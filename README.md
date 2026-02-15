# 🎫 AlgoEvents — Decentralized Event Ticketing on Algorand

> **HackSeries 2 — Track 1: Future of Finance**
>
> A simple, user-friendly decentralized application that enables students and campus communities to create, sell, and manage event tickets using blockchain wallets, tokens, and smart contracts on Algorand.

![Algorand](https://img.shields.io/badge/Algorand-Testnet-685AFF?style=for-the-badge&logo=algorand)
![AlgoKit](https://img.shields.io/badge/AlgoKit-PuyaPy_v5-FF5B5B?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)

---

## 🎯 Problem Statement

Students and campus communities rely on centralized ticketing platforms that:
- **Charge high fees** (15–25% service charges)
- **Lack transparency** — no way to verify ticket authenticity
- **Enable scalping** — bots buy and resell at inflated prices
- **Provide no control** to organizers over the secondary market

## 💡 Our Solution

**AlgoEvents** is a fully decentralized event ticketing platform built on Algorand that gives organizers and attendees full control:

| Feature | How It Works |
|---|---|
| **NFT Tickets** | Each ticket is minted as a unique ASA (Algorand Standard Asset) on-chain |
| **Resale Market** | Attendees can resell tickets securely; organizers set price caps and earn royalties |
| **Cancellation** | Buyers can cancel tickets before a deadline for a refund (minus penalty) |
| **Transparent Pricing** | Ticket prices are set in the smart contract — no hidden fees |
| **Anti-Scalping** | Tickets are non-transferable until claimed; organizer controls the flow |
| **QR Verification** | Attendees show a QR code at the door; organizer verifies on-chain |
| **Instant Payouts** | Organizers withdraw revenue directly from the contract — no middleman |
| **Low Cost** | Algorand's ~0.001 ALGO tx fee vs. $5+ platform fees |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐│
│  │  Create   │ │Marketplace│ │My Tickets│ │  Organizer   ││
│  │  Event    │ │ (Browse)  │ │(Claim/QR)│ │  Dashboard   ││
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘│
│       │            │            │               │        │
│       └────────────┴────────────┴───────────────┘        │
│                         │  Pera Wallet                   │
│                         │  Resale/Cancel Actions         │
└─────────────────────────┼────────────────────────────────┘
                          │ algosdk
┌─────────────────────────┼────────────────────────────────┐
│           Algorand Testnet Blockchain                    │
│  ┌──────────────────┐  ┌───────────────────────────────┐ │
│  │  EventFactory     │  │  TicketManager (per event)    │ │
│  │  (Registry)       │  │  • create_event()             │ │
│  │  • register_event │  │  • buy_ticket()               │ │
│  │  • get_event()    │  │  • claim_ticket() / check_in()│ │
│  │  • get_event_count│  │  • cancel_ticket()            │ │
│  │                   │  │  • list_for_resale()          │ │
│  │  BoxMap: events   │  │  • buy_resale_ticket()        │ │
│  └──────────────────┘  │  BoxMap: tickets               │ │
│                        └───────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Smart Contracts** | **PyTeal** (Python) — compiled via **AlgoKit** utils |
| **Frontend** | Next.js 14, React 18, Tailwind CSS, Shadcn/UI |
| **Wallet** | Pera Wallet (`@txnlab/use-wallet`) |
| **SDK** | `algosdk` v2 |
| **Network** | Algorand TestNet (`testnet-api.algonode.cloud`) |
| **Contract Spec** | ARC-56 (auto-generated) |

---

## 📁 Project Structure

```
web3/
├── smart-contracts/
│   ├── algokit_contracts/           # Smart Contract Logic (PyTeal)
│   │   ├── ticket_manager.py        # Main ticketing contract + Resale
│   │   ├── event_factory.py         # Event registry contract
│   │   └── artifacts/               # Compiled TEAL & JSON
│   ├── compile.py                   # Build script (compiles & copies to frontend)
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   ├── create-event/page.tsx    # Create & deploy events
│   │   ├── events/page.tsx          # Marketplace (standard & resale)
│   │   ├── my-tickets/page.tsx      # View, claim, cancel, resell tickets
│   │   ├── verify/page.tsx          # Organizer dashboard
│   │   └── event/[id]/page.tsx      # Event detail page
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── RefundModal.tsx          # Cancellation UI
│   │   ├── ResaleModal.tsx          # Resale listing UI
│   │   └── ...
│   ├── utils/
│   │   ├── events.ts
│   │   └── signer.ts
│   └── public/utils/contracts/      # Compiled contracts (auto-copied)
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+
- **Python** v3.10+ (for contract compilation)
- **Pera Wallet** (mobile app or browser extension, set to **TestNet**)

### 1. Clone & Install

```bash
git clone https://github.com/samartha04/algorand-ticketing.git
cd algorand-ticketing/frontend
npm install
```

### 2. Run the Frontend

```bash
npm run dev
# → Opens at http://localhost:3000
```

### 3. Get Test ALGO

1. Open Pera Wallet → switch to **TestNet**
2. Visit [Algorand Testnet Faucet](https://bank.testnet.algorand.network/)
3. Dispense 10+ ALGO to your wallet address

### 4. Compile Contracts (Optional)

Pre-compiled contracts are included. To modify and rebuild:

```bash
cd smart-contracts
# Setup venv if needed
python compile.py
```
This will compile `ticket_manager.py` and `event_factory.py` (PyTeal), generating artifacts in `algokit_contracts/` and copying them to `frontend/public/utils/contracts/`.

---

## 📖 User Flow

### For Event Organizers
1. **Connect** Pera Wallet
2. **Create Event** → Deploy Factory (one-time) → Deploy Event Contract → Set price, supply, & cancellation deadline
3. **Share** the Factory App ID with attendees
4. **Verify** tickets at the door using the Organizer Dashboard
5. **Withdraw** revenue from ticket sales

### For Attendees
1. **Connect** Pera Wallet
2. **Browse** events on the Marketplace (enter Factory App ID)
3. **Buy** a ticket (Primary Market) or **Buy Resale** (Secondary Market)
4. **Claim** the ticket (transfers NFT to your wallet)
5. **Manage Ticket**:
   - **Show QR**: Entry verification
   - **Cancel**: Request refund (if before deadline)
   - **List for Resale**: Sell to others if you can't go

---

## 🔗 Smart Contract Methods

### TicketManager (per event)
| Method | Description | Access |
|---|---|---|
| `create_event(price, supply)` | Initialize event with ticket price and supply | Creator only |
| `buy_ticket(payment)` | Purchase ticket; mints NFT | Any user |
| `claim_ticket(ticket_index)` | Transfer NFT to buyer's wallet | Ticket owner |
| `cancel_ticket(ticket_index)` | Refund ticket (minus penalty) & return NFT | Pending/Claimed owner |
| `list_for_resale(index, price)` | List claimed ticket for secondary sale | Ticket owner |
| `delist_resale_ticket(index)` | Remove ticket from resale market | Ticket owner |
| `buy_resale_ticket(index, pay)` | Buy listed ticket from another user | Any user |
| `check_in(ticket_index)` | Mark ticket as used at venue | Organizer only |
| `withdraw_funds(amount)` | Withdraw sales revenue | Organizer only |
| `get_event_info()` | Returns (price, supply, sold) | Read-only |

### EventFactory (global registry)
| Method | Description | Access |
|---|---|---|
| `register_event(app_id, name)` | Register a new event | Any user |
| `get_event_count()` | Total registered events | Read-only |
| `get_event(index)` | Get event details by index | Read-only |

---

## 🔑 Key Algorand Features Used

- **ASAs (Algorand Standard Assets)** — Tickets as unique NFTs
- **Inner Transactions** — Contract mints, transfers, and claws back ASAs autonomously
- **Box Storage** — Scalable on-chain storage for ticket metadata and resale listings
- **Atomic Transfers** — Payment + ticket delivery in single transactions
- **Smart Contract Logic** — Enforced logic for refunds, resale royalties, and event lifecycle
- **ARC-4 ABI** — Typed method calls for contract interaction

---

## 📄 License

MIT

---

Built with ❤️ on Algorand for HackSeries 2
