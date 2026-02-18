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
        isMobile?: boolean;
        showMilestones?: boolean;
        onPoiSelect?: (poi: any) => void;
    }

    let { 
        initialPOIs = [], 
        selectedPOI = $bindable(null), 
        selectedStageId = null, 
        mapStyle = 'topo', 
        selectedRoute = 'osm',
        isHeadingUp = false,
        isMobile = false,
        showMilestones = true,
        onPoiSelect 
    }: Props = $props();

    let mapContainer: HTMLDivElement;
    let map = $state<maplibregl.Map | null>(null);
    let corridor: any;
    let mouseCoords = $state({ lng: -2.3958, lat: 55.0036 });
    let zoomLevel = $state(12);
    let userLocation = $state<{lng: number, lat: number, accuracy: number} | null>(null);
    let userMarker: maplibregl.Marker | null = null;
    let watchId: number | null = null;

    const styles: Record<string, any> = {
        streets: 'https://tiles.openfreemap.org/styles/bright',
        topo: 'https://tiles.openfreemap.org/styles/liberty', 
        satellite: {
            version: 8,
            sources: {
                'raster-tiles': {
                    type: 'raster',
                    tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                    tileSize: 256,
                    attribution: 'Esri, Maxar'
                },
                'openfreemap': {
                    type: 'vector',
                    url: 'https://tiles.openfreemap.org/tiles/v1/openfreemap.json'
                }
            },
            layers: [
                { id: 'simple-tiles', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 22 },
                // Place Name Overlay for Orientation
                {
                    id: 'place-labels',
                    type: 'symbol',
                    source: 'openfreemap',
                    'source-layer': 'place',
                    layout: {
                        'text-field': '{name}',
                        'text-font': ['Noto Sans Regular'],
                        'text-size': 12,
                        'text-transform': 'uppercase',
                        'text-letter-spacing': 0.1
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-halo-color': 'rgba(0,0,0,0.8)',
                        'text-halo-width': 2
                    }
                }
            ]
        }
    };

    // React to style change
    $effect(() => {
        if (map && mapStyle && styles[mapStyle]) {
            map.setStyle(styles[mapStyle]);
            // Re-add layers once the new style has loaded
            map.once('style.load', () => {
                setupLayers();
                // Ensure active stage is redrawn if selected
                if (selectedStageId) {
                    const stage = itinerary.find(s => s.id === selectedStageId);
                    if (stage) updateStageLayer(stage);
                }
            });
        }
    });

    // React to Milestone Toggle
    $effect(() => {
        if (map && selectedStageId) {
            const stage = itinerary.find(s => s.id === selectedStageId);
            if (stage) updateStageLayer(stage);
        } else {
            clearPaceMarkers();
        }
    });

    function updateStageLayer(stage: any) {
        if (!map) return;
        
        const hubs = overnightStops;
        // Robust hub matching: check if hub name is in stage name or vice versa
        const fromHub = hubs.find(h => stage.from.includes(h.name.split('/')[0]) || h.name.includes(stage.from.split(' ')[0]));
        const toHub = hubs.find(h => stage.to.includes(h.name.split('/')[0]) || h.name.includes(stage.to.split(' ')[0]));

        let stageCoords: [number, number][] = [];
        
        if (fromHub && toHub) {
            // Find indices of points in the master trail closest to these hubs
            let startIdx = 0;
            let endIdx = trailCoordinates.length - 1;
            let minDistStart = Infinity;
            let minDistEnd = Infinity;

            trailCoordinates.forEach((c, i) => {
                const pt = turf.point(c as [number, number]);
                const dStart = turf.distance(pt, turf.point(fromHub.coords as [number, number]), { units: 'miles' });
                const dEnd = turf.distance(pt, turf.point(toHub.coords as [number, number]), { units: 'miles' });
                
                if (dStart < minDistStart) {
                    minDistStart = dStart;
                    startIdx = i;
                }
                if (dEnd < minDistEnd) {
                    minDistEnd = dEnd;
                    endIdx = i;
                }
            });

            // Slice the trail sequence between the two hubs
            const s = Math.min(startIdx, endIdx);
            const e = Math.max(startIdx, endIdx);
            stageCoords = trailCoordinates.slice(s, e + 1) as [number, number][];
        } else {
            // Fallback to full trail if hubs aren't found
            stageCoords = trailCoordinates as [number, number][];
        }

        const source = map.getSource('selected-stage') as maplibregl.GeoJSONSource;
        if (source) source.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: stageCoords }, properties: {} });
        
        // Dynamic Framing for the specific slice
        if (stageCoords.length > 0) {
            const bounds = new maplibregl.LngLatBounds();
            stageCoords.forEach(c => bounds.extend(c));
            map.fitBounds(bounds, { 
                padding: isMobile ? 40 : { top: 100, bottom: 100, left: 450, right: 100 }, 
                duration: 1500 
            });
        }

        renderPaceMarkers(stageCoords, stage);
    }

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
                updateStageLayer(stage);
            }
        } else if (map && !selectedStageId) {
            const source = map.getSource('selected-stage') as maplibregl.GeoJSONSource;
            if (source) source.setData({ type: 'FeatureCollection', features: [] });
            clearPaceMarkers();
        }
    });

    let paceMarkers: maplibregl.Marker[] = [];
    function clearPaceMarkers() {
        paceMarkers.forEach(m => m.remove());
        paceMarkers = [];
    }

    function renderPaceMarkers(coords: any[], stage: any) {
        clearPaceMarkers();
        if (coords.length < 2 || !showMilestones) return;

        let totalDist = 0;
        const speedMph = 2.8;
        const startTime = 9; 
        const halfWayMi = stage.distanceMi / 2;
        let halfWayAdded = false;
        
        const milestoneIndices: { idx: number, name: string, type: 'pace' | 'milestone' | 'halfway', hours?: number }[] = [];

        // Track cumulative distance to place markers
        for (let i = 1; i < coords.length; i++) {
            const p1 = turf.point(coords[i-1]);
            const p2 = turf.point(coords[i]);
            totalDist += turf.distance(p1, p2, { units: 'miles' });

            // Bi-Hourly Pace (Blue)
            if (totalDist >= 4.5 && milestoneIndices.filter(m => m.type === 'pace').length === 0) {
                milestoneIndices.push({ idx: i, name: '+2H', type: 'pace', hours: 2 });
            }
            if (totalDist >= 9.0 && milestoneIndices.filter(m => m.type === 'pace').length === 1) {
                milestoneIndices.push({ idx: i, name: '+4H', type: 'pace', hours: 4 });
            }

            // Half-Way Checkpoint (Amber)
            if (totalDist >= halfWayMi && !halfWayAdded && halfWayMi > 1) {
                milestoneIndices.push({ idx: i, name: 'Half-Way', type: 'halfway' });
                halfWayAdded = true;
            }

            // Itinerary Milestones (Amber)
            stage.milestones?.forEach((ms: any) => {
                if (totalDist >= ms.mi && !milestoneIndices.find(m => m.name === ms.name)) {
                    milestoneIndices.push({ idx: i, name: ms.name, type: 'milestone' });
                }
            });
        }

        milestoneIndices.forEach(m => {
            const el = document.createElement('div');
            const isPace = m.type === 'pace';
            const isHalf = m.type === 'halfway';
            
            const time = m.hours ? startTime + m.hours : null;
            const timeStr = time ? `${time > 12 ? time - 12 : time}:00 ${time >= 12 ? 'PM' : 'AM'}` : '';
            
            el.className = 'pace-marker z-20 pointer-events-none';
            el.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="w-2.5 h-2.5 ${isPace ? 'bg-blue-500 rounded-full' : 'bg-amber-500 rotate-45'} border border-white shadow-sm mb-1"></div>
                    <div class="bg-white/95 backdrop-blur-md border border-slate-200 px-1.5 py-0.5 rounded-sm shadow-xl flex flex-col items-center">
                        <span class="text-[8px] font-black ${isPace ? 'text-blue-700' : 'text-amber-700'} uppercase tracking-tighter tabular-nums">${m.name}</span>
                        ${timeStr ? `<span class="text-[7px] font-bold text-slate-500">${timeStr}</span>` : ''}
                    </div>
                </div>
            `;
            if (map) {
                const marker = new maplibregl.Marker({ element: el }).setLngLat(coords[m.idx] as [number, number]).addTo(map);
                paceMarkers.push(marker);
            }
        });
    }

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
        if (!map) return;
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
            // Dynamic Contrast: Use white for Satellite mode, slate for others
            const isSat = mapStyle === 'satellite';
            map.addLayer({ 
                id: 'trail-line', 
                type: 'line', 
                source: 'trail', 
                layout: { 'line-join': 'round', 'line-cap': 'round' }, 
                paint: { 
                    'line-color': isSat ? '#ffffff' : '#1e293b', 
                    'line-width': isSat ? 5 : 4, 
                    'line-opacity': isSat ? 0.8 : 0.6, 
                    'line-dasharray': [2, 1] 
                } 
            });
        }
        if (!map.getSource('corridor')) {
            map.addSource('corridor', { type: 'geojson', data: corridor });
            map.addLayer({ id: 'corridor-fill', type: 'fill', source: 'corridor', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.02 } });
        }
    }

    function locateMe() {
        if (watchId !== null) return;
        watchId = navigator.geolocation.watchPosition(pos => {
            if (!map) return;
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

        if (map) {
            map.on('zoom', () => { zoomLevel = map?.getZoom() || 12; });

            map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
            map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

            map.on('mousemove', (e) => { mouseCoords = { lng: e.lngLat.lng, lat: e.lngLat.lat }; });

            map.on('idle', () => {
                // Background Warming: Prefetch other styles into browser cache
                const otherStyles = Object.keys(styles).filter(s => s !== mapStyle);
                otherStyles.forEach(s => {
                    const url = styles[s];
                    if (typeof url === 'string') {
                        fetch(url, { priority: 'low' }).catch(() => {});
                    }
                });
            });

            map.on('load', () => {
                setupLayers();
                
                const onceBrewed: [number, number] = [-2.3958, 55.0036];
                const bounds = new maplibregl.LngLatBounds();
                trailCoordinates.forEach(c => bounds.extend(c as [number, number]));

                // Flight to Once Brewed as the strategic center of the full route
                map?.flyTo({
                    center: onceBrewed,
                    zoom: isMobile ? 9.0 : 9.8,
                    padding: isMobile ? { top: 20, bottom: 20, left: 20, right: 20 } : { top: 50, bottom: 50, left: 450, right: 50 },
                    duration: 2500,
                    essential: true,
                    curve: 1.2,
                    speed: 0.5
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
                                            <div class="marker-icon ${isMobile ? 'w-12 h-12' : 'w-10 h-10'} ${bgColor} rounded-sm border-2 ${isMulti ? 'border-white ring-2 ring-blue-400/50' : 'border-white'} shadow-xl flex items-center justify-center text-white">
                                                ${icon}
                                            </div>
                                            <div class="poi-label label-priority-${poi.priority} bg-slate-900/95 backdrop-blur-xl px-2 py-1 rounded-sm border border-slate-700 shadow-2xl transition-opacity duration-300 pointer-events-none">
                                                <span class="${isMobile ? 'text-[11px]' : 'text-[9px]'} font-black text-white uppercase tracking-tighter whitespace-nowrap">${poi.title}</span>
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
                        map?.flyTo({ center: poi.coords as [number, number], zoom: 14 });
                    };
                    if (map) new maplibregl.Marker({ element: el }).setLngLat(poi.coords as [number, number]).addTo(map);
                });

                if (initialPOIs.length > 0) renderPOIs(initialPOIs);
                updatePOIs();
            });

            map.on('moveend', updatePOIs);
        }
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
                    <div class="marker-icon bg-white rounded-sm border-2 border-blue-600 shadow-xl flex items-center justify-center overflow-hidden" style="width: ${isMobile ? size * 1.2 : size}px; height: ${isMobile ? size * 1.2 : size}px;">
                        <div class="text-blue-600 ${isMobile ? 'scale-[0.9]' : 'scale-[0.8]'}">
                            ${icons.discovery}
                        </div>
                    </div>
                    <div class="poi-label label-priority-4 bg-slate-900/95 backdrop-blur-xl px-2 py-1 rounded-sm border border-slate-700 shadow-2xl transition-opacity duration-300 pointer-events-none">
                        <span class="${isMobile ? 'text-[11px]' : 'text-[9px]'} font-black text-white uppercase tracking-tighter whitespace-nowrap">${poi.title}</span>
                    </div>
                </div>
            `;

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onPoiSelect) onPoiSelect({ ...poi });
                map?.flyTo({ center: [poi.lon, poi.lat], zoom: 14 });
            });
            if (map) {
                new maplibregl.Marker({ element: el }).setLngLat([poi.lon, poi.lat]).addTo(map);
                renderedPageIds.add(poi.pageid);
            }
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
            map.flyTo({ 
                center: coords as [number, number], 
                zoom: 15, 
                padding: isMobile ? 40 : { top: 50, bottom: 50, left: 450, right: 50 },
                duration: 2000 
            });
        }
    }

    export function triggerLocateMe() {
        locateMe();
    }
