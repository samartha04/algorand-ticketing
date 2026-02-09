from pyteal import *

# Main Router
router = Router(
    "TicketManager",
    BareCallActions(
        no_op=OnCompleteAction.create_only(Approve()),
        opt_in=OnCompleteAction.always(Approve()),
        close_out=OnCompleteAction.always(Approve()),
        update_application=OnCompleteAction.always(Return(Txn.sender() == Global.creator_address())),
        delete_application=OnCompleteAction.always(Return(Txn.sender() == Global.creator_address())),
    ),
)

# Global State Keys
PRICE = Bytes("Price")
SUPPLY = Bytes("Supply")
SOLD = Bytes("Sold")
ORGANIZER = Bytes("Organizer")

@router.method
def create_event(price: abi.Uint64, supply: abi.Uint64):
    return Seq(
        App.globalPut(PRICE, price.get()),
        App.globalPut(SUPPLY, supply.get()),
        App.globalPut(SOLD, Int(0)),
        App.globalPut(ORGANIZER, Txn.sender()),
    )

@router.method
def buy_ticket(payment: abi.PaymentTransaction):
    return Seq(
        # Checks
        Assert(payment.get().receiver() == Global.current_application_address()),
        Assert(payment.get().amount() == App.globalGet(PRICE)),
        Assert(App.globalGet(SOLD) < App.globalGet(SUPPLY)),
        
        # Increment Sold
        App.globalPut(SOLD, App.globalGet(SOLD) + Int(1)),
        
        # Inner Txn: Mint NFT
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetConfig,
            TxnField.config_asset_total: Int(1),
            TxnField.config_asset_decimals: Int(0),
            TxnField.config_asset_default_frozen: Int(0),
            TxnField.config_asset_name: Bytes("TICKET"),
            TxnField.config_asset_unit_name: Bytes("TKT"),
            TxnField.config_asset_manager: Global.current_application_address(),
        }),
        InnerTxnBuilder.Submit(),
        
        # Store Ticket ID -> Owner in Box
        # Key: Ticket Asset ID (Uint64)
        # Value: Owner Address (32 bytes) + Status (1 byte: 0=Pending, 1=Claimed, 2=Used)
        App.box_put(Itob(InnerTxn.created_asset_id()), Concat(Txn.sender(), Bytes("\x00"))),
    )

@router.method
def claim_ticket(ticket_id: abi.Uint64):
    # Box Key
    box_key = Itob(ticket_id.get())
    
    # Read Box
    box_val = App.box_get(box_key)
    
    # Extract Owner and Status
    owner = ScratchVar()
    status = ScratchVar()
    
    return Seq(
        # Execute Box Get
        box_val,
        
        # Verify Box Exists
        Assert(box_val.hasValue()),
        
        # Parse Value using Extract(bytes, start, length)
        owner.store(Extract(box_val.value(), Int(0), Int(32))), 
        status.store(Extract(box_val.value(), Int(32), Int(1))), 
        
        # Verify Caller is Owner
        Assert(Txn.sender() == owner.load()),
        
        # Verify Status is 'Pending' (0) or 'Claimed' (1)
        Assert(status.load() == Bytes("\x00")),
        
        # Inner Txn: Transfer Asset
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.xfer_asset: ticket_id.get(),
            TxnField.asset_receiver: Txn.sender(),
            TxnField.asset_amount: Int(1),
        }),
        InnerTxnBuilder.Submit(),
        
        # Update Status to 'Claimed' (1)
        App.box_replace(box_key, Int(32), Bytes("\x01")),
    )

@router.method
def check_in(ticket_id: abi.Uint64):
    # Determine box key
    box_key = Itob(ticket_id.get())
    
    # Box Check
    box_val = App.box_get(box_key)
    
    # Parse
    status = ScratchVar()

    return Seq(
        # Execute Box Get
        box_val,
        
        # Verify Box Exists
        Assert(box_val.hasValue()),
        
        # Verify Caller is Organizer
        Assert(Txn.sender() == App.globalGet(ORGANIZER)),
        
        # Get Status using Extract(bytes, start, length)
        status.store(Extract(box_val.value(), Int(32), Int(1))),
        
        # Verify Status is 'Claimed' (1) for entry. 
        Assert(status.load() == Bytes("\x01")),
        
        # Mark as Used (2)
        App.box_replace(box_key, Int(32), Bytes("\x02")),
    )

if __name__ == "__main__":
    import os
    import json

    path = os.path.dirname(os.path.abspath(__file__))
    approval, clear, contract = router.compile_program(version=8)
    
    with open(os.path.join(path, "ticket_manager_approval.teal"), "w") as f:
        f.write(approval)
        
    with open(os.path.join(path, "ticket_manager_clear.teal"), "w") as f:
        f.write(clear)
        
    with open(os.path.join(path, "ticket_manager_contract.json"), "w") as f:
        f.write(json.dumps(contract.dictify(), indent=4))
