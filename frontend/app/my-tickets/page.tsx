"use client";

import { useWallet } from '@txnlab/use-wallet';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import algosdk from 'algosdk';
import { QRCodeCanvas } from 'qrcode.react';
import { executeATC, dummySigner } from '@/utils/signer';
import { useTxStatus } from '@/components/TxStatus';
import TxConfirm from '@/components/TxConfirm';
import ResaleModal from '@/components/ResaleModal';
import RefundModal from '@/components/RefundModal';
import { fetchAllEvents } from '@/utils/events';

interface Ticket {
    assetId: number;
    eventName: string;
    appId: number;
    status: 'pending' | 'claimed' | 'used' | 'listed' | 'cancelled';
    index: number;
    resalePrice?: number;
}

function TicketSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
            <div className="h-2 bg-gray-100 rounded-full" />
            <div className="p-6 space-y-4">
                <div className="h-5 bg-gray-100 rounded-lg w-3/4" />
                <div className="h-4 bg-gray-50 rounded-lg w-1/2" />
                <div className="h-10 bg-gray-100 rounded-xl w-full mt-4" />
            </div>
        </div>
    );
}

const statusConfig = {
    pending: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Pending Claim', btnClass: 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20' },
    claimed: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', dot: 'bg-green-500', label: 'Ready to Use', btnClass: 'gradient-purple text-white shadow-brand' },
    used: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', dot: 'bg-gray-400', label: 'Used', btnClass: 'bg-gray-100 text-gray-400' },
    listed: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', dot: 'bg-blue-500', label: 'Listed for Resale', btnClass: 'bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', dot: 'bg-red-500', label: 'Cancelled', btnClass: 'bg-gray-100 text-gray-400' },
};

