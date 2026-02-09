import { algodClient } from '../utils/algorand';
import algosdk from 'algosdk';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from frontend root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const checkBalance = async () => {
    const mnemonic = process.env.DEPLOYER_MNEMONIC;
    if (!mnemonic) {
        console.error("No MNEMONIC found in .env");
        return;
    }

    try {
        const account = algosdk.mnemonicToSecretKey(mnemonic);
        console.log(`Checking balance for: ${account.addr}`);

        const accountInfo = await algodClient.accountInformation(account.addr).do();
        const balance = accountInfo.amount;

        console.log(`Balance: ${algosdk.microalgosToAlgos(balance)} ALGO`);

        if (balance < 1000000) { // Less than 1 ALGO
            console.log("⚠️  Account balance is low! Please check the Dispenser.");
        } else {
            console.log("✅ Account funded and ready.");
        }
    } catch (e: any) {
        console.error("Error checking balance:", e.message);
    }
};

checkBalance();
