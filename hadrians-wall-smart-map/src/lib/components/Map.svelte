<script lang="ts">
    import { onMount } from "svelte";
    import maplibregl from "maplibre-gl";
    import "maplibre-gl/dist/maplibre-gl.css";
    import * as turf from "@turf/turf";
    import type { Feature, LineString } from "geojson";
    import {
        trailGeoJSON,
        getCorridor,
        overnightStops,
        itinerary,
        trailCoordinates,
        englishHeritageSites,
        hospitalitySites,
    } from "$lib/data/trail";
    import { routeVariants } from "$lib/data/routes";
    import { fetchWikiPOIs, type WikiPOI } from "$lib/services/wikipedia";
    import { selectRenderableWikiPOIs, getClusteredWikiPOIs } from "$lib/utils/wikiPins";
    import {
        navigationService,
        type NavigationMetrics,
    } from "$lib/services/navigation";

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
        hikerActive?: boolean;
        hikerHeading?: number;
        hikerSimplified?: boolean;
        lowPowerMode?: boolean;
        freezeMap?: boolean;
        onNavigationUpdate?: (metrics: NavigationMetrics) => void;
        onHikerPoiSelect?: (poi: any) => void;
        onMapReady?: () => void;
        onInteraction?: () => void;
    }

    let {
        initialPOIs = [],
        selectedPOI = $bindable(null),
        selectedStageId = null,
        mapStyle = "topo",
        selectedRoute = "osm",
        isHeadingUp = false,
        isMobile = false,
        showMilestones = true,
        onPoiSelect,
        hikerActive = false,
        hikerHeading = 0,
        hikerSimplified = false,
        lowPowerMode = false,
        freezeMap = false,
        onNavigationUpdate,
        onHikerPoiSelect,
        onMapReady,
        onInteraction,
    }: Props = $props();

    let mapContainer: HTMLDivElement;
    let map = $state<maplibregl.Map | null>(null);
    let corridor: any;
    let wikiCorridor: any;
    let wikiWindowLine: Feature<LineString> | null = null;
    let mouseCoords = $state({ lng: -2.3958, lat: 55.0036 });
    let zoomLevel = $state(12);
    let userLocation = $state<{
        lng: number;
        lat: number;
        accuracy: number;
    } | null>(null);
    let userMarker: maplibregl.Marker | null = null;
    let watchId: number | null = null;
    let driftMeters = $state(0);
    let registryPOIs: any[] = [];
    let floatingMarkers: maplibregl.Marker[] = [];
    let wikiMarkers = new Map<number | string, maplibregl.Marker>();
    let allWikiPOIs = new Map<number, WikiPOI>();
    let glowFrame: number | null = null;
    let lastGlowTick = 0;
    let lastFlyTo = 0;
    const wikiWindowHubs = [
        "Carlisle",
        "Lanercost/Brampton",
        "Gilsland",
        "Once Brewed",
        "Chollerford",
        "Corbridge",
    ];

    const styles: Record<string, any> = {
        streets: "https://tiles.openfreemap.org/styles/bright",
        topo: "https://tiles.openfreemap.org/styles/liberty",
        satellite: {
            version: 8,
            sources: {
                "raster-tiles": {
                    type: "raster",
                    tiles: [
                        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                    ],
                    tileSize: 256,
                    attribution: "Esri, Maxar",
                },
                openfreemap: {
                    type: "vector",
                    url: "https://tiles.openfreemap.org/tiles/v1/openfreemap.json",
                },
            },
            layers: [
                {
                    id: "simple-tiles",
                    type: "raster",
                    source: "raster-tiles",
                    minzoom: 0,
                    maxzoom: 22,
                },
                // Place Name Overlay for Orientation
                {
                    id: "place-labels",
                    type: "symbol",
                    source: "openfreemap",
                    "source-layer": "place",
                    layout: {
                        "text-field": "{name}",
                        "text-font": ["Noto Sans Regular"],
                        "text-size": 12,
                        "text-transform": "uppercase",
                        "text-letter-spacing": 0.1,
                    },
                    paint: {
                        "text-color": "#ffffff",
                        "text-halo-color": "rgba(0,0,0,0.8)",
                        "text-halo-width": 2,
                    },
                },
            ],
        },
    };

    // React to style change
    $effect(() => {
        if (map && mapStyle && styles[mapStyle]) {
            map.setStyle(styles[mapStyle]);
            // Re-add layers once the new style has loaded
            map.once("style.load", () => {
                setupLayers();
                const shouldGlow = hikerActive && !hikerSimplified;
                setGlowVisibility(shouldGlow);
                if (shouldGlow) startGlowPulse();
                // Ensure active stage is redrawn if selected
                if (selectedStageId !== null) {
                    const stage = itinerary.find(
                        (s) => s.id === selectedStageId,
                    );
                    if (stage) updateStageLayer(stage);
                }
            });
        }
    });

    // React to Milestone Toggle
    $effect(() => {
        if (map && selectedStageId !== null) {
            const stage = itinerary.find((s) => s.id === selectedStageId);
            if (stage) updateStageLayer(stage);
        } else {
            clearPaceMarkers();
        }
    });

    function updateStageLayer(stage: any) {
        if (!map) return;

        const hubs = overnightStops;
        // Robust hub matching: check if hub name is in stage name or vice versa
        const fromHub = hubs.find(
            (h) =>
                stage.from.includes(h.name.split("/")[0]) ||
                h.name.includes(stage.from.split(" ")[0]),
        );
        const toHub = hubs.find(
            (h) =>
                stage.to.includes(h.name.split("/")[0]) ||
                h.name.includes(stage.to.split(" ")[0]),
        );

        let stageCoords: [number, number][] = [];

        if (fromHub && toHub) {
            // Find indices of points in the master trail closest to these hubs
            let startIdx = 0;
            let endIdx = trailCoordinates.length - 1;
            let minDistStart = Infinity;
            let minDistEnd = Infinity;

            trailCoordinates.forEach((c, i) => {
                const pt = turf.point(c as [number, number]);
                const dStart = turf.distance(
                    pt,
                    turf.point(fromHub.coords as [number, number]),
                    { units: "miles" },
                );
                const dEnd = turf.distance(
                    pt,
                    turf.point(toHub.coords as [number, number]),
                    { units: "miles" },
                );

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
            stageCoords = trailCoordinates.slice(s, e + 1) as [
                number,
                number,
            ][];
        } else {
            // Fallback to full trail if hubs aren't found
            stageCoords = trailCoordinates as [number, number][];
        }

        const source = map.getSource(
            "selected-stage",
        ) as maplibregl.GeoJSONSource;
        if (source)
            source.setData({
                type: "Feature",
                geometry: { type: "LineString", coordinates: stageCoords },
                properties: {},
            });

        // Dynamic Framing for the specific slice
        if (stageCoords.length > 0) {
            const bounds = new maplibregl.LngLatBounds();
            stageCoords.forEach((c) => bounds.extend(c));
            map.fitBounds(bounds, {
                padding: isMobile
                    ? 40
                    : { top: 100, bottom: 100, left: 450, right: 100 },
                duration: 1500,
            });
        }

        renderPaceMarkers(stageCoords, stage);
    }

    // React to route change
    $effect(() => {
        const variants = routeVariants as Record<string, any>;
        if (map && selectedRoute && variants[selectedRoute]) {
            const source = map.getSource("trail") as maplibregl.GeoJSONSource;
            if (source) {
                source.setData({
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "LineString",
                        coordinates: variants[selectedRoute],
                    },
                });
            }
        }
    });

    // React to POI selection (Visual highlighting)
    $effect(() => {
        if (map && selectedPOI) {
            document.querySelectorAll(".poi-marker").forEach((m) => {
                const markerEl = m as HTMLElement;
                const isSelected =
                    markerEl.dataset.pageid ===
                        selectedPOI.pageid?.toString() ||
                    markerEl.dataset.name === selectedPOI.name;
                markerEl.classList.toggle("active-marker", isSelected);
            });
        }
    });

    // React to Stage selection (Fly to and highlight)
    $effect(() => {
        if (map && selectedStageId !== null) {
            const stage = itinerary.find((s) => s.id === selectedStageId);
            if (stage) {
                updateStageLayer(stage);
            }
        } else if (map && selectedStageId === null) {
            const source = map.getSource(
                "selected-stage",
            ) as maplibregl.GeoJSONSource;
            if (source)
                source.setData({ type: "FeatureCollection", features: [] });
            clearPaceMarkers();
        }
    });

    function setMapInteractivity(enabled: boolean) {
        if (!map) return;

        if (enabled) {
            map.dragPan.enable();
            map.scrollZoom.enable();
            map.boxZoom.enable();
            map.dragRotate.enable();
            map.keyboard.enable();
            map.doubleClickZoom.enable();
            map.touchZoomRotate.enable();
            return;
        }

        map.dragPan.disable();
        map.scrollZoom.disable();
        map.boxZoom.disable();
        map.dragRotate.disable();
        map.keyboard.disable();
        map.doubleClickZoom.disable();
        map.touchZoomRotate.disable();
    }

    function clearFloatingMarkers() {
        floatingMarkers.forEach((marker) => marker.remove());
        floatingMarkers = [];
    }

    function renderNearbyFloatingPOIs(center: [number, number]) {
        if (!map || !hikerActive || !userLocation || hikerSimplified) {
            clearFloatingMarkers();
            return;
        }

        clearFloatingMarkers();
        const centerPoint = turf.point(center);
        const nearby = registryPOIs
            .filter((poi) => {
                const km = turf.distance(centerPoint, turf.point(poi.coords), {
                    units: "kilometers",
                });
                return km <= 0.5;
            })
            .slice(0, 8);

        nearby.forEach((poi) => {
            const currentMap = map;
            if (!currentMap) return;
            const el = document.createElement("button");
            el.className = "hiker-floating-poi";
            el.innerHTML = `
                <i class="hn hn-location-pin hiker-floating-poi__icon" aria-hidden="true"></i>
                <span class="hiker-floating-poi__label">${poi.title}</span>
            `;
            el.onclick = (event) => {
                event.stopPropagation();
                onHikerPoiSelect?.(poi);
            };

            const marker = new maplibregl.Marker({
                element: el,
                anchor: "bottom",
            })
                .setLngLat(poi.coords as [number, number])
                .addTo(currentMap);
            floatingMarkers.push(marker);
        });
    }

    function setGlowVisibility(visible: boolean) {
        if (!map) return;
        const visibility = visible ? "visible" : "none";
        if (map.getLayer("hiker-glow-outer"))
            map.setLayoutProperty("hiker-glow-outer", "visibility", visibility);
        if (map.getLayer("hiker-glow-core"))
            map.setLayoutProperty("hiker-glow-core", "visibility", visibility);
    }

    function animateGlow(ts: number) {
        if (
            !map ||
            !map.getLayer("hiker-glow-outer") ||
            !map.getLayer("hiker-glow-core")
        ) {
            glowFrame = null;
            return;
        }

        const frameEveryMs = lowPowerMode ? 120 : 34;
        if (ts - lastGlowTick >= frameEveryMs) {
            lastGlowTick = ts;
            const pulse = 0.5 + 0.5 * Math.sin(ts / 240);
            map.setPaintProperty(
                "hiker-glow-outer",
                "line-width",
                8 + pulse * 8,
            );
            map.setPaintProperty(
                "hiker-glow-outer",
                "line-opacity",
                0.1 + pulse * 0.26,
            );
            map.setPaintProperty(
                "hiker-glow-core",
                "line-width",
                2.5 + pulse * 2.5,
            );
            map.setPaintProperty(
                "hiker-glow-core",
                "line-opacity",
                0.35 + pulse * 0.45,
            );
        }

        glowFrame = requestAnimationFrame(animateGlow);
    }

    function startGlowPulse() {
        if (glowFrame !== null) return;
        glowFrame = requestAnimationFrame(animateGlow);
    }

    function stopGlowPulse() {
        if (glowFrame !== null) {
            cancelAnimationFrame(glowFrame);
            glowFrame = null;
        }
        if (!map) return;
        if (map.getLayer("hiker-glow-outer"))
            map.setPaintProperty("hiker-glow-outer", "line-opacity", 0);
        if (map.getLayer("hiker-glow-core"))
            map.setPaintProperty("hiker-glow-core", "line-opacity", 0);
    }

    $effect(() => {
        if (!map) return;
        setMapInteractivity(!freezeMap);
    });

    $effect(() => {
        if (!map) return;
        const targetPitch = hikerActive && !hikerSimplified ? 60 : 0;
        if (Math.abs(map.getPitch() - targetPitch) > 1) {
            map.easeTo({ pitch: targetPitch, duration: 650 });
        }
    });

    $effect(() => {
        if (!map) return;
        const shouldHeadingUp = isHeadingUp && hikerActive && !hikerSimplified;
        if (shouldHeadingUp) {
            map.setBearing(hikerHeading);
            return;
        }
        if (Math.abs(map.getBearing()) > 1) {
            map.easeTo({ bearing: 0, duration: 500 });
        }
    });

    $effect(() => {
        if (!map) return;
        const shouldGlow = hikerActive && !hikerSimplified;
        setGlowVisibility(shouldGlow);
        if (shouldGlow) {
            startGlowPulse();
        } else {
            stopGlowPulse();
        }
    });

    $effect(() => {
        if (!map) return;
        if (!userLocation) {
            clearFloatingMarkers();
            return;
        }
        renderNearbyFloatingPOIs([userLocation.lng, userLocation.lat]);
    });

    let paceMarkers: maplibregl.Marker[] = [];
    function clearPaceMarkers() {
        paceMarkers.forEach((m) => m.remove());
        paceMarkers = [];
    }

    function nearestTrailIndex(target: [number, number]) {
        let idx = 0;
        let best = Infinity;
        trailCoordinates.forEach((coord, i) => {
            const d = turf.distance(
                turf.point(coord as [number, number]),
                turf.point(target),
                { units: "kilometers" },
            );
            if (d < best) {
                best = d;
                idx = i;
            }
        });
        return idx;
    }

    function buildWikiWindowCorridor() {
        const carlisle = overnightStops.find((hub) => hub.name === "Carlisle");
        const corbridge = overnightStops.find(
            (hub) => hub.name === "Corbridge",
        );
        if (!carlisle || !corbridge) {
            wikiCorridor = corridor;
            wikiWindowLine = turf.lineString(
                trailCoordinates as [number, number][],
            );
            return;
        }

        const startIdx = nearestTrailIndex(carlisle.coords as [number, number]);
        const endIdx = nearestTrailIndex(corbridge.coords as [number, number]);
        const from = Math.min(startIdx, endIdx);
        const to = Math.max(startIdx, endIdx);
        const segmentCoords = trailCoordinates.slice(from, to + 1) as [
            number,
            number,
        ][];

        if (segmentCoords.length < 2) {
            wikiCorridor = corridor;
            wikiWindowLine = turf.lineString(
                trailCoordinates as [number, number][],
            );
            return;
        }

        const segmentLine = turf.lineString(segmentCoords);
        wikiWindowLine = segmentLine;
        wikiCorridor = turf.buffer(segmentLine, 1.1, { units: "kilometers" });
    }

    function renderPaceMarkers(coords: any[], stage: any) {
        clearPaceMarkers();
        if (coords.length < 2 || !showMilestones) return;

        let totalDist = 0;
        const speedMph = 2.8;
        const startTime = 9;
        const halfWayMi = stage.distanceMi / 2;
        let halfWayAdded = false;

        const milestoneIndices: {
            idx: number;
            name: string;
            type: "pace" | "milestone" | "halfway";
            hours?: number;
        }[] = [];

        // Track cumulative distance to place markers
        for (let i = 1; i < coords.length; i++) {
            const p1 = turf.point(coords[i - 1]);
            const p2 = turf.point(coords[i]);
            totalDist += turf.distance(p1, p2, { units: "miles" });

            // Bi-Hourly Pace (Blue)
            if (
                totalDist >= 4.5 &&
                milestoneIndices.filter((m) => m.type === "pace").length === 0
            ) {
                milestoneIndices.push({
                    idx: i,
                    name: "+2H",
                    type: "pace",
                    hours: 2,
                });
            }
            if (
                totalDist >= 9.0 &&
                milestoneIndices.filter((m) => m.type === "pace").length === 1
            ) {
                milestoneIndices.push({
                    idx: i,
                    name: "+4H",
                    type: "pace",
                    hours: 4,
                });
            }

            // Half-Way Checkpoint (Amber)
            if (totalDist >= halfWayMi && !halfWayAdded && halfWayMi > 1) {
                milestoneIndices.push({
                    idx: i,
                    name: "Half-Way",
                    type: "halfway",
                });
                halfWayAdded = true;
            }

            // Itinerary Milestones (Amber)
            stage.milestones?.forEach((ms: any) => {
                if (
                    totalDist >= ms.mi &&
                    !milestoneIndices.find((m) => m.name === ms.name)
                ) {
                    milestoneIndices.push({
                        idx: i,
                        name: ms.name,
                        type: "milestone",
                    });
                }
            });
        }

        milestoneIndices.forEach((m) => {
            const el = document.createElement("div");
            const isPace = m.type === "pace";
            const isHalf = m.type === "halfway";

            const time = m.hours ? startTime + m.hours : null;
            const timeStr = time
                ? `${time > 12 ? time - 12 : time}:00 ${time >= 12 ? "PM" : "AM"}`
                : "";

            el.className = "pace-marker z-20 pointer-events-none";
            el.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="w-2.5 h-2.5 ${isPace ? "bg-blue-500 rounded-full" : "bg-amber-500 rotate-45"} border border-white shadow-sm mb-1"></div>
                    <div class="bg-white/95 backdrop-blur-md border border-slate-200 px-1.5 py-0.5 rounded-sm shadow-xl flex flex-col items-center">
                        <span class="text-[8px] font-black ${isPace ? "text-blue-700" : "text-amber-700"} uppercase tracking-tighter tabular-nums">${m.name}</span>
                        ${timeStr ? `<span class="text-[7px] font-bold text-slate-500">${timeStr}</span>` : ""}
                    </div>
                </div>
            `;
            if (map) {
                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat(coords[m.idx] as [number, number])
                    .addTo(map);
                paceMarkers.push(marker);
            }
        });
    }

    // RPG Awesome pin icon classes
    const icons = {
        bed: `<i class="ra ra-castle-flag map-pin-glyph" aria-hidden="true"></i>`,
        heritage: `<i class="ra ra-capitol map-pin-glyph" aria-hidden="true"></i>`,
        pub: `<i class="ra ra-beer map-pin-glyph" aria-hidden="true"></i>`,
        brewery: `<i class="ra ra-beer map-pin-glyph" aria-hidden="true"></i>`,
        discovery: `<span style="font-family: serif; font-weight: bold;">W</span>`,
        cafe: `<i class="ra ra-coffee-mug map-pin-glyph" aria-hidden="true"></i>`,
        restaurant: `<i class="ra ra-knife-fork map-pin-glyph" aria-hidden="true"></i>`,
        deli: `<i class="ra ra-meat map-pin-glyph" aria-hidden="true"></i>`,
    };

    function setupLayers() {
        if (!map) return;
        const variants = routeVariants as Record<string, any>;

        // User Accuracy Circle (Communicate uncertainty)
        if (!map.getSource("user-accuracy")) {
            map.addSource("user-accuracy", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });
            map.addLayer({
                id: "user-accuracy-fill",
                type: "fill",
                source: "user-accuracy",
                paint: { "fill-color": "#3b82f6", "fill-opacity": 0.1 },
            });
            map.addLayer({
                id: "user-accuracy-outline",
                type: "line",
                source: "user-accuracy",
                paint: {
                    "line-color": "#3b82f6",
                    "line-width": 1,
                    "line-dasharray": [2, 2],
                },
            });
        }

        if (!map.getSource("selected-stage")) {
            map.addSource("selected-stage", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });
            // Route Prominence: High-contrast glow
            map.addLayer({
                id: "selected-stage-line",
                type: "line",
                source: "selected-stage",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: {
                    "line-color": "#3b82f6",
                    "line-width": 12,
                    "line-opacity": 0.4,
                },
            });
            map.addLayer({
                id: "selected-stage-line-core",
                type: "line",
                source: "selected-stage",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": "#ffffff", "line-width": 2 },
            });
        }
        if (!map.getSource("trail")) {
            map.addSource("trail", {
                type: "geojson",
                data: {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "LineString",
                        coordinates:
                            variants[selectedRoute] || trailCoordinates,
                    },
                },
            });
            map.addLayer({
                id: "hiker-glow-outer",
                type: "line",
                source: "trail",
                layout: {
                    "line-join": "round",
                    "line-cap": "round",
                    visibility: "none",
                },
                paint: {
                    "line-color": "#38bdf8",
                    "line-width": 8,
                    "line-opacity": 0,
                    "line-blur": 1.2,
                },
            });
            map.addLayer({
                id: "hiker-glow-core",
                type: "line",
                source: "trail",
                layout: {
                    "line-join": "round",
                    "line-cap": "round",
                    visibility: "none",
                },
                paint: {
                    "line-color": "#facc15",
                    "line-width": 3,
                    "line-opacity": 0,
                },
            });
            // Path Hierarchy: Differentiation via texture (Dashed = Footpath)
            // Dynamic Contrast: Use white for Satellite mode, slate for others
            const isSat = mapStyle === "satellite";
            map.addLayer({
                id: "trail-line",
                type: "line",
                source: "trail",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: {
                    "line-color": isSat ? "#ffffff" : "#1e293b",
                    "line-width": isSat ? 5 : 4,
                    "line-opacity": isSat ? 0.8 : 0.6,
                    "line-dasharray": [2, 1],
                },
            });
        }
        if (!map.getSource("corridor")) {
            map.addSource("corridor", { type: "geojson", data: corridor });
            map.addLayer({
                id: "corridor-fill",
                type: "fill",
                source: "corridor",
                paint: { "fill-color": "#3b82f6", "fill-opacity": 0.02 },
            });
        }
    }

    // --- ADAPTIVE NAVIGATION LOGIC (iOS 2026 PWA) ---
    const UI_THROTTLE_MS = 3000;
    const STATIONARY_THRESHOLD_MPH = 0.45;
    const STATIONARY_COORDS_DELTA_M = 4.0;
    const POOR_ACCURACY_THRESHOLD_M = 100.0;
    const RECOVERY_BACKOFF_MS = [3000, 10000, 30000];

    let lastUiUpdate = 0;
    let recoveryAttempt = 0;
    let isTrackingBackgrounded = false;
    let trackingState = $state<"HIGH_ACCURACY" | "LOW_POWER" | "ERROR">("LOW_POWER");
    let lastStableCoord: [number, number] | null = null;

    function clearWatch() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
    }

    function locateMe() {
        if (!hikerActive || isTrackingBackgrounded) {
            clearWatch();
            return;
        }

        if (watchId !== null) return;

        const options: PositionOptions =
            trackingState === "HIGH_ACCURACY"
                ? {
                      enableHighAccuracy: true,
                      maximumAge: 0,
                      timeout: 10000,
                  }
                : {
                      enableHighAccuracy: false,
                      maximumAge: 60000,
                      timeout: 20000,
                  };

        watchId = navigator.geolocation.watchPosition(
            (pos) => {
                if (!map || !hikerActive) return;

                const { longitude, latitude, accuracy, heading, speed } =
                    pos.coords;
                const now = Date.now();

                // 1. Accuracy Gate & Error Recovery
                if (accuracy > POOR_ACCURACY_THRESHOLD_M) {
                    handlePoorAccuracy();
                    return;
                }
                recoveryAttempt = 0;

                // 2. Throttle Logic
                if (now - lastUiUpdate < UI_THROTTLE_MS) return;
                lastUiUpdate = now;

                // 3. Movement Detection (Adaptive Escalation)
                const currentCoord: [number, number] = [longitude, latitude];
                let isStationary = false;

                if (speed !== null && speed < STATIONARY_THRESHOLD_MPH) {
                    isStationary = true;
                } else if (lastStableCoord) {
                    const dist = turf.distance(
                        turf.point(lastStableCoord),
                        turf.point(currentCoord),
                        { units: "meters" },
                    );
                    if (dist < STATIONARY_COORDS_DELTA_M) isStationary = true;
                }

                if (isStationary && trackingState === "HIGH_ACCURACY") {
                    transitionTracking("LOW_POWER");
                } else if (!isStationary && trackingState !== "HIGH_ACCURACY") {
                    transitionTracking("HIGH_ACCURACY");
                }
                lastStableCoord = currentCoord;

                // 4. Update Core UI
                const rawCoord: [number, number] = [longitude, latitude];
                const baseMetrics = navigationService.updatePosition(rawCoord);
                const gpsHeading =
                    typeof heading === "number" &&
                    Number.isFinite(heading) &&
                    heading >= 0
                        ? heading
                        : null;
                const gpsSpeedMph =
                    typeof speed === "number" &&
                    Number.isFinite(speed) &&
                    speed >= 0
                        ? speed * 2.2369362920544
                        : null;

                const metrics: NavigationMetrics = {
                    ...baseMetrics,
                    gpsHeading,
                    gpsSpeedMph,
                };

                const [snappedLng, snappedLat] = metrics.snappedCoord;
                userLocation = { lng: snappedLng, lat: snappedLat, accuracy };
                driftMeters = metrics.driftMeters;
                onNavigationUpdate?.(metrics);

                // Update Accuracy Circle
                const circle = turf.circle(
                    [longitude, latitude],
                    accuracy / 1000,
                    { units: "kilometers" },
                );
                const source = map.getSource(
                    "user-accuracy",
                ) as maplibregl.GeoJSONSource;
                if (source) source.setData(circle);

                // Update User Marker
                if (!userMarker) {
                    const el = document.createElement("div");
                    el.className =
                        "w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-2xl animate-pulse flex items-center justify-center transition-colors";
                    el.innerHTML = `<div class="w-2 h-2 bg-white rounded-full"></div>`;
                    userMarker = new maplibregl.Marker({ element: el })
                        .setLngLat([snappedLng, snappedLat])
                        .addTo(map);
                } else {
                    userMarker.setLngLat([snappedLng, snappedLat]);
                    if (userMarker.getElement()) {
                        userMarker
                            .getElement()
                            .classList.toggle(
                                "bg-rose-600",
                                metrics.driftMeters > 25,
                            );
                        userMarker
                            .getElement()
                            .classList.toggle(
                                "bg-blue-600",
                                metrics.driftMeters <= 25,
                            );
                    }
                }

                renderNearbyFloatingPOIs(metrics.snappedCoord);

                const flyInterval = lowPowerMode ? 4000 : 1800;
                if (now - lastFlyTo >= flyInterval) {
                    lastFlyTo = now;
                    map.easeTo({
                        center: [snappedLng, snappedLat],
                        zoom: 15,
                        duration: lowPowerMode ? 2000 : 1200,
                    });
                }
            },
            (err) => {
                console.warn("Geolocation error:", err);
                handlePoorAccuracy();
            },
            options,
        );
    }

    function transitionTracking(newState: "HIGH_ACCURACY" | "LOW_POWER") {
        if (trackingState === newState) return;
        trackingState = newState;
        clearWatch();
        // Small delay to prevent rapid cycling
        setTimeout(() => locateMe(), 500);
    }

    function handlePoorAccuracy() {
        trackingState = "ERROR";
        clearWatch();
        const backoff =
            RECOVERY_BACKOFF_MS[
                Math.min(recoveryAttempt, RECOVERY_BACKOFF_MS.length - 1)
            ];
        recoveryAttempt++;
        setTimeout(() => {
            if (hikerActive && !isTrackingBackgrounded) {
                transitionTracking("LOW_POWER");
            }
        }, backoff);
    }

    // Lifecycle: Pause on Background
    function handleVisibilityChange() {
        isTrackingBackgrounded = document.visibilityState === "hidden";
        if (isTrackingBackgrounded) {
            clearWatch();
        } else if (hikerActive) {
            locateMe();
        }
    }

    $effect(() => {
        if (hikerActive) {
            locateMe();
        } else {
            clearWatch();
            if (userMarker) {
                userMarker.remove();
                userMarker = null;
            }
        }
    });

    onMount(() => {
        document.addEventListener("visibilitychange", handleVisibilityChange);
        corridor = getCorridor(1.1);
        buildWikiWindowCorridor();
        map = new maplibregl.Map({
            container: mapContainer,
            // @ts-ignore
            style: styles[mapStyle] || styles.topo,
            center: [-2.3, 55.0], // Strategic midpoint
            zoom: 8,
            maxZoom: 18,
            minZoom: 6,
            attributionControl: false,
        });

        if (map) {
            map.on("zoom", () => {
                zoomLevel = map?.getZoom() || 12;
            });

            map.addControl(
                new maplibregl.NavigationControl({ showCompass: true }),
                "bottom-right",
            );
            map.addControl(
                new maplibregl.ScaleControl({ unit: "imperial" }),
                "bottom-left",
            );

            map.on("mousemove", (e) => {
                mouseCoords = { lng: e.lngLat.lng, lat: e.lngLat.lat };
                onInteraction?.();
            });

            map.on("dragstart", () => onInteraction?.());
            map.on("zoomstart", () => onInteraction?.());
            map.on("click", () => onInteraction?.());

            map.on("idle", () => {
                // Background Warming: Prefetch other styles into browser cache
                const otherStyles = Object.keys(styles).filter(
                    (s) => s !== mapStyle,
                );
                otherStyles.forEach((s) => {
                    const url = styles[s];
                    if (typeof url === "string") {
                        fetch(url, { priority: "low" }).catch(() => {});
                    }
                });
            });

            map.on("error", (e) => {
                console.error("MapLibre error:", e);
                // Fire ready anyway to clear splash
                onMapReady?.();
            });

            map.on("load", () => {
                setupLayers();
                onMapReady?.();

                const onceBrewed: [number, number] = [-2.3958, 55.0036];
                const bounds = new maplibregl.LngLatBounds();
                trailCoordinates.forEach((c) =>
                    bounds.extend(c as [number, number]),
                );

                // Flight to Once Brewed as the strategic center of the full route
                map?.flyTo({
                    center: onceBrewed,
                    zoom: isMobile ? 9.0 : 9.8,
                    padding: isMobile
                        ? { top: 20, bottom: 20, left: 20, right: 20 }
                        : { top: 50, bottom: 50, left: 450, right: 50 },
                    duration: 2500,
                    essential: true,
                    curve: 1.2,
                    speed: 0.5,
                });

                // Consolidate Official Sites by Coordinates
                const registry = new Map<string, any>();

                const addSite = (site: any, type: string, priority: number) => {
                    const key = `${site.coords[0].toFixed(5)},${site.coords[1].toFixed(5)}`;
                    if (registry.has(key)) {
                        const existing = registry.get(key);
                        existing.types.push(type);
                        existing.priority = Math.min(
                            existing.priority,
                            priority,
                        ); // Keep highest priority
                        existing.allData.push({ ...site, type });
                        if (type === "heritage" || type === "hospitality")
                            existing.title = site.name;
                    } else {
                        registry.set(key, {
                            title: site.name || site.title,
                            coords: site.coords,
                            types: [type],
                            priority,
                            allData: [{ ...site, type }],
                            pageid: site.pageid,
                            lat: site.coords[1],
                            lon: site.coords[0],
                        });
                    }
                };

                overnightStops.forEach((s) => addSite(s, "hub", 1));
                englishHeritageSites.forEach((s) => addSite(s, "heritage", 2));
                hospitalitySites.forEach((s) => addSite(s, "hospitality", 3));
                registryPOIs = Array.from(registry.values());

                registry.forEach((poi) => {
                    const el = document.createElement("div");
                    const isMulti = poi.types.length > 1;

                    let bgColor = "bg-blue-600";
                    let icon = icons.bed;

                    if (poi.types.includes("heritage")) {
                        bgColor = "bg-slate-800";
                        icon = icons.heritage;
                    } else if (poi.types.includes("hospitality")) {
                        const hSite = poi.allData.find(
                            (d: any) => d.type === "hospitality",
                        );
                        if (hSite?.category === "brewery") {
                            bgColor = "bg-amber-600";
                            icon = icons.brewery;
                        } else if (hSite?.category === "cafe") {
                            bgColor = "bg-emerald-600";
                            icon = icons.cafe;
                        } else if (hSite?.category === "restaurant") {
                            bgColor = "bg-rose-700";
                            icon = icons.restaurant;
                        } else if (hSite?.category === "deli") {
                            bgColor = "bg-lime-700";
                            icon = icons.deli;
                        } else if (hSite?.category === "hotel") {
                            bgColor = "bg-blue-600";
                            icon = icons.bed;
                        } else {
                            bgColor = "bg-orange-700";
                            icon = icons.pub;
                        }
                    }

                    el.className = `poi-marker z-30`;
                    el.dataset.name = poi.title;
                    if (poi.pageid) el.dataset.pageid = poi.pageid.toString();

                    el.innerHTML = `
                                        <div class="instrument-shell flex flex-col items-center gap-1 group cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95">
                                            <div class="marker-icon ${isMobile ? "w-9 h-9 text-[14px]" : "w-10 h-10 text-[15px]"} ${bgColor} rounded-sm border-2 ${isMulti ? "border-white ring-2 ring-blue-400/50" : "border-white"} shadow-xl flex items-center justify-center text-white">
                                                ${icon}
                                            </div>
                                            <div class="poi-label label-priority-${poi.priority} bg-slate-900/95 backdrop-blur-xl px-2 py-1 rounded-sm border border-slate-700 shadow-2xl transition-opacity duration-300 pointer-events-none">
                                                <span class="${isMobile ? "text-[11px]" : "text-[9px]"} font-black text-white uppercase tracking-tighter whitespace-nowrap">${poi.title}</span>
                                            </div>
                                        </div>
                                    `;
                    el.onclick = (e) => {
                        e.stopPropagation();
                        const mergedPOI = {
                            ...poi,
                            summary: poi.allData
                                .map((d: any) => d.summary || d.intel || "")
                                .filter(Boolean)
                                .join("\n\n"),
                            bourdainIntel: poi.allData.find(
                                (d: any) => d.bourdainIntel,
                            )?.bourdainIntel,
                            fryeIntel: poi.allData.find((d: any) => d.fryeIntel)
                                ?.fryeIntel,
                            rickStevesIntel: poi.allData.find(
                                (d: any) => d.rickStevesIntel,
                            )?.rickStevesIntel,
                            photoIntel: poi.allData.find(
                                (d: any) => d.photoIntel,
                            )?.photoIntel,
                            url:
                                poi.allData.find(
                                    (d: any) => d.url && d.url !== "#",
                                )?.url ||
                                (poi.pageid
                                    ? `https://en.wikipedia.org/?curid=${poi.pageid}`
                                    : "#"),
                        };
                        if (onPoiSelect) onPoiSelect(mergedPOI);
                        map?.flyTo({
                            center: poi.coords as [number, number],
                            zoom: 14,
                        });
                    };
                    if (map)
                        new maplibregl.Marker({ element: el })
                            .setLngLat(poi.coords as [number, number])
                            .addTo(map);
                });
            });

            map?.on("style.load", () => {
                const source = map?.getSource("trail") as maplibregl.GeoJSONSource;
                if (source) source.setData(trailGeoJSON as any);

                if (initialPOIs.length > 0) {
                    initialPOIs.forEach(poi => allWikiPOIs.set(poi.pageid, poi));
                    refreshWikiMarkers();
                }
                preloadWikiPOIsForHikerSection();
                updatePOIs();
            });

            map?.on("moveend", () => {
                updatePOIs();
                refreshWikiMarkers();
            });
        }

        return () => {
            stopGlowPulse();
            clearFloatingMarkers();
            clearPaceMarkers();
            clearWikiMarkers();
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
            if (userMarker) {
                userMarker.remove();
                userMarker = null;
            }
            map?.remove();
            map = null;
        };
    });

    function clearWikiMarkers() {
        for (const marker of wikiMarkers.values()) {
            marker.remove();
        }
        wikiMarkers.clear();
    }

    function refreshWikiMarkers() {
        if (!map) return;
        const zoom = map.getZoom();
        const bounds = map.getBounds();
        const bbox: [number, number, number, number] = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
        ];

        const activeCorridor = wikiCorridor || corridor;
        const candidates = Array.from(allWikiPOIs.values());

        // Filter by corridor
        const filtered = candidates.filter((poi) => {
            if (!activeCorridor) return true;
            try {
                const pt = turf.point([poi.lon, poi.lat]);
                return turf.booleanPointInPolygon(pt, activeCorridor);
            } catch {
                return true;
            }
        });

        // Cluster
        const clusters = getClusteredWikiPOIs(filtered, zoom, bbox);
        const nextMarkerIds = new Set<string | number>();

        for (const feature of clusters) {
            const isCluster = (feature.properties as any).cluster;
            const id = isCluster
                ? `cluster-${feature.id}`
                : (feature.properties as any).pageid;
            nextMarkerIds.add(id);

            if (!wikiMarkers.has(id)) {
                const el = document.createElement("div");
                const [lng, lat] = feature.geometry.coordinates;

                if (isCluster) {
                    const count = feature.properties.point_count;
                    const topTitle = feature.properties.topTitle;

                    el.className = "poi-marker z-10 cluster-marker";
                    el.innerHTML = `
                        <div class="instrument-shell flex flex-col items-center gap-1 group cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95">
                            <div class="marker-icon bg-slate-900/90 backdrop-blur-sm rounded-full border border-slate-700 shadow-lg flex items-center justify-center overflow-hidden w-8 h-8">
                                <div class="text-white text-[11px] font-black tabular-nums">
                                    ${count}
                                </div>
                            </div>
                            <div class="poi-label bg-slate-900/95 backdrop-blur-xl px-2 py-1 rounded-sm border border-slate-700 shadow-2xl transition-opacity duration-300 pointer-events-none">
                                <span class="text-[9px] font-black text-white uppercase tracking-tighter whitespace-nowrap">${topTitle} & ${count - 1} more</span>
                            </div>
                        </div>
                    `;
                    el.addEventListener("click", (e) => {
                        e.stopPropagation();
                        map?.flyTo({ center: [lng, lat], zoom: zoom + 2 });
                    });
                } else {
                    const poi = feature.properties as WikiPOI;
                    const size = Math.min(22, Math.max(14, 14 + poi.rank / 10));
                    el.className = "poi-marker z-10";
                    el.dataset.pageid = poi.pageid.toString();

                    el.innerHTML = `
                        <div class="instrument-shell flex flex-col items-center gap-1 group cursor-pointer transition-all duration-200 hover:scale-125 hover:z-40 active:scale-90 overflow-visible">
                                <div class="marker-icon bg-white/90 backdrop-blur-sm rounded-sm border border-slate-300 shadow-sm flex items-center justify-center overflow-hidden" style="width: ${isMobile ? size * 0.95 : size}px; height: ${isMobile ? size * 0.95 : size}px;">
                                <div class="text-black flex items-center justify-center leading-none font-bold" style="font-size: ${Math.max(10, Math.min(16, size * (isMobile ? 0.65 : 0.6)))}px; font-family: serif;">
                                    W
                                </div>
                            </div>
                            <div class="poi-label label-priority-4 bg-slate-900/95 backdrop-blur-xl px-2 py-1 rounded-sm border border-slate-700 shadow-2xl transition-opacity duration-300 pointer-events-none">
                                <span class="${isMobile ? "text-[11px]" : "text-[9px]"} font-black text-white uppercase tracking-tighter whitespace-nowrap">${poi.title}</span>
                            </div>
                        </div>
                    `;

                    el.addEventListener("click", (e) => {
                        e.stopPropagation();
                        if (onPoiSelect) onPoiSelect({ ...poi });
                        map?.flyTo({ center: [lng, lat], zoom: 14 });
                    });
                }

                if (map) {
                    const marker = new maplibregl.Marker({ element: el })
                        .setLngLat([lng, lat])
                        .addTo(map);
                    wikiMarkers.set(id, marker);
                }
            }
        }

        // Cleanup old markers
        for (const [id, marker] of wikiMarkers.entries()) {
            if (!nextMarkerIds.has(id)) {
                marker.remove();
                wikiMarkers.delete(id);
            }
        }
    }

    async function preloadWikiPOIsForHikerSection() {
        const seeds = overnightStops.filter((hub) =>
            wikiWindowHubs.includes(hub.name),
        );
        const batches = await Promise.allSettled(
            seeds.map((hub) =>
                fetchWikiPOIs(hub.coords[1], hub.coords[0], 8000),
            ),
        );

        batches.forEach((batch) => {
            if (batch.status !== "fulfilled") return;
            batch.value.forEach((poi) => {
                if (!allWikiPOIs.has(poi.pageid))
                    allWikiPOIs.set(poi.pageid, poi);
            });
        });

        refreshWikiMarkers();
    }

    async function updatePOIs() {
        if (!map) return;
        try {
            const center = map.getCenter();
            const pois = await fetchWikiPOIs(center.lat, center.lng, 3000);
            let added = false;
            pois.forEach((poi) => {
                if (!allWikiPOIs.has(poi.pageid)) {
                    allWikiPOIs.set(poi.pageid, poi);
                    added = true;
                }
            });
            if (added) refreshWikiMarkers();
        } catch {
            // Offline-first behavior: preserve already-rendered POIs and skip network-dependent refresh.
        }
    }

    // Expose API for parent
    export function flyToPOI(poi: any) {
        if (!map) return;
        const coords = poi.coords || [poi.lon, poi.lat];
        if (coords && coords[0] && coords[1]) {
            map.flyTo({
                center: coords as [number, number],
                zoom: 15,
                padding: isMobile
                    ? 40
                    : { top: 50, bottom: 50, left: 450, right: 50 },
                duration: 2000,
            });
        }
    }

    export function triggerLocateMe() {
        locateMe();
    }
