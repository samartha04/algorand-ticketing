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

// Fetch all registered events from the Factory
export async function fetchAllEvents(
    factoryAppId: number,
    algodClient: algosdk.Algodv2,
    indexerClient: algosdk.Indexer
): Promise<EventInfo[]> {
    if (factoryAppId === 0) return [];

    try {
        // 1. Get Event Count
        const appInfo = await algodClient.getApplicationByID(factoryAppId).do();
        const globalState = appInfo.params["global-state"];
        const countKey = btoa("EventCount");
        const countState = globalState?.find((s: any) => s.key === countKey);
        const eventCount = countState ? countState.value.uint : 0;

        const events: EventInfo[] = [];

        // 2. Iterate Events (Box Storage in Factory)
        for (let i = 0; i < eventCount; i++) {
            try {
                const boxKey = algosdk.encodeUint64(i);
                const box = await algodClient.getApplicationBoxByName(factoryAppId, boxKey).do();

                // Parse Factory Box: [AppID (8 bytes)][Name Length (2 bytes)][Name Bytes]
                const id = algosdk.decodeUint64(box.value.slice(0, 8), 'safe');
                const nameLen = (box.value[8] << 8) | box.value[9];
                const name = new TextDecoder().decode(box.value.slice(10, 10 + nameLen));

                // 3. Fetch Event Details from Ticket Manager Contract (Global State)
                const eventAppInfo = await algodClient.getApplicationByID(Number(id)).do();
                const eventGlobalState = eventAppInfo.params["global-state"];

                // Helper to get global int
                const getGlobalInt = (key: string) => {
                    const k = btoa(key);
                    const s = eventGlobalState?.find((x: any) => x.key === k);
                    return s ? s.value.uint : 0;
                };

                // Helper to get global bytes (Organizer is bytes)
                const getGlobalBytes = (key: string) => {
                    const k = btoa(key);
                    const s = eventGlobalState?.find((x: any) => x.key === k);
                    return s ? s.value.bytes : ''; // base64
                };

                const price = getGlobalInt("Price");
                const supply = getGlobalInt("Supply");
                const sold = getGlobalInt("Sold");
                const organizerBase64 = getGlobalBytes("Organizer");

                // Decode Organizer Address ? 
                // It is stored as bytes (32 bytes public key). 
                // We need to encode it to algorand address format.
                // But wait, `getGlobalBytes` returns base64 string from algod response.
                // We need to decode base64 to Uint8Array, then encodeAddress.
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
