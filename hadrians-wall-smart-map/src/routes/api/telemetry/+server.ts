import { json } from '@sveltejs/kit';
import { getStore } from '@netlify/blobs';
import { env } from '$env/dynamic/private';

// OwnTracks HTTP POST payload schema
// see: https://owntracks.org/booklet/tech/json/#_typelocation
interface OwnTracksLocation {
    _type: 'location';
    lat: number;
    lon: number;
    alt?: number; // Altitude in meters
    batt?: number; // Battery level
    vel?: number; // Velocity (km/h)
    tst: number; // Unix timestamp
    tid?: string; // Tracker ID
}

export async function POST({ request }) {
    // 1. Validate Secret Token
    // We expect the iOS app to hit: /api/telemetry?token=SUPER_SECRET
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token || token !== env.TELEMETRY_SECRET) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload: OwnTracksLocation = await request.json();

        // 2. Validate Payload
        if (payload._type !== 'location' || !payload.lat || !payload.lon) {
            return json({ error: 'Invalid payload format' }, { status: 400 });
        }

        // 3. Connect to Netlify Blobs
        // Provide the env vars explicitly so this works directly in `vite dev` without `netlify-cli`
        const telemetryStore = getStore({
            name: 'telemetry',
            siteID: env.NETLIFY_SITE_ID ?? process.env.NETLIFY_SITE_ID,
            token: env.NETLIFY_API_TOKEN ?? process.env.NETLIFY_API_TOKEN,
        });

        // 4. Overwrite the 'current_location' key
        // We only care about the latest ping.
        const locationData = {
            lat: payload.lat,
            lon: payload.lon,
            alt: payload.alt || null,
            batt: payload.batt || null,
            vel: payload.vel || null,
            timestamp: payload.tst,
            updatedAt: new Date().toISOString()
        };

        await telemetryStore.setJSON('current_location', locationData);

        return json({ success: true, message: 'Telemetry stored successfully' });

    } catch (e) {
        console.error('Failed to process telemetry ping:', e);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
