"use client";

import { useWallet } from '@txnlab/use-wallet';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import algosdk from 'algosdk';
import { QRCodeCanvas } from 'qrcode.react';

interface Ticket {
    assetId: number;
    eventName: string;
    appId: number;
    status: 'pending' | 'claimed' | 'used';
}

export default function MyTicketsPage() {
    const { activeAccount, signTransactions } = useWallet();
    const [factoryAppId, setFactoryAppId] = useState<number>(0);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

    const indexerClient = new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud', 443);
    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);

    const fetchAll = async () => {
        if (!activeAccount || factoryAppId === 0) {
            setStatus('Please connect wallet and enter Factory ID');
            return;
        }
        setIsLoading(true);
        setStatus('Fetching events...');

        try {
            const appInfo = await algodClient.getApplicationByID(factoryAppId).do();
            const globalState = appInfo.params["global-state"];
            const countKey = btoa("EventCount");
            const countState = globalState?.find((s: any) => s.key === countKey);
            const eventCount = countState ? countState.value.uint : 0;

            const eventMap = new Map<string, { appId: number, name: string }>();

            for (let i = 0; i < eventCount; i++) {
                const boxKey = algosdk.encodeUint64(i);
                const box = await algodClient.getApplicationBoxByName(factoryAppId, boxKey).do();
                const id = algosdk.decodeUint64(box.value.slice(0, 8), 'safe');
                const nameLen = (box.value[8] << 8) | box.value[9];
                const name = new TextDecoder().decode(box.value.slice(10, 10 + nameLen));
                const addr = algosdk.getApplicationAddress(id);
                eventMap.set(addr, { appId: Number(id), name });
            }

            const myTickets: Ticket[] = [];

            // Pending
            setStatus('Checking pending tickets...');
            for (const [appAddr, info] of Array.from(eventMap.entries())) {
                const created = await indexerClient.lookupAccountCreatedAssets(appAddr).do();
                for (const asset of created['assets'] || []) {
                    try {
                        const boxKey = algosdk.encodeUint64(asset.index);
                        const box = await algodClient.getApplicationBoxByName(info.appId, boxKey).do();
                        const owner = algosdk.encodeAddress(box.value.slice(0, 32));
                        const status = box.value[32];

                        if (owner === activeAccount.address && status === 0) {
                            myTickets.push({
                                assetId: asset.index,
                                eventName: info.name,
                                appId: info.appId,
                                status: 'pending'
                            });
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }

            // Claimed
            setStatus('Checking claimed tickets...');
            const userAssets = await indexerClient.lookupAccountAssets(activeAccount.address).do();
            for (const asset of userAssets['assets'] || []) {
                if (asset.amount > 0) {
                    const aInfo = await indexerClient.lookupAssetByID(asset['asset-id']).do();
                    const creator = aInfo['asset']['params']['creator'];

                    if (eventMap.has(creator)) {
                        const info = eventMap.get(creator)!;
                        myTickets.push({
                            assetId: asset['asset-id'],
                            eventName: info.name,
                            appId: info.appId,
                            status: 'claimed'
                        });
                    }
                }
            }

            setTickets(myTickets);
            setStatus(`Found ${myTickets.length} tickets`);

        } catch (e: any) {
            console.error(e);
            setStatus(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const claimTicket = async (ticket: Ticket) => {
        try {
            setStatus(`Claiming ticket ${ticket.assetId}...`);
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('claim_ticket');

            const atc = new algosdk.AtomicTransactionComposer();

            const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                from: activeAccount!.address,
                to: activeAccount!.address,
                assetIndex: ticket.assetId,
                amount: 0,
                suggestedParams: await algodClient.getTransactionParams().do()
            });

            atc.addTransaction({ txn: optInTxn, signer: async (txns) => signTransactions(txns.map(t => t.toByte())) });

            const sp = await algodClient.getTransactionParams().do();
            sp.fee = 2000;
            sp.flatFee = true;

            atc.addMethodCall({
                appID: ticket.appId,
                method: method,
                methodArgs: [ticket.assetId],
                sender: activeAccount!.address,
                signer: async (txns) => signTransactions(txns.map(t => t.toByte())),
                suggestedParams: sp,
            });

            await atc.execute(algodClient, 4);
            setStatus('Ticket Claimed Successfully!');
            fetchAll();

        } catch (e: any) {
            console.error(e);
            setStatus(`Claim Error: ${e.message}`);
        }
    };

    return (
        <div className="container mx-auto py-10 relative">
            <h1 className="text-3xl font-bold mb-6">My Tickets</h1>

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
                        <Button onClick={fetchAll} disabled={isLoading || !activeAccount}>Refresh Tickets</Button>
                    </div>
                    {!activeAccount && <p className="text-red-500 text-sm mt-2">Please connect wallet</p>}
                    {status && <p className="text-muted-foreground text-sm mt-2 font-mono">{status}</p>}
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tickets.map((ticket) => (
                    <Card key={ticket.assetId}>
                        <CardHeader>
                            <CardTitle>{ticket.eventName}</CardTitle>
                            <CardDescription>Asset ID: {ticket.assetId}</CardDescription>
                        </CardHeader>
                        <CardFooter>
                            {ticket.status === 'pending' ? (
                                <Button className="w-full" onClick={() => claimTicket(ticket)}>Claim Ticket</Button>
                            ) : (
                                <Button variant="secondary" className="w-full" onClick={() => setSelectedTicket(ticket)}>View QR (Ready)</Button>
                            )}
                        </CardFooter>
                    </Card>
                ))}
                {tickets.length === 0 && !isLoading && (
                    <div className="text-center col-span-full py-10 text-gray-500">
                        No tickets found.
                    </div>
                )}
            </div>

            {selectedTicket && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 transition-opacity" onClick={() => setSelectedTicket(null)}>
                    <div className="bg-white p-8 rounded-lg max-w-sm w-full space-y-6 text-center shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedTicket(null)}
                            className="absolute top-2 right-2 text-gray-500 hover:text-black text-xl font-bold p-2"
                        >
                            ×
                        </button>
                        <div>
                            <h3 className="text-2xl font-bold mb-1">{selectedTicket.eventName}</h3>
                            <p className="text-sm text-gray-500">Show this at the entrance</p>
                        </div>

                        <div className="flex justify-center py-4">
                            <QRCodeCanvas
                                value={JSON.stringify({
                                    appId: selectedTicket.appId,
                                    assetId: selectedTicket.assetId
                                })}
                                size={220}
                                level={"H"}
                                includeMargin={true}
                            />
                        </div>

                        <div className="text-xs text-gray-400 font-mono break-all py-2 border-t">
                            ID: {selectedTicket.assetId}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
