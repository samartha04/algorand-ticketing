"use client";

import { useWallet } from '@txnlab/use-wallet';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import algosdk from 'algosdk';
import { executeATC, dummySigner } from '@/utils/signer';

interface EventInfo {
    appId: number;
    name: string;
    price: number;
    supply: number;
    sold: number;
    organizer: string;
}

// Skeleton loader
function EventCardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
            <div className="h-36 bg-gray-100" />
            <div className="p-5 space-y-3">
                <div className="h-5 bg-gray-100 rounded-lg w-3/4" />
                <div className="h-4 bg-gray-50 rounded-lg w-1/2" />
                <div className="h-2 bg-gray-50 rounded-full w-full mt-4" />
                <div className="h-10 bg-gray-100 rounded-xl w-full mt-3" />
            </div>
        </div>
    );
}

// Gradient banners for events
const eventGradients = [
    'linear-gradient(135deg, #685AFF, #a855f7)',
    'linear-gradient(135deg, #FF5B5B, #FF8C42)',
    'linear-gradient(135deg, #4A9EFF, #685AFF)',
    'linear-gradient(135deg, #10b981, #4A9EFF)',
    'linear-gradient(135deg, #F59E0B, #FF5B5B)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
];

function getEventGradient(name: string) {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return eventGradients[hash % eventGradients.length];
}

