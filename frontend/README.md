# Algorand Event Ticketing & Verification Platform

A decentralized application (dApp) for managing events and tickets on the Algorand blockchain.

## 🚀 Getting Started

### Prerequisites
1.  **Node.js** (v18 or later)
2.  **Algorand Wallet** (Testnet-compatible)
    -   Recommended: **Pera Wallet** (Mobile) or **Defly Wallet**.
    -   Switch your wallet network to **Testnet** in Developer Settings.
    -   Fund your wallet using a [Testnet Dispenser](https://bank.testnet.algorand.network/).

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    cd frontend
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 Usage Guide

### 1. Connect Your Wallet
-   Click the **Connect Wallet** button in the top-right corner.
-   Scan the QR code with your Pera/Defly mobile app.
-   Ensure you are connected to **Testnet**.

### 2. For Organizers: Creating an Event
1.  Navigate to **Create Event**.
2.  (First Time Only) You may need to deploy an **Event Factory**. Enter "0" in the Factory ID field and click **Deploy New**. Note the new App ID.
3.  Fill in the event details:
    -   **Event Name**: e.g., "Summer Concert 2024"
    -   **Price**: In MicroAlgos (1 Algo = 1,000,000 MicroAlgos).
    -   **Supply**: Total number of tickets available.
4.  Click **Deploy Event Contract**.
5.  Your wallet will prompt you to sign a transaction to deploy the smart contract.
6.  Once deployed, the event is registered on the blockchain!

### 3. For Attendees: Managing Tickets
*Note: Currently, tickets must be distributed by the organizer or bought via a script (Marketplace UI coming soon).*

1.  Navigate to **My Tickets**.
2.  Enter the **Factory App ID** (ask the organizer or use the one from step 2).
3.  Click **Refresh Tickets**.
4.  **Pending Tickets**: If you have a ticket assigned to you (but not yet in your wallet), it will appear here. Click **Claim Ticket** to opt-in and receive the NFT.
5.  **Ready Tickets**: Once claimed, click **View QR** to generate your entry code.

### 4. For Staff: Verifying Tickets
1.  Navigate to **Verify (Admin)**.
2.  Enter the **Event App ID** and the **Ticket Asset ID** (from the attendee's QR code).
3.  Click **Check In**.
4.  The system verifies:
    -   Does this ticket exist?
    -   Does the attendee own it?
    -   Has it already been used?
5.  If valid, the ticket status updates to **Used** on-chain.

---

## 🛠 Tech Stack
-   **Frontend**: Next.js, Tailwind CSS, Shadcn UI
-   **Blockchain**: Algorand (Testnet)
-   **Smart Contracts**: PyTeal (Python)
-   **Wallet Connection**: @txnlab/use-wallet
