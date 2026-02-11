"""
Ticket Manager Smart Contract — Algorand Python (ARC4)

This contract manages event ticketing on the Algorand blockchain.
Features:
  - Event creation with configurable price and supply
  - NFT ticket minting on purchase (atomic inner txns)
  - Ticket claiming (transfer NFT to buyer)
  - On-chain check-in (organizer marks ticket as used)
  - Revenue withdrawal by organizer
"""

from algopy import (
    ARC4Contract,
    Asset,
    BoxMap,
    Global,
    Txn,
    UInt64,
    arc4,
    gtxn,
    itxn,
    op,
    subroutine,
)


# Ticket status: 33 bytes total (32-byte address + 1 status byte)
# Status: 0 = Pending, 1 = Claimed, 2 = Used
class TicketInfo(arc4.Struct):
    owner: arc4.Address
    status: arc4.UInt8


class TicketManager(ARC4Contract):
    """
    Manages event tickets as on-chain NFTs (ASAs).
    Each ticket is a unique ASA minted by the contract.
    Ticket metadata is stored in boxes keyed by asset ID.
    """

    # Global state
    price: UInt64
    supply: UInt64
    sold: UInt64
    organizer: arc4.Address

    # Box storage: ticket_id -> TicketInfo
    tickets: BoxMap[UInt64, TicketInfo]

    def __init__(self) -> None:
        self.price = UInt64(0)
        self.supply = UInt64(0)
        self.sold = UInt64(0)
        self.organizer = arc4.Address()
        self.tickets = BoxMap(UInt64, TicketInfo)

    @arc4.abimethod()
    def create_event(self, price: arc4.UInt64, supply: arc4.UInt64) -> None:
        """Initialize event with price (microAlgos) and ticket supply. Only creator can call."""
        assert Txn.sender == Global.creator_address, "Only creator can initialize"
        self.price = price.native
        self.supply = supply.native
        self.sold = UInt64(0)
        self.organizer = arc4.Address(Txn.sender)

    @arc4.abimethod()
    def buy_ticket(self, payment: gtxn.PaymentTransaction) -> arc4.UInt64:
        """
        Purchase a ticket. Requires a payment transaction for the ticket price.
        Mints a unique NFT and stores buyer info in a box.
        Returns the minted asset ID.
        """
        # Validate payment
        assert payment.receiver == Global.current_application_address, "Pay the contract"
        assert payment.amount == self.price, "Incorrect payment amount"
        assert self.sold < self.supply, "Sold out"

        # Increment sold count
        self.sold += 1

        # Mint NFT ticket via inner transaction
        ticket_asset = (
            itxn.AssetConfig(
                total=1,
                decimals=0,
                default_frozen=False,
                asset_name=b"TICKET",
                unit_name=b"TKT",
                manager=Global.current_application_address,
            )
            .submit()
            .created_asset
        )

        # Store ticket info in box
        self.tickets[ticket_asset.id] = TicketInfo(
            owner=arc4.Address(Txn.sender),
            status=arc4.UInt8(0),  # Pending
        )

        return arc4.UInt64(ticket_asset.id)

    @arc4.abimethod()
    def claim_ticket(self, ticket_id: arc4.UInt64) -> None:
        """
        Claim a purchased ticket. Transfers the NFT to the buyer.
        Buyer must opt-in to the ASA before calling this.
        """
        asset_id = ticket_id.native
        ticket = self.tickets[asset_id].copy()

        # Verify caller is the ticket owner
        assert Txn.sender == ticket.owner.native, "Not the ticket owner"

        # Verify status is Pending (0)
        assert ticket.status == arc4.UInt8(0), "Ticket already claimed"

        # Transfer NFT to buyer via inner transaction
        itxn.AssetTransfer(
            xfer_asset=Asset(asset_id),
            asset_receiver=Txn.sender,
            asset_amount=1,
        ).submit()

        # Update status to Claimed (1)
        self.tickets[asset_id] = TicketInfo(
            owner=ticket.owner,
            status=arc4.UInt8(1),
        )

    @arc4.abimethod()
    def check_in(self, ticket_id: arc4.UInt64) -> None:
        """
        Mark a ticket as used (check-in at the venue).
        Only the organizer can call this.
        """
        asset_id = ticket_id.native
        ticket = self.tickets[asset_id].copy()

        # Only organizer can verify
        assert Txn.sender == self.organizer.native, "Only organizer"

        # Must be in Claimed (1) status
        assert ticket.status == arc4.UInt8(1), "Ticket not in claimed state"

        # Update to Used (2)
        self.tickets[asset_id] = TicketInfo(
            owner=ticket.owner,
            status=arc4.UInt8(2),
        )

    @arc4.abimethod()
    def withdraw_funds(self, amount: arc4.UInt64) -> None:
        """Withdraw revenue from ticket sales. Only organizer can call."""
        assert Txn.sender == self.organizer.native, "Only organizer"

        itxn.Payment(
            receiver=Txn.sender,
            amount=amount.native,
        ).submit()

    @arc4.abimethod(readonly=True)
    def get_event_info(self) -> arc4.Tuple[arc4.UInt64, arc4.UInt64, arc4.UInt64]:
        """Read-only: returns (price, supply, sold)."""
        return arc4.Tuple(
            (arc4.UInt64(self.price), arc4.UInt64(self.supply), arc4.UInt64(self.sold))
        )
