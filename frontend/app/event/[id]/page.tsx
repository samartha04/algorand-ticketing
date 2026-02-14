"use client";

import { useWallet } from '@txnlab/use-wallet';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import algosdk from 'algosdk';
import { executeATC, dummySigner } from '@/utils/signer';
import { useTxStatus } from '@/components/TxStatus';

export default function EventDetailsPage({ params }: { params: { id: string } }) {
    const appId = parseInt(params.id);
    const { activeAccount, signTransactions } = useWallet();
    const { setStatus: setTxStatus } = useTxStatus();

    // Event State
    const [eventData, setEventData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [isBuying, setIsBuying] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmData, setConfirmData] = useState<{ amount?: number; fee?: number; reserve?: number; } | null>(null);

    // Algod Client
    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);

    useEffect(() => {
        if (appId) {
            fetchEventDetails();
        }
    }, [appId]);

    const fetchEventDetails = async () => {
        try {
            const appInfo = await algodClient.getApplicationByID(appId).do();
            const globalState = appInfo.params['global-state'];

            // Parse State
            // Smart contract uses capitalized keys: 'Price', 'Supply', 'Sold', 'Organizer'
            const parsedState: any = {};
            globalState.forEach((item: any) => {
                const key = Buffer.from(item.key, 'base64').toString();
                const value = item.value.type === 1 ? item.value.bytes : item.value.uint; // 1 is bytes, 2 is uint
                parsedState[key] = value;
            });

            setEventData({
                price: parsedState['Price'], // MicroAlgos
                supply: parsedState['Supply'],
                sold: parsedState['Sold'],
                organizer: parsedState['Organizer'] ? algosdk.encodeAddress(Buffer.from(parsedState['Organizer'], 'base64')) : 'Unknown',
                appId: appId
            });
        } catch (error) {
            console.error(error);
            setStatus('Failed to load event details.');
        } finally {
            setIsLoading(false);
        }
    };

    const buyTicket = async () => {
        if (!activeAccount || !eventData) return;
        // show confirmation first
        try {
            const params = await algodClient.getTransactionParams().do();
            // fee used in code: 3000 microAlgos
            const feeMicro = 3000;
            // reserve impact happens at claim opt-in (~0.1 ALGO)
            setConfirmData({ amount: eventData.price / 1000000, fee: feeMicro / 1000000, reserve: 0.1 });
            setConfirmOpen(true);
        } catch (e) {
            setStatus('Failed to prepare transaction.');
        }
        return;

        try {
            // 0. Re-fetch the LATEST sold count from the chain to avoid stale box references
            const appInfo = await algodClient.getApplicationByID(appId).do();
            const globalState = appInfo.params['global-state'];
            let currentSold = 0;
            let currentPrice = eventData.price;
            globalState.forEach((item: any) => {
                const key = Buffer.from(item.key, 'base64').toString();
                if (key === 'Sold') currentSold = item.value.uint;
                if (key === 'Price') currentPrice = item.value.uint;
            });

            setIsBuying(true);
            setStatus('Processing purchase...');
            // 1. Prepare Payment Transaction
            const params = await algodClient.getTransactionParams().do();
            const appAddress = algosdk.getApplicationAddress(appId);

            const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                from: activeAccount.address,
                to: appAddress,
                amount: currentPrice,
                suggestedParams: params
            });

            // 2. Prepare App Call (buy_ticket)
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);

            const atc = new algosdk.AtomicTransactionComposer();
            const sp = { ...params, fee: 3000, flatFee: true };

            // Build box key: "tickets" + uint64(currentSold + 1)
            // The contract increments Sold first, then writes to "tickets" + newSold
            const ticketsPrefix = new TextEncoder().encode("tickets");
            const rawKey = algosdk.encodeUint64(currentSold + 1);
            const boxKey = new Uint8Array(ticketsPrefix.length + rawKey.length);
            boxKey.set(ticketsPrefix, 0);
            boxKey.set(rawKey, ticketsPrefix.length);

            atc.addMethodCall({
                appID: appId,
                method: contract.getMethodByName('buy_ticket'),
                methodArgs: [
                    { txn: paymentTxn, signer: dummySigner }
                ],
                boxes: [{ appIndex: 0, name: boxKey }],
                sender: activeAccount.address,
                signer: dummySigner,
                suggestedParams: sp
            });

            // Execute
            await executeATC(atc, algodClient, signTransactions, 4, (s) => {
                if (s.state === 'pending') setTxStatus({ state: 'pending', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                if (s.state === 'success') setTxStatus({ state: 'success', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                if (s.state === 'failed') setTxStatus({ state: 'failed', message: s.message });
            });

            setStatus('Purchase Successful! You can now claim your ticket.');
            // Ideally refresh global state
            fetchEventDetails();

        } catch (error: any) {
            console.error(error);
            setStatus(`Purchase Failed: ${error.message}`);
        } finally {
            setIsBuying(false);
        }
    };

    // continuation once user confirms in modal
    const buyTicketConfirmed = async () => {
        // reuse existing buyTicket logic by calling the inner flow
        // replicate body after confirmation: set state and execute
        if (!activeAccount || !eventData) return;
        setIsBuying(true);
        setStatus('Processing purchase...');

        try {
            const appInfo = await algodClient.getApplicationByID(appId).do();
            const globalState = appInfo.params['global-state'];
            let currentSold = 0;
            let currentPrice = eventData.price;
            globalState.forEach((item: any) => {
                const key = Buffer.from(item.key, 'base64').toString();
                if (key === 'Sold') currentSold = item.value.uint;
                if (key === 'Price') currentPrice = item.value.uint;
            });

            const params = await algodClient.getTransactionParams().do();
            const appAddress = algosdk.getApplicationAddress(appId);

            const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                from: activeAccount.address,
                to: appAddress,
                amount: currentPrice,
                suggestedParams: params
            });

            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);

            const atc = new algosdk.AtomicTransactionComposer();
            const sp = { ...params, fee: 3000, flatFee: true };

            const ticketsPrefix = new TextEncoder().encode("tickets");
            const rawKey = algosdk.encodeUint64(currentSold + 1);
            const boxKey = new Uint8Array(ticketsPrefix.length + rawKey.length);
            boxKey.set(ticketsPrefix, 0);
            boxKey.set(rawKey, ticketsPrefix.length);

            atc.addMethodCall({
                appID: appId,
                method: contract.getMethodByName('buy_ticket'),
                methodArgs: [
                    { txn: paymentTxn, signer: dummySigner }
                ],
                boxes: [{ appIndex: 0, name: boxKey }],
                sender: activeAccount.address,
                signer: dummySigner,
                suggestedParams: sp
            });

            await executeATC(atc, algodClient, signTransactions, 4, (s) => {
                if (s.state === 'pending') setTxStatus({ state: 'pending', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                if (s.state === 'success') setTxStatus({ state: 'success', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                if (s.state === 'failed') setTxStatus({ state: 'failed', message: s.message });
            });

            setStatus('Purchase Successful! You can now claim your ticket.');
            fetchEventDetails();
        } catch (error: any) {
            console.error(error);
            setStatus(`Purchase Failed: ${error.message}`);
        } finally {
            setIsBuying(false);
        }
    };

    if (isLoading) return <div className="p-10 text-center">Loading Event Details...</div>;
    if (!eventData) return <div className="p-10 text-center text-red-500">Event Not Found</div>;

    return (
        <div className="container mx-auto py-10">
            <TxConfirm open={confirmOpen} title="Confirm Purchase" message="Please confirm the purchase details before proceeding." amountALGO={confirmData?.amount} feeALGO={confirmData?.fee} reserveALGO={confirmData?.reserve} onCancel={() => setConfirmOpen(false)} onConfirm={async () => { setConfirmOpen(false); /* continue purchase */
                try { await buyTicketConfirmed(); } catch (e) { /* handled */ }
            }} />

            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>Event #{appId}</CardTitle>
                    <CardDescription>Organizer: {eventData.organizer}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-4 bg-secondary rounded-lg">
                            <div className="text-sm text-muted-foreground">Price</div>
                            <div className="text-2xl font-bold">{eventData.price / 1000000} Algo</div>
                        </div>
                        <div className="p-4 bg-secondary rounded-lg">
                            <div className="text-sm text-muted-foreground">Availability</div>
                            <div className="text-2xl font-bold">{eventData.supply - eventData.sold} / {eventData.supply}</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Button
                            size="lg"
                            className="w-full text-lg"
                            onClick={buyTicket}
                            disabled={isBuying || !activeAccount || (eventData.sold >= eventData.supply)}
                        >
                            {isBuying ? 'Processing...' : 'Buy Ticket'}
                        </Button>
                        {!activeAccount && (
                            <p className="text-center text-sm text-muted-foreground">Connect wallet to purchase</p>
                        )}
                    </div>

                    {status && (
                        <div className={`p-4 rounded-md text-sm font-mono break-all ${status.includes('Failed') ? 'bg-destructive/10 text-destructive' : 'bg-green-100 text-green-800'}`}>
                            {status}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
