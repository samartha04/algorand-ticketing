# Required Skills for Algorand Event Ticketing Platform

To build and maintain this decentralized application (dApp), you need a combination of blockchain, frontend, and backend skills.

## 1. Blockchain Development (Algorand)
- **Smart Contracts (PyTeal)**: 
  - Writing Python code that compiles to TEAL (Transaction Execution Approval Language).
  - Understanding the **Application Binaries Interface (ABI)** (ARC-4) for defining methods and arguments.
  - Managing **Global State**, **Local State**, and **Box Storage** (critical for large data like ticket ownership).
  - Creating **Inner Transactions** (e.g., minting ASAs/NFTs directly from the smart contract).
- **Algorand SDKs**:
  - `algosdk` (TypeScript/JavaScript): Interacting with the blockchain (sending transactions, querying state).
  - `indexer`: Querying historical data (e.g., finding all events created by a factory).
- **Wallets & Security**:
  - Integrating wallets (Pera, Defly) using `@txnlab/use-wallet`.
  - Understanding **Atomic Transaction Groups** (grouping multiple actions into one fail-safe transaction).

## 2. Frontend Development
- **Frameworks**:
  - **React.js**: Component-based UI development.
  - **Next.js (App Router)**: Server-side rendering (SSR), routing, and API handling.
- **Language**:
  - **TypeScript**: Static typing for safer code, especially when dealing with complex blockchain data structures.
- **Styling**:
  - **Tailwind CSS**: Utility-first CSS for rapid UI development.
  - **shadcn/ui**: Reusable component library (based on Radix UI) for polished inputs, dialogs, and cards.

## 3. Web3 Concepts
- **Wallets & Accounts**: Understanding public/private keys, addresses, and signing transactions.
- **Testnet vs. Mainnet**: Using Testnet ensures you can develop without spending real money.
- **Faucets**: Obtaining test Algos to fund accounts.
- **Block Explorers**: Using tools like Pera Explorer or AlgoExplorer to debug transactions.

## 4. Specific Libraries Used
- **`qrcode.react`**: generating QR codes for ticket verification.
- **`lucide-react`**: Icons.
- **`axios` / `fetch`**: API requests.