</script>

<div class="w-full h-full bg-slate-50 relative zoom-state-z{Math.floor(zoomLevel)}" bind:this={mapContainer}>
    <div class="absolute bottom-4 right-12 z-10 px-2 py-1 bg-white/90 backdrop-blur border border-slate-200 rounded-sm text-[9px] font-mono font-bold text-slate-500 shadow-sm pointer-events-none select-none tabular-nums">
        {mouseCoords.lat.toFixed(5)}°N {Math.abs(mouseCoords.lng).toFixed(5)}°W
    </div>
    
    <!-- Imperial Logo: Custom Roman Coin with Figma Glow -->
    <div class="absolute {isMobile ? 'bottom-4 left-4' : 'bottom-12 left-4'} z-20 pointer-events-none select-none">
        <img 
            src="/logo-coin.png" 
            alt="Roman Coin" 
            class="w-14 h-14 md:w-16 md:h-16 object-contain filter drop-shadow-[0_0_12px_rgba(59,130,246,0.4)] drop-shadow-[0_0_2px_rgba(59,130,246,0.6)]"
            style="image-rendering: -webkit-optimize-contrast;"
        />
    </div>
</div>

<style>
    :global(.maplibregl-map) { height: 100%; width: 100%; font-family: inherit; }
    :global(.poi-marker) { 
        pointer-events: auto !important; 
        outline: none !important;
        -webkit-tap-highlight-color: transparent;
    }
    
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

    :global(.poi-marker.active-marker .marker-icon) {
        border-color: #3b82f6 !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4), 0 0 15px rgba(59, 130, 246, 0.2);
        transform: scale(1.1);
    }
</style>
