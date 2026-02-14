# Testnet ALGO Quick Cheat‑Sheet

Purpose: quick reference for how Testnet ALGO is used in this project (deploying contracts, creating events, buying & claiming tickets, and debugging).

## Key numbers & units
- 1 ALGO = 1,000,000 microAlgos (µA).
- Typical network fee per transaction: 1,000 µA = 0.001 ALGO.
- Base minimum balance per account: ~100,000 µA = 0.1 ALGO.
- ASA opt‑in reserve (per asset): ~100,000 µA = 0.1 ALGO.
- Typical extra fee to cover inner txns: 2,000–3,000 µA (0.002–0.003 ALGO).
- Recommended test funding per account: 10 ALGO (safe for multiple deploys/tests).

## Short concepts (plain language)
- Fees: every blockchain action (create event, buy, claim, withdraw) requires a tiny fee paid by the transaction sender — this is a network fee, not a platform charge.
- Payments to the contract: when you buy a ticket you send ALGO to the event contract; that money sits in the contract until the organizer withdraws it.
- Locked reserves (minimum balance): accounts must keep a reserved balance. Holding an NFT (ASA) or contract storage increases required reserve; those amounts are not spendable.
- Opt‑in: to receive an ASA you must opt‑in; opt‑in costs a transaction fee and increases your account reserve by ~0.1 ALGO.
- Inner transactions: contracts may mint or transfer assets internally (inner txns). The caller of the app-call must include extra fee units to cover inner txns.
- Boxes/state: storing per-ticket data in contract boxes increases the contract account’s reserve; organizers typically fund the contract on creation to cover this.

## Typical flows & numeric examples (Testnet)

Notes: use 1 ALGO = 1,000,000 µA.

1) Organizer — Deploy event and fund contract
- Actions: app create (deploy), fund app (example UI funds 1 ALGO), initialize app.
- Typical costs:
  - App create fee: 0.001 ALGO
  - App funding amount (example): 1.000 ALGO (sent to app to cover reserves)
  - Init/app-call fee: 0.001–0.003 ALGO
- Example immediate outflow: ≈ 1.002–1.005 ALGO. The contract then holds ~1 ALGO to satisfy min balances and inner txn needs.

2) Buyer — Purchase one ticket (ticket price = 1 ALGO example)
- Actions: payment (buyer → app) + app-call (buy)
- Costs:
  - Ticket price: 1.000 ALGO (transferred into contract)
  - Payment txn fee: 0.001 ALGO
  - App-call fee (to cover inner ASA mint): ~0.002–0.003 ALGO
- Buyer outflow: ≈ 1.003–1.004 ALGO
- Additional locked amount after claim (if buyer must opt-in): opt-in fee 0.001 ALGO + reserve 0.1 ALGO (total locked ≈ 0.101 ALGO)

3) Buyer — Claim ticket (if opt-in required at claim)
- Actions: opt-in (if needed), app-call to claim (contract does inner transfer)
- Costs:
  - Opt-in fee: 0.001 ALGO + reserve 0.1 ALGO (locked)
  - Claim app-call fee: ~0.002 ALGO
- Net: small fees plus ~0.1 ALGO reserve locked in buyer’s account for holding the ASA.

4) Organizer — Withdraw funds
- Actions: call withdraw; contract performs inner payment to organizer
- Costs:
  - Withdraw call fee: ~0.002 ALGO (caller pays)
  - Amount withdrawn is sent from app balance to organizer (contract must retain enough for min-balances)

## Practical tips
- Keep a 0.2 ALGO buffer in your wallet for fees and opt-ins during testing.
- When a UI call sets `fee = 2000` or `3000` µA, that increase pays for inner transactions; expect that extra when approving the txn in your wallet.
- If you see "minimum balance" errors, the app or account needs additional ALGO to satisfy reserves (fund the account or the contract).
- For repeated testing, use a dedicated deployer funded with ~10 ALGO.

## Where to inspect the code (quick links)
- Contract ticket logic: [smart-contracts/ticket_manager.py](smart-contracts/ticket_manager.py)
- Create event UI: [frontend/app/create-event/page.tsx](frontend/app/create-event/page.tsx)
- Event page / buy: [frontend/app/event/[id]/page.tsx](frontend/app/event/[id]/page.tsx)
- My tickets: [frontend/app/my-tickets/page.tsx](frontend/app/my-tickets/page.tsx)
- Deploy helper script: [frontend/scripts/deploy.ts](frontend/scripts/deploy.ts)

## Quick checklist before testing
- [ ] Wallet connected to Testnet.
- [ ] Deployer/purchaser funded (recommended 10 ALGO for deployer).
- [ ] Contract deployed (if necessary) and app ID recorded.
- [ ] Accounts opt‑in if contract requires local state or if you plan to hold ASAs.
- [ ] Keep transaction IDs for failed txns and inspect them in the TestNet explorer.
