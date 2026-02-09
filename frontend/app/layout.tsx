import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Algorand Ticket Platform',
    description: 'Decentralized Event Ticketing',
}

import WalletProviderComponent from '@/components/WalletProvider'
import ConnectWallet from '@/components/ConnectWallet'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <WalletProviderComponent>
                    <header className="flex justify-between items-center p-4 border-b bg-white relative z-50">
                        <div className="flex gap-6 items-center">
                            <h1 className="text-xl font-bold">AlgoEvents</h1>
                            <nav className="flex gap-4">
                                <a href="/" className="hover:underline">Home</a>
                                <a href="/create-event" className="hover:underline">Create Event</a>
                                <a href="/my-tickets" className="hover:underline">My Tickets</a>
                                <a href="/verify" className="hover:underline">Verify (Admin)</a>
                            </nav>
                        </div>
                        <ConnectWallet />
                    </header>
                    <main className="p-4">
                        {children}
                    </main>
                </WalletProviderComponent>
            </body>
        </html>
    )
}
