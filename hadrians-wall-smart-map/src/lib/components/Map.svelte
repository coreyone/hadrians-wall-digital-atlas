<script lang="ts">
    import { onMount } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import * as turf from '@turf/turf';
    import { trailGeoJSON, getCorridor, overnightStops, itinerary, trailCoordinates, englishHeritageSites, hospitalitySites } from '$lib/data/trail';
    import { routeVariants } from '$lib/data/routes';
    import { fetchWikiPOIs, fetchPageSummary, type WikiPOI } from '$lib/services/wikipedia';

    interface Props {
        initialPOIs?: WikiPOI[];
        selectedPOI?: any;
        selectedStageId?: number | null;
        mapStyle?: string;
        selectedRoute?: string;
        isHeadingUp?: boolean;
        onPoiSelect?: (poi: any) => void;
    }

    let { 
        initialPOIs = [], 
        selectedPOI = $bindable(null), 
        selectedStageId = null, 
        mapStyle = 'topo', 
        selectedRoute = 'osm',
        isHeadingUp = false,
        onPoiSelect 
    }: Props = $props();

    let mapContainer: HTMLDivElement;
    let map: maplibregl.Map;
    let corridor: any;
    let mouseCoords = $state({ lng: -2.3958, lat: 55.0036 });
    let zoomLevel = $state(12);
    let userLocation = $state<{lng: number, lat: number, accuracy: number} | null>(null);
    let userMarker: maplibregl.Marker | null = null;

    const styles: Record<string, any> = {
        streets: 'https://demotiles.maplibre.org/style.json',
        topo: 'https://tiles.openfreemap.org/styles/liberty', 
        satellite: {
            version: 8,
            sources: {
                'raster-tiles': {
                    type: 'raster',
                    tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                    tileSize: 256,
                    attribution: 'Esri, Maxar'
                }
            },
            layers: [{ id: 'simple-tiles', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 22 }]
        }
    };

    // React to style change
    $effect(() => {
        if (map && mapStyle && styles[mapStyle]) {
            map.setStyle(styles[mapStyle]);
            map.once('styledata', setupLayers);
        }
    });

    // React to route change
    $effect(() => {
        const variants = routeVariants as Record<string, any>;
        if (map && selectedRoute && variants[selectedRoute]) {
            const source = map.getSource('trail') as maplibregl.GeoJSONSource;
            if (source) {
                source.setData({
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: variants[selectedRoute]
                    }
                });
            }
        }
    });

    // React to POI selection (Visual highlighting)
    $effect(() => {
        if (map && selectedPOI) {
            document.querySelectorAll('.poi-marker').forEach(m => {
                const markerEl = m as HTMLElement;
                const isSelected = markerEl.dataset.pageid === selectedPOI.pageid?.toString() || markerEl.dataset.name === selectedPOI.name;
                markerEl.classList.toggle('active-marker', isSelected);
            });
        }
    });

    // React to Stage selection (Fly to and highlight)
    $effect(() => {
        if (map && selectedStageId) {
            const stage = itinerary.find(s => s.id === selectedStageId);
            if (stage) {
                const slices: Record<number, [number, number]> = { 1: [1, 3], 2: [2, 4], 3: [3, 5], 4: [4, 6], 5: [5, 7] };
                const [start, end] = slices[selectedStageId];
                const coords = trailCoordinates.slice(start, end);
                const source = map.getSource('selected-stage') as maplibregl.GeoJSONSource;
                if (source) source.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} });
                const bounds = new maplibregl.LngLatBounds();
                coords.forEach(c => bounds.extend(c as [number, number]));
                map.fitBounds(bounds, { padding: 80, duration: 1000 });
            }
        }
    });

    // Phosphor Icons (Raw SVGs)
    const icons = {
        bed: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M208,80H32V56a8,8,0,0,0-16,0V200a8,8,0,0,0,16,0V176H224v24a8,8,0,0,0,16,0V112A32,32,0,0,0,208,80Zm16,80H32V96H208a16,16,0,0,1,16,16Z"></path></svg>`,
        heritage: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M240,208H224V101.33l10.67,5.34a8,8,0,0,0,7.15-14.34l-104-52a8,8,0,0,0-7.15,0l-104,52a8,8,0,0,0,7.15,14.34L48,101.33V208H32a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM64,109.33l64-32,64,32V208H64Z"></path></svg>`,
        pub: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M216,64H192V56a16,16,0,0,0-16-16H40A16,16,0,0,0,24,56V200a24,24,0,0,0,24,24H168a24,24,0,0,0,24-24V184h8a24,24,0,0,0,24-24V88A24,24,0,0,0,216,64Zm-40,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V56H176Zm32-40a8,8,0,0,1-8,8H192V80h16a8,8,0,0,1,8,8Z"></path></svg>`,
        brewery: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M232,104a32,32,0,0,0-32-32H184V56a16,16,0,0,0-16-16H40A16,16,0,0,0,24,56V208a32,32,0,0,0,32,32H160a32,32,0,0,0,32-32V184h8a32,32,0,0,0,32-32ZM176,208a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56H176Zm40-56a16,16,0,0,1-16,16H192V88h8a16,16,0,0,1,16,16Z"></path></svg>`,
        locate: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM128,64a64,64,0,1,0,64,64A64.07,64.1,0,0,0,128,64Zm0,112a48,48,0,1,1,48-48A48.05,48.05,0,0,1,128,176Zm0-64a16,16,0,1,0,16,16A16,16,0,0,0,128,112Z"></path></svg>`,
        discovery: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Zm-32,0a56,56,0,1,1-56-56A56.06,56.06,0,0,1,184,128Zm-16,0a40,40,0,1,0-40,40A40,40,0,0,0,168,128Z"></path></svg>`,
        cafe: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M208,80H192V72a16,16,0,0,0-16-16H40A16,16,0,0,0,24,72V176a40,40,0,0,0,40,40h80a40,40,0,0,0,40-40V160h8a40,40,0,0,0,40-40V120A40,40,0,0,0,208,80Zm-32,96a24,24,0,0,1-24,24H64a24,24,0,0,1-24-24V72H176Zm40-56a24,24,0,0,1-24,24H192V96h16a24,24,0,0,1,24,24Z"></path></svg>`,
        restaurant: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M208,32a8,8,0,0,0-8,8v88H160V40a8,8,0,0,0-16,0v88H112V40a8,8,0,0,0-16,0V128a40,40,0,0,0,40,40v56a8,8,0,0,0,16,0V168a40,40,0,0,0,40-40V40A8,8,0,0,0,208,32ZM80,32a48,48,0,0,0-48,48v88a8,8,0,0,0,16,0V80a32,32,0,0,1,64,0v88a8,8,0,0,0,16,0V80A48,48,0,0,0,80,32ZM72,216a8,8,0,0,1-8,8H56a8,8,0,0,1,0-16H64A8,8,0,0,1,72,216Z"></path></svg>`,
        deli: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M240,96,224,40a8,8,0,0,0-8-8H40a8,8,0,0,0-8,8L16,96a32,32,0,0,0,32,32h8v72a16,16,0,0,0,16,16h112a16,16,0,0,0,16-16V128h8A32,32,0,0,0,240,96ZM48,112a16,16,0,0,1-16-16l14-48H210l14,48a16,16,0,0,1-16,16H192a16,16,0,0,1-16-16,8,8,0,0,0-16,0,16,16,0,0,1-16,16,16,16,0,0,1-16-16,8,8,0,0,0-16,0,16,16,0,0,1-16,16,16,16,0,0,1-16-16,8,8,0,0,0-16,0,16,16,0,0,1-16,16Zm136,88H72V128H184Z"></path></svg>`
    };

    function setupLayers() {
        const variants = routeVariants as Record<string, any>;
        
        // User Accuracy Circle (Communicate uncertainty)
        if (!map.getSource('user-accuracy')) {
            map.addSource('user-accuracy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            map.addLayer({ id: 'user-accuracy-fill', type: 'fill', source: 'user-accuracy', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.1 } });
            map.addLayer({ id: 'user-accuracy-outline', type: 'line', source: 'user-accuracy', paint: { 'line-color': '#3b82f6', 'line-width': 1, 'line-dasharray': [2, 2] } });
        }

        if (!map.getSource('selected-stage')) {
            map.addSource('selected-stage', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            // Route Prominence: High-contrast glow
            map.addLayer({ id: 'selected-stage-line', type: 'line', source: 'selected-stage', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#3b82f6', 'line-width': 12, 'line-opacity': 0.4 } });
            map.addLayer({ id: 'selected-stage-line-core', type: 'line', source: 'selected-stage', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 2 } });
        }
        if (!map.getSource('trail')) {
            map.addSource('trail', { 
                type: 'geojson', 
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: variants[selectedRoute] || trailCoordinates
                    }
                }
            });
            // Path Hierarchy: Differentiation via texture (Dashed = Footpath)
            map.addLayer({ id: 'trail-line', type: 'line', source: 'trail', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#1e293b', 'line-width': 4, 'line-opacity': 0.6, 'line-dasharray': [2, 1] } });
        }
        if (!map.getSource('corridor')) {
            map.addSource('corridor', { type: 'geojson', data: corridor });
            map.addLayer({ id: 'corridor-fill', type: 'fill', source: 'corridor', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.02 } });
        }
    }

    function locateMe() {
        navigator.geolocation.watchPosition(pos => {
            const { longitude, latitude, accuracy, heading } = pos.coords;
            userLocation = { lng: longitude, lat: latitude, accuracy };
            
            // Update Accuracy Circle (Communicate uncertainty)
            const circle = turf.circle([longitude, latitude], accuracy / 1000, { units: 'kilometers' });
            const source = map.getSource('user-accuracy') as maplibregl.GeoJSONSource;
            if (source) source.setData(circle);

            if (!userMarker) {
                const el = document.createElement('div');
                el.className = 'w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-2xl animate-pulse flex items-center justify-center';
                el.innerHTML = `<div class="w-2 h-2 bg-white rounded-full"></div>`;
                userMarker = new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
            } else {
                userMarker.setLngLat([longitude, latitude]);
            }

            if (isHeadingUp && heading !== null) {
                map.setBearing(heading);
            }
            map.flyTo({ center: [longitude, latitude], zoom: 15, duration: 2000 });
        }, err => console.error(err), { enableHighAccuracy: true });
    }

    onMount(() => {
        corridor = getCorridor(1.1); 
        map = new maplibregl.Map({
            container: mapContainer,
            // @ts-ignore
            style: styles[mapStyle] || styles.topo,
            center: [-2.3, 55.0], // Strategic midpoint
            zoom: 8,
            maxZoom: 18,
            minZoom: 6,
            attributionControl: false
        });

        map.on('zoom', () => { zoomLevel = map.getZoom(); });

        map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
        map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

        map.on('mousemove', (e) => { mouseCoords = { lng: e.lngLat.lng, lat: e.lngLat.lat }; });

        map.on('load', () => {
            setupLayers();
            const bounds = new maplibregl.LngLatBounds();
            trailCoordinates.forEach(c => bounds.extend(c as [number, number]));
            // Instant fit with sidebar-aware padding
            map.fitBounds(bounds, { 
                padding: { top: 50, bottom: 50, left: 450, right: 50 }, 
                duration: 2000, 
                essential: true 
            });

            // Consolidate Official Sites by Coordinates
            const registry = new Map<string, any>();
            
            const addSite = (site: any, type: string, priority: number) => {
                const key = `${site.coords[0].toFixed(5)},${site.coords[1].toFixed(5)}`;
                if (registry.has(key)) {
                    const existing = registry.get(key);
                    existing.types.push(type);
                    existing.priority = Math.min(existing.priority, priority); // Keep highest priority
                    existing.allData.push({ ...site, type });
                    if (type === 'heritage' || type === 'hospitality') existing.title = site.name;
                } else {
                    registry.set(key, {
                        title: site.name || site.title,
                        coords: site.coords,
                        types: [type],
                        priority,
                        allData: [{ ...site, type }],
                        pageid: site.pageid,
                        lat: site.coords[1],
                        lon: site.coords[0]
                    });
                }
            };

            overnightStops.forEach(s => addSite(s, 'hub', 1));
            englishHeritageSites.forEach(s => addSite(s, 'heritage', 2));
            hospitalitySites.forEach(s => addSite(s, 'hospitality', 3));

            registry.forEach((poi) => {
                const el = document.createElement('div');
                const isMulti = poi.types.length > 1;
                
                let bgColor = 'bg-blue-600';
                let icon = icons.bed;
                
                if (poi.types.includes('heritage')) {
                    bgColor = 'bg-slate-800';
                    icon = icons.heritage;
                } else if (poi.types.includes('hospitality')) {
                    const hSite = poi.allData.find((d: any) => d.type === 'hospitality');
                    if (hSite?.category === 'brewery') {
                        bgColor = 'bg-amber-600';
                        icon = icons.brewery;
                    } else if (hSite?.category === 'cafe') {
                        bgColor = 'bg-emerald-600';
                        icon = icons.cafe;
                    } else if (hSite?.category === 'restaurant') {
                        bgColor = 'bg-rose-700';
                        icon = icons.restaurant;
                    } else if (hSite?.category === 'deli') {
                        bgColor = 'bg-lime-700';
                        icon = icons.deli;
                    } else if (hSite?.category === 'hotel') {
                        bgColor = 'bg-blue-600';
                        icon = icons.bed;
                    } else {
                        bgColor = 'bg-orange-700';
                        icon = icons.pub;
                    }
                }

                el.className = `poi-marker z-30`;
                el.dataset.name = poi.title;
                if (poi.pageid) el.dataset.pageid = poi.pageid.toString();
                
                el.innerHTML = `
                    <div class="instrument-shell flex flex-col items-center gap-1 group cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95">
                        <div class="marker-icon w-10 h-10 ${bgColor} rounded-sm border-2 ${isMulti ? 'border-white ring-2 ring-blue-400/50' : 'border-white'} shadow-xl flex items-center justify-center text-white">
                            ${icon}
                        </div>
                        <div class="poi-label label-priority-${poi.priority} bg-slate-900/90 backdrop-blur-md px-1.5 py-0.5 rounded-sm border border-slate-700 shadow-2xl transition-opacity duration-300 pointer-events-none">
                            <span class="text-[9px] font-black text-white uppercase tracking-tighter whitespace-nowrap">${poi.title}</span>
                        </div>
                    </div>
                `;

                el.onclick = (e) => {
                    e.stopPropagation();
                    const mergedPOI = {
                        ...poi,
                        summary: poi.allData.map((d: any) => d.summary || d.intel || "").filter(Boolean).join("\n\n"),
                        bourdainIntel: poi.allData.find((d: any) => d.bourdainIntel)?.bourdainIntel,
                        fryeIntel: poi.allData.find((d: any) => d.fryeIntel)?.fryeIntel,
                        url: poi.allData.find((d: any) => d.url && d.url !== '#')?.url || (poi.pageid ? `https://en.wikipedia.org/?curid=${poi.pageid}` : '#')
                    };
                    if (onPoiSelect) onPoiSelect(mergedPOI);
                    map.flyTo({ center: poi.coords as [number, number], zoom: 14 });
                };
                new maplibregl.Marker({ element: el }).setLngLat(poi.coords as [number, number]).addTo(map);
            });

            if (initialPOIs.length > 0) renderPOIs(initialPOIs);
            updatePOIs();
        });

        map.on('moveend', updatePOIs);
    });

    let renderedPageIds = new Set<number>();
    function renderPOIs(pois: WikiPOI[]) {
        const validPOIs = pois.filter(poi => {
            if (renderedPageIds.has(poi.pageid)) return false;
            const pt = turf.point([poi.lon, poi.lat]);
            return turf.booleanPointInPolygon(pt, corridor);
        });

        for (const poi of validPOIs) {
            const el = document.createElement('div');
            const size = Math.min(18, Math.max(10, 10 + (poi.rank / 10)));
            
            el.className = 'poi-marker z-10';
            el.dataset.pageid = poi.pageid.toString();
            
            el.innerHTML = `
                <div class="instrument-shell flex flex-col items-center gap-1 group cursor-pointer transition-all duration-200 hover:scale-125 hover:z-40 active:scale-90 overflow-visible">
                    <div class="marker-icon bg-white rounded-full border-2 border-blue-600 shadow-xl flex items-center justify-center overflow-hidden" style="width: ${size}px; height: ${size}px;">
                        <div class="text-blue-600 scale-[0.8]">
                            ${icons.discovery}
                        </div>
                    </div>
                    <div class="poi-label label-priority-4 bg-slate-900/90 backdrop-blur-md px-1.5 py-0.5 rounded-sm border border-slate-700 shadow-2xl transition-opacity duration-300 pointer-events-none">
                        <span class="text-[9px] font-black text-white uppercase tracking-tighter whitespace-nowrap">${poi.title}</span>
                    </div>
                </div>
            `;

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onPoiSelect) onPoiSelect({ ...poi });
                map.flyTo({ center: [poi.lon, poi.lat], zoom: 14 });
            });
            new maplibregl.Marker({ element: el }).setLngLat([poi.lon, poi.lat]).addTo(map);
            renderedPageIds.add(poi.pageid);
        }
    }

    async function updatePOIs() {
        if (!map) return;
        const center = map.getCenter();
        const pois = await fetchWikiPOIs(center.lat, center.lng, 3000); 
        renderPOIs(pois);
    }

    // Expose API for parent
    export function flyToPOI(poi: any) {
        if (!map) return;
        const coords = poi.coords || [poi.lon, poi.lat];
        if (coords && coords[0] && coords[1]) {
            map.flyTo({ center: coords as [number, number], zoom: 15, duration: 2000 });
        }
    }
