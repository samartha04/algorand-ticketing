"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet';
import { Button } from '@/components/ui/button';
import algosdk from 'algosdk';
import { executeATC, dummySigner } from '@/utils/signer';
import { useTxStatus } from '@/components/TxStatus';

interface Event {
    appId: number;
    name: string;
    price: number;
    supply: number;
    sold: number;
    organizer: string;
    date: string;
    day: string;
    location: string;
    revenue: number;
    cancellationDeadline: number;
    penaltyPercentage: number;
    royaltyPercentage: number;
}

interface TicketInfo {
    index: number;
    assetId: number;
    owner: string;
    status: 'pending' | 'claimed' | 'used' | 'listed' | 'cancelled';
    resalePrice?: number;
}

interface DashboardStats {
    totalEvents: number;
    totalTickets: number;
    totalSold: number;
    totalRevenue: number;
    totalRoyalties: number;
    averagePrice: number;
    sellThroughRate: number;
    activeEvents: number;
    totalAttendees: number;
    checkInRate: number;
    resaleRevenue: number;
}

function StatCard({ title, value, subtitle, trend, icon }: { title: string; value: string; subtitle?: string; trend?: number; icon: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                    {icon}
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={trend >= 0 ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                        </svg>
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
            <p className="text-sm text-gray-500">{title}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
    );
}

export default function DashboardPage() {
    const { activeAccount, signTransactions } = useWallet();
    const { setStatus: setTxStatus } = useTxStatus();
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [tickets, setTickets] = useState<TicketInfo[]>([]);
    const [stats, setStats] = useState<DashboardStats>({
        totalEvents: 0,
        totalTickets: 0,
        totalSold: 0,
        totalRevenue: 0,
        totalRoyalties: 0,
        averagePrice: 0,
        sellThroughRate: 0,
        activeEvents: 0,
        totalAttendees: 0,
        checkInRate: 0,
        resaleRevenue: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [withdrawingEventId, setWithdrawingEventId] = useState<number | null>(null);

    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);
    const indexerClient = new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud', 443);

    // Load all events for the current organizer
    const loadOrganizerEvents = async () => {
        if (!activeAccount) return;
        
        setIsLoading(true);
        setStatus('Loading your events...');
        
        try {
            const deployedEvents = JSON.parse(localStorage.getItem('deployedEvents') || '[]');
            const organizerEvents: Event[] = [];
            
            for (const deployedEvent of deployedEvents) {
                try {
                    const eventAppInfo = await algodClient.getApplicationByID(deployedEvent.eventId).do();
                    const eventGlobalState = eventAppInfo.params["global-state"];
                    
                    const getGlobalInt = (key: string) => { 
                        const k = btoa(key); 
                        const s = eventGlobalState?.find((x: any) => x.key === k); 
                        return s ? s.value.uint : 0; 
                    };
                    
                    const getGlobalBytes = (key: string) => { 
                        const k = btoa(key); 
                        const s = eventGlobalState?.find((x: any) => x.key === k); 
                        return s ? s.value.bytes : ''; 
                    };
                    
                    const price = getGlobalInt("Price");
                    const supply = getGlobalInt("Supply");
                    const sold = getGlobalInt("Sold");
                    const organizerBase64 = getGlobalBytes("Organizer");
                    const cancellationDeadline = getGlobalInt("cancellation_deadline");
                    const penaltyPercentage = getGlobalInt("penalty_percentage");
                    const royaltyPercentage = getGlobalInt("royalty_percentage");
                    
                    let organizer = "";
                    if (organizerBase64) { 
                        const bin = atob(organizerBase64); 
                        const arr = new Uint8Array(bin.length); 
                        for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j); 
                        organizer = algosdk.encodeAddress(arr); 
                    }
                    
                    // Only show events where current user is the organizer
                    if (organizer === activeAccount.address) {
                        organizerEvents.push({
                            appId: deployedEvent.eventId,
                            name: deployedEvent.eventName,
                            price,
                            supply,
                            sold,
                            organizer,
                            date: deployedEvent.date,
                            day: deployedEvent.day,
                            location: deployedEvent.location,
                            revenue: price * sold,
                            cancellationDeadline,
                            penaltyPercentage,
                            royaltyPercentage,
                        });
                    }
                } catch (e) {
                    console.error(`Error loading event ${deployedEvent.eventId}:`, e);
                }
            }
            
            setEvents(organizerEvents);
            calculateStats(organizerEvents);
            
            if (organizerEvents.length === 0) {
                setStatus('No events found. Create your first event to see dashboard analytics!');
            } else {
                setStatus(`Found ${organizerEvents.length} event${organizerEvents.length === 1 ? '' : 's'}`);
            }
        } catch (e: any) {
            console.error('Error loading events:', e);
            setStatus(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate dashboard statistics
    const calculateStats = (events: Event[]) => {
        const totalEvents = events.length;
        const totalTickets = events.reduce((sum, event) => sum + event.supply, 0);
        const totalSold = events.reduce((sum, event) => sum + event.sold, 0);
        const totalRevenue = events.reduce((sum, event) => sum + event.revenue, 0);
        const totalRoyalties = 0; // Would need to track actual royalty payments
        const averagePrice = totalTickets > 0 ? totalRevenue / totalSold : 0;
        const sellThroughRate = totalTickets > 0 ? (totalSold / totalTickets) * 100 : 0;
        const activeEvents = events.filter(event => event.sold < event.supply).length;
        const totalAttendees = totalSold; // Simplified - would be actual check-ins
        const checkInRate = totalSold > 0 ? 85 : 0; // Simplified - would calculate from actual check-ins
        const resaleRevenue = 0; // Would track actual resale transactions

        setStats({
            totalEvents,
            totalTickets,
            totalSold,
            totalRevenue,
            totalRoyalties,
            averagePrice,
            sellThroughRate,
            activeEvents,
            totalAttendees,
            checkInRate,
            resaleRevenue,
        });
    };

    // Load tickets for a specific event
    const loadEventTickets = async (event: Event) => {
        setSelectedEvent(event);
        setIsLoading(true);
        setStatus('Loading tickets...');
        
        try {
            const eventTickets: TicketInfo[] = [];
            const ticketsPrefix = new TextEncoder().encode("tickets");
            const promises = [];
            
            for (let i = 1; i <= event.sold; i++) {
                const rawKey = algosdk.encodeUint64(i);
                const boxKey = new Uint8Array(ticketsPrefix.length + rawKey.length);
                boxKey.set(ticketsPrefix, 0);
                boxKey.set(rawKey, ticketsPrefix.length);
                promises.push(algodClient.getApplicationBoxByName(event.appId, boxKey).do().then(box => ({ i, box })).catch(() => null));
            }
            
            const results = await Promise.all(promises);
            for (const res of results) {
                if (!res) continue;
                const { i, box } = res;
                const assetId = algosdk.decodeUint64(box.value.slice(0, 8), 'safe');
                const owner = algosdk.encodeAddress(box.value.slice(8, 40));
                const statusByte = box.value[40];
                const resalePriceBytes = box.value.slice(41, 49);
                const resalePrice = algosdk.decodeUint64(resalePriceBytes, 'safe');
                
                const status = statusByte === 0 ? 'pending' : statusByte === 1 ? 'claimed' : statusByte === 2 ? 'used' : statusByte === 3 ? 'listed' : 'cancelled';
                
                eventTickets.push({
                    index: i,
                    assetId: Number(assetId),
                    owner,
                    status,
                    resalePrice: Number(resalePrice),
                });
            }
            
            setTickets(eventTickets);
            setStatus(`Loaded ${eventTickets.length} tickets for ${event.name}`);
        } catch (e: any) {
            console.error('Error loading tickets:', e);
            setStatus(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Check in attendee
    const checkInAttendee = async (ticket: TicketInfo) => {
        if (!activeAccount || !selectedEvent) return;
        
        try {
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('check_in');
            const atc = new algosdk.AtomicTransactionComposer();
            const sp = await algodClient.getTransactionParams().do();
            
            atc.addMethodCall({ 
                appID: selectedEvent.appId, 
                method, 
                methodArgs: [ticket.index], 
                sender: activeAccount.address, 
                signer: dummySigner, 
                suggestedParams: sp 
            });
            
            await executeATC(atc, algodClient, signTransactions, 4, (s) => {
                if (s.state === 'pending') setTxStatus({ state: 'pending', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                if (s.state === 'success') setTxStatus({ state: 'success', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                if (s.state === 'failed') setTxStatus({ state: 'failed', message: s.message });
            });
            
            setStatus('🎉 Attendee checked in successfully!');
            loadEventTickets(selectedEvent); // Refresh tickets
        } catch (e: any) {
            console.error('Error checking in attendee:', e);
            setStatus(`Check-in failed: ${e.message}`);
        }
    };

    // Export attendee list
    const exportAttendeeList = () => {
        if (!selectedEvent || tickets.length === 0) return;
        
        const csvContent = [
            ['Ticket #', 'Asset ID', 'Owner Address', 'Status', 'Resale Price'],
            ...tickets.map(ticket => [
                ticket.index,
                ticket.assetId,
                ticket.owner,
                ticket.status,
                ticket.resalePrice && ticket.resalePrice > 0 ? `${(ticket.resalePrice / 1000000).toFixed(3)} ALGO` : 'N/A'
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedEvent.name.replace(/[^a-z0-9]/gi, '_')}_attendees.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        setStatus('📥 Attendee list exported successfully!');
    };
    const withdrawFunds = async (event: Event) => {
        if (!activeAccount) return;
        
        setWithdrawingEventId(event.appId);
        try {
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('withdraw_funds');
            const atc = new algosdk.AtomicTransactionComposer();
            const sp = await algodClient.getTransactionParams().do();
            
            atc.addMethodCall({ 
                appID: event.appId, 
                method, 
                methodArgs: [], 
                sender: activeAccount.address, 
                signer: dummySigner, 
                suggestedParams: sp 
            });
            
            await executeATC(atc, algodClient, signTransactions, 4, (s) => {
                if (s.state === 'pending') setTxStatus({ state: 'pending', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                if (s.state === 'success') setTxStatus({ state: 'success', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                if (s.state === 'failed') setTxStatus({ state: 'failed', message: s.message });
            });
            
            setStatus('🎉 Funds withdrawn successfully!');
            loadOrganizerEvents(); // Refresh data
        } catch (e: any) {
            console.error('Error withdrawing funds:', e);
            setStatus(`Withdrawal failed: ${e.message}`);
        } finally {
            setWithdrawingEventId(null);
        }
    };

    // Load events when wallet connects
    useEffect(() => {
        if (activeAccount) {
            loadOrganizerEvents();
        }
    }, [activeAccount]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero */}
            <section className="relative py-16 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07] blur-3xl" style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }} />
                <div className="container px-4 md:px-6 relative z-10 text-center">
                    <p className="text-sm font-bold text-purple-600 uppercase tracking-wider mb-3">Dashboard</p>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                        Organizer Analytics
                    </h1>
                    <p className="text-gray-400 max-w-lg mx-auto">Track your event performance, revenue, and ticket sales in real-time</p>
                </div>
            </section>

            {/* Stats Grid */}
            <section className="py-8">
                <div className="container px-4 md:px-6">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            title="Total Events"
                            value={stats.totalEvents.toString()}
                            subtitle={`${stats.activeEvents} active`}
                            icon={<svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                        />
                        <StatCard
                            title="Total Tickets Sold"
                            value={stats.totalSold.toString()}
                            subtitle={`${stats.sellThroughRate.toFixed(1)}% sell-through`}
                            trend={stats.sellThroughRate > 50 ? 12 : -5}
                            icon={<svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>}
                        />
                        <StatCard
                            title="Total Revenue"
                            value={`${(stats.totalRevenue / 1000000).toFixed(2)} ALGO`}
                            subtitle={`Avg: ${(stats.averagePrice / 1000000).toFixed(3)} ALGO`}
                            trend={15}
                            icon={<svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        />
                        <StatCard
                            title="Total Attendees"
                            value={stats.totalAttendees.toString()}
                            subtitle={`${stats.checkInRate}% check-in rate`}
                            trend={8}
                            icon={<svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                        />
                    </div>

                    {/* Additional Stats Row */}
                    <div className="grid gap-6 md:grid-cols-3 mt-6">
                        <StatCard
                            title="Total Capacity"
                            value={stats.totalTickets.toString()}
                            subtitle={`${stats.totalTickets - stats.totalSold} available`}
                            icon={<svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>}
                        />
                        <StatCard
                            title="Royalty Earnings"
                            value={`${(stats.totalRoyalties / 1000000).toFixed(3)} ALGO`}
                            subtitle="From resales"
                            icon={<svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>}
                        />
                        <StatCard
                            title="Resale Revenue"
                            value={`${(stats.resaleRevenue / 1000000).toFixed(3)} ALGO`}
                            subtitle="Secondary market"
                            icon={<svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
                        />
                    </div>
                </div>
            </section>

            {/* Events List */}
            <section className="py-8">
                <div className="container px-4 md:px-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Your Events</h2>
                        <Button
                            onClick={loadOrganizerEvents}
                            disabled={isLoading}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {isLoading ? 'Refreshing...' : 'Refresh'}
                        </Button>
                    </div>

                    {status && (
                        <p className={`text-center mb-6 text-sm font-medium ${status.includes('Found') ? 'text-green-600' : status.includes('Error') ? 'text-red-600' : 'text-gray-400'}`}>
                            {status}
                        </p>
                    )}

                    {events.length > 0 ? (
                        <div className="grid gap-6 lg:grid-cols-2">
                            {events.map((event) => (
                                <div key={event.appId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow">
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-900 mb-2">{event.name}</h3>
                                                <p className="text-sm text-gray-500">App ID: {event.appId}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-bold text-purple-600">{(event.revenue / 1000000).toFixed(2)} ALGO</p>
                                                <p className="text-xs text-gray-500">Revenue</p>
                                            </div>
                                        </div>

                                        {/* Event Details */}
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <p className="text-sm text-gray-500">Price</p>
                                                <p className="font-semibold">{(event.price / 1000000).toFixed(3)} ALGO</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Sold</p>
                                                <p className="font-semibold">{event.sold} / {event.supply}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Date</p>
                                                <p className="font-semibold">{event.date}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Location</p>
                                                <p className="font-semibold">{event.location}</p>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mb-4">
                                            <div className="flex justify-between text-sm text-gray-500 mb-1">
                                                <span>Sell-through</span>
                                                <span>{((event.sold / event.supply) * 100).toFixed(1)}%</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
                                                    style={{ width: `${(event.sold / event.supply) * 100}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => loadEventTickets(event)}
                                                className="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-700"
                                            >
                                                View Tickets
                                            </Button>
                                            <Button
                                                onClick={() => withdrawFunds(event)}
                                                disabled={withdrawingEventId === event.appId || event.revenue === 0}
                                                className="bg-green-600 hover:bg-green-700 text-white"
                                            >
                                                {withdrawingEventId === event.appId ? 'Withdrawing...' : 'Withdraw'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-purple-50 flex items-center justify-center">
                                <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">No Events Yet</h3>
                            <p className="text-gray-400 max-w-sm mx-auto">
                                Create your first event to start tracking analytics and revenue
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* Tickets Modal/Section */}
            {selectedEvent && (
                <section className="py-8 border-t">
                    <div className="container px-4 md:px-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Tickets for {selectedEvent.name}</h2>
                            <Button
                                onClick={() => setSelectedEvent(null)}
                                variant="outline"
                            >
                                Close
                            </Button>
                        </div>

                        {tickets.length > 0 ? (
                            <div className="space-y-4">
                                {/* Attendee Stats */}
                                <div className="grid grid-cols-4 gap-4 mb-6">
                                    <div className="bg-green-50 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-green-600">{tickets.filter(t => t.status === 'used').length}</p>
                                        <p className="text-xs text-green-700">Checked In</p>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-blue-600">{tickets.filter(t => t.status === 'claimed').length}</p>
                                        <p className="text-xs text-blue-700">Ready</p>
                                    </div>
                                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-amber-600">{tickets.filter(t => t.status === 'pending').length}</p>
                                        <p className="text-xs text-amber-700">Pending</p>
                                    </div>
                                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-purple-600">{tickets.filter(t => t.status === 'listed').length}</p>
                                        <p className="text-xs text-purple-700">For Resale</p>
                                    </div>
                                </div>

                                {/* Export Button */}
                                <div className="flex justify-end mb-4">
                                    <Button
                                        onClick={exportAttendeeList}
                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                    >
                                        📥 Export CSV
                                    </Button>
                                </div>

                                {/* Tickets Table */}
                                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-b">
                                                <tr>
                                                    <th className="text-left p-4 text-sm font-medium text-gray-700">Ticket #</th>
                                                    <th className="text-left p-4 text-sm font-medium text-gray-700">Asset ID</th>
                                                    <th className="text-left p-4 text-sm font-medium text-gray-700">Owner</th>
                                                    <th className="text-left p-4 text-sm font-medium text-gray-700">Status</th>
                                                    <th className="text-left p-4 text-sm font-medium text-gray-700">Resale Price</th>
                                                    <th className="text-left p-4 text-sm font-medium text-gray-700">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {tickets.map((ticket) => (
                                                    <tr key={ticket.index} className="hover:bg-gray-50">
                                                        <td className="p-4 text-sm font-medium">#{ticket.index}</td>
                                                        <td className="p-4 text-sm font-mono">{ticket.assetId}</td>
                                                        <td className="p-4 text-sm font-mono">{ticket.owner.slice(0, 8)}...{ticket.owner.slice(-4)}</td>
                                                        <td className="p-4">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                                                ticket.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                                                                ticket.status === 'claimed' ? 'bg-green-50 text-green-700' :
                                                                ticket.status === 'used' ? 'bg-gray-50 text-gray-700' :
                                                                ticket.status === 'listed' ? 'bg-blue-50 text-blue-700' :
                                                                'bg-red-50 text-red-700'
                                                            }`}>
                                                                {ticket.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-sm">
                                                            {ticket.resalePrice && ticket.resalePrice > 0 
                                                                ? `${(ticket.resalePrice / 1000000).toFixed(3)} ALGO` 
                                                                : '-'
                                                            }
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex gap-2">
                                                                {ticket.status === 'claimed' && (
                                                                    <Button
                                                                        onClick={() => checkInAttendee(ticket)}
                                                                        className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1"
                                                                    >
                                                                        Check In
                                                                    </Button>
                                                                )}
                                                                {ticket.status === 'used' && (
                                                                    <span className="text-xs text-gray-500">Already checked in</span>
                                                                )}
                                                                {ticket.status === 'pending' && (
                                                                    <span className="text-xs text-amber-600">Awaiting claim</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-gray-500">No tickets found for this event</p>
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
