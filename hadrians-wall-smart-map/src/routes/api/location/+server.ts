import { json } from '@sveltejs/kit';
import { getStore } from '@netlify/blobs';
import { env } from '$env/dynamic/private';

export async function GET() {
    try {
        // Connect to the Netlify Blob store named 'telemetry'
        const telemetryStore = getStore({
            name: 'telemetry',
            siteID: env.NETLIFY_SITE_ID ?? process.env.NETLIFY_SITE_ID,
            token: env.NETLIFY_API_TOKEN ?? process.env.NETLIFY_API_TOKEN,
        });

        // Fetch the 'current_location' key
        const locationData = await telemetryStore.get('current_location', { type: 'json' });

        // If no data exists, return a 404
        if (!locationData) {
            return json({ error: 'No telemetry data found.', status: 'offline' }, { status: 404 });
        }

        return json({
            success: true,
            status: 'live',
            data: locationData
        });

    } catch (e) {
        console.error('Failed to fetch telemetry payload:', e);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
