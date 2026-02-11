import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="bg-gray-50 border-t border-gray-100 mt-auto">
            <div className="container px-4 md:px-6 py-16">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1">
                        <Link href="/" className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg gradient-purple flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                </svg>
                            </div>
                            <span className="text-lg font-bold text-gradient-brand">AlgoEvents</span>
                        </Link>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Secure, transparent event ticketing powered by Algorand blockchain technology.
                        </p>
                    </div>

                    {/* Platform */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Platform</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link href="/events" className="text-gray-500 hover:text-[#685AFF] transition-colors">Marketplace</Link></li>
                            <li><Link href="/create-event" className="text-gray-500 hover:text-[#685AFF] transition-colors">Create Event</Link></li>
                            <li><Link href="/my-tickets" className="text-gray-500 hover:text-[#685AFF] transition-colors">My Tickets</Link></li>
                        </ul>
                    </div>

                    {/* Organizers */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Organizers</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link href="/verify" className="text-gray-500 hover:text-[#685AFF] transition-colors">Dashboard</Link></li>
                            <li><Link href="/verify" className="text-gray-500 hover:text-[#685AFF] transition-colors">Verify Tickets</Link></li>
                            <li><Link href="/verify" className="text-gray-500 hover:text-[#685AFF] transition-colors">Withdraw Funds</Link></li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Resources</h4>
                        <ul className="space-y-3 text-sm">
                            <li><a href="https://algorand.co" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-[#685AFF] transition-colors">Algorand ↗</a></li>
                            <li><a href="https://testnet.algoexplorer.io" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-[#685AFF] transition-colors">Explorer ↗</a></li>
                            <li><a href="https://bank.testnet.algorand.network/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-[#685AFF] transition-colors">Testnet Faucet ↗</a></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-gray-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-400">
                        © 2024 AlgoEvents. Built on Algorand.
                    </p>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold px-3 py-1 bg-[#E8E5FF] text-[#685AFF] rounded-full">
                            ● Testnet
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
