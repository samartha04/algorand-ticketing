"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';

const features = [
    {
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
        ),
        title: "NFT Tickets",
        description: "Every ticket is a unique on-chain asset. No fakes, no duplicates — just verifiable ownership.",
        color: "gradient-card-purple",
        iconBg: "bg-[#685AFF]",
    },
    {
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
        title: "Anti-Scalping",
        description: "Smart contracts enforce fair pricing. Organizers set the rules, blockchain enforces them.",
        color: "gradient-card-red",
        iconBg: "bg-[#FF5B5B]",
    },
    {
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
        title: "Instant Settlement",
        description: "Atomic transfers ensure tickets and payments move together. No chargebacks, no delays.",
        color: "gradient-card-blue",
        iconBg: "bg-[#4A9EFF]",
    },
    {
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        ),
        title: "Community First",
        description: "Built for students and campus events. Low fees, easy setup, and transparent operations.",
        color: "gradient-card-yellow",
        iconBg: "bg-[#E5A800]",
    },
];

const stats = [
    { value: "0.001", unit: "ALGO", label: "Transaction Fee" },
    { value: "<4s", unit: "", label: "Finality Time" },
    { value: "100%", unit: "", label: "On-Chain" },
    { value: "0%", unit: "", label: "Platform Fee" },
];

export default function Home() {
    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <section className="relative overflow-hidden py-24 md:py-32">
                {/* Background gradient blobs */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #685AFF 0%, transparent 70%)' }} />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl" style={{ background: 'radial-gradient(circle, #FF5B5B 0%, transparent 70%)' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl" style={{ background: 'radial-gradient(circle, #9CCFFF 0%, transparent 70%)' }} />

                <div className="container px-4 md:px-6 relative z-10">
                    <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#E8E5FF] text-[#685AFF] text-sm font-semibold rounded-full mb-8 animate-slide-up">
                            <span className="w-2 h-2 bg-[#685AFF] rounded-full animate-pulse" />
                            Powered by Algorand
                        </div>

                        {/* Title */}
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1] animate-slide-up" style={{ animationDelay: '0.1s' }}>
                            Event Tickets,{' '}
                            <span className="text-gradient-brand">Reimagined</span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-xl text-gray-500 max-w-2xl mb-10 leading-relaxed animate-slide-up" style={{ animationDelay: '0.2s' }}>
                            Create, sell, and verify event tickets as NFTs on the blockchain.
                            Transparent pricing. Zero fraud. Instant settlement.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                            <Link href="/events">
                                <Button size="lg" className="gradient-purple text-white shadow-brand-lg hover:shadow-brand text-base px-10 h-14 rounded-2xl">
                                    Explore Events
                                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </Button>
                            </Link>
                            <Link href="/create-event">
                                <Button variant="outline" size="lg" className="text-base px-10 h-14 rounded-2xl border-2">
                                    Host an Event
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats bar */}
            <section className="border-y border-gray-100 bg-gray-50/50">
                <div className="container px-4 md:px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
                        {stats.map((stat) => (
                            <div key={stat.label} className="py-8 text-center">
                                <p className="text-3xl font-extrabold text-gray-900">
                                    {stat.value}
                                    {stat.unit && <span className="text-lg font-semibold text-[#685AFF] ml-1">{stat.unit}</span>}
                                </p>
                                <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24">
                <div className="container px-4 md:px-6">
                    <div className="text-center mb-16">
                        <p className="text-sm font-bold text-[#685AFF] uppercase tracking-wider mb-3">Why AlgoEvents</p>
                        <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
                            Ticketing for the future
                        </h2>
                        <p className="text-gray-500 max-w-lg mx-auto">
                            Everything you need to run events — powered by blockchain and built for simplicity.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {features.map((feature, index) => (
                            <div
                                key={feature.title}
                                className={`group ${feature.color} rounded-2xl p-6 border border-white/60 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-default`}
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <div className={`w-12 h-12 ${feature.iconBg} rounded-xl flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform`}>
                                    {feature.icon}
                                </div>
                                <h3 className="font-bold text-gray-900 text-lg mb-2">
                                    {feature.title}
                                </h3>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it Works */}
            <section className="py-24 bg-gray-50/60">
                <div className="container px-4 md:px-6">
                    <div className="text-center mb-16">
                        <p className="text-sm font-bold text-[#FF5B5B] uppercase tracking-wider mb-3">How It Works</p>
                        <h2 className="text-4xl font-extrabold text-gray-900">
                            Three steps to your event
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                        {[
                            {
                                step: "01",
                                title: "Create Your Event",
                                desc: "Deploy a smart contract, set ticket price and supply. Takes less than 30 seconds.",
                                accent: "#685AFF",
                            },
                            {
                                step: "02",
                                title: "Sell Tickets",
                                desc: "Share your event. Attendees purchase NFT tickets directly through the marketplace.",
                                accent: "#FF5B5B",
                            },
                            {
                                step: "03",
                                title: "Verify & Earn",
                                desc: "Scan QR codes at the door for instant verification. Withdraw revenue anytime.",
                                accent: "#4A9EFF",
                            },
                        ].map((item) => (
                            <div key={item.step} className="text-center group">
                                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white shadow-lg flex items-center justify-center group-hover:shadow-xl transition-shadow">
                                    <span className="text-2xl font-extrabold" style={{ color: item.accent }}>
                                        {item.step}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24">
                <div className="container px-4 md:px-6">
                    <div className="relative rounded-3xl gradient-purple p-12 md:p-20 text-center text-white overflow-hidden">
                        {/* Decorative circles */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
                                Ready to launch your event?
                            </h2>
                            <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">
                                Deploy your first event contract in minutes. No coding required.
                            </p>
                            <Link href="/create-event">
                                <Button size="lg" className="bg-white text-[#685AFF] hover:bg-gray-100 font-bold px-10 h-14 rounded-2xl shadow-xl text-base">
                                    Get Started Free
                                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
