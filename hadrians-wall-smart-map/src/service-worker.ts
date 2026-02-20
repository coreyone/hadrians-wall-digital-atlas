/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `hadrian-atlas-v2-${version}`;
const ASSETS = [...build, ...files];
const ASSET_SET = new Set(ASSETS);
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
	const isLocalhost =
		self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
	if (isLocalhost) return;

	// Handle Map Tiles (OpenFreeMap & ESRI)
	const isMapTile = url.host.includes('tiles.openfreemap.org') ||
		url.host.includes('services.arcgisonline.com') ||
		url.host.includes('demotiles.maplibre.org');
	const isNavigation = event.request.mode === 'navigate';
	const isSameOrigin = url.origin === self.location.origin;
	const isBuildAsset = isSameOrigin && ASSET_SET.has(url.pathname);
	const isAppAssetRequest =
		isBuildAsset &&
		(event.request.destination === 'script' ||
			event.request.destination === 'style' ||
			event.request.destination === 'font' ||
			event.request.destination === 'worker' ||
			url.pathname.endsWith('.js') ||
			url.pathname.endsWith('.css'));

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

			// Network-first for app assets prevents stale CSS/JS from overriding fresh UI after deploy.
			if (isAppAssetRequest) {
				try {
					const networkResponse = await fetch(event.request);
					if (networkResponse.ok) {
						cache.put(event.request, networkResponse.clone());
					}
					return networkResponse;
				} catch {
					const cachedAsset = await cache.match(event.request);
					if (cachedAsset) return cachedAsset;
					return new Response('Offline', { status: 503 });
				}
			}

			const cachedResponse = await cache.match(event.request);

			if (cachedResponse) return cachedResponse;

			try {
				const response = await fetch(event.request);

				// Cache map tiles and same-origin build assets on-the-fly for offline use
				if (
					(isMapTile && (response.ok || response.type === 'opaque')) ||
					(isBuildAsset && response.ok)
				) {
					cache.put(event.request, response.clone());
				}

				// Wallcast Audio Caching (Runtime)
				// Cache .ogg/.mp3 files served from /wallcast/ or external if CORS allows
				if (url.pathname.match(/\.(ogg|mp3|wav)$/) && response.ok) {
					// Use a dedicated cache for large media if possible, but keeping it simple for now
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