</script>

<div class="w-full h-full bg-slate-50 relative zoom-state-z{Math.floor(zoomLevel)}" bind:this={mapContainer}>
    <div class="absolute bottom-4 right-12 z-10 px-2 py-1 bg-white/90 backdrop-blur border border-slate-200 rounded-sm text-[9px] font-mono font-bold text-slate-500 shadow-sm pointer-events-none select-none">
        {mouseCoords.lat.toFixed(5)}°N {Math.abs(mouseCoords.lng).toFixed(5)}°W
    </div>
    <button onclick={locateMe} class="absolute bottom-24 right-4 z-10 p-2.5 bg-white/90 backdrop-blur border border-slate-200 rounded-sm shadow-lg text-slate-600 hover:text-blue-600 active:scale-95 transition-all" title="Locate Me">{@html icons.locate}</button>

    <!-- Imperial Logo: Roman Coin -->
    <div class="absolute bottom-4 right-4 z-20 pointer-events-none select-none drop-shadow-2xl">
        <svg width="64" height="64" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="coinGrad" cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
                    <stop offset="0%" style="stop-color:#f1f5f9;stop-opacity:1" />
                    <stop offset="40%" style="stop-color:#cbd5e1;stop-opacity:1" />
                    <stop offset="85%" style="stop-color:#64748b;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
                </radialGradient>
                <filter id="metalRelief">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
                    <feSpecularLighting in="blur" surfaceScale="5" specularConstant="0.8" specularExponent="20" lighting-color="#ffffff" result="specOut">
                        <fePointLight x="-5000" y="-10000" z="20000" />
                    </feSpecularLighting>
                    <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut" />
                    <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
                </filter>
            </defs>
            <circle cx="128" cy="128" r="120" fill="url(#coinGrad)" stroke="#475569" stroke-width="2" />
            <path d="M128,40 c-30,0 -50,25 -50,60 c0,40 20,60 50,85 c5,5 15,10 15,25 l0,15 l35,0 l0,-20 c0,-15 -10,-25 -20,-35 c-20,-20 -30,-35 -30,-70 c0,-25 15,-40 35,-40 c20,0 35,15 35,40 c0,35 -10,50 -30,70" fill="#94a3b8" filter="url(#metalRelief)" opacity="0.9" />
            <circle cx="128" cy="128" r="115" fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="2,4" opacity="0.3" />
        </svg>
    </div>
