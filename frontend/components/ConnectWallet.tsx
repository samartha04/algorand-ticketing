"use client";

import { useWallet } from '@txnlab/use-wallet';
import { Button } from './ui/button';
import { formatAddress } from '@/utils/algorand';
import { useState, useEffect } from 'react';

export default function ConnectWallet() {
    const { providers, activeAccount } = useWallet();
    const [isClient, setIsClient] = useState(false);
    const [showProviders, setShowProviders] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) return null;

    const handleDisconnect = async () => {
        if (providers) {
            const activeProvider = providers.find((p) => p.isActive);
            if (activeProvider) {
                await activeProvider.disconnect();
            }
        }
    };

    if (activeAccount) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#E8E5FF] rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-mono text-[#685AFF] font-medium">
                        {formatAddress(activeAccount.address)}
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnect}
                    className="text-gray-400 hover:text-[#FF5B5B] hover:bg-[#FFE5E5]"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </Button>
            </div>
        );
    }

    return (
        <div className="relative">
            <Button
                onClick={() => setShowProviders(!showProviders)}
                className="gradient-purple text-white shadow-brand hover:shadow-brand-lg"
            >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Connect Wallet
            </Button>

            {showProviders && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowProviders(false)}
                    />
                    <div className="absolute right-0 top-full mt-3 w-72 p-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 animate-scale-in">
                        <div className="px-3 py-2 mb-1">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Select Wallet
                            </p>
                        </div>
                        <div className="space-y-1">
                            {providers?.map((provider) => (
                                <button
                                    key={provider.metadata.id}
                                    onClick={async () => {
                                        await provider.connect();
                                        setShowProviders(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#E8E5FF] transition-all group"
                                >
                                    <img
                                        src={provider.metadata.icon}
                                        alt={provider.metadata.name}
                                        className="w-9 h-9 rounded-xl bg-gray-100 p-1.5"
                                    />
                                    <div className="text-left">
                                        <p className="text-sm font-semibold text-gray-800 group-hover:text-[#685AFF] transition-colors">
                                            {provider.metadata.name}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            Tap to connect
                                        </p>
                                    </div>
                                    <svg className="w-4 h-4 ml-auto text-gray-300 group-hover:text-[#685AFF] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
