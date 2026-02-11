"""
Event Factory (Registry) Smart Contract — Algorand Python (ARC4)

A simple on-chain registry that stores references to all deployed
TicketManager contracts. Organizers register their events here so
the frontend can discover them.
"""

from algopy import (
    ARC4Contract,
    BoxMap,
    Global,
    Txn,
    UInt64,
    arc4,
)


class EventEntry(arc4.Struct):
    """Stores a registered event's app ID and display name."""
    app_id: arc4.UInt64
    name: arc4.String


class EventFactory(ARC4Contract):
    """
    On-chain registry of events.
    Each registered event gets a box keyed by its index (0, 1, 2, ...).
    """

    # Global state
    event_count: UInt64

    # Box storage: index -> EventEntry (must be defined before use)
    events: BoxMap[UInt64, EventEntry]

    def __init__(self) -> None:
        self.event_count = UInt64(0)
        self.events = BoxMap(UInt64, EventEntry)

    @arc4.abimethod()
    def register_event(self, app_id: arc4.UInt64, name: arc4.String) -> arc4.UInt64:
        """
        Register a new TicketManager event contract.
        Payment for box storage must be included in the group.
        Returns the event index.
        """
        # Get current index
        index = self.event_count

        # Store in box: index -> EventEntry
        self.events[index] = EventEntry(
            app_id=app_id,
            name=name,
        )

        # Increment count
        self.event_count = index + 1

        return arc4.UInt64(index)

    @arc4.abimethod(readonly=True)
    def get_event_count(self) -> arc4.UInt64:
        """Returns the total number of registered events."""
        return arc4.UInt64(self.event_count)

    @arc4.abimethod(readonly=True)
    def get_event(self, index: arc4.UInt64) -> EventEntry:
        """Returns the event entry at the given index."""
        return self.events[index.native].copy()
