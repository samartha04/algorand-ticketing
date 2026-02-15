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
# Status: 0 = Pending, 1 = Claimed, 2 = Used, 3 = Listed for Resale, 4 = Cancelled
class TicketInfo(arc4.Struct):
    owner: arc4.Address
    status: arc4.UInt8
    resale_price: arc4.UInt64  # For resale listings


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
    cancellation_deadline: UInt64  # Unix timestamp for cancellation deadline
    penalty_percentage: UInt64     # Penalty percentage (0-100) for cancellations
    royalty_percentage: UInt64     # Royalty percentage (0-100) for resales

    # Box storage: ticket_id -> TicketInfo
    tickets: BoxMap[UInt64, TicketInfo]

    def __init__(self) -> None:
        self.price = UInt64(0)
        self.supply = UInt64(0)
        self.sold = UInt64(0)
        self.organizer = arc4.Address()
        self.cancellation_deadline = UInt64(0)
        self.penalty_percentage = UInt64(10)  # Default 10% penalty
        self.royalty_percentage = UInt64(5)    # Default 5% royalty
        self.tickets = BoxMap(UInt64, TicketInfo)

    @arc4.abimethod()
    def create_event(self, price: arc4.UInt64, supply: arc4.UInt64, cancellation_deadline: arc4.UInt64, penalty_percentage: arc4.UInt64, royalty_percentage: arc4.UInt64) -> None:
        """Initialize event with price, supply, cancellation deadline, penalty and royalty percentages. Only creator can call."""
        assert Txn.sender == Global.creator_address, "Only creator can initialize"
        assert penalty_percentage.native <= 100, "Penalty percentage cannot exceed 100"
        assert royalty_percentage.native <= 100, "Royalty percentage cannot exceed 100"
        
        self.price = price.native
        self.supply = supply.native
        self.sold = UInt64(0)
        self.organizer = arc4.Address(Txn.sender)
        self.cancellation_deadline = cancellation_deadline.native
        self.penalty_percentage = penalty_percentage.native
        self.royalty_percentage = royalty_percentage.native

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
            resale_price=arc4.UInt64(0),  # No resale price initially
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
            resale_price=ticket.resale_price,
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
            resale_price=ticket.resale_price,
        )

    @arc4.abimethod()
    def withdraw_funds(self, amount: arc4.UInt64) -> None:
        """Withdraw revenue from ticket sales. Only organizer can call."""
        assert Txn.sender == self.organizer.native, "Only organizer"

        itxn.Payment(
            receiver=Txn.sender,
            amount=amount.native,
        ).submit()

    @arc4.abimethod()
    def cancel_ticket(self, ticket_id: arc4.UInt64) -> None:
        """
        Cancel a ticket and refund with penalty. Only ticket owner can call.
        Penalty is deducted and sent to organizer, remainder goes to owner.
        """
        asset_id = ticket_id.native
        ticket = self.tickets[asset_id].copy()
        
        # Verify caller is the ticket owner
        assert Txn.sender == ticket.owner.native, "Not the ticket owner"
        
        # Must be in Pending (0) status
        assert ticket.status == arc4.UInt8(0), "Ticket already claimed"
        
        # Check cancellation deadline
        assert Global.latest_timestamp < self.cancellation_deadline, "Cancellation deadline passed"
        
        # Calculate penalty and refund amounts (handle case where penalty percentage is 0)
        if self.penalty_percentage.native > 0:
            penalty_amount = (self.price * self.penalty_percentage) // 100
        else:
            penalty_amount = UInt64(0)
        
        refund_amount = self.price - penalty_amount
        
        # Only send penalty if it's greater than 0
        if penalty_amount > 0:
            itxn.Payment(
                receiver=self.organizer.native,
                amount=penalty_amount,
            ).submit()
        
        # Send refund to ticket owner
        itxn.Payment(
            receiver=ticket.owner.native,
            amount=refund_amount,
        ).submit()
        
        # Update ticket status to Cancelled (4)
        self.tickets[asset_id] = TicketInfo(
            owner=ticket.owner,
            status=arc4.UInt8(4),
            resale_price=ticket.resale_price,
        )

    @arc4.abimethod()
    def list_for_resale(self, ticket_id: arc4.UInt64, resale_price: arc4.UInt64) -> None:
        """
        List a claimed ticket for resale. Only ticket owner can call.
        Sets resale price and changes status to Listed for Resale (3).
        """
        asset_id = ticket_id.native
        
        # First check if ticket exists
        if asset_id not in self.tickets:
            raise Exception("Ticket does not exist")
        
        ticket = self.tickets[asset_id].copy()
        
        # Verify caller is ticket owner
        assert Txn.sender == ticket.owner.native, "Not the ticket owner"
        
        # Must be in Claimed (1) status
        assert ticket.status == arc4.UInt8(1), "Ticket not in claimed state"
        
        # Validate resale price
        assert resale_price.native > 0, "Resale price must be greater than 0"
        
        # Update ticket with resale price and status
        self.tickets[asset_id] = TicketInfo(
            owner=ticket.owner,
            status=arc4.UInt8(3),  # Listed for Resale
            resale_price=resale_price,
        )

    @arc4.abimethod()
    def buy_resale_ticket(self, ticket_id: arc4.UInt64, payment: gtxn.PaymentTransaction) -> None:
        """
        Buy a ticket listed for resale. Transfers NFT to new owner.
        Payment goes to original owner minus royalty to organizer.
        """
        asset_id = ticket_id.native
        ticket = self.tickets[asset_id].copy()
        
        # Verify ticket is listed for resale
        assert ticket.status == arc4.UInt8(3), "Ticket not listed for resale"
        
        # Validate payment
        assert payment.receiver == Global.current_application_address, "Pay the contract"
        assert payment.amount == ticket.resale_price.native, "Incorrect payment amount"
        
        # Validate resale price is greater than 0
        assert ticket.resale_price.native > 0, "Invalid resale price"
        
        # Calculate royalty (handle case where royalty percentage is 0)
        if self.royalty_percentage.native > 0:
            royalty_amount = (ticket.resale_price.native * self.royalty_percentage) // 100
        else:
            royalty_amount = UInt64(0)
        
        owner_payment = ticket.resale_price.native - royalty_amount
        
        # Only send royalty if it's greater than 0
        if royalty_amount > 0:
            itxn.Payment(
                receiver=self.organizer.native,
                amount=royalty_amount,
            ).submit()
        
        # Send payment to original ticket owner
        itxn.Payment(
            receiver=ticket.owner.native,
            amount=owner_payment,
        ).submit()
        
        # Transfer NFT to new buyer
        itxn.AssetTransfer(
            xfer_asset=Asset(asset_id),
            asset_receiver=Txn.sender,
            asset_amount=1,
        ).submit()
        
        # Update ticket owner and status back to Claimed (1)
        self.tickets[asset_id] = TicketInfo(
            owner=arc4.Address(Txn.sender),
            status=arc4.UInt8(1),  # Claimed by new owner
            resale_price=arc4.UInt64(0),  # Reset resale price
        )

    @arc4.abimethod()
    def delist_resale_ticket(self, ticket_id: arc4.UInt64) -> None:
        """
        Remove a ticket from resale listing. Only ticket owner can call.
        Changes status back to Claimed (1).
        """
        asset_id = ticket_id.native
        ticket = self.tickets[asset_id].copy()
        
        # Verify caller is the ticket owner
        assert Txn.sender == ticket.owner.native, "Not the ticket owner"
        
        # Must be in Listed for Resale (3) status
        assert ticket.status == arc4.UInt8(3), "Ticket not listed for resale"
        
        # Update ticket status back to Claimed (1) and reset resale price
        self.tickets[asset_id] = TicketInfo(
            owner=ticket.owner,
            status=arc4.UInt8(1),  # Claimed
            resale_price=arc4.UInt64(0),  # Reset resale price
        )

    @arc4.abimethod(readonly=True)
    def get_event_info(self) -> arc4.Tuple[arc4.UInt64, arc4.UInt64, arc4.UInt64, arc4.UInt64, arc4.UInt64, arc4.UInt64]:
        """Read-only: returns (price, supply, sold, cancellation_deadline, penalty_percentage, royalty_percentage)."""
        return arc4.Tuple(
            (
                arc4.UInt64(self.price),
                arc4.UInt64(self.supply),
                arc4.UInt64(self.sold),
                arc4.UInt64(self.cancellation_deadline),
                arc4.UInt64(self.penalty_percentage),
                arc4.UInt64(self.royalty_percentage),
            )
        )

    @arc4.abimethod(readonly=True)
    def get_ticket_info(self, ticket_id: arc4.UInt64) -> TicketInfo:
        """Read-only: returns ticket information for the given ticket ID."""
        return self.tickets[ticket_id.native].copy()