export default function MarketplacePage() {
    const { activeAccount, signTransactions } = useWallet();
    const [events, setEvents] = useState<EventInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [factoryAppId, setFactoryAppId] = useState<number>(0);
    const [buyingEventId, setBuyingEventId] = useState<number | null>(null);

    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);

    const fetchEvents = async () => {
        if (factoryAppId === 0) { setStatus("Enter a Factory ID to discover events"); return; }
        setIsLoading(true);
        setStatus('');
        setEvents([]);
        try {
            const appInfo = await algodClient.getApplicationByID(factoryAppId).do();
            const globalState = appInfo.params["global-state"];
            const countState = globalState?.find((s: any) => s.key === btoa("event_count")) ?? globalState?.find((s: any) => s.key === btoa("EventCount"));
            if (!countState) {
                setStatus(`Error: This App ID (${factoryAppId}) is not a valid Event Factory.`);
                return;
            }
            const eventCount = countState.value.uint;
            const fetchedEvents: EventInfo[] = [];
            const eventsPrefix = new TextEncoder().encode("events");
            for (let i = 0; i < eventCount; i++) {
                try {
                    const rawKey = algosdk.encodeUint64(i);
                    const boxKey = new Uint8Array(eventsPrefix.length + rawKey.length);
                    boxKey.set(eventsPrefix, 0);
                    boxKey.set(rawKey, eventsPrefix.length);
                    const box = await algodClient.getApplicationBoxByName(factoryAppId, boxKey).do();
                    const id = algosdk.decodeUint64(box.value.slice(0, 8), 'safe');
                    const nameLen = (box.value[8] << 8) | box.value[9];
                    const name = new TextDecoder().decode(box.value.slice(10, 10 + nameLen));
                    const eventAppInfo = await algodClient.getApplicationByID(Number(id)).do();
                    const eventGlobalState = eventAppInfo.params["global-state"];
                    const getGlobalInt = (key: string) => { const k = btoa(key); const s = eventGlobalState?.find((x: any) => x.key === k); return s ? s.value.uint : 0; };
                    const getGlobalBytes = (key: string) => { const k = btoa(key); const s = eventGlobalState?.find((x: any) => x.key === k); return s ? s.value.bytes : ''; };
                    const price = getGlobalInt("Price");
                    const supply = getGlobalInt("Supply");
                    const sold = getGlobalInt("Sold");
                    const organizerBase64 = getGlobalBytes("Organizer");
                    let organizer = "";
                    if (organizerBase64) { const bin = atob(organizerBase64); const arr = new Uint8Array(bin.length); for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j); organizer = algosdk.encodeAddress(arr); }
                    fetchedEvents.push({ appId: Number(id), name, price, supply, sold, organizer });
                } catch (e) { console.error(`Error fetching event ${i}`, e); }
            }
            setEvents(fetchedEvents);
            if (fetchedEvents.length === 0) setStatus('No events found in this factory');
        } catch (error: any) { console.error(error); setStatus(`Error: ${error.message}`); }
        finally { setIsLoading(false); }
    };

    const buyTicket = async (event: EventInfo) => {
        if (!activeAccount) { setStatus("Connect your wallet first"); return; }
        setBuyingEventId(event.appId);
        setStatus('');
        try {
            // Re-fetch current Sold and Price from chain to avoid stale data and wrong box key
            const appInfo = await algodClient.getApplicationByID(event.appId).do();
            const globalState = appInfo.params['global-state'];
            let currentSold = 0;
            let currentPrice = event.price;
            globalState.forEach((item: any) => {
                const key = Buffer.from(item.key, 'base64').toString();
                if (key === 'Sold') currentSold = item.value.uint;
                if (key === 'Price') currentPrice = item.value.uint;
            });
            const supply = event.supply;
            if (currentSold >= supply) {
                setStatus('Event is sold out.');
                return;
            }
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('buy_ticket');
            const params = await algodClient.getTransactionParams().do();
            const eventAppAddr = algosdk.getApplicationAddress(event.appId);
            const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ from: activeAccount.address, to: eventAppAddr, amount: currentPrice, suggestedParams: params });
            const atc = new algosdk.AtomicTransactionComposer();
            const sp = { ...params, fee: 3000, flatFee: true };
            // Contract increments Sold first, then writes to "tickets" + newSold
            const ticketsPrefix = new TextEncoder().encode("tickets");
            const rawKey = algosdk.encodeUint64(currentSold + 1);
            const boxKey = new Uint8Array(ticketsPrefix.length + rawKey.length);
            boxKey.set(ticketsPrefix, 0);
            boxKey.set(rawKey, ticketsPrefix.length);
            atc.addMethodCall({ appID: event.appId, method, methodArgs: [{ txn: payTxn, signer: dummySigner }], boxes: [{ appIndex: 0, name: boxKey }], sender: activeAccount.address, signer: dummySigner, suggestedParams: sp });
            await executeATC(atc, algodClient, signTransactions);
            setStatus(`🎉 Ticket purchased for "${event.name}"! Check My Tickets to claim.`);
            fetchEvents();
        } catch (e: any) { console.error(e); setStatus(`Purchase failed: ${e.message}`); }
        finally { setBuyingEventId(null); }
    };


    return (
        <div className="min-h-screen bg-white">
            {/* Hero */}
            <section className="relative py-16 md:py-20 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-[0.07] blur-3xl" style={{ background: 'radial-gradient(circle, #685AFF, transparent 70%)' }} />
                <div className="container px-4 md:px-6 relative z-10">
                    <div className="text-center max-w-2xl mx-auto">
                        <p className="text-sm font-bold text-[#685AFF] uppercase tracking-wider mb-3">Marketplace</p>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                            Discover{' '}
                            <span className="text-gradient-brand">Amazing Events</span>
                        </h1>
                        <p className="text-gray-500 text-lg">
                            Buy NFT tickets to live events. Secured on Algorand.
                        </p>
                    </div>
                </div>
            </section>

            {/* Search */}
            <section className="pb-8">
                <div className="container px-4 md:px-6">
                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-center max-w-md mx-auto">
                        <input
                            className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#685AFF]/30 focus:border-[#685AFF] transition-all text-sm"
                            type="number"
                            placeholder="Enter Factory App ID"
                            value={factoryAppId || ''}
                            onChange={(e) => setFactoryAppId(parseInt(e.target.value) || 0)}
                        />
                        <Button
                            onClick={fetchEvents}
                            disabled={isLoading}
                            className="gradient-purple text-white shadow-brand whitespace-nowrap px-8"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                    Loading...
                                </span>
                            ) : 'Search'}
                        </Button>
                    </div>
                    {status && (
                        <p className={`text-center mt-4 text-sm font-medium ${status.includes('🎉') ? 'text-green-600' : status.includes('Error') || status.includes('failed') ? 'text-[#FF5B5B]' : 'text-gray-400'}`}>
                            {status}
                        </p>
                    )}
                </div>
            </section>

            {/* Events Grid */}
            <section className="py-8 pb-24">
                <div className="container px-4 md:px-6">
                    {isLoading ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3, 4, 5, 6].map(i => <EventCardSkeleton key={i} />)}
                        </div>
                    ) : events.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {events.map((event) => {
                                const soldOut = event.sold >= event.supply;
                                const pct = Math.round((event.sold / event.supply) * 100);
                                return (
                                    <div
                                        key={event.appId}
                                        className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:shadow-[#685AFF]/10 transition-all duration-300 hover:-translate-y-1"
                                    >
                                        {/* Banner */}
                                        <div className="h-36 relative overflow-hidden" style={{ background: getEventGradient(event.name) }}>
                                            <div className="absolute inset-0 bg-black/10" />
                                            {/* Remaining badge */}
                                            <div className="absolute top-3 right-3">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${soldOut ? 'bg-gray-900/60 text-white' : 'bg-white/90 text-gray-800'}`}>
                                                    {soldOut ? 'Sold Out' : `${event.supply - event.sold} left`}
                                                </span>
                                            </div>
                                            {/* Event icon */}
                                            <div className="absolute bottom-3 left-4">
                                                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-5">
                                            <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-[#685AFF] transition-colors">
                                                {event.name}
                                            </h3>
                                            <p className="text-xs text-gray-400 font-mono mb-4">
                                                App ID: {event.appId}
                                            </p>

                                            {/* Price */}
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-sm text-gray-400">Price</span>
                                                <span className="text-xl font-extrabold text-gray-900">
                                                    {(event.price / 1000000).toFixed(2)}
                                                    <span className="text-sm font-semibold text-[#685AFF] ml-1">ALGO</span>
                                                </span>
                                            </div>

                                            {/* Progress */}
                                            <div className="mb-4">
                                                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                                                    <span>{event.sold} sold</span>
                                                    <span>{pct}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-700"
                                                        style={{ width: `${pct}%`, background: getEventGradient(event.name) }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Buy Button */}
                                            <Button
                                                className={`w-full ${soldOut ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'gradient-purple text-white shadow-brand hover:shadow-brand-lg'}`}
                                                onClick={() => buyTicket(event)}
                                                disabled={buyingEventId === event.appId || !activeAccount || soldOut}
                                            >
                                                {buyingEventId === event.appId ? (
                                                    <span className="flex items-center gap-2">
                                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                                        Processing...
                                                    </span>
                                                ) : soldOut ? 'Sold Out' : 'Buy Ticket →'}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Empty State */
                        <div className="text-center py-20">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#E8E5FF] flex items-center justify-center">
                                <svg className="w-10 h-10 text-[#685AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">No Events Yet</h3>
                            <p className="text-gray-400 max-w-sm mx-auto">
                                Enter a Factory App ID above to discover events
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
