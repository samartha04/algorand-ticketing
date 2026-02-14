import algosdk from 'algosdk';

/**
 * Bypasses ATC's TransactionSigner interface entirely.
 * Instead, we use ATC just to build the transaction group (ABI encoding + group IDs),
 * then sign with use-wallet's signTransactions and send via algodClient directly.
 */
export async function executeATC(
    atc: algosdk.AtomicTransactionComposer,
    algodClient: algosdk.Algodv2,
    signTransactions: (txns: Uint8Array[], indexesToSign?: number[], returnGroup?: boolean) => Promise<Uint8Array[]>,
    waitRounds: number = 4,
    onStatus?: (s: { state: 'pending' | 'success' | 'failed'; message?: string; txId?: string; explorerUrl?: string }) => void
): Promise<{ txIDs: string[], confirmedRound: number }> {
    // 1. Build the transaction group
    const txnGroup = atc.buildGroup();
    const txns = txnGroup.map(tws => tws.txn);

    // 2. Prepare for signing
    // CRITICAL FIX: We must explicitly ask the wallet to sign ALL transactions in the group.
    // Pera Wallet (and others) may re-calculate Group IDs if they modify transaction fields (e.g. adding genesis info).
    // If we don't ask to sign all of them, we might get back a mix of signed (modified, new Group ID) 
    // and unsigned (original, old Group ID) transactions, leading to "incomplete group" or "invalid signature" errors.
    // By passing indexesToSign for everything, we ensure consistency.
    const indexesToSign = txns.map((_, i) => i);
    const encoded = txns.map(txn => algosdk.encodeUnsignedTransaction(txn));

    // 3. Sign using use-wallet
    // pass returnGroup=true to keep the sequence intact
    if (onStatus) onStatus({ state: 'pending', message: 'Waiting for wallet signature...' });
    const signedTxns = await signTransactions(encoded, indexesToSign, true);

    // 4. Validate and Filter
    // Ensure we have the same number of transactions
    if (signedTxns.length !== txns.length) {
        throw new Error(`Mismatch in signed transactions count. Expected ${txns.length}, got ${signedTxns.length}`);
    }

    // Filter out nulls and ensure validity
    const validTxns = signedTxns.filter(t => t && t.length > 0);

    if (validTxns.length === 0) {
        throw new Error('No valid signed transactions returned');
    }

    try {
        // 5. Send to Network
        const { txId } = await algodClient.sendRawTransaction(validTxns).do();

        if (onStatus) onStatus({ state: 'pending', message: 'Transaction broadcasted to network', txId, explorerUrl: `https://testnet.algoexplorer.io/tx/${txId}` });

        // 6. Wait for confirmation
        const result = await algosdk.waitForConfirmation(algodClient, txId, waitRounds);
        const confirmedRound = result['confirmed-round'] || 0;
        const txIDs = txns.map(txn => txn.txID());

        if (onStatus) onStatus({ state: 'success', message: 'Transaction confirmed', txId, explorerUrl: `https://testnet.algoexplorer.io/tx/${txId}` });

        return { txIDs, confirmedRound };
    } catch (err: any) {
        if (onStatus) onStatus({ state: 'failed', message: err?.message || 'Transaction failed' });
        throw err;
    }
}

/**
 * A no-op signer.
 */
export const dummySigner: algosdk.TransactionSigner = async (
    _txnGroup: algosdk.Transaction[],
    _indexesToSign: number[]
): Promise<Uint8Array[]> => {
    return _indexesToSign.map(() => new Uint8Array());
};
