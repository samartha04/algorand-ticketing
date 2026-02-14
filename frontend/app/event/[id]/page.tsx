"use client";

import { useWallet } from '@txnlab/use-wallet';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import algosdk from 'algosdk';
import { executeATC, dummySigner } from '@/utils/signer';
import { useTxStatus } from '@/components/TxStatus';
import TxConfirm from '@/components/TxConfirm';

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

    const getEventMetadata = (appId: number) => {
        try {
            const metadata = JSON.parse(localStorage.getItem('eventMetadata') || '{}');
            return metadata[appId] || {};
        } catch (e) {
            console.error('Failed to retrieve event metadata:', e);
            return {};
        }
    };

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
                appId: appId,
                ...getEventMetadata(appId)
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
    };

    // continuation once user confirms in modal
    const buyTicketConfirmed = async () => {
        // reuse existing buyTicket logic by calling the inner flow
        // replicate body after confirmation: set state and execute
        if (!activeAccount) { setStatus('Connect wallet to continue'); return; }
        if (!eventData) return;
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
                    {/* Date, Day, Location */}
                    {(eventData.date || eventData.day || eventData.location) && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                            {eventData.date && (
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m7 8H3a2 2 0 01-2-2V7a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2z" /></svg>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-700">Date</div>
                                        <div className="text-base text-blue-700 font-medium">{eventData.date}</div>
                                    </div>
                                </div>
                            )}
                            {eventData.day && (
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-700">Time</div>
                                        <div className="text-base text-blue-700 font-medium">{eventData.day}</div>
                                    </div>
                                </div>
                            )}
                            {eventData.location && (
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-700">Location</div>
                                        <div className="text-base text-blue-700 font-medium">{eventData.location}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
