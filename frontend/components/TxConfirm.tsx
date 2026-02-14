"use client";

import React from 'react';
import { Button } from '@/components/ui/button';

export default function TxConfirm({
    open,
    title = 'Confirm Transaction',
    message,
    amountALGO,
    feeALGO,
    reserveALGO,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    title?: string;
    message?: string;
    amountALGO?: number;
    feeALGO?: number;
    reserveALGO?: number;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                {message && <p className="text-sm text-gray-600 mb-4">{message}</p>}

                <div className="space-y-2 mb-4">
                    {typeof amountALGO === 'number' && (
                        <div className="flex justify-between text-sm text-gray-700">
                            <span>Amount</span>
                            <span className="font-mono">{amountALGO.toFixed(6)} ALGO</span>
                        </div>
                    )}
                    {typeof feeALGO === 'number' && (
                        <div className="flex justify-between text-sm text-gray-700">
                            <span>Network fee</span>
                            <span className="font-mono">{feeALGO.toFixed(6)} ALGO</span>
                        </div>
                    )}
                    {typeof reserveALGO === 'number' && reserveALGO > 0 && (
                        <div className="flex justify-between text-sm text-gray-700">
                            <span>Estimated reserve locked</span>
                            <span className="font-mono">{reserveALGO.toFixed(6)} ALGO</span>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 justify-end">
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button onClick={onConfirm}>Confirm</Button>
                </div>
            </div>
        </div>
    );
}
