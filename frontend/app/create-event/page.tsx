"use client";

import { useWallet } from '@txnlab/use-wallet';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import algosdk from 'algosdk';

export default function CreateEventPage() {
    const { activeAccount, signTransactions, sendTransactions } = useWallet();
    const [eventName, setEventName] = useState('');
    const [price, setPrice] = useState('1000000'); // 1 Algo
    const [supply, setSupply] = useState('100');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');

    const [factoryAppId, setFactoryAppId] = useState<number>(0);

    const deployFactory = async () => {
        if (!activeAccount) return;
        setIsLoading(true);
        setStatus('Deploying Event Factory...');
        try {
            const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);
            const approvalProgram = await fetch('/utils/contracts/event_factory_approval.teal').then(r => r.text());
            const clearProgram = await fetch('/utils/contracts/event_factory_clear.teal').then(r => r.text());

            const approvalBin = await algodClient.compile(approvalProgram).do();
            const clearBin = await algodClient.compile(clearProgram).do();

            const params = await algodClient.getTransactionParams().do();

            const approvalBytes = new Uint8Array(atob(approvalBin.result).split('').map(x => x.charCodeAt(0)));
            const clearBytes = new Uint8Array(atob(clearBin.result).split('').map(x => x.charCodeAt(0)));

            const txn = algosdk.makeApplicationCreateTxnFromObject({
                from: activeAccount.address,
                approvalProgram: approvalBytes,
                clearProgram: clearBytes,
                numGlobalByteSlices: 0,
                numGlobalInts: 1, // EventCount
                numLocalByteSlices: 0,
                numLocalInts: 0,
                onComplete: algosdk.OnApplicationComplete.NoOpOC,
                suggestedParams: params,
                note: new TextEncoder().encode("Event Factory")
            });

            const signedTxn = await signTransactions([txn.toByte()]);
            const { id } = await sendTransactions(signedTxn, 4);
            const ptx = await algodClient.pendingTransactionInformation(id).do();
            const appId = ptx["application-index"];

            setFactoryAppId(appId);
            setStatus(`Factory Deployed! App ID: ${appId}`);
        } catch (e: any) {
            console.error(e);
            setStatus(`Factory Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const deployEvent = async () => {
        if (!activeAccount) {
            setStatus('Please connect wallet first');
            return;
        }

        setIsLoading(true);
        setStatus('Deploying event contract...');

        try {
            const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);

            // 1. Fetch compiled TEAL
            const approvalProgram = await fetch('/utils/contracts/ticket_manager_approval.teal').then(r => r.text());
            const clearProgram = await fetch('/utils/contracts/ticket_manager_clear.teal').then(r => r.text());

            const approvalBin = await algodClient.compile(approvalProgram).do();
            const clearBin = await algodClient.compile(clearProgram).do();

            // 2. createApplication transaction
            const params = await algodClient.getTransactionParams().do();

            // Schema: 
            // Global: Price, Supply, Sold, Organizer (4 Ints? No, Organizer is Bytes. Price, Supply, Sold are Ints. 3 Ints, 1 Byte)
            // Local: None
            const approvalProgramBytes = new Uint8Array(atob(approvalBin.result).split('').map(x => x.charCodeAt(0)));
            const clearProgramBytes = new Uint8Array(atob(clearBin.result).split('').map(x => x.charCodeAt(0)));

            const txn = algosdk.makeApplicationCreateTxnFromObject({
                from: activeAccount.address,
                approvalProgram: approvalProgramBytes,
                clearProgram: clearProgramBytes,
                numGlobalByteSlices: 1, // Organizer
                numGlobalInts: 3,       // Price, Supply, Sold
                numLocalByteSlices: 0,
                numLocalInts: 0,
                onComplete: algosdk.OnApplicationComplete.NoOpOC,
                suggestedParams: params,
                appArgs: [], // We'll initialize in a separate call or could do it here if method allowed creation args
                note: new TextEncoder().encode("Event Ticket Manager")
            });

            // Sign and Send Create App
            const signedTxn = await signTransactions([txn.toByte()]);
            const { id } = await sendTransactions(signedTxn, 4); // Wait 4 rounds

            const ptx = await algodClient.pendingTransactionInformation(id).do();
            const appId = ptx["application-index"];

            setStatus(`Contract Deployed! App ID: ${appId}. initializing...`);

            // 3. Initialize Contract (create_event method)
            // Need the ABI method definition
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('create_event');

            // App Call to Initialize
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addMethodCall({
                appID: appId,
                method: method,
                methodArgs: [
                    parseInt(price),
                    parseInt(supply)
                ],
                sender: activeAccount.address,
                signer: async (txns) => {
                    const s = await signTransactions(txns.map(t => t.toByte()));
                    return s;
                },
                suggestedParams: await algodClient.getTransactionParams().do()
            });

            await atc.execute(algodClient, 4);

            setStatus(`Event Initialized! Registering with Factory...`);

            // 4. Register with Factory
            if (factoryAppId !== 0) {
                const factoryJson = await fetch('/utils/contracts/event_factory_contract.json').then(r => r.json());
                const factoryContract = new algosdk.ABIContract(factoryJson);
                const registerMethod = factoryContract.getMethodByName('register_event');

                // Fetch current EventCount to determine Box Key
                const facAppInfo = await algodClient.getApplicationByID(factoryAppId).do();
                const globalState = facAppInfo.params["global-state"];
                const countKey = btoa("EventCount"); // Key in global state
                const countState = globalState?.find((s: any) => s.key === countKey);
                const eventCount = countState ? countState.value.uint : 0;

                // Encode Box Key (Uint64)
                const boxKey = algosdk.encodeUint64(eventCount);

                const atcFactory = new algosdk.AtomicTransactionComposer();
                const factoryParams = await algodClient.getTransactionParams().do();

                // MBR Payment: 0.1 Algo (conservative)
                const factoryAddr = algosdk.getApplicationAddress(factoryAppId);
                const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                    from: activeAccount.address,
                    to: factoryAddr,
                    amount: 105700, // Min Balance for Box (2500 + 400 * (key+value_size)) approx. Safe 0.1A
                    suggestedParams: factoryParams
                });

                atcFactory.addTransaction({ txn: payTxn, signer: async (txns) => signTransactions(txns.map(t => t.toByte())) });

                atcFactory.addMethodCall({
                    appID: factoryAppId,
                    method: registerMethod,
                    methodArgs: [
                        appId,
                        eventName
                    ],
                    boxes: [
                        { appIndex: 0, name: boxKey } // Reference the box we are creating
                    ],
                    sender: activeAccount.address,
                    signer: async (txns) => signTransactions(txns.map(t => t.toByte())),
                    suggestedParams: factoryParams
                });

                await atcFactory.execute(algodClient, 4);
                setStatus(`Success! Event Created & Registered. App ID: ${appId}`);
            } else {
                setStatus(`Success! Event Created (Not Registered). App ID: ${appId}`);
            }

        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-10">
            <Card className="max-w-lg mx-auto">
                <CardHeader>
                    <CardTitle>Create New Event</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 border rounded bg-slate-50">
                        <label className="text-xs font-bold text-gray-500 uppercase">Event Factory Registry</label>
                        <div className="flex gap-2 mt-2">
                            <input
                                className="flex-1 p-2 text-sm border rounded"
                                placeholder="Factory App ID (0 to deploy new)"
                                type="number"
                                value={factoryAppId}
                                onChange={e => setFactoryAppId(parseInt(e.target.value))}
                            />
                            <Button size="sm" variant="outline" onClick={deployFactory}>Deploy New</Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Event Name</label>
                        <input
                            className="w-full p-2 border rounded-md"
                            value={eventName}
                            onChange={(e) => setEventName(e.target.value)}
                            placeholder="My Awesome Concert"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Price (MicroAlgos)</label>
                            <input
                                className="w-full p-2 border rounded-md"
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Ticket Supply</label>
                            <input
                                className="w-full p-2 border rounded-md"
                                type="number"
                                value={supply}
                                onChange={(e) => setSupply(e.target.value)}
                            />
                        </div>
                    </div>

                    <Button
                        onClick={deployEvent}
                        disabled={isLoading || !activeAccount}
                        className="w-full"
                    >
                        {isLoading ? 'Processing...' : 'Deploy Event Contract'}
                    </Button>

                    {status && (
                        <div className="p-4 bg-muted rounded-md text-sm font-mono break-all">
                            {status}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
