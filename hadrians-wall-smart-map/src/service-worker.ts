/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `hadrian-atlas-${version}`;
const ASSETS = [...build, ...files];

// 1. Install: Cache the Application Shell
self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}
	event.waitUntil(addFilesToCache());
});

// 2. Activate: Cleanup old caches
self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}
	event.waitUntil(deleteOldCaches());
});

// 3. Fetch: Intercept and Cache Map Tiles + Serve from Cache
self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Handle Map Tiles (OpenFreeMap & ESRI)
	const isMapTile = url.host.includes('tiles.openfreemap.org') || 
                      url.host.includes('services.arcgisonline.com') ||
                      url.host.includes('demotiles.maplibre.org');

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const cachedResponse = await cache.match(event.request);

			if (cachedResponse) return cachedResponse;

			try {
				const response = await fetch(event.request);
				
                // Cache map tiles on-the-fly for offline use
				if (isMapTile && response.status === 200) {
					cache.put(event.request, response.clone());
				}
				
				return response;
			} catch (err) {
				// Fallback for failed fetches (offline)
				return cachedResponse || new Response('Offline', { status: 408 });
			}
		})()
	);
});
