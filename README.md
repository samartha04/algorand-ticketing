# Decentralized Event Ticketing Platform (Algorand)

A transparent, decentralized event ticketing platform built on the Algorand blockchain to eliminate scalping and provide verifiable ticket ownership.

## Features

- **Event Creation & Management**: Create events, set ticket tiers, and define supply.
- **Ticket Minting**: Issue tickets as Algorand Standard Assets (ASAs).
- **Secure Purchases**: Atomic transfers for instant, trustless ticket buying.
- **QR Entry Verification**: On-chain verification for event entry using QR codes.
- **Secondary Market**: Controlled resale with price caps and royalties.

## Tech Stack

- **Smart Contracts**: PyTeal (Python)
- **Frontend**: Next.js (React), Tailwind CSS, Shadcn/UI
- **Wallet Integration**: Pera Wallet, Defly
- **Storage**: IPFS (Pinata)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.10+)
- [Docker](https://www.docker.com/) (Recommended for Algorand Sandbox)

## Setup

1.  **Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

2.  **Smart Contracts**:
    ```bash
    cd smart-contracts
    pip install -r requirements.txt
    # Contracts are in smart-contracts/ directory
    ```

## Development

This project uses PyTeal for smart contracts.

### Smart Contracts
Located in `smart-contracts/`. The core logic resides in `event_factory.py` and `ticket_manager.py`.

### Frontend
Located in `frontend/`. Uses `algosdk` for blockchain interaction.

## License
MIT
