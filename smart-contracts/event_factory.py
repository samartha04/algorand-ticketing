from pyteal import *

# This contract acts as a Registry for all events created on the platform.
# Organizers deploy their own TicketManager contract, then register it here.

router = Router(
    "EventFactoryRepository",
    BareCallActions(
        no_op=OnCompleteAction.create_only(Approve()),
        opt_in=OnCompleteAction.always(Approve()),
    ),
)

EVENT_COUNT = Bytes("EventCount")

@router.method
def register_event(app_id: abi.Uint64, name: abi.String):
    return Seq(
        # Increment event count
        # Store in box: Key = Count, Value = {AppID, Name}
        # Or simpler: Just emit an event?
        # Using boxes for storage.
        
        # Get current count
        (current_count := ScratchVar()).store(App.globalGet(EVENT_COUNT)),
        
        # Create Box Key
        (box_key := ScratchVar()).store(Itob(current_count.load())),
        
        # Store AppID + Name in Box
        App.box_put(box_key.load(), Concat(Itob(app_id.get()), name.get())),
        
        # Increment Global Count
        App.globalPut(EVENT_COUNT, current_count.load() + Int(1)),
    )

if __name__ == "__main__":
    import os
    import json

    path = os.path.dirname(os.path.abspath(__file__))
    approval, clear, contract = router.compile_program(version=8)
    
    with open(os.path.join(path, "event_factory_approval.teal"), "w") as f:
        f.write(approval)
        
    with open(os.path.join(path, "event_factory_clear.teal"), "w") as f:
        f.write(clear)

    with open(os.path.join(path, "event_factory_contract.json"), "w") as f:
        f.write(json.dumps(contract.dictify(), indent=4))
