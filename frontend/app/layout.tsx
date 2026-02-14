import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
    title: 'AlgoEvents – NFT Event Ticketing on Algorand',
    description: 'Discover, create, and manage events with NFT tickets on the Algorand blockchain. Secure, transparent, and fair.',
}

import WalletProviderComponent from '@/components/WalletProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { TxStatusProvider } from '@/components/TxStatus'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={`${inter.className} min-h-screen flex flex-col bg-background text-foreground antialiased`}>
                <WalletProviderComponent>
                    <TxStatusProvider>
                        <Header />
                        <main className="flex-1">
                            {children}
                        </main>
                        <Footer />
                    </TxStatusProvider>
                </WalletProviderComponent>
            </body>
        </html>
    )
}
