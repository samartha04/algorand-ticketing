"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ConnectWallet from './ConnectWallet';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Marketplace', href: '/events' },
    { name: 'Create Event', href: '/create-event' },
    { name: 'My Tickets', href: '/my-tickets' },
    { name: 'Dashboard', href: '/verify' },
];

export default function Header() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm">
            <div className="container flex h-16 items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg gradient-purple flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                            </svg>
                        </div>
                        <span className="text-xl font-bold text-gradient-brand">
                            AlgoEvents
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                                    pathname === item.href
                                        ? "bg-[#E8E5FF] text-[#685AFF]"
                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                                )}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-3">
                    <ConnectWallet />

                    {/* Mobile menu toggle */}
                    <button
                        className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {mobileOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            {/* Mobile Nav */}
            {mobileOpen && (
                <div className="md:hidden bg-white border-t border-gray-100 animate-slide-up">
                    <nav className="container py-4 flex flex-col gap-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                    "px-4 py-3 rounded-lg text-sm font-medium transition-all",
                                    pathname === item.href
                                        ? "bg-[#E8E5FF] text-[#685AFF]"
                                        : "text-gray-600 hover:bg-gray-50"
                                )}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </nav>
                </div>
            )}
        </header>
    );
}
