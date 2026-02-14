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
        # Only Creator can initialize
        Assert(Txn.sender() == Global.creator_address()),
        App.globalPut(PRICE, price.get()),
        App.globalPut(SUPPLY, supply.get()),
        App.globalPut(SOLD, Int(0)), 
        App.globalPut(ORGANIZER, Txn.sender()),
    )

@router.method
def buy_ticket(payment: abi.PaymentTransaction):
    sold_count = App.globalGet(SOLD)
    supply = App.globalGet(SUPPLY)
    
    return Seq(
        # Checks
        Assert(payment.get().receiver() == Global.current_application_address()),
        Assert(payment.get().amount() == App.globalGet(PRICE)),
        Assert(sold_count < supply), 
        
        # Increment Sold
        App.globalPut(SOLD, sold_count + Int(1)),
        
        # Inner Txn: Mint NFT
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetConfig,
            TxnField.config_asset_total: Int(1),
            TxnField.config_asset_decimals: Int(0),
            TxnField.config_asset_default_frozen: Int(0),
            TxnField.config_asset_name: Bytes("TICKET"),
            TxnField.config_asset_unit_name: Bytes("TKT"),
            # Default Manager = ZeroAddress (Immutable)
        }),
        InnerTxnBuilder.Submit(),
        
        # Store Ticket Info in Box (Key: 'tickets' + index)
        # Value: [AssetID 8][Owner 32][Status 1]
        App.box_put(
            Concat(Bytes("tickets"), Itob(sold_count)), 
            Concat(
                Itob(InnerTxn.created_asset_id()),
                Txn.sender(),
                Bytes("\x00") # 0 = Pending
            )
        ),
        
        # Log AssetID for debugging
        Log(Concat(Bytes("AssetID:"), Itob(InnerTxn.created_asset_id())))
    )

@router.method
def claim_ticket(ticket_index: abi.Uint64):
    # Box Key: 'tickets' + index
    box_key = Concat(Bytes("tickets"), Itob(ticket_index.get()))
    
    return Seq(
        # Read Box
        (box_val := App.box_get(box_key)),
        Assert(box_val.hasValue()),
        
        # Parse Value
        (asset_id := ScratchVar()).store(Btoi(Extract(box_val.value(), Int(0), Int(8)))),
        (owner := ScratchVar()).store(Extract(box_val.value(), Int(8), Int(32))),
        (status := ScratchVar()).store(Extract(box_val.value(), Int(40), Int(1))),
        
        # Verify Caller is Owner
        Assert(Txn.sender() == owner.load()),
        
        # Verify Status is 'Pending' (0)
        Assert(status.load() == Bytes("\x00")),
        
        # Inner Txn: Transfer Asset
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.sender: Global.current_application_address(), # Explicit Sender
            TxnField.xfer_asset: asset_id.load(),
            TxnField.asset_receiver: Txn.sender(),
            TxnField.asset_amount: Int(1),
            TxnField.fee: Int(0), # Inner txn fee covered by outer txn
        }),
        InnerTxnBuilder.Submit(),
        
        # Update Status to 'Claimed' (1)
        App.box_replace(box_key, Int(40), Bytes("\x01")),
    )

@router.method
def check_in(ticket_index: abi.Uint64):
    # Box Key
    box_key = Concat(Bytes("tickets"), Itob(ticket_index.get()))
    
    return Seq(
        # Read Box
        (box_val := App.box_get(box_key)),
        Assert(box_val.hasValue()),
        
        # Verify Organizer
        Assert(Txn.sender() == App.globalGet(ORGANIZER)),
        
        # Verify Status is 'Claimed' (1)
        # Extract(40, 1) == 0x01
        Assert(Extract(box_val.value(), Int(40), Int(1)) == Bytes("\x01")),
        
        # Update Status to 'Used' (2)
        App.box_replace(box_key, Int(40), Bytes("\x02")),
    )

@router.method
def withdraw_funds(amount: abi.Uint64):
    return Seq(
        Assert(Txn.sender() == App.globalGet(ORGANIZER)),
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: Txn.sender(),
            TxnField.amount: amount.get(),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
    )

@router.method
def get_event_info(*, output: abi.Tuple3[abi.Uint64, abi.Uint64, abi.Uint64]):
    return Seq(
        (price := abi.Uint64()).set(App.globalGet(PRICE)),
        (supply := abi.Uint64()).set(App.globalGet(SUPPLY)),
        (sold := abi.Uint64()).set(App.globalGet(SOLD)),
        output.set(price, supply, sold),
    )

if __name__ == "__main__":
    import os
    import json

    # Compile
    approval_program, clear_program, contract = router.compile_program(version=10)

    # Save
    with open("ticket_manager_approval.teal", "w") as f:
        f.write(approval_program)

    with open("ticket_manager_clear.teal", "w") as f:
        f.write(clear_program)

    with open("ticket_manager_contract.json", "w") as f:
        json.dump(contract.dictify(), f, indent=4)
