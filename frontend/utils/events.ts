import algosdk from 'algosdk';

export interface Ticket {
    assetId: number;
    eventName: string;
    appId: number;
    status: 'pending' | 'claimed' | 'used';
    price?: number;
    supply?: number;
    sold?: number;
}

export interface EventInfo {
    appId: number;
    name: string;
    price: number;
    supply: number;
    sold: number;
    organizer: string;
}

// AlgoKit BoxMap prefix for "events" map
const EVENTS_BOX_PREFIX = new TextEncoder().encode("events");
// AlgoKit BoxMap prefix for "tickets" map
const TICKETS_BOX_PREFIX = new TextEncoder().encode("tickets");

// Build a box key with MapName prefix (how AlgoKit BoxMap works)
function buildBoxKey(prefix: Uint8Array, key: Uint8Array): Uint8Array {
    const result = new Uint8Array(prefix.length + key.length);
    result.set(prefix, 0);
    result.set(key, prefix.length);
    return result;
}

// Fetch all registered events from the Factory
export async function fetchAllEvents(
    factoryAppId: number,
    algodClient: algosdk.Algodv2,
    indexerClient: algosdk.Indexer
): Promise<EventInfo[]> {
    if (factoryAppId === 0) return [];

    try {
        // 1. Get Event Count from global state
        const appInfo = await algodClient.getApplicationByID(factoryAppId).do();
        const globalState = appInfo.params["global-state"];
        const countKey = btoa("event_count"); // AlgoKit uses lowercase
        const countState = globalState?.find((s: any) => s.key === countKey);
        const eventCount = countState ? countState.value.uint : 0;

        const events: EventInfo[] = [];

        // 2. Iterate Events (AlgoKit BoxMap with "events" prefix)
        for (let i = 0; i < eventCount; i++) {
            try {
                // AlgoKit BoxMap key = prefix + encoded_uint64
                const boxKey = buildBoxKey(EVENTS_BOX_PREFIX, algosdk.encodeUint64(i));
                const box = await algodClient.getApplicationBoxByName(factoryAppId, boxKey).do();

                // Parse EventEntry struct: [AppID (8 bytes)][Offset (2 bytes)][Name Length (2 bytes)][Name Bytes]
                // ARC4 Tuple with dynamic string: first 8 bytes = uint64 app_id, then 2-byte offset, then string
                const id = algosdk.decodeUint64(box.value.slice(0, 8), 'safe');
                const nameLen = (box.value[8] << 8) | box.value[9];
                const name = new TextDecoder().decode(box.value.slice(10, 10 + nameLen));

                // 3. Fetch Event Details from Ticket Manager Contract (Global State)
                const eventAppInfo = await algodClient.getApplicationByID(Number(id)).do();
                const eventGlobalState = eventAppInfo.params["global-state"];

                // Helper to get global int (AlgoKit uses lowercase keys)
                const getGlobalInt = (key: string) => {
                    const k = btoa(key);
                    const s = eventGlobalState?.find((x: any) => x.key === k);
                    return s ? s.value.uint : 0;
                };

                // Helper to get global bytes (organizer is stored as address bytes)
                const getGlobalBytes = (key: string) => {
                    const k = btoa(key);
                    const s = eventGlobalState?.find((x: any) => x.key === k);
                    return s ? s.value.bytes : ''; // base64
                };

                const price = getGlobalInt("Price");
                const supply = getGlobalInt("Supply");
                const sold = getGlobalInt("Sold");
                const organizerBase64 = getGlobalBytes("Organizer");

                let organizer = "";
                if (organizerBase64) {
                    const orgBytes = Uint8Array.from(atob(organizerBase64), c => c.charCodeAt(0));
                    organizer = algosdk.encodeAddress(orgBytes);
                }

                events.push({
                    appId: Number(id),
                    name,
                    price,
                    supply,
                    sold,
                    organizer
                });

            } catch (e) {
                console.error(`Error fetching event ${i}:`, e);
            }
        }
        return events;
    } catch (e) {
        console.error("Error fetching all events:", e);
        return [];
    }
}

// Export box key builders for use in other components
export { EVENTS_BOX_PREFIX, TICKETS_BOX_PREFIX, buildBoxKey };
