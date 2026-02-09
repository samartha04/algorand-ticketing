import algosdk from 'algosdk';

const algodToken = '';
const algodServer = 'https://testnet-api.algonode.cloud'; // Using Algonode for free access
const algodPort = 443;

export const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

export const indexerClient = new algosdk.Indexer(
    '',
    'https://testnet-idx.algonode.cloud',
    443
);

export const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const convertToMicroAlgos = (algos: number) => {
    return algos * 1000000;
};

export const convertToAlgos = (microAlgos: number) => {
    return microAlgos / 1000000;
};
