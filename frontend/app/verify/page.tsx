"use client";

import { useWallet } from '@txnlab/use-wallet';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import algosdk from 'algosdk';

export default function VerifyPage() {
    const { activeAccount, signTransactions } = useWallet();
    const [appId, setAppId] = useState('');
    const [ticketId, setTicketId] = useState('');
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);

    const checkIn = async () => {
        if (!activeAccount || !appId || !ticketId) {
            setStatus("Please fill all fields and connect wallet.");
            return;
        }

        setIsLoading(true);
        setStatus("Verifying ticket...");

        try {
            const ticketAppId = parseInt(appId);
            const assetIndex = parseInt(ticketId);

            // Fetch Contract ABI
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('check_in');

            const atc = new algosdk.AtomicTransactionComposer();

            atc.addMethodCall({
                appID: ticketAppId,
                method: method,
                methodArgs: [assetIndex],
                sender: activeAccount.address,
                signer: async (txns) => signTransactions(txns.map(t => t.toByte())),
                suggestedParams: await algodClient.getTransactionParams().do()
            });

            await atc.execute(algodClient, 4);
            setStatus(`Ticket ${assetIndex} Verified & Checked In!`);

        } catch (error: any) {
            console.error(error);
            setStatus(`Verification Failed: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto max-w-md py-10">
            <Card>
                <CardHeader>
                    <CardTitle>Verify Ticket</CardTitle>
                    <CardDescription>Organizer Check-In Portal</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Event App ID</label>
                        <input
                            className="w-full p-2 border rounded"
                            value={appId}
                            onChange={(e) => setAppId(e.target.value)}
                            placeholder="e.g. 123456"
                            type="number"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Ticket Asset ID</label>
                        <input
                            className="w-full p-2 border rounded"
                            value={ticketId}
                            onChange={(e) => setTicketId(e.target.value)}
                            placeholder="e.g. 998877"
                            type="number"
                        />
                    </div>

                    <Button
                        onClick={checkIn}
                        disabled={isLoading || !activeAccount}
                        className="w-full"
                    >
                        {isLoading ? 'Processing...' : 'Check In'}
                    </Button>

                    {status && (
                        <div className={`p-4 rounded text-sm font-mono ${status.includes('Failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {status}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
