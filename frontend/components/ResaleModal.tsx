"use client";

import { useState } from 'react';
import { useWallet } from '@txnlab/use-wallet';
import { Button } from '@/components/ui/button';
import algosdk from 'algosdk';
import { executeATC, dummySigner } from '@/utils/signer';
import { useTxStatus } from '@/components/TxStatus';

interface Ticket {
    assetId: number;
    eventName: string;
    appId: number;
    status: 'pending' | 'claimed' | 'used' | 'listed' | 'cancelled';
    index: number;
    resalePrice?: number;
}

interface ResaleModalProps {
    isOpen: boolean;
    ticket: Ticket | null;
    onClose: () => void;
}

export default function ResaleModal({ isOpen, ticket, onClose }: ResaleModalProps) {
    const { activeAccount, signTransactions } = useWallet();
    const { setStatus: setTxStatus } = useTxStatus();
    const [resalePrice, setResalePrice] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');

    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);

    const listForResale = async () => {
        if (!activeAccount || !ticket) return;
        
        const priceInMicroAlgos = Math.floor(parseFloat(resalePrice) * 1000000);
        if (priceInMicroAlgos <= 0) {
            setStatus('Please enter a valid resale price');
            return;
        }

        setIsLoading(true);
        setStatus('');
        
        try {
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('list_for_resale');
            
            const atc = new algosdk.AtomicTransactionComposer();
            const params = await algodClient.getTransactionParams().do();
            const sp = { ...params, fee: 2000, flatFee: true };
            
            const ticketsPrefix = new TextEncoder().encode("tickets");
            const rawKey = algosdk.encodeUint64(ticket.index);
            const boxKey = new Uint8Array(ticketsPrefix.length + rawKey.length);
            boxKey.set(ticketsPrefix, 0);
            boxKey.set(rawKey, ticketsPrefix.length);
            
            atc.addMethodCall({
                appID: ticket.appId,
                method,
                methodArgs: [ticket.index, priceInMicroAlgos],
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
            
            setStatus('🎉 Ticket listed for resale!');
            setTimeout(() => {
                onClose();
                setResalePrice('');
            }, 2000);
        } catch (e: any) {
            console.error(e);
            setStatus(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const delistFromResale = async () => {
        if (!activeAccount || !ticket) return;

        setIsLoading(true);
        setStatus('');
        
        try {
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('delist_resale_ticket');
            
            const atc = new algosdk.AtomicTransactionComposer();
            const params = await algodClient.getTransactionParams().do();
            const sp = { ...params, fee: 2000, flatFee: true };
            
            const ticketsPrefix = new TextEncoder().encode("tickets");
            const rawKey = algosdk.encodeUint64(ticket.index);
            const boxKey = new Uint8Array(ticketsPrefix.length + rawKey.length);
            boxKey.set(ticketsPrefix, 0);
            boxKey.set(rawKey, ticketsPrefix.length);
            
            atc.addMethodCall({
                appID: ticket.appId,
                method,
                methodArgs: [ticket.index],
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
            
            setStatus('🎉 Ticket removed from resale!');
            setTimeout(() => {
                onClose();
                setResalePrice('');
            }, 2000);
        } catch (e: any) {
            console.error(e);
            setStatus(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen || !ticket) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Resale Ticket</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all">
                        ✕
                    </button>
                </div>

                {/* Ticket Info */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-purple rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">{ticket.eventName}</h3>
                            <p className="text-sm text-gray-500">Ticket #{ticket.index}</p>
                        </div>
                    </div>
                </div>

                {/* Resale Price Input */}
                <div className="space-y-2 mb-6">
                    <label className="text-sm font-bold text-gray-800">Resale Price (ALGO)</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={resalePrice}
                        onChange={(e) => setResalePrice(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                        placeholder="Enter resale price"
                    />
                    <p className="text-xs text-gray-400">Note: A royalty will be deducted from the final sale price</p>
                </div>

                {/* Status Message */}
                {status && (
                    <div className={`p-3 rounded-xl text-sm font-medium mb-4 ${
                        status.includes('🎉') ? 'bg-green-50 text-green-700 border border-green-200' :
                        status.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' :
                        'bg-gray-50 text-gray-500 border border-gray-200'
                    }`}>
                        {status}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                    {ticket.status === 'claimed' ? (
                        <Button
                            onClick={listForResale}
                            disabled={isLoading || !resalePrice || !activeAccount}
                            className="w-full gradient-purple text-white shadow-brand hover:shadow-brand-lg py-3"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Processing...
                                </span>
                            ) : 'List for Resale'}
                        </Button>
                    ) : (
                        <Button
                            onClick={delistFromResale}
                            disabled={isLoading || !activeAccount}
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Processing...
                                </span>
                            ) : 'Remove from Resale'}
                        </Button>
                    )}
                    
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                        className="w-full"
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
}
