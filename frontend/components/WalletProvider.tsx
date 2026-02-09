"use client";

import { useInitializeProviders, PROVIDER_ID, ProvidersArray, WalletProvider } from '@txnlab/use-wallet';
import { PeraWalletConnect } from '@perawallet/connect';
import { DeflyWalletConnect } from '@blockshake/defly-connect';
import algosdk from 'algosdk';
export default function WalletProviderComponent({ children }: { children: React.ReactNode }) {
    const providers: ProvidersArray = [
        { id: PROVIDER_ID.PERA, clientStatic: PeraWalletConnect },
        { id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect },
    ];

    const walletProviders = useInitializeProviders({
        providers: providers,
        nodeConfig: {
            network: 'testnet',
            nodeServer: 'https://testnet-api.algonode.cloud',
            nodePort: '443',
            nodeToken: '',
        },
        algosdkStatic: algosdk,
    });

    return (
        <WalletProvider value={walletProviders}>
            {children}
        </WalletProvider>
    );
}
