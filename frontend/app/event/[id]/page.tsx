"use client";

import { useWallet } from '@txnlab/use-wallet';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import algosdk from 'algosdk';
import { executeATC, dummySigner } from '@/utils/signer';

export default function EventDetailsPage({ params }: { params: { id: string } }) {
    const appId = parseInt(params.id);
    const { activeAccount, signTransactions } = useWallet();

    // Event State
    const [eventData, setEventData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [isBuying, setIsBuying] = useState(false);

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
            // AlgoKit uses lowercase keys: 'price', 'supply', 'sold', 'organizer'
            const parsedState: any = {};
            globalState.forEach((item: any) => {
                const key = Buffer.from(item.key, 'base64').toString();
                const value = item.value.type === 1 ? item.value.bytes : item.value.uint; // 1 is bytes, 2 is uint
                parsedState[key] = value;
            });

            setEventData({
                price: parsedState['price'], // MicroAlgos
                supply: parsedState['supply'],
                sold: parsedState['sold'],
                organizer: parsedState['organizer'] ? algosdk.encodeAddress(Buffer.from(parsedState['organizer'], 'base64')) : 'Unknown',
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
        setIsBuying(true);
        setStatus('Processing purchase...');

        try {
            // 1. Prepare Payment Transaction
            const params = await algodClient.getTransactionParams().do();
            const appAddress = algosdk.getApplicationAddress(appId);

            const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                from: activeAccount.address,
                to: appAddress,
                amount: eventData.price,
                suggestedParams: params
            });

            // 2. Prepare App Call (buy_ticket)
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);



            const atc = new algosdk.AtomicTransactionComposer();
            const sp = { ...params, fee: 3000, flatFee: true };
            const ticketsPrefix = new TextEncoder().encode("tickets");
            const rawKey = algosdk.encodeUint64(eventData.sold);
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
            await executeATC(atc, algodClient, signTransactions);

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

    if (isLoading) return <div className="p-10 text-center">Loading Event Details...</div>;
    if (!eventData) return <div className="p-10 text-center text-red-500">Event Not Found</div>;

    return (
        <div className="container mx-auto py-10">
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
