"use client";

import { useWallet } from '@txnlab/use-wallet';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import algosdk from 'algosdk';
import { executeATC, dummySigner } from '@/utils/signer';

export default function OrganizerDashboard() {
    const { activeAccount, signTransactions } = useWallet();
    const [appId, setAppId] = useState('');
    const [ticketId, setTicketId] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'verify' | 'withdraw'>('verify');
    const [contractBalance, setContractBalance] = useState<number | null>(null);

    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);

    const fetchContractBalance = async () => {
        if (!appId) return;
        try { const appAddr = algosdk.getApplicationAddress(parseInt(appId)); const info = await algodClient.accountInformation(appAddr).do(); setContractBalance(info.amount / 1000000); } catch (e) { setContractBalance(null); }
    };

    const decodeBoxValue = (raw: string | Uint8Array): Uint8Array =>
        typeof raw === 'string' ? new Uint8Array(Uint8Array.from(atob(raw), c => c.charCodeAt(0))) : new Uint8Array(raw);

    const checkIn = async () => {
        if (!activeAccount || !appId || !ticketId) { setStatus("Fill all fields"); return; }
        const ticketIdInput = parseInt(ticketId, 10);
        if (!Number.isInteger(ticketIdInput) || ticketIdInput < 1) {
            setStatus("Enter a valid Ticket # (index) or Asset ID from the attendee's QR.");
            return;
        }
        setIsLoading(true); setStatus("");
        try {
            const appID = parseInt(appId);
            const ticketsPrefix = new TextEncoder().encode("tickets");

            // Resolve input to (ticketIndex, boxValue): accept either ticket index (1,2,3...) or asset ID
            let resolvedIndex: number;
            let boxValue: Uint8Array;

            const tryBox = async (index: number): Promise<Uint8Array | null> => {
                const rawKey = algosdk.encodeUint64(index);
                const key = new Uint8Array(ticketsPrefix.length + rawKey.length);
                key.set(ticketsPrefix, 0);
                key.set(rawKey, ticketsPrefix.length);
                try {
                    const boxResp = await algodClient.getApplicationBoxByName(appID, key).do();
                    return decodeBoxValue(boxResp.value);
                } catch {
                    return null;
                }
            };

            const boxAtInput = await tryBox(ticketIdInput);
            if (boxAtInput && boxAtInput.length >= 41) {
                resolvedIndex = ticketIdInput;
                boxValue = boxAtInput;
            } else if (ticketIdInput > 1000) {
                // Likely an asset ID: find which ticket index has this asset
                const appInfo = await algodClient.getApplicationByID(appID).do();
                const gs = appInfo.params['global-state'] || [];
                const soldKey = btoa('Sold');
                const soldState = gs.find((s: { key: string }) => s.key === soldKey);
                const sold = soldState ? soldState.value.uint : 0;
                let found = false;
                for (let i = 1; i <= sold; i++) {
                    const bv = await tryBox(i);
                    if (bv && bv.length >= 8) {
                        const assetIdInBox = Number(algosdk.decodeUint64(bv.slice(0, 8), 'safe'));
                        if (assetIdInBox === ticketIdInput) {
                            resolvedIndex = i;
                            boxValue = bv;
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) {
                    setStatus(`✗ No ticket with Asset ID ${ticketIdInput} for this event. Check Event App ID is correct.`);
                    return;
                }
            } else {
                setStatus(`✗ No ticket #${ticketIdInput} for this event. You can enter Ticket # (1, 2, 3...) or the Asset ID from the QR.`);
                return;
            }

            // Box layout: 8 assetId, 32 owner, 1 status (0=pending, 1=claimed, 2=used)
            const statusByte = boxValue.length > 40 ? boxValue[40] : 0;
            if (statusByte === 0) {
                setStatus("✗ Ticket not claimed yet. Attendee must claim the ticket in My Tickets first.");
                return;
            }
            if (statusByte === 2) {
                setStatus("✗ Ticket already used (already checked in).");
                return;
            }

            const rawKey = algosdk.encodeUint64(resolvedIndex);
            const boxKey = new Uint8Array(ticketsPrefix.length + rawKey.length);
            boxKey.set(ticketsPrefix, 0);
            boxKey.set(rawKey, ticketsPrefix.length);

            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('check_in');
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addMethodCall({ appID, method, methodArgs: [resolvedIndex], boxes: [{ appIndex: 0, name: boxKey }], sender: activeAccount.address, signer: dummySigner, suggestedParams: await algodClient.getTransactionParams().do() });
            await executeATC(atc, algodClient, signTransactions);
            setStatus(`✓ Ticket verified! (index ${resolvedIndex})`);
        } catch (error: any) {
            console.error(error);
            const msg = String(error?.message ?? error);
            if (msg.includes("assert failed") || msg.includes("pc=505") || msg.includes("load 6")) {
                setStatus("✗ Ticket not found or invalid. Check Event App ID and Ticket # or Asset ID.");
            } else {
                setStatus(`✗ Failed: ${msg}`);
            }
        }
        finally { setIsLoading(false); }
    };

    const withdrawFunds = async () => {
        if (!activeAccount || !appId || !withdrawAmount) { setStatus("Fill all fields"); return; }
        setIsLoading(true); setStatus("");
        try {
            const amountMicro = Math.floor(parseFloat(withdrawAmount) * 1000000);
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('withdraw_funds');
            const atc = new algosdk.AtomicTransactionComposer();
            const sp = await algodClient.getTransactionParams().do(); sp.fee = 2000; sp.flatFee = true;
            atc.addMethodCall({ appID: parseInt(appId), method, methodArgs: [amountMicro], sender: activeAccount.address, signer: dummySigner, suggestedParams: sp });
            await executeATC(atc, algodClient, signTransactions);
            setStatus(`✓ Withdrew ${withdrawAmount} ALGO!`);
            fetchContractBalance();
        } catch (error: any) { console.error(error); setStatus(`✗ Failed: ${error.message}`); }
        finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-screen bg-white py-12 md:py-16">
            <div className="container px-4 md:px-6 mb-10">
                <div className="text-center">
                    <p className="text-sm font-bold text-[#FF5B5B] uppercase tracking-wider mb-3">Organizer</p>
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">Dashboard</h1>
                    <p className="text-gray-400 max-w-md mx-auto">Verify tickets at the door and withdraw your earnings</p>
                </div>
            </div>

            <div className="container px-4 md:px-6">
                {/* Tabs */}
                <div className="flex gap-2 justify-center mb-8">
                    <button onClick={() => { setActiveTab('verify'); setStatus(''); }} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'verify' ? 'bg-[#FF5B5B] text-white shadow-md shadow-[#FF5B5B]/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Verify
                    </button>
                    <button onClick={() => { setActiveTab('withdraw'); setStatus(''); fetchContractBalance(); }} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'withdraw' ? 'bg-green-600 text-white shadow-md shadow-green-600/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Withdraw
                    </button>
                </div>

                <div className="max-w-xl mx-auto bg-white border border-gray-100 rounded-3xl shadow-xl shadow-gray-100/50 p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${activeTab === 'verify' ? 'bg-[#FF5B5B]' : 'bg-green-600'}`}>
                            {activeTab === 'verify' ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2" /></svg>
                            )}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{activeTab === 'verify' ? 'Check-In Attendee' : 'Withdraw Revenue'}</h2>
                            <p className="text-xs text-gray-400">{activeTab === 'verify' ? 'Validate a ticket from a QR scan' : 'Transfer sales to your wallet'}</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-800">Event App ID</label>
                            <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#685AFF]/30 focus:border-[#685AFF] transition-all text-sm" value={appId} onChange={(e) => { setAppId(e.target.value); if (activeTab === 'withdraw') fetchContractBalance(); }} placeholder="e.g. 755123456" type="number" />
                            <p className="text-xs text-gray-500">Use the <strong>event</strong> app ID (from the event page URL), not the Factory ID.</p>
                        </div>

                        {activeTab === 'verify' && (
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-800">Ticket # or Asset ID</label>
                                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#685AFF]/30 focus:border-[#685AFF] transition-all text-sm" value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="e.g. 1 or 755496986 (from QR)" type="number" min={1} />
                                <p className="text-xs text-gray-500">From the attendee&apos;s QR: use <code>ticketIndex</code> (1, 2, 3…) or <code>assetId</code> — both work.</p>
                            </div>
                        )}

                        {activeTab === 'withdraw' && (
                            <>
                                {contractBalance !== null && (
                                    <div className="p-4 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-between">
                                        <span className="text-sm text-green-700 font-medium">Contract Balance</span>
                                        <span className="text-2xl font-extrabold text-green-700">{contractBalance.toFixed(4)} <span className="text-sm">ALGO</span></span>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-800">Amount (ALGO)</label>
                                    <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all text-sm" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="e.g. 10.5" type="number" step="0.1" />
                                    <p className="text-xs text-gray-400">Leave ~0.2 ALGO for minimum balance</p>
                                </div>
                            </>
                        )}

                        <Button onClick={activeTab === 'verify' ? checkIn : withdrawFunds} disabled={isLoading || !activeAccount} className={`w-full h-14 text-base rounded-2xl ${activeTab === 'verify' ? 'bg-[#FF5B5B] hover:bg-[#e64d4d] text-white shadow-md shadow-[#FF5B5B]/20' : 'bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-600/20'}`}>
                            {isLoading ? (
                                <span className="flex items-center gap-3"><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Processing...</span>
                            ) : !activeAccount ? 'Connect Wallet' : activeTab === 'verify' ? 'Verify & Check-In →' : 'Withdraw Funds →'}
                        </Button>

                        {status && (
                            <div className={`p-4 rounded-xl text-sm font-medium ${status.includes('✓') ? 'bg-green-50 text-green-700 border border-green-200' : status.includes('✗') ? 'bg-red-50 text-[#FF5B5B] border border-red-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>{status}</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
