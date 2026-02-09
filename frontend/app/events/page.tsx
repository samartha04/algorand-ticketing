"use client";

import { useWallet } from '@txnlab/use-wallet';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import algosdk from 'algosdk';

interface EventInfo {
    appId: number;
    name: string;
    price: number;
    supply: number;
    sold: number;
    organizer: string;
}

export default function MarketplacePage() {
    const { activeAccount, signTransactions, sendTransactions } = useWallet();
    const [events, setEvents] = useState<EventInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [factoryAppId, setFactoryAppId] = useState<number>(0);

    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);

    const fetchEvents = async () => {
        if (factoryAppId === 0) {
            setStatus("Please enter a Factory ID to load events.");
            return;
        }

        setIsLoading(true);
        setStatus('Loading events...');
        setEvents([]);

        try {
            // 1. Get Event Count from Factory Global State
            const appInfo = await algodClient.getApplicationByID(factoryAppId).do();
            const globalState = appInfo.params["global-state"];
            const countKey = btoa("EventCount");
            const countState = globalState?.find((s: any) => s.key === countKey);
            const eventCount = countState ? countState.value.uint : 0;

            const fetchedEvents: EventInfo[] = [];

            // 2. Iterate Events from Factory Box Storage
            for (let i = 0; i < eventCount; i++) {
                try {
                    const boxKey = algosdk.encodeUint64(i);
                    const box = await algodClient.getApplicationBoxByName(factoryAppId, boxKey).do();

                    // Box Format: [AppID (8 bytes)][Name Length (2 bytes)][Name Bytes]
                    const id = algosdk.decodeUint64(box.value.slice(0, 8), 'safe');
                    const nameLen = (box.value[8] << 8) | box.value[9];
                    const name = new TextDecoder().decode(box.value.slice(10, 10 + nameLen));

                    // 3. Fetch Event Details from Ticket Manager Contract Global State
                    const eventAppInfo = await algodClient.getApplicationByID(Number(id)).do();
                    const eventGlobalState = eventAppInfo.params["global-state"];

                    // Helpers
                    const getGlobalInt = (key: string) => {
                        const k = btoa(key);
                        const s = eventGlobalState?.find((x: any) => x.key === k);
                        return s ? s.value.uint : 0;
                    };

                    const getGlobalBytes = (key: string) => {
                        const k = btoa(key);
                        const s = eventGlobalState?.find((x: any) => x.key === k);
                        return s ? s.value.bytes : '';
                    };

                    const price = getGlobalInt("Price");
                    const supply = getGlobalInt("Supply");
                    const sold = getGlobalInt("Sold");
                    const organizerBase64 = getGlobalBytes("Organizer");

                    let organizer = "";
                    if (organizerBase64) {
                        // organizerBase64 is base64 string. Decode to Uint8Array, then encodeAddress.
                        const bin = atob(organizerBase64);
                        const arr = new Uint8Array(bin.length);
                        for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
                        organizer = algosdk.encodeAddress(arr);
                    }

                    fetchedEvents.push({
                        appId: Number(id),
                        name,
                        price,
                        supply,
                        sold,
                        organizer
                    });

                } catch (e) {
                    console.error(`Error fetching event ${i}`, e);
                }
            }
            setEvents(fetchedEvents);
            setStatus(`Loaded ${fetchedEvents.length} events.`);

        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const buyTicket = async (event: EventInfo) => {
        if (!activeAccount) {
            setStatus("Please connect wallet first.");
            return;
        }

        setIsLoading(true);
        setStatus(`Buying ticket for ${event.name}...`);

        try {
            // Fetch Contract ABI
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('buy_ticket');

            const atc = new algosdk.AtomicTransactionComposer();
            const params = await algodClient.getTransactionParams().do();

            // 1. Payment Transaction (User -> Event App)
            const eventAppAddr = algosdk.getApplicationAddress(event.appId);
            const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                from: activeAccount.address,
                to: eventAppAddr,
                amount: event.price, // Exact price
                suggestedParams: params
            });

            // Add Payment to ATC as a transaction argument? 
            // The method `buy_ticket` takes a `txn` (payment) as argument.
            // In ATC, we pass the transaction object in `methodArgs`.
            // The value should be the TransactionWithSigner or just the transaction object if we use signer callback?
            // Actually, we need to pass a TransactionWithSigner object.

            const txnWithSigner = {
                txn: payTxn,
                signer: async (txns: algosdk.Transaction[], idx: number) => {
                    // This signer callback is used by ATC.
                    // But we are providing a global signer for the method call.
                    // Wait, `addMethodCall` signer argument applies to the App Call.
                    // The argument `payment` is a transaction. ATC expects a specific structure.
                    return signTransactions(txns.map(t => t.toByte())); // Generic fallback
                }
            };

            // Actually simplified: ATC `methodArgs` handles transaction arguments by looking for `txn` type.
            // We pass the transaction object directly.
            // BUT we must ensure the group index is correct. ATC handles this.

            atc.addMethodCall({
                appID: event.appId,
                method: method,
                methodArgs: [
                    {
                        txn: payTxn,
                        signer: async (txns: algosdk.Transaction[]) => signTransactions(txns.map(t => t.toByte()))
                    }
                ],
                sender: activeAccount.address,
                signer: async (txns) => signTransactions(txns.map(t => t.toByte())),
                suggestedParams: params,
                // Increase fee to cover inner transactions (Mint + Box Put)
                // Mint (0.001) + Box Put (0.001 + cost per byte?) 
                // Box Put MBR is paid by the ACCOUNT (Contract), not the fee.
                // The fee covers execution. 
                // Inner txn fee is 0.001.
                // We likely need 2x or 3x fee. 3000 microAlgos to be safe.
            });

            // Manually increase fee in the constructed transaction within ATC?
            // ATC sets fees based on suggestedParams.
            // We can pass modified suggestedParams.
            const sp = { ...params, fee: 3000, flatFee: true };

            // Re-add with correct params
            // Clear previous? internal property... 
            // Just create a new ATC.
        } catch (e: any) {
            console.error(e);
            setStatus(`Error preparing transaction: ${e.message}`);
            setIsLoading(false);
            return;
        }

        // Retry with clean ATC and fee
        try {
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('buy_ticket');
            const params = await algodClient.getTransactionParams().do();

            const eventAppAddr = algosdk.getApplicationAddress(event.appId);
            const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                from: activeAccount.address,
                to: eventAppAddr,
                amount: event.price,
                suggestedParams: params
            });

            const atc = new algosdk.AtomicTransactionComposer();
            // Fee for the App Call: NEEDS TO COVER INNER TXNS.
            // 1. App Call itself (0.001)
            // 2. Inner Txn: Asset Config/Mint (0.001)
            // 3. Inner Txn: Box Put? Box Put is an opcode, cost is in App Call fee? No, Box MBR is different.
            // Opcode budget is the issue. Fees verify the transaction can pay. 
            // Inner transactions need fees too. If Contract has no algae for fees, we must pool.
            // So we pay 2 * MinFee (2000).
            const sp = { ...params, fee: 3000, flatFee: true }; // 3000 just to be super safe

            atc.addMethodCall({
                appID: event.appId,
                method: method,
                methodArgs: [
                    {
                        txn: payTxn,
                        signer: async (txns: algosdk.Transaction[]) => signTransactions(txns.map(t => t.toByte()))
                    }
                ],
                sender: activeAccount.address,
                signer: async (txns) => signTransactions(txns.map(t => t.toByte())),
                suggestedParams: sp
            });

            await atc.execute(algodClient, 4);
            setStatus(`Successfully bought ticket! Check "My Tickets".`);

        } catch (e: any) {
            console.error(e);
            setStatus(`Buy Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-6">Marketplace</h1>

            <Card className="mb-6">
                <CardContent className="pt-6">
                    <div className="flex gap-4 items-center">
                        <label className="text-sm font-medium whitespace-nowrap">Factory App ID:</label>
                        <input
                            className="p-2 border rounded w-32"
                            type="number"
                            value={factoryAppId}
                            onChange={(e) => setFactoryAppId(parseInt(e.target.value))}
                        />
                        <Button onClick={fetchEvents} disabled={isLoading}>Refresh Events</Button>
                    </div>
                    {status && <p className="text-muted-foreground text-sm mt-2 font-mono">{status}</p>}
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                    <Card key={event.appId} className="flex flex-col">
                        <CardHeader>
                            <CardTitle>{event.name}</CardTitle>
                            <CardDescription>App ID: {event.appId}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Price:</span>
                                <span className="font-bold">{(event.price / 1000000).toFixed(2)} Algo</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Available:</span>
                                <span>{event.supply - event.sold} / {event.supply}</span>
                            </div>
                            <div className="text-xs text-gray-400 truncate mt-4">
                                Organizer: {event.organizer}
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" onClick={() => buyTicket(event)} disabled={isLoading || !activeAccount}>
                                Buy Ticket
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {events.length === 0 && !isLoading && (
                <div className="text-center py-10 text-gray-400">
                    No events found. Enter a valid Factory ID.
                </div>
            )}
        </div>
    );
}
