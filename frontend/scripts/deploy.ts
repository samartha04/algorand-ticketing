import { algodClient } from '../utils/algorand';
import algosdk from 'algosdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Load compiled contracts
const getContract = (name: string) => {
    // Assuming script is in frontend/scripts, and contracts are in root/smart-contracts
    // Go up two levels: frontend/scripts -> frontend -> root
    const rootDir = path.resolve(__dirname, '..', '..');
    const contractsDir = path.join(rootDir, 'smart-contracts');

    const approvalPath = path.join(contractsDir, `${name}_approval.teal`);
    const clearPath = path.join(contractsDir, `${name}_clear.teal`);

    console.log(`Loading contracts from: ${contractsDir}`);

    return {
        approval: fs.readFileSync(approvalPath, 'utf8'),
        clear: fs.readFileSync(clearPath, 'utf8')
    };
};

const compileProgram = async (programSource: string) => {
    const result = await algodClient.compile(programSource).do();
    return new Uint8Array(Buffer.from(result.result, 'base64'));
};

const deployEventFactory = async () => {
    const mnemonic = process.env.DEPLOYER_MNEMONIC;

    if (!mnemonic) {
        console.error("Please set DEPLOYER_MNEMONIC in .env file");
        return;
    }

    try {
        const account = algosdk.mnemonicToSecretKey(mnemonic);
        console.log(`Deploying from account: ${account.addr}`);

        const contracts = getContract('event_factory');

        const approvalBin = await compileProgram(contracts.approval);
        const clearBin = await compileProgram(contracts.clear);

        const onComplete = algosdk.OnApplicationComplete.NoOpOC;
        const txn = algosdk.makeApplicationCreateTxnFromObject({
            from: account.addr,
            suggestedParams: await algodClient.getTransactionParams().do(),
            onComplete,
            approvalProgram: approvalBin,
            clearProgram: clearBin,
            numGlobalByteSlices: 0,
            numGlobalInts: 1, // EventCount
            numLocalByteSlices: 0,
            numLocalInts: 0,
            appArgs: [],
        });

        const signedTxn = txn.signTxn(account.sk);
        const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
        console.log(`Transaction submitted: ${txId}`);

        const result = await algosdk.waitForConfirmation(algodClient, txId, 4);
        console.log(`Contract deployed! App ID: ${result['application-index']}`);

    } catch (e) {
        console.error("Deployment failed:", e);
    }
};

deployEventFactory();