</div>

<style>
    :global(.maplibregl-map) { height: 100%; width: 100%; font-family: inherit; }
    :global(.poi-marker) { pointer-events: auto !important; }
    
    /* Base Label State: Hidden by default */
    :global(.poi-label) {
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease-out;
    }

    /* Forced visibility for Active/Hovered points */
    :global(.poi-marker.active-marker .poi-label),
    :global(.poi-marker:hover .poi-label) {
        opacity: 1 !important;
        display: block !important;
        z-index: 100;
    }

    /* Density Logic: Level 1 (Hubs) - Show at Z11+ */
    :global(.zoom-state-z11 .label-priority-1),
    :global(.zoom-state-z12 .label-priority-1),
    :global(.zoom-state-z13 .label-priority-1),
    :global(.zoom-state-z14 .label-priority-1),
    :global(.zoom-state-z15 .label-priority-1),
    :global(.zoom-state-z16 .label-priority-1),
    :global(.zoom-state-z17 .label-priority-1),
    :global(.zoom-state-z18 .label-priority-1) { opacity: 1; }

    /* Density Logic: Level 2 (Heritage) - Show at Z13+ */
    :global(.zoom-state-z13 .label-priority-2),
    :global(.zoom-state-z14 .label-priority-2),
    :global(.zoom-state-z15 .label-priority-2),
    :global(.zoom-state-z16 .label-priority-2),
    :global(.zoom-state-z17 .label-priority-2),
    :global(.zoom-state-z18 .label-priority-2) { opacity: 1; }

    /* Density Logic: Level 3 (Pubs) - Show at Z15+ */
    :global(.zoom-state-z15 .label-priority-3),
    :global(.zoom-state-z16 .label-priority-3),
    :global(.zoom-state-z17 .label-priority-3),
    :global(.zoom-state-z18 .label-priority-3) { opacity: 1; }

    /* Density Logic: Level 4 (Discovery) - Show at Z16+ */
    :global(.zoom-state-z16 .label-priority-4),
    :global(.zoom-state-z17 .label-priority-4),
    :global(.zoom-state-z18 .label-priority-4) { opacity: 1; }

    :global(.poi-marker.active-marker .instrument-shell) {
        border-color: #3b82f6 !important;
        border-width: 2px;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }
</style>
