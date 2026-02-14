"use client";

import React, { createContext, useContext, useState } from 'react';
import Link from 'next/link';

type TxState = 'idle' | 'pending' | 'success' | 'failed';
type TxStatus = {
    state: TxState;
    message?: string;
    txId?: string;
    explorerUrl?: string;
};

const TxStatusContext = createContext<{
    status: TxStatus;
    setStatus: (s: TxStatus) => void;
}>({ status: { state: 'idle' }, setStatus: () => { } });

export const TxStatusProvider = ({ children }: { children: React.ReactNode }) => {
    const [status, setStatus] = useState<TxStatus>({ state: 'idle' });

    return (
        <TxStatusContext.Provider value={{ status, setStatus }}>
            {children}
            <TxStatusToast />
        </TxStatusContext.Provider>
    );
};

export const useTxStatus = () => useContext(TxStatusContext);

function TxStatusToast() {
    const { status, setStatus } = useTxStatus();

    if (status.state === 'idle') return null;

    const bg = status.state === 'failed' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800';

    return (
        <div className={`fixed bottom-6 right-6 max-w-sm w-full border rounded-lg p-4 shadow-lg ${bg}`} role="status">
            <div className="flex items-start gap-3">
                <div className="flex-1">
                    <div className="font-medium">{status.state === 'pending' ? 'Transaction pending' : status.state === 'success' ? 'Transaction confirmed' : 'Transaction failed'}</div>
                    {status.message && <div className="text-sm mt-1">{status.message}</div>}
                    {status.txId && status.explorerUrl && (
                        <div className="mt-2 text-sm">
                            <a href={status.explorerUrl} target="_blank" rel="noreferrer" className="underline">View on Explorer</a>
                        </div>
                    )}
                </div>
                <div>
                    <button className="text-xs underline" onClick={() => setStatus({ state: 'idle' })}>Dismiss</button>
                </div>
            </div>
        </div>
    );
}
