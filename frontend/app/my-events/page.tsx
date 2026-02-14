"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface DeployedEvent {
    eventId: number;
    factoryId: number;
    eventName: string;
    date?: string;
    day?: string;
    location?: string;
    timestamp: number;
}

export default function MyEventsPage() {
    const [deployedEvents, setDeployedEvents] = useState<DeployedEvent[]>([]);
    const [copiedId, setCopiedId] = useState<{ type: 'factory' | 'event', id: number } | null>(null);

    useEffect(() => {
        loadDeployedEvents();
    }, []);

    const loadDeployedEvents = () => {
        try {
            const events = JSON.parse(localStorage.getItem('deployedEvents') || '[]');
            setDeployedEvents(events);
        } catch (e) {
            console.error('Failed to load deployed events:', e);
        }
    };

    const copyToClipboard = (text: string | number, type: 'factory' | 'event', id: number) => {
        navigator.clipboard.writeText(String(text));
        setCopiedId({ type, id });
        setTimeout(() => setCopiedId(null), 2000);
    };

    const deleteEvent = (eventId: number) => {
        try {
            const updated = deployedEvents.filter(e => e.eventId !== eventId);
            localStorage.setItem('deployedEvents', JSON.stringify(updated));
            setDeployedEvents(updated);
        } catch (e) {
            console.error('Failed to delete event:', e);
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="min-h-screen bg-white py-12 md:py-16">
            {/* Header */}
            <div className="container px-4 md:px-6 mb-10">
                <div className="text-center">
                    <p className="text-sm font-bold text-[#685AFF] uppercase tracking-wider mb-3">My Dashboard</p>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                        My Events
                    </h1>
                    <p className="text-gray-400 max-w-lg mx-auto">View all your deployed events with their Factory IDs and Event IDs for quick reference.</p>
                </div>
            </div>

            <div className="container px-4 md:px-6">
                {deployedEvents.length === 0 ? (
                    <div className="text-center py-20 max-w-md mx-auto">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-purple-50 flex items-center justify-center">
                            <svg className="w-10 h-10 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">No Events Deployed Yet</h3>
                        <p className="text-gray-400 mb-6">Deploy your first event and it will appear here with all the details you need.</p>
                        <Link href="/create-event">
                            <Button className="gradient-purple text-white shadow-brand hover:shadow-brand-lg">
                                Create Event →
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1 max-w-4xl mx-auto">
                        {deployedEvents.map((event) => (
                            <div key={event.eventId} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
                                <div className="h-1.5 gradient-purple" />
                                
                                <div className="p-6">
                                    {/* Event Name */}
                                    <h3 className="text-2xl font-extrabold text-gray-900 mb-2">{event.eventName}</h3>
                                    <p className="text-sm text-gray-400 mb-4">Deployed on {formatDate(event.timestamp)}</p>

                                    {/* Event Details */}
                                    {(event.date || event.day || event.location) && (
                                        <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-2">
                                            {event.date && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <svg className="w-4 h-4 text-[#685AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m7 8H3a2 2 0 01-2-2V7a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2z" /></svg>
                                                    <span className="text-gray-700">{event.date}</span>
                                                </div>
                                            )}
                                            {event.day && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <svg className="w-4 h-4 text-[#685AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <span className="text-gray-700">{event.day}</span>
                                                </div>
                                            )}
                                            {event.location && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <svg className="w-4 h-4 text-[#685AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                    <span className="text-gray-700">{event.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* IDs Section */}
                                    <div className="space-y-3 mb-6">
                                        {/* Factory ID */}
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Factory ID</div>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-lg font-mono font-bold text-blue-900">{event.factoryId}</div>
                                                <button
                                                    onClick={() => copyToClipboard(event.factoryId, 'factory', event.eventId)}
                                                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all whitespace-nowrap"
                                                >
                                                    {copiedId?.type === 'factory' && copiedId.id === event.eventId ? '✓ Copied' : 'Copy'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Event ID */}
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                            <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Event ID</div>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-lg font-mono font-bold text-green-900">{event.eventId}</div>
                                                <button
                                                    onClick={() => copyToClipboard(event.eventId, 'event', event.eventId)}
                                                    className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-all whitespace-nowrap"
                                                >
                                                    {copiedId?.type === 'event' && copiedId.id === event.eventId ? '✓ Copied' : 'Copy'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3">
                                        <Link href={`/event/${event.eventId}`} className="flex-1">
                                            <Button variant="outline" className="w-full">
                                                View Event
                                            </Button>
                                        </Link>
                                        <button
                                            onClick={() => deleteEvent(event.eventId)}
                                            className="px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium text-sm transition-all"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
