"use client";

import { useWallet } from '@txnlab/use-wallet';
import { Button } from './ui/button';
import { formatAddress } from '@/utils/algorand';
import { useState, useEffect } from 'react';

export default function ConnectWallet() {
    const { providers, activeAccount } = useWallet();
    const [isClient, setIsClient] = useState(false);

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
                <span className="text-sm font-mono bg-secondary px-3 py-1 rounded-md">
                    {formatAddress(activeAccount.address)}
                </span>
                <Button variant="outline" onClick={handleDisconnect}>
                    Disconnect
                </Button>
            </div>
        );
    }

    return (
        <div className="flex gap-2">
            {providers?.map((provider) => (
                <Button
                    key={provider.metadata.id}
                    onClick={async () => {
                        await provider.connect();
                    }}
                    className="gap-2"
                >
                    <img
                        src={provider.metadata.icon}
                        alt={provider.metadata.name}
                        className="w-5 h-5 bg-white rounded-full p-0.5" // specific tweak for icon visibility
                    />
                    Connect {provider.metadata.name}
                </Button>
            ))}
        </div>
    );
}
