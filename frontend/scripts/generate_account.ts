import algosdk from 'algosdk';

const account = algosdk.generateAccount();
const mnemonic = algosdk.secretKeyToMnemonic(account.sk);

console.log("=== NEW ALGORAND TESTNET ACCOUNT ===");
console.log(`Address: ${account.addr}`);
console.log(`Mnemonic: ${mnemonic}`);
console.log("====================================");
console.log("Please fund this account using the Testnet Faucet: https://bank.testnet.algorand.network/");
console.log("Then add the MNEMONIC to your .env file as DEPLOYER_MNEMONIC.");