</script>

<div
    class="w-full h-full bg-slate-50 relative zoom-state-z{Math.floor(
        zoomLevel,
    )}"
    bind:this={mapContainer}
>
    <div
        class="ds-panel absolute bottom-4 right-12 z-10 px-2 py-1 bg-white/90 backdrop-blur border border-slate-200 rounded-sm text-[9px] font-mono font-bold text-slate-500 shadow-sm pointer-events-none select-none tabular-nums"
    >
        {mouseCoords.lat.toFixed(5)}°N {Math.abs(mouseCoords.lng).toFixed(5)}°W
    </div>

    {#if hikerActive && driftMeters > 25}
        <div
            class="absolute top-4 left-1/2 -translate-x-1/2 z-40 rounded-full border border-rose-300/60 bg-rose-500/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xl"
        >
            ↖ Off Trail {Math.round(driftMeters)}m
        </div>
    {/if}

    {#if freezeMap}
        <div
            class="absolute inset-0 z-30 bg-black/10 backdrop-blur-[1px] pointer-events-auto"
        ></div>
    {/if}
</div>

<style>
    :global(.maplibregl-map) {
        height: 100%;
        width: 100%;
        font-family: inherit;
    }
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
    :global(.poi-marker.active-marker .poi-label) {
        opacity: 1 !important;
        display: block !important;
        z-index: 100;
    }

    @media (hover: hover) {
        :global(.poi-marker:hover .poi-label) {
            opacity: 1 !important;
            display: block !important;
            z-index: 100;
        }
    }

    /* Density Logic: Level 1 (Hubs) - Show at Z11+ */
    :global(.zoom-state-z11 .label-priority-1),
    :global(.zoom-state-z12 .label-priority-1),
    :global(.zoom-state-z13 .label-priority-1),
    :global(.zoom-state-z14 .label-priority-1),
    :global(.zoom-state-z15 .label-priority-1),
    :global(.zoom-state-z16 .label-priority-1),
    :global(.zoom-state-z17 .label-priority-1),
    :global(.zoom-state-z18 .label-priority-1) {
        opacity: 1;
    }

    /* Density Logic: Level 2 (Heritage) - Show at Z13+ */
    :global(.zoom-state-z13 .label-priority-2),
    :global(.zoom-state-z14 .label-priority-2),
    :global(.zoom-state-z15 .label-priority-2),
    :global(.zoom-state-z16 .label-priority-2),
    :global(.zoom-state-z17 .label-priority-2),
    :global(.zoom-state-z18 .label-priority-2) {
        opacity: 1;
    }

    /* Density Logic: Level 3 (Pubs) - Show at Z15+ */
    :global(.zoom-state-z15 .label-priority-3),
    :global(.zoom-state-z16 .label-priority-3),
    :global(.zoom-state-z17 .label-priority-3),
    :global(.zoom-state-z18 .label-priority-3) {
        opacity: 1;
    }

    /* Density Logic: Level 4 (Discovery) - Show at Z16+ */
    :global(.zoom-state-z16 .label-priority-4),
    :global(.zoom-state-z17 .label-priority-4),
    :global(.zoom-state-z18 .label-priority-4) {
        opacity: 1;
    }

    :global(.poi-marker.active-marker .marker-icon) {
        border-color: #3b82f6 !important;
        box-shadow:
            0 0 0 3px rgba(59, 130, 246, 0.4),
            0 0 15px rgba(59, 130, 246, 0.2);
        transform: scale(1.1);
    }

    :global(.map-pin-glyph) {
        display: block;
        font-size: inherit;
        line-height: 1;
        font-weight: 400;
        text-rendering: geometricPrecision;
    }

    :global(.hiker-floating-poi) {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        border: 1px solid rgba(250, 204, 21, 0.4);
        background: rgba(15, 23, 42, 0.88);
        color: #fef08a;
        padding: 0.3rem 0.5rem;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        box-shadow:
            0 10px 18px rgba(2, 6, 23, 0.35),
            0 0 12px rgba(250, 204, 21, 0.22);
        animation: poi-float 2.8s ease-in-out infinite;
    }

    :global(.hiker-floating-poi__icon) {
        font-size: 11px;
        line-height: 1;
    }

    :global(.hiker-floating-poi__label) {
        white-space: nowrap;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    @keyframes poi-float {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-4px);
        }
    }
</style>
