/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `hadrian-atlas-${version}`;
const ASSETS = [...build, ...files];
const APP_SHELL_URLS = ['/', '/index.html'];

// 1. Install: Cache the Application Shell
self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
		await Promise.all(
			APP_SHELL_URLS.map(async (url) => {
				try {
					await cache.add(url);
				} catch {
					// Some environments may not expose both shell paths; ignore per-path failures.
				}
			})
		);
	}
	event.waitUntil(addFilesToCache());
    self.skipWaiting();
});

// 2. Activate: Cleanup old caches
self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
        await clients.claim();
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
	const isNavigation = event.request.mode === 'navigate';
	const isSameOrigin = url.origin === self.location.origin;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			if (isNavigation) {
				try {
					const networkResponse = await fetch(event.request);
					if (networkResponse.ok) {
						cache.put('/', networkResponse.clone());
					}
					return networkResponse;
				} catch {
					const fallback =
						(await cache.match(event.request)) ||
						(await cache.match('/')) ||
						(await cache.match('/index.html'));

					if (fallback) return fallback;

					return new Response(
						'<!doctype html><html><body><h1>Offline</h1><p>Open once online to cache this app.</p></body></html>',
						{
							status: 503,
							headers: { 'Content-Type': 'text/html; charset=utf-8' }
						}
					);
				}
			}

			const cachedResponse = await cache.match(event.request);

			if (cachedResponse) return cachedResponse;

			try {
				const response = await fetch(event.request);
				
                // Cache map tiles and same-origin assets on-the-fly for offline use
				if (
					(isMapTile && (response.ok || response.type === 'opaque')) ||
					(isSameOrigin && response.ok)
				) {
					cache.put(event.request, response.clone());
				}
				
				return response;
			} catch {
				// Fallback for failed fetches (offline)
				return cachedResponse || new Response('Offline', { status: 503 });
			}
		})()
	);
});
