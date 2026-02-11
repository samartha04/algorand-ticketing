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

    const checkIn = async () => {
        if (!activeAccount || !appId || !ticketId) { setStatus("Fill all fields"); return; }
        setIsLoading(true); setStatus("");
        try {
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('check_in');
            const atc = new algosdk.AtomicTransactionComposer();
            const ticketsPrefix = new TextEncoder().encode("tickets");
            const rawKey = algosdk.encodeUint64(parseInt(ticketId));
            const boxKey = new Uint8Array(ticketsPrefix.length + rawKey.length);
            boxKey.set(ticketsPrefix, 0);
            boxKey.set(rawKey, ticketsPrefix.length);
            atc.addMethodCall({ appID: parseInt(appId), method, methodArgs: [parseInt(ticketId)], boxes: [{ appIndex: 0, name: boxKey }], sender: activeAccount.address, signer: dummySigner, suggestedParams: await algodClient.getTransactionParams().do() });
            await executeATC(atc, algodClient, signTransactions);
            setStatus(`✓ Ticket ${ticketId} verified!`);
        } catch (error: any) { console.error(error); setStatus(`✗ Failed: ${error.message}`); }
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
                        </div>

                        {activeTab === 'verify' && (
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-800">Ticket Asset ID</label>
                                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#685AFF]/30 focus:border-[#685AFF] transition-all text-sm" value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="From attendee's QR code" type="number" />
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
