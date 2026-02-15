"use client";

import React, { useState } from 'react';
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
}

interface RefundModalProps {
    isOpen: boolean;
    ticket: Ticket | null;
    onClose: () => void;
}

export default function RefundModal({ isOpen, ticket, onClose }: RefundModalProps) {
    const { activeAccount, signTransactions } = useWallet();
    const { setStatus: setTxStatus } = useTxStatus();
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [eventData, setEventData] = useState<{ price: number; deadline: number } | null>(null);

    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);

    // Fetch event info when modal opens
    React.useEffect(() => {
        if (isOpen && ticket) {
            fetchEventInfo();
        }
    }, [isOpen, ticket]);

    const fetchEventInfo = async () => {
        if (!ticket) return;

        try {
            const appInfo = await algodClient.getApplicationByID(ticket.appId).do();
            const globalState = appInfo.params["global-state"] || [];

            // Parse Global State
            const getValue = (key: string) => {
                const item = globalState.find((s: any) => s.key === btoa(key));
                return item ? item.value.uint : 0;
            };

            const price = getValue("Price");
            const deadline = getValue("Deadline");

            setEventData({ price, deadline });
        } catch (e) {
            console.error('Failed to fetch event info:', e);
        }
    };

    const cancelTicket = async () => {
        if (!activeAccount || !ticket) return;

        setIsLoading(true);
        setStatus('');

        try {
            const contractJson = await fetch('/utils/contracts/ticket_manager_contract.json').then(r => r.json());
            const contract = new algosdk.ABIContract(contractJson);
            const method = contract.getMethodByName('cancel_ticket');

            const atc = new algosdk.AtomicTransactionComposer();
            const params = await algodClient.getTransactionParams().do();
            const sp = { ...params, fee: 3000, flatFee: true };

            // Box Key: "tickets" + Index (8 bytes)
            const ticketsPrefix = new TextEncoder().encode("tickets");
            const rawKey = algosdk.encodeUint64(ticket.index);
            const boxKey = new Uint8Array(ticketsPrefix.length + rawKey.length);
            boxKey.set(ticketsPrefix, 0);
            boxKey.set(rawKey, ticketsPrefix.length);

            atc.addMethodCall({
                appID: ticket.appId,
                method,
                methodArgs: [ticket.index], // Pass Index here, NOT AssetID
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

            setStatus('🎉 Ticket cancelled and refund processed!');
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (e: any) {
            console.error(e);
            setStatus(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const canCancel = () => {
        if (!eventData || !ticket) return false;

        const currentTime = Math.floor(Date.now() / 1000);
        // Status 0 (Pending) or 1 (Claimed) can be cancelled?
        // Code Step 379 snippet: cancel_ticket checks status is 0 or 1.
        // So both can be cancelled.
        const validStatus = ticket.status === 'pending' || ticket.status === 'claimed';
        const notExpired = currentTime < eventData.deadline;

        return validStatus && notExpired;
    };

    const calculateRefund = () => {
        if (!eventData) return { refund: 0, penalty: 0 };

        const price = eventData.price;
        const penaltyAmount = 0; // Penalty not implemented yet
        const refundAmount = price - penaltyAmount;

        return {
            refund: refundAmount / 1000000, // Convert to ALGO
            penalty: penaltyAmount / 1000000,
            originalPrice: price / 1000000
        };
    };

    if (!isOpen || !ticket) return null;

    const refundInfo = calculateRefund();
    const isEligible = canCancel();

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Cancel Ticket</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all">
                        ✕
                    </button>
                </div>

                {/* Ticket Info */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">{ticket.eventName}</h3>
                            <p className="text-sm text-gray-500">Ticket #{ticket.index}</p>
                        </div>
                    </div>
                </div>

                {/* Refund Details */}
                {eventData && (
                    <div className="bg-gray-50 rounded-2xl p-4 mb-6 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Original Price</span>
                            <span className="font-bold text-gray-900">{refundInfo.originalPrice} ALGO</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Penalty (0%)</span>
                            <span className="font-bold text-red-600">-{refundInfo.penalty} ALGO</span>
                        </div>
                        <div className="border-t pt-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-800">You'll Receive</span>
                                <span className="text-xl font-bold text-green-600">{refundInfo.refund} ALGO</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Eligibility Status */}
                <div className={`p-4 rounded-xl mb-6 ${isEligible
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                    <div className="flex items-center gap-2">
                        {isEligible ? (
                            <>
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm font-medium text-green-700">Eligible for cancellation</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm font-medium text-red-700">
                                    {ticket.status !== 'pending' && ticket.status !== 'claimed'
                                        ? 'Ticket cannot be cancelled (used or listed)'
                                        : 'Cancellation deadline has passed'
                                    }
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Status Message */}
                {status && (
                    <div className={`p-3 rounded-xl text-sm font-medium mb-4 ${status.includes('🎉') ? 'bg-green-50 text-green-700 border border-green-200' :
                            status.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' :
                                'bg-gray-50 text-gray-500 border border-gray-200'
                        }`}>
                        {status}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                    <Button
                        onClick={cancelTicket}
                        disabled={isLoading || !isEligible || !activeAccount}
                        className={`w-full py-3 ${isEligible
                                ? 'gradient-purple text-white shadow-brand hover:shadow-brand-lg'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Processing...
                            </span>
                        ) : isEligible ? 'Cancel Ticket & Get Refund' : 'Cannot Cancel'}
                    </Button>

                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                        className="w-full"
                    >
                        {isEligible ? 'Keep Ticket' : 'Close'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