export default function MyTicketsPage() {
    const { activeAccount, signTransactions } = useWallet();
    const { setStatus: setTxStatus } = useTxStatus();
    const [factoryAppId, setFactoryAppId] = useState<number>(0);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmData, setConfirmData] = useState<{ amount?: number; fee?: number; reserve?: number; } | null>(null);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [claimingId, setClaimingId] = useState<number | null>(null);
    const [copiedTicketId, setCopiedTicketId] = useState(false);
    const [refundTicket, setRefundTicket] = useState<Ticket | null>(null);
    const [resaleTicket, setResaleTicket] = useState<Ticket | null>(null);

    const indexerClient = new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud', 443);
    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);

    useEffect(() => {
        if (activeAccount) {
            fetchAll();
        }
    }, [activeAccount]);

    const copyTicketId = () => {
        if (selectedTicket) {
            navigator.clipboard.writeText(selectedTicket.index.toString());
            setCopiedTicketId(true);
            setTimeout(() => setCopiedTicketId(false), 2000);
        }
    };

    const fetchAll = async () => {
        if (!activeAccount) { setStatus('Connect wallet first'); return; }
        setIsLoading(true); setStatus(''); setTickets([]);

        try {
            const eventMap = new Map<string, { appId: number, name: string }>();

            // 1. Add Locally Deployed Events (Dev convenience)
            try {
                const localEvents = JSON.parse(localStorage.getItem('deployedEvents') || '[]');
                for (const ev of localEvents) {
                    if (ev.eventId) {
                        const addr = algosdk.getApplicationAddress(ev.eventId);
                        eventMap.set(addr, { appId: ev.eventId, name: ev.eventName || `Event ${ev.eventId}` });
                    }
                }
            } catch (e) {
                console.warn('Error reading local events:', e);
            }

            // 2. Add Manually Entered ID (Factory OR Event)
            if (factoryAppId > 0) {
                try {
                    const appInfo = await algodClient.getApplicationByID(factoryAppId).do();
                    const globalState = appInfo.params["global-state"] || [];

                    // Check if Factory (has event_count)
                    const countState = globalState.find((s: any) => s.key === btoa("event_count") || s.key === btoa("EventCount"));

                    if (countState) {
                        // It's a Factory
                        const eventCount = countState.value.uint;
                        for (let i = 0; i < eventCount; i++) {
                            try {
                                const boxKey = algosdk.encodeUint64(i);
                                const box = await algodClient.getApplicationBoxByName(factoryAppId, boxKey).do();
                                const id = algosdk.decodeUint64(box.value.slice(0, 8), 'safe');
                                const name = new TextDecoder().decode(box.value.slice(8));
                                const addr = algosdk.getApplicationAddress(id);
                                eventMap.set(addr, { appId: Number(id), name });
                            } catch (e: any) { }
                        }
                    } else {
                        // It's likely an Event Contract directly
                        // Try to get name? Or just use ID
                        const addr = algosdk.getApplicationAddress(factoryAppId);
                        eventMap.set(addr, { appId: factoryAppId, name: `Event ${factoryAppId}` });
                    }
                } catch (e: any) {
                    console.error('Error fetching app info:', e);
                    setStatus(`Error fetching ID ${factoryAppId}: ${e.message}`);
                }
            }

            // 3. Scan Found Events (Unified Strategy: Box Scan)
            const myTickets: any[] = [];
            const addedAssetIds = new Set<number>();

            // Fetch user's actual assets to check holding status
            const userAssets = await indexerClient.lookupAccountAssets(activeAccount.address).limit(1000).do();
            const myAssetIds = new Set(userAssets.assets.filter((a: any) => a.amount > 0).map((a: any) => a['asset-id']));

            console.log(`User holds ${myAssetIds.size} assets. Scanning events...`);

            for (const [appAddr, info] of Array.from(eventMap.entries())) {
                try {
                    // Fetch all boxes for this event
                    const boxesResponse = await algodClient.getApplicationBoxes(info.appId).do();

                    // Parallel fetch box values
                    const promises = boxesResponse.boxes.map((boxDesc: any) =>
                        algodClient.getApplicationBoxByName(info.appId, boxDesc.name).do()
                            .then(box => ({ name: boxDesc.name, box }))
                            .catch(() => null)
                    );

                    const results = await Promise.all(promises);

                    for (const res of results) {
                        if (!res) continue;
                        let { name, box } = res;

                        // Parse Box Name to get Index
                        // Box Name: "tickets" (7 bytes) + Index (8 bytes) = 15 bytes
                        if (name.length !== 15) continue; // Ignore other boxes

                        // Check prefix "tickets"
                        const prefix = new TextDecoder().decode(name.slice(0, 7));
                        if (prefix !== "tickets") continue;

                        const ticketIndex = algosdk.decodeUint64(name.slice(7), 'safe');

                        // Parse Box Value
                        // [AssetID 8][Owner 32][Status 1][ResalePrice 8]
                        if (box.value.length < 41) continue;

                        const assetId = algosdk.decodeUint64(box.value.slice(0, 8), 'safe');
                        const owner = algosdk.encodeAddress(box.value.slice(8, 40));
                        const statusByte = box.value[40];
                        const resalePrice = box.value.length >= 49 ? algosdk.decodeUint64(box.value.slice(41, 49), 'safe') : 0;

                        // Match Criteria: Am I the Owner (Box Record) OR Do I hold the Asset?
                        const isOwner = owner === activeAccount.address;
                        const isHolder = myAssetIds.has(Number(assetId));

                        if (isOwner || isHolder) {
                            const status = statusByte === 0 ? 'pending' : statusByte === 1 ? 'claimed' : statusByte === 2 ? 'used' : statusByte === 3 ? 'listed' : 'cancelled';

                            // Deduplicate
                            if (addedAssetIds.has(Number(assetId))) continue;

                            myTickets.push({
                                index: Number(ticketIndex),
                                assetId: Number(assetId),
                                eventName: info.name,
                                appId: info.appId,
                                status,
                                resalePrice: Number(resalePrice)
                            });
                            addedAssetIds.add(Number(assetId));
                        }
                    }
                } catch (e: any) {
                    console.error(`Error scanning app ${info.appId}:`, e);
                }
            }

            setTickets(myTickets);
            if (myTickets.length === 0) {
                setStatus(
                    eventMap.size === 0
                        ? 'No events found. Enter a Factory or Event App ID, or deploy an event locally.'
                        : 'No tickets found for the discovered events.'
                );
            } else {
                setStatus(`Found ${myTickets.length} ticket${myTickets.length === 1 ? '' : 's'}`);
            }
        } catch (e: any) {
            console.error('Error in fetchAll:', e);
            setStatus(`Error fetching tickets: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper function to get ticket status from box
    const getTicketStatusFromBox = async (appId: number, assetId: number): Promise<'pending' | 'claimed' | 'used' | 'listed' | 'cancelled'> => {
        try {
            // Try to get the box for this asset ID
            const assetIdBytes = algosdk.encodeUint64(assetId);
            const box = await algodClient.getApplicationBoxByName(appId, assetIdBytes).do();

            if (box.value.length >= 41) { // TicketInfo is 41 bytes: owner(32) + status(1) + resale_price(8)
                const owner = algosdk.encodeAddress(box.value.slice(0, 32));
                const statusByte = box.value[32]; // Status is at byte 32

                console.log(`Ticket ${assetId} - Box Owner: ${owner}, User: ${activeAccount?.address}, Status: ${statusByte}`);

                // Only return status if this ticket actually belongs to the current user
                if (owner === activeAccount?.address) {
                    return statusByte === 0 ? 'pending' : statusByte === 1 ? 'claimed' : statusByte === 2 ? 'used' : statusByte === 3 ? 'listed' : 'cancelled';
                } else {
                    console.log(`Ticket ${assetId} belongs to ${owner}, not current user ${activeAccount?.address}`);
                    return 'cancelled'; // Mark as cancelled so it won't show cancel button
                }
            }
        } catch (e: any) {
            console.log(`Could not get status for ticket ${assetId} from box, trying fallback:`, e);
            return 'pending';
        }
        return 'cancelled'; // Default to cancelled if we can't verify ownership
    };
    const claimTicket = async (ticket: Ticket) => {
        if (!activeAccount) return;
        // show confirmation: opt-in will lock ~0.1 ALGO + fees
        setConfirmData({ amount: 0, fee: 0.002 + 0.001, reserve: 0.1 });
        setConfirmOpen(true);
        // store ticket in temp to act on after confirmation
        (window as any).__pendingClaimTicket = ticket;
        return;
    };

    const claimTicketConfirmed = async (ticket?: Ticket) => {
        const t = ticket || (window as any).__pendingClaimTicket as Ticket;
        if (!t) return;
        if (!activeAccount) { setStatus('Connect wallet and try again'); setConfirmOpen(false); delete (window as any).__pendingClaimTicket; return; }
        setClaimingId(t.assetId);
        try {
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('claim_ticket');
            const atc = new algosdk.AtomicTransactionComposer();
            const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ from: activeAccount.address, to: activeAccount.address, assetIndex: t.assetId, amount: 0, suggestedParams: await algodClient.getTransactionParams().do() });
            atc.addTransaction({ txn: optInTxn, signer: dummySigner });
            const sp = await algodClient.getTransactionParams().do(); sp.fee = 2000; sp.flatFee = true;

            // Fix: Use tickets prefix and ticket index
            const ticketsPrefix = new TextEncoder().encode("tickets");
            const rawKey = algosdk.encodeUint64(t.index);
            const claimBoxKey = new Uint8Array(ticketsPrefix.length + rawKey.length);
            claimBoxKey.set(ticketsPrefix, 0);
            claimBoxKey.set(rawKey, ticketsPrefix.length);

            // Inner axfer: asset must be in foreign assets array; receiver must be in accounts array
            atc.addMethodCall({
                appID: t.appId,
                method,
                methodArgs: [t.index],
                boxes: [{ appIndex: 0, name: claimBoxKey }],
                appAccounts: [activeAccount.address],
                appForeignAssets: [t.assetId],
                sender: activeAccount.address,
                signer: dummySigner,
                suggestedParams: sp
            });

            await executeATC(atc, algodClient, signTransactions, 4, (s) => {
                if (s.state === 'pending') setTxStatus({ state: 'pending', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                if (s.state === 'success') setTxStatus({ state: 'success', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                if (s.state === 'failed') setTxStatus({ state: 'failed', message: s.message });
            });
            setStatus('🎉 Ticket claimed!');
            fetchAll();
        } catch (e: any) { console.error(e); setStatus(`Claim failed: ${e.message}`); }
        finally { setClaimingId(null); delete (window as any).__pendingClaimTicket; setConfirmOpen(false); }
    };

    const cancelTicket = async (ticket: Ticket) => {
        if (!activeAccount) return;
        setRefundTicket(ticket);
    };

    useEffect(() => {
        if (activeAccount) {
            fetchAll();
        }
    }, [activeAccount]);

    return (
        <div className="min-h-screen bg-white">
            <TxConfirm open={confirmOpen} title="Confirm Claim" message="Claiming will opt-in to the asset and lock an estimated reserve." amountALGO={confirmData?.amount} feeALGO={confirmData?.fee} reserveALGO={confirmData?.reserve} onCancel={() => setConfirmOpen(false)} onConfirm={async () => { await claimTicketConfirmed(); }} />
            {/* Hero */}
            <section className="relative py-16 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07] blur-3xl" style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }} />
                <div className="container px-4 md:px-6 relative z-10 text-center">
                    <p className="text-sm font-bold text-green-600 uppercase tracking-wider mb-3">Wallet</p>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                        My Tickets
                    </h1>
                    <p className="text-gray-400 max-w-lg mx-auto">Manage your NFT tickets. Claim pending tickets and show QR codes for entry.</p>
                </div>
            </section>

            {/* Search */}
            <section className="pb-8">
                <div className="container px-4 md:px-6">
                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-center max-w-md mx-auto">
                        <input className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all text-sm" type="number" placeholder="Factory or Event App ID" value={factoryAppId || ''} onChange={(e) => setFactoryAppId(parseInt(e.target.value) || 0)} />
                        <Button onClick={fetchAll} disabled={isLoading || !activeAccount} className="bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-600/20 whitespace-nowrap px-8">
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                    Loading...
                                </span>
                            ) : 'Load Tickets'}
                        </Button>
                    </div>
                    {!activeAccount && <p className="text-center mt-4 text-sm text-amber-500 font-medium">Connect your wallet first</p>}
                    {status && <p className={`text-center mt-4 text-sm font-medium ${status.includes('🎉') ? 'text-green-600' : status.includes('Error') || status.includes('failed') ? 'text-[#FF5B5B]' : 'text-gray-400'}`}>{status}</p>}
                </div>
            </section>

            {/* Tickets Grid */}
            <section className="py-8 pb-24">
                <div className="container px-4 md:px-6">
                    {isLoading ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(i => <TicketSkeleton key={i} />)}</div>
                    ) : tickets.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {tickets.map((ticket) => {
                                const cfg = statusConfig[ticket.status];
                                return (
                                    <div key={ticket.assetId} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 hover:-translate-y-1">
                                        {/* Status bar */}
                                        <div className={`h-1.5 ${ticket.status === 'pending' ? 'bg-amber-400' : ticket.status === 'claimed' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                        <div className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#685AFF] transition-colors">{ticket.eventName}</h3>
                                                    <p className="text-xs text-gray-400 font-mono">Ticket #{ticket.index} (Asset {ticket.assetId})</p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text} ${cfg.border} border flex items-center gap-1.5`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                    {cfg.label}
                                                </span>
                                            </div>

                                            {ticket.status === 'pending' ? (
                                                <div className="space-y-2">
                                                    <Button className={`w-full ${cfg.btnClass}`} onClick={() => claimTicket(ticket)} disabled={claimingId === ticket.assetId}>
                                                        {claimingId === ticket.assetId ? (
                                                            <span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Claiming...</span>
                                                        ) : 'Claim Ticket →'}
                                                    </Button>
                                                    <button onClick={() => cancelTicket(ticket)} className="w-full px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors">
                                                        Cancel & Refund
                                                    </button>
                                                </div>
                                            ) : ticket.status === 'claimed' ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Button className={`w-full ${cfg.btnClass}`} onClick={() => setSelectedTicket(ticket)}>
                                                        Show QR
                                                    </Button>
                                                    <Button onClick={() => setResaleTicket(ticket)} className="bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20">
                                                        Resale
                                                    </Button>
                                                    <Button onClick={() => cancelTicket(ticket)} className="col-span-2 w-full px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors border border-red-100">
                                                        Cancel & Refund
                                                    </Button>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-green-50 flex items-center justify-center">
                                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">No Tickets Yet</h3>
                            <p className="text-gray-400 max-w-sm mx-auto">Purchase tickets from the Marketplace and they'll show up here</p>
                        </div>
                    )}
                </div>
            </section>

            {/* QR Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedTicket(null)}>
                    <div className="bg-white p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl animate-scale-in relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedTicket(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all">✕</button>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full mb-4">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Entry Pass
                        </div>
                        <h3 className="text-2xl font-extrabold text-gray-900 mb-6">{selectedTicket.eventName}</h3>
                        <div className="p-5 bg-gray-50 rounded-2xl inline-block mb-6">
                            <QRCodeCanvas value={JSON.stringify({ appId: selectedTicket.appId, assetId: selectedTicket.assetId, ticketIndex: selectedTicket.index })} size={200} level={"H"} includeMargin={true} />
                        </div>

                        {/* Ticket ID Section */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Your Ticket ID</div>
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-3xl font-extrabold text-blue-600">{selectedTicket.index}</div>
                                <button
                                    onClick={copyTicketId}
                                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all whitespace-nowrap"
                                >
                                    {copiedTicketId ? '✓ Copied' : 'Copy'}
                                </button>
                            </div>
                            <p className="text-xs text-blue-600 mt-3">Use this number for check-in at the entrance</p>
                        </div>

                        <p className="text-xs text-gray-400 pt-3 border-t border-gray-100">Present this QR code at the entrance for verification</p>
                    </div>
                </div>
            )}

            {/* Refund Modal */}
            {refundTicket && (
                <RefundModal
                    isOpen={true}
                    ticket={refundTicket}
                    onClose={() => setRefundTicket(null)}
                />
            )}

            {/* Resale Modal */}
            {resaleTicket && (
                <ResaleModal
                    isOpen={true}
                    ticket={resaleTicket}
                    onClose={() => setResaleTicket(null)}
                />
            )}
        </div>
    );
}
