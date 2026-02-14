"use client";

import { useWallet } from '@txnlab/use-wallet';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import algosdk from 'algosdk';
import { executeATC, dummySigner } from '@/utils/signer';
import { useTxStatus } from '@/components/TxStatus';

// Step indicator
function StepIndicator({ steps, currentStep }: { steps: string[], currentStep: number }) {
    return (
        <div className="flex items-center justify-center mb-8">
            {steps.map((step, index) => (
                <div key={step} className="flex items-center">
                    <div className="flex flex-col items-center">
                        <div className={`
                            flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 font-bold text-sm
                            ${index < currentStep
                                ? 'bg-green-500 border-green-500 text-white'
                                : index === currentStep
                                    ? 'gradient-purple border-[#685AFF] text-white'
                                    : 'bg-gray-50 border-gray-200 text-gray-400'}
                        `}>
                            {index < currentStep ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <span>{index + 1}</span>
                            )}
                        </div>
                        <span className={`text-xs mt-1.5 font-medium ${index <= currentStep ? 'text-gray-700' : 'text-gray-400'}`}>{step}</span>
                    </div>
                    {index < steps.length - 1 && (
                        <div className={`w-16 h-0.5 mx-2 mb-5 transition-all duration-300 rounded-full ${index < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

export default function CreateEventPage() {
    const { activeAccount, signTransactions } = useWallet();
    const { setStatus: setTxStatus } = useTxStatus();
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventDay, setEventDay] = useState('');
    const [eventLocation, setEventLocation] = useState('');
    const [price, setPrice] = useState('1');
    const [supply, setSupply] = useState('100');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [currentStep, setCurrentStep] = useState(0);
    const [factoryAppId, setFactoryAppId] = useState<number>(0);
    const [createdAppId, setCreatedAppId] = useState<number | null>(null);
    const [copiedId, setCopiedId] = useState<'factory' | 'event' | null>(null);

    const steps = ['Deploy', 'Initialize', 'Register'];

    const copyToClipboard = (text: string | number, type: 'factory' | 'event') => {
        navigator.clipboard.writeText(String(text));
        setCopiedId(type);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const storeEventMetadata = (appId: number) => {
        try {
            const metadata = {
                name: eventName,
                date: eventDate,
                day: eventDay,
                location: eventLocation,
                timestamp: Date.now()
            };
            const existing = JSON.parse(localStorage.getItem('eventMetadata') || '{}');
            existing[appId] = metadata;
            localStorage.setItem('eventMetadata', JSON.stringify(existing));
        } catch (e) {
            console.error('Failed to store event metadata:', e);
        }
    };

    const deployFactory = async () => {
        if (!activeAccount) return;
        setIsLoading(true); setStatus('Deploying Event Factory...');
        try {
            const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);
            const approvalProgram = await fetch('/utils/contracts/event_factory_approval.teal').then(r => r.text());
            const clearProgram = await fetch('/utils/contracts/event_factory_clear.teal').then(r => r.text());
            const approvalBin = await algodClient.compile(approvalProgram).do();
            const clearBin = await algodClient.compile(clearProgram).do();
            const params = await algodClient.getTransactionParams().do();
            const approvalBytes = new Uint8Array(atob(approvalBin.result).split('').map(x => x.charCodeAt(0)));
            const clearBytes = new Uint8Array(atob(clearBin.result).split('').map(x => x.charCodeAt(0)));
            const txn = algosdk.makeApplicationCreateTxnFromObject({ from: activeAccount.address, approvalProgram: approvalBytes, clearProgram: clearBytes, numGlobalByteSlices: 0, numGlobalInts: 1, numLocalByteSlices: 0, numLocalInts: 0, onComplete: algosdk.OnApplicationComplete.NoOpOC, suggestedParams: params, note: new TextEncoder().encode("Event Factory") });
            // Sign and send directly (no ATC needed for single txns)
            const encoded = algosdk.encodeUnsignedTransaction(txn);
            const signedTxns = await signTransactions([encoded]);
            const { txId } = await algodClient.sendRawTransaction(signedTxns.filter(t => t != null)).do();
            const ptx = await algosdk.waitForConfirmation(algodClient, txId, 4);
            const appId = ptx["application-index"];
            setFactoryAppId(appId);
            setStatus(`✓ Factory deployed: ${appId}`);
        } catch (e: any) { console.error(e); setStatus(`Error: ${e.message}`); }
        finally { setIsLoading(false); }
    };

    const deployEvent = async () => {
        if (!activeAccount) { setStatus('Connect wallet first'); return; }
        if (!eventName.trim()) { setStatus('Enter an event name'); return; }
        setIsLoading(true); setCurrentStep(0); setCreatedAppId(null);
        try {
            const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);
            setStatus('Deploying smart contract...');
            const approvalProgram = await fetch('/utils/contracts/ticket_manager_approval.teal').then(r => r.text());
            const clearProgram = await fetch('/utils/contracts/ticket_manager_clear.teal').then(r => r.text());
            const approvalBin = await algodClient.compile(approvalProgram).do();
            const clearBin = await algodClient.compile(clearProgram).do();
            const params = await algodClient.getTransactionParams().do();
            const approvalProgramBytes = new Uint8Array(atob(approvalBin.result).split('').map(x => x.charCodeAt(0)));
            const clearProgramBytes = new Uint8Array(atob(clearBin.result).split('').map(x => x.charCodeAt(0)));
            const txn = algosdk.makeApplicationCreateTxnFromObject({ from: activeAccount.address, approvalProgram: approvalProgramBytes, clearProgram: clearProgramBytes, numGlobalByteSlices: 1, numGlobalInts: 3, numLocalByteSlices: 0, numLocalInts: 0, onComplete: algosdk.OnApplicationComplete.NoOpOC, suggestedParams: params, note: new TextEncoder().encode("Event Ticket Manager") });
            // Sign and send directly
            const encoded = algosdk.encodeUnsignedTransaction(txn);
            const signedTxns = await signTransactions([encoded]);
            const { txId } = await algodClient.sendRawTransaction(signedTxns.filter(t => t != null)).do();
            const ptx = await algosdk.waitForConfirmation(algodClient, txId, 4);
            const appId = ptx["application-index"];
            setCurrentStep(1); setCreatedAppId(appId);

            setStatus('Initializing event...');
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('create_event');
            const priceInMicroAlgos = Math.floor(parseFloat(price) * 1000000);
            const initParams = await algodClient.getTransactionParams().do();
            const atc = new algosdk.AtomicTransactionComposer();
            const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                from: activeAccount.address,
                to: algosdk.getApplicationAddress(appId),
                amount: 1_000_000,
                suggestedParams: initParams
            });
            atc.addTransaction({ txn: fundTxn, signer: dummySigner });
            atc.addMethodCall({ appID: appId, method, methodArgs: [priceInMicroAlgos, parseInt(supply)], sender: activeAccount.address, signer: dummySigner, suggestedParams: initParams });
            await executeATC(atc, algodClient, signTransactions, 4, (s) => {
                if (s.state === 'pending') setTxStatus({ state: 'pending', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                if (s.state === 'success') setTxStatus({ state: 'success', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                if (s.state === 'failed') setTxStatus({ state: 'failed', message: s.message });
            });
            setCurrentStep(2);

            if (factoryAppId !== 0) {
                setStatus('Registering with factory...');
                const facAppInfo = await algodClient.getApplicationByID(factoryAppId).do();
                const globalState = facAppInfo.params["global-state"];
                const countState = globalState?.find((s: any) => s.key === btoa("event_count")) ?? globalState?.find((s: any) => s.key === btoa("EventCount"));
                const eventCount = countState ? countState.value.uint : 0;
                const eventsPrefix = new TextEncoder().encode("events");
                const rawKey = algosdk.encodeUint64(eventCount);
                const boxKey = new Uint8Array(eventsPrefix.length + rawKey.length);
                boxKey.set(eventsPrefix, 0);
                boxKey.set(rawKey, eventsPrefix.length);
                const atcFactory = new algosdk.AtomicTransactionComposer();
                const factoryParams = await algodClient.getTransactionParams().do();
                const factoryAddr = algosdk.getApplicationAddress(factoryAppId);
                const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ from: activeAccount.address, to: factoryAddr, amount: 200000, suggestedParams: factoryParams });
                atcFactory.addTransaction({ txn: payTxn, signer: dummySigner });
                // Build register_event call with exact selector from event_factory_approval.teal so it matches deployed AlgoKit factory
                const REGISTER_EVENT_SELECTOR = new Uint8Array([0x91, 0x5e, 0x7d, 0x3d]);
                const nameBytes = new TextEncoder().encode(eventName);
                const nameEncoded = new Uint8Array(2 + nameBytes.length);
                nameEncoded[0] = (nameBytes.length >> 8) & 0xff;
                nameEncoded[1] = nameBytes.length & 0xff;
                nameEncoded.set(nameBytes, 2);
                const registerAppArgs = [REGISTER_EVENT_SELECTOR, algosdk.encodeUint64(appId), nameEncoded];
                const registerTxn = algosdk.makeApplicationCallTxnFromObject({
                    from: activeAccount.address,
                    appIndex: factoryAppId,
                    onComplete: algosdk.OnApplicationComplete.NoOpOC,
                    appArgs: registerAppArgs,
                    boxes: [{ appIndex: factoryAppId, name: boxKey }],
                    suggestedParams: { ...factoryParams, fee: 2000, flatFee: true },
                });
                atcFactory.addTransaction({ txn: registerTxn, signer: dummySigner });
                await executeATC(atcFactory, algodClient, signTransactions, 4, (s) => {
                    if (s.state === 'pending') setTxStatus({ state: 'pending', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                    if (s.state === 'success') setTxStatus({ state: 'success', message: s.message, txId: s.txId, explorerUrl: s.explorerUrl });
                    if (s.state === 'failed') setTxStatus({ state: 'failed', message: s.message });
                });
                setCurrentStep(3);
                storeEventMetadata(appId);
                setStatus(`✓ Event created & registered! Ready to go.`);
            } else {
                setCurrentStep(3);
                storeEventMetadata(appId);
                setStatus(`✓ Event created! (Not registered - No Factory ID found. Did you refresh?)`);
            }
        } catch (error: any) { console.error(error); setStatus(`Error: ${error.message}`); }
        finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-screen bg-white py-12 md:py-16">
            {/* Header */}
            <div className="container px-4 md:px-6 mb-10">
                <div className="text-center">
                    <p className="text-sm font-bold text-[#685AFF] uppercase tracking-wider mb-3">Event Manager</p>
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
                        Create Your Event
                    </h1>
                    <p className="text-gray-400 max-w-md mx-auto">
                        Deploy a smart contract and start selling NFT tickets in minutes
                    </p>
                </div>
            </div>

            {isLoading && <div className="container px-4"><StepIndicator steps={steps} currentStep={currentStep} /></div>}

            <div className="container px-4 md:px-6">
                <div className="max-w-xl mx-auto bg-white border border-gray-100 rounded-3xl shadow-xl shadow-gray-100/50 p-8">
                    <div className="space-y-6">
                        {/* Factory */}
                        <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-6 h-6 rounded-lg bg-[#E8E5FF] flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-[#685AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <label className="text-sm font-bold text-gray-800">Event Factory</label>
                            </div>
                            <p className="text-xs text-gray-400">Enter an existing Factory ID or deploy a new one</p>
                            <div className="flex gap-3">
                                <input className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#685AFF]/30 focus:border-[#685AFF] transition-all text-sm" placeholder="Factory App ID" type="number" value={factoryAppId || ''} onChange={e => setFactoryAppId(parseInt(e.target.value) || 0)} />
                                <Button variant="outline" onClick={deployFactory} disabled={isLoading} className="whitespace-nowrap">
                                    Deploy New
                                </Button>
                            </div>
                        </div>

                        {/* Event Name */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-800">Event Name</label>
                            <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#685AFF]/30 focus:border-[#685AFF] transition-all" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g. Summer Music Festival 2024" />
                        </div>

                        {/* Date, Day, Location */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-800">Date</label>
                                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#685AFF]/30 focus:border-[#685AFF] transition-all" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-800">Day & Time</label>
                                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#685AFF]/30 focus:border-[#685AFF] transition-all" value={eventDay} onChange={(e) => setEventDay(e.target.value)} placeholder="e.g. Friday 10:00 PM" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-800">Location</label>
                                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#685AFF]/30 focus:border-[#685AFF] transition-all" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="e.g. Madison Square Garden" />
                            </div>
                        </div>

                        {/* Price & Supply */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-800">Price (ALGO)</label>
                                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#685AFF]/30 focus:border-[#685AFF] transition-all" type="number" step="0.1" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-800">Total Supply</label>
                                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#685AFF]/30 focus:border-[#685AFF] transition-all" type="number" min="1" value={supply} onChange={(e) => setSupply(e.target.value)} />
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="p-4 rounded-2xl gradient-card-purple border border-[#685AFF]/10">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-500">Potential Revenue</span>
                                <span className="font-bold text-gray-900">{(parseFloat(price || '0') * parseInt(supply || '0')).toFixed(2)} ALGO</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Est. Deployment Cost</span>
                                <span className="text-gray-500">~0.5 ALGO</span>
                            </div>
                        </div>

                        {/* Deploy */}
                        <Button onClick={deployEvent} disabled={isLoading || !activeAccount} className="w-full py-6 text-base gradient-purple text-white shadow-brand-lg hover:shadow-brand rounded-2xl h-14">
                            {isLoading ? (
                                <span className="flex items-center gap-3">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                    {status || 'Processing...'}
                                </span>
                            ) : !activeAccount ? 'Connect Wallet to Continue' : 'Deploy Event Contract →'}
                        </Button>

                        {/* Status */}
                        {status && !isLoading && (
                            <div className={`p-4 rounded-xl text-sm font-medium ${status.includes('🎉') || status.includes('✓') ? 'bg-green-50 text-green-700 border border-green-200' : status.includes('Error') ? 'bg-red-50 text-[#FF5B5B] border border-red-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                                {status}
                            </div>
                        )}

                        {createdAppId && !isLoading && (
                            <div className="space-y-3">
                                {factoryAppId !== 0 && (
                                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                            </div>
                                            <div>
                                                <p className="font-bold text-blue-800 text-xs uppercase">Factory ID</p>
                                                <p className="text-blue-600 text-sm font-mono font-bold">{factoryAppId}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => copyToClipboard(factoryAppId, 'factory')} className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm transition-all">
                                            {copiedId === 'factory' ? '✓ Copied' : 'Copy'}
                                        </button>
                                    </div>
                                )}
                                <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center text-white flex-shrink-0">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                        <div>
                                            <p className="font-bold text-green-800 text-xs uppercase">Event ID</p>
                                            <p className="text-green-600 text-sm font-mono font-bold">{createdAppId}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => copyToClipboard(createdAppId, 'event')} className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium text-sm transition-all">
                                        {copiedId === 'event' ? '✓ Copied' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>


        </div>
    );
}
