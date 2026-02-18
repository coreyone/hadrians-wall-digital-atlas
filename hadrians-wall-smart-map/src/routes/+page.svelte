<script lang="ts">
    import { onMount, tick } from 'svelte';
    import Map from '$lib/components/Map.svelte';
    import HikerHUD from '$lib/components/HikerHUD.svelte';
    import { hikerMode } from '$lib/stores/hikerMode';
    import type { PageData } from './$types';
    import { fetchPageSummary } from '$lib/services/wikipedia';
    import { itinerary, englishHeritageSites, hospitalitySites, overnightStops } from '$lib/data/trail';
    import { fade, fly, slide } from 'svelte/transition';
    import { compassService } from '$lib/services/compass';
    import { gamificationService } from '$lib/services/gamification';
    import { audioService } from '$lib/services/audio';
    import type { NavigationMetrics } from '$lib/services/navigation';
    import { runBlobMorph } from '$lib/utils/blobMorph';

    let { data }: { data: PageData } = $props();

    interface POI {
        title: string;
        summary?: string;
        pageid?: number;
        url?: string;
        lat?: number;
        lon?: number;
        type?: string;
        category?: string;
        special?: string;
        bourdainIntel?: string;
        fryeIntel?: string;
        rickStevesIntel?: string;
        photoIntel?: string;
        name?: string;
    }

    let isSidebarOpen = $state(true); 
    let selectedPOI = $state<POI | null>(null);
    let searchQuery = $state('');
    let isHeadingUp = $state(false);
    let mapComponent: any = $state();
    let isMobile = $state(false);
    let isOnline = $state(true);
    
    type AppMode = 'plan' | 'explore';
    let mode = $state<AppMode>('plan');
    let selectedStageId = $state<number | null>(null);
    let mapStyle = $state('topo');
    let selectedRoute = $state('osm');
    let showMilestones = $state(true);
    let expandedMilestoneStages = $state(new Set<number>());
    let hasRequestedCompassPermission = $state(false);
    let coinAnimating = $state(false);
    let coinMetallic = $state(false);
    let hikerIntelCard = $state<any | null>(null);
    let latestBadge = $state<{ name: string; description: string } | null>(null);
    let swipeStartY = $state(0);
    let swipeStartX = $state(0);
    let swipeTracking = $state(false);
    let drawerSwipeStartY = $state(0);
    let drawerSwipeStartX = $state(0);
    let mobileCoinButton = $state<HTMLButtonElement | null>(null);
    let hikerTopCoinRect = $state<DOMRect | null>(null);
    let coinMorphing = $state(false);
    let coinMorphBusy = $state(false);
    let showMobileSplash = $state(false);
    let splashMinElapsed = $state(false);
    let mapReady = $state(false);
    let compassHeading = $state(0);
    let compassNeedsCalibration = $state(false);
    let compassUnstableSinceTs = $state<number | null>(null);
    let compassStableSinceTs = $state<number | null>(null);
    let compassFallbackLatched = $state(false);
    let lastReliableCompassHeading = $state<number | null>(null);
    let lastReliableCompassHeadingTs = $state(0);
    let gpsHeading = $state<number | null>(null);
    let latestGpsSpeedMph = $state(0);
    let showCompassFallbackNotice = $state(false);
    let dismissedCompassFallbackNotice = $state(false);
    let lastAppliedHeading = $state<number | null>(null);
    let lastAppliedCalibration = $state<boolean | null>(null);
    let discoveredPOIs = $derived(data.initialPOIs ?? []);
    const GPS_COURSE_SPEED_THRESHOLD_MPH = 1.5;
    const GPS_COURSE_RECOVERY_SPEED_THRESHOLD_MPH = 1.1;
    const COMPASS_FALLBACK_ENTER_MS = 2200;
    const COMPASS_FALLBACK_EXIT_MS = 1400;
    const COMPASS_HEADING_HOLD_MS = 8000;
    const COMPASS_NOTICE_DELAY_MS = 3200;
    const MOBILE_SPLASH_SHOW_DELAY_MS = 120;
    const MOBILE_SPLASH_MIN_VISIBLE_MS = 320;
    const MOBILE_SPLASH_HARD_TIMEOUT_MS = 1700;

    let filteredDiscovery = $derived.by(() => {
        const query = searchQuery.trim().toLowerCase();
        return discoveredPOIs
            .filter((poi) => !query || poi.title.toLowerCase().includes(query))
            .sort((a, b) => b.rank - a.rank);
    });

    function normalizeHeading(value: number | null | undefined): number | null {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
        return ((value % 360) + 360) % 360;
    }

    function headingDelta(a: number, b: number) {
        return Math.abs((((a - b) % 360) + 540) % 360 - 180);
    }

    function readSafeAreaTopInsetPx() {
        if (typeof document === 'undefined') return 0;
        const probe = document.createElement('div');
        probe.style.cssText =
            'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);visibility:hidden;pointer-events:none;';
        document.body.appendChild(probe);
        const inset = Number.parseFloat(getComputedStyle(probe).paddingTop) || 0;
        probe.remove();
        return inset;
    }

    function fallbackHikerCoinRect() {
        const safeTop = readSafeAreaTopInsetPx();
        const size = 48;
        const centerX = window.innerWidth / 2;
        const centerY = safeTop + 12 + 36;
        return new DOMRect(centerX - size / 2, centerY - size / 2, size, size);
    }

    async function runCoinMorph(direction: 'expand' | 'collapse') {
        if (!isMobile || !mobileCoinButton || typeof window === 'undefined') return;

        coinMorphing = true;
        try {
            await tick();
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

            const hikerRect = hikerTopCoinRect ?? fallbackHikerCoinRect();
            const mobileRect = mobileCoinButton.getBoundingClientRect();
            const mobileCenterX = mobileRect.left + mobileRect.width / 2;
            const mobileCenterY = mobileRect.top + mobileRect.height / 2;
            const mobileRestSize = 36;
            const mobileRestRect = new DOMRect(
                mobileCenterX - mobileRestSize / 2,
                mobileCenterY - mobileRestSize / 2,
                mobileRestSize,
                mobileRestSize
            );
            const from = direction === 'expand' ? mobileCoinButton : hikerRect;
            const to = direction === 'expand' ? hikerRect : mobileRestRect;
            await runBlobMorph({
                from,
                to,
                direction,
                durationMs: 620,
                bounce: 0.42,
                zIndex: 116,
                contentSource: mobileCoinButton
            });
        } finally {
            coinMorphing = false;
        }
    }

    onMount(() => {
        const handleOnline = () => (isOnline = true);
        const handleOffline = () => (isOnline = false);
        isOnline = navigator.onLine;
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const mql = window.matchMedia('(max-width: 768px)');
        isMobile = mql.matches;
        const handleMedia = (e: MediaQueryListEvent) => (isMobile = e.matches);
        mql.addEventListener('change', handleMedia);

        let splashShowTimer: ReturnType<typeof setTimeout> | null = null;
        let splashMinTimer: ReturnType<typeof setTimeout> | null = null;
        let splashHardTimer: ReturnType<typeof setTimeout> | null = null;
        if (isMobile && !mapReady) {
            showMobileSplash = false;
            splashMinElapsed = false;
            splashShowTimer = setTimeout(() => {
                if (mapReady) return;
                showMobileSplash = true;
                splashMinTimer = setTimeout(() => {
                    splashMinElapsed = true;
                    if (mapReady) {
                        showMobileSplash = false;
                    }
                }, MOBILE_SPLASH_MIN_VISIBLE_MS);
            }, MOBILE_SPLASH_SHOW_DELAY_MS);
            splashHardTimer = setTimeout(() => {
                splashMinElapsed = true;
                if (showMobileSplash) {
                    showMobileSplash = false;
                }
            }, MOBILE_SPLASH_HARD_TIMEOUT_MS);
        }

        const unsubscribeCompass = compassService.subscribe((state) => {
            compassHeading = state.heading;
            compassNeedsCalibration = state.needsCalibration;
            if (!state.needsCalibration && Number.isFinite(state.heading)) {
                lastReliableCompassHeading = state.heading;
                lastReliableCompassHeadingTs = Date.now();
            }
        });

        let batteryRef: any = null;
        let batteryHandler: (() => void) | null = null;
        if ('getBattery' in navigator) {
            (navigator as Navigator & { getBattery: () => Promise<any> })
                .getBattery()
                .then((battery) => {
                    batteryRef = battery;
                    batteryHandler = () => {
                        const low = battery.level <= 0.25 && !battery.charging;
                        hikerMode.setLowBattery(low);
                    };
                    batteryHandler();
                    battery.addEventListener('levelchange', batteryHandler);
                    battery.addEventListener('chargingchange', batteryHandler);
                })
                .catch(() => {
                    hikerMode.setLowBattery(false);
                });
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            mql.removeEventListener('change', handleMedia);
            if (splashShowTimer) clearTimeout(splashShowTimer);
            if (splashMinTimer) clearTimeout(splashMinTimer);
            if (splashHardTimer) clearTimeout(splashHardTimer);
            if (batteryRef && batteryHandler) {
                batteryRef.removeEventListener('levelchange', batteryHandler);
                batteryRef.removeEventListener('chargingchange', batteryHandler);
            }
            unsubscribeCompass();
            compassService.stop();
            audioService.stop();
        };
    });

    // Explore IA: Section Management
    let expandedSections = $state({
        heritage: true,
        hospitality: true,
        discovery: true
    });

    // Explore IA: Category Toggles
    let activeCategories = $state({
        heritage: true,
        pubs: true,
        discovery: true
    });

    let searchInput = $state<HTMLInputElement>();

    async function handlePOIClick(poi: any) {
        mode = 'explore';
        isSidebarOpen = true;
        selectedPOI = { ...poi };
        
        if (selectedPOI && !selectedPOI.summary && selectedPOI.pageid) {
            const summary = await fetchPageSummary(selectedPOI.pageid);
            if (selectedPOI) {
                selectedPOI.summary = summary;
                selectedPOI = { ...selectedPOI };
            }
        }
    }

    function toggleSearch() {
        mode = 'explore';
        isSidebarOpen = true;
        selectedPOI = null;
        // Focus input on next tick
        setTimeout(() => searchInput?.focus(), 50);
    }

    function toggleStage(id: number) {
        selectedStageId = selectedStageId === id ? null : id;
    }

    function toggleMilestones(id: number) {
        if (expandedMilestoneStages.has(id)) {
            expandedMilestoneStages.delete(id);
        } else {
            expandedMilestoneStages.add(id);
        }
        expandedMilestoneStages = new Set(expandedMilestoneStages);
    }

    function flyToMilestone(stage: any, milestone: any) {
        const center = overnightStops.find(h => h.name.includes(stage.from.split(' ')[0]))?.coords;
        if (center && mapComponent) {
            mapComponent.flyToPOI({ coords: center });
        }
    }

    function generateSparkline(gain: number, loss: number) {
        const h = 20; const w = 60; const total = gain + loss;
        const ratio = gain / (total || 1); const mid = w * ratio;
        return `M 0 ${h} L ${mid} 0 L ${w} ${h}`;
    }

    // Phosphor Icons (Raw SVGs)
    const icons = {
        clock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v40h48A8,8,0,0,1,192,128Z"></path></svg>`,
        map: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M228.92,49.69a8,8,0,0,0-6.86-1.45L160.93,63.41,95.07,35.13a8,8,0,0,0-6.14,0L27.08,60.19A8,8,0,0,0,22,67.53V208a8,8,0,0,0,9.14,7.86l61.13-15.14,65.86,28.28a8,8,0,0,0,6.14,0l61.85-25.06A8,8,0,0,0,234,188.47V48A8,8,0,0,0,228.92,49.69ZM160,195.12l-64-27.43V60.88l64,27.43ZM38,196.29V75.47L80,59.13v108ZM218,180.53l-42,17.03V89.13l42-16.33Z"></path></svg>`,
        compass: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM172.42,72.82l-32.55,81.38a8,8,0,0,1-4.47,4.47l-81.38,32.55a8,8,0,0,1-10.37-10.37l32.55-81.38a8,8,0,0,1,4.47-4.47L162.05,62.45a8,8,0,0,1,10.37,10.37ZM128,112a16,16,0,1,0,16,16A16,16,0,0,0,128,112Z"></path></svg>`,
        list: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path></svg>`,
        mountain: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M252.92,210.14l-96-160a16,16,0,0,0-27.43,0l-25.15,41.91L78.29,50.14a16,16,0,0,0-27.43,0l-48,80a16,16,0,0,0,0,16.53l48,80A16,16,0,0,0,64.57,232h184a8,8,0,0,0,6.85-12.14ZM64.57,216,24,142.67,64.57,75.33,105.14,142.67Zm177.14,0H121.71l21.43-35.71,25.14,41.9a8,8,0,0,0,13.72-8.24l-31.15-51.91L192,92.67,241.71,175.33Z"></path></svg>`,
        shopping: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M239.38,90.47A15.94,15.94,0,0,0,224,80H64V56A16,16,0,0,0,48,40H24a8,8,0,0,0,0,16H48V192a16,16,0,0,0,16,16H192a8,8,0,0,0,0-16H64V96H224l-18.4,82.82A16,16,0,0,1,190,192H96a8,8,0,0,0,0,16h94a32,32,0,0,0,31.27-25.05L240,99.76A15.86,15.94,0,0,0,239.38,90.47ZM100,216a20,20,0,1,0,20,20A20,20,0,0,0,100,216Zm100,0a20,20,0,1,0,20,20A20,20,0,0,0,200,216Z"></path></svg>`,
        arrowLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`,
        landmark: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M240,208H224V101.33l10.67,5.34a8,8,0,0,0,7.15-14.34l-104-52a8,8,0,0,0-7.15,0l-104,52a8,8,0,0,0,7.15,14.34L48,101.33V208H32a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM64,109.33l64-32,64,32V208H64Z"></path></svg>`,
        beer: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M232,64H208V56a16,16,0,0,0-16-16H40A16,16,0,0,0,24,56V208a32,32,0,0,0,32,32H160a32,32,0,0,0,32-32V184h8a32,32,0,0,0,32-32V96A32,32,0,0,0,232,64Zm-56,144a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56H176Zm40-56a16,16,0,0,1-16,16H192V80h16a16,16,0,0,1,16,16ZM64,88a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H72A8,8,0,0,1,64,88Zm0,32a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H72A8,8,0,0,1,64,120Zm0,32a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H72A8,8,0,0,1,64,152Z"></path></svg>`,
        search: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path></svg>`,
        caret: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L100,192.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"></path></svg>`,
        discovery: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Zm-32,0a56,56,0,1,1-56-56A56.06,56.06,0,0,1,184,128Zm-16,0a40,40,0,1,0-40,40A40,40,0,0,0,168,128Z"></path></svg>`,
        star: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M234.29,114.85l-45,38.83L203,207.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,225.57A16.4,16.4,0,0,1,53,207.75l13.76-54.07-45-38.83A16.46,16.46,0,0,1,31.08,86l57.51-8.45,25.76-55.68a16.36,16.36,0,0,1,29.27,0l25.76,55.68,57.51,8.45A16.46,16.46,0,0,1,234.29,114.85Z"></path></svg>`,
        sun: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16a8,8,0,0,0-11.32,11.32Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM197.66,186.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM240,120H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16ZM40,120H16a8,8,0,0,0,0,16H40a8,8,0,0,0,0-16Zm157.66-61.66a8,8,0,0,0-11.32-11.32l-16,16a8,8,0,0,0,11.32,11.32Zm-77.66,161.66V240a8,8,0,0,0,16,0V220a8,8,0,0,0-16,0Z"></path></svg>`,
        footprints: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M100,140a36,36,0,0,0-36,36v20a12,12,0,0,0,12,12h48a12,12,0,0,0,12-12V176A36,36,0,0,0,100,140Zm20,56a4,4,0,0,1-4,4H80a4,4,0,0,1-4-4V176a20,20,0,0,1,40,0ZM188,140a36,36,0,0,0-36,36v20a12,12,0,0,0,12,12h48a12,12,0,0,0,12-12V176A36,36,0,0,0,188,140Zm20,56a4,4,0,0,1-4,4H168a4,4,0,0,1-4-4V176a20,20,0,0,1,40,0Z"></path></svg>`,
        arrowRight: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L204.69,128,138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66ZM120,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16h72A8,8,0,0,1,120,128Z"></path></svg>`,
        camera: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M208,56H168V48a16,16,0,0,0-16-16H104A16,16,0,0,0,88,48v8H48A32,32,0,0,0,16,88V192a32,32,0,0,0,32,32H208a32,32,0,0,0,32-32V88A32,32,0,0,0,208,56Zm-80,128a40,40,0,1,1,40-40A40,40,0,0,1,128,184ZM104,48h48v8H104Zm104,160H48a16,16,0,0,1-16-16V88a16,16,0,0,1,16-16H208a16,16,0,0,1,16,16v88A16,16,0,0,1,208,208Z"></path></svg>`,
        locate: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM128,64a64,64,0,1,0,64,64A64.07,64.1,0,0,0,128,64Zm0,112a48,48,0,1,1,48-48A48.05,48.05,0,0,1,128,176Zm0-64a16,16,0,1,0,16,16A16,16,0,0,0,128,112Z"></path></svg>`,
        close: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>`
    };

    let lastTap = 0;
    let tapCount = 0;

    async function activateHikerMode() {
        if (coinMorphBusy) return;
        coinMorphBusy = true;
        try {
            hikerMode.activate();
            coinMetallic = true;
            coinAnimating = true;
            if (navigator.vibrate) navigator.vibrate(300);

            if (isMobile) {
                await runCoinMorph('expand');
            }

            if (!hasRequestedCompassPermission) {
                hasRequestedCompassPermission = true;
                await compassService.requestPermission();
            }
            await compassService.start();
            await audioService.resume();
            audioService.setEnabled(true);
            mapComponent?.triggerLocateMe();
            isHeadingUp = !$hikerMode.simplifiedHUD;
            setTimeout(() => (coinAnimating = false), 720);
        } finally {
            coinMorphBusy = false;
        }
    }

    function deactivateHikerMode() {
        hikerMode.deactivate();
        compassService.stop();
        audioService.setEnabled(false);
        audioService.stop();
        isHeadingUp = false;
        hikerIntelCard = null;
        swipeTracking = false;
        coinAnimating = false;
        coinMetallic = false;
        coinMorphing = false;
        coinMorphBusy = false;
        showCompassFallbackNotice = false;
        dismissedCompassFallbackNotice = false;
        compassUnstableSinceTs = null;
        compassStableSinceTs = null;
        compassFallbackLatched = false;
        lastReliableCompassHeading = null;
        lastReliableCompassHeadingTs = 0;
        lastAppliedHeading = null;
        lastAppliedCalibration = null;
        gpsHeading = null;
        latestGpsSpeedMph = 0;
    }

    async function deactivateHikerModeWithMorph() {
        if (coinMorphBusy) return;
        coinMorphBusy = true;
        try {
            if (isMobile) {
                await runCoinMorph('collapse');
            }
        } finally {
            deactivateHikerMode();
        }
    }

    async function handleCoinTap() {
        const now = Date.now();
        if (now - lastTap < 400) {
            tapCount++;
        } else {
            tapCount = 1;
        }
        lastTap = now;

        if (tapCount === 3) {
            tapCount = 0;
            if ($hikerMode.isActive) {
                await deactivateHikerModeWithMorph();
            } else {
                await activateHikerMode();
            }
        }
    }

    function handleNavigationUpdate(metrics: NavigationMetrics) {
        gpsHeading = normalizeHeading(metrics.gpsHeading);
        latestGpsSpeedMph =
            typeof metrics.gpsSpeedMph === 'number' && Number.isFinite(metrics.gpsSpeedMph)
                ? Math.max(0, metrics.gpsSpeedMph)
                : Math.max(0, metrics.speedMph);

        const game = gamificationService.update(
            metrics.snappedCoord,
            metrics.distanceWalkedMiles,
            metrics.totalMiles
        );

        const hour = new Date().getHours();
        hikerMode.updateMetrics({
            distanceToday: metrics.dailyProgressMiles,
            distanceWalkedMiles: metrics.distanceWalkedMiles,
            totalMiles: metrics.totalMiles,
            totalMilesRemaining: metrics.totalMilesRemaining,
            dailyGoalMiles: metrics.dailyGoalMiles,
            dailyRemainingMiles: metrics.dailyRemainingMiles,
            requiredSpeedMphToDailyGoal: metrics.requiredSpeedMphToDailyGoal,
            requiredPaceMinPerMileToDailyGoal: metrics.requiredPaceMinPerMileToDailyGoal,
            dailyGoalDeadlinePassed: metrics.dailyGoalDeadlinePassed,
            fullTripGoalMiles: metrics.planTotalMiles,
            fullTripProgressMiles: metrics.planProgressMiles,
            fullTripRemainingMiles: metrics.planRemainingMiles,
            speedMph: metrics.speedMph,
            eta: metrics.dailyEta,
            elevationGain: metrics.elevationGain,
            elevationLoss: metrics.elevationLoss,
            weatherTempF: metrics.weather.tempF,
            weatherCondition: metrics.weather.condition,
            driftMeters: metrics.driftMeters,
            isOffTrail: metrics.driftMeters > 25,
            integrity: game.integrity,
            badges: game.badges,
            isDaytime: hour >= 7 && hour < 18
        });

        audioService.updateSpeed(metrics.speedMph);

        if (game.newlyUnlocked.length > 0) {
            const badge = game.newlyUnlocked[game.newlyUnlocked.length - 1];
            latestBadge = { name: badge.name, description: badge.description };
            setTimeout(() => {
                latestBadge = null;
            }, 3500);
        }
    }

    function handleMapReady() {
        mapReady = true;
        if (isMobile && splashMinElapsed) {
            showMobileSplash = false;
        }
    }

    function handleHikerTopCoinLayout(rect: DOMRect) {
        hikerTopCoinRect = new DOMRect(rect.x, rect.y, rect.width, rect.height);
    }

    function handleHikerPoiSelect(poi: any) {
        hikerIntelCard = poi;
    }

    function closeIntelCard() {
        hikerIntelCard = null;
    }

    function handleHikerTouchStart(event: TouchEvent) {
        if (!$hikerMode.isActive) return;
        swipeTracking = true;
        swipeStartY = event.changedTouches[0]?.clientY ?? 0;
        swipeStartX = event.changedTouches[0]?.clientX ?? 0;
    }

    function handleHikerTouchEnd(event: TouchEvent) {
        if (!$hikerMode.isActive || !swipeTracking) return;
        swipeTracking = false;
        const endY = event.changedTouches[0]?.clientY ?? 0;
        const endX = event.changedTouches[0]?.clientX ?? 0;
        const deltaY = endY - swipeStartY;
        const deltaX = Math.abs(endX - swipeStartX);
        if (deltaY > 95 && deltaX < 80) {
            deactivateHikerMode();
        }
    }

    function toggleSimplifiedHUD() {
        hikerMode.toggleSimplified();
    }

    function handleDrawerHandleTouchStart(event: TouchEvent) {
        if (!isMobile || !isSidebarOpen) return;
        drawerSwipeStartY = event.changedTouches[0]?.clientY ?? 0;
        drawerSwipeStartX = event.changedTouches[0]?.clientX ?? 0;
    }

    function handleDrawerHandleTouchEnd(event: TouchEvent) {
        if (!isMobile || !isSidebarOpen) return;
        const endY = event.changedTouches[0]?.clientY ?? 0;
        const endX = event.changedTouches[0]?.clientX ?? 0;
        const deltaY = endY - drawerSwipeStartY;
        const deltaX = Math.abs(endX - drawerSwipeStartX);
        if (deltaY > 40 && deltaX < 90) {
            isSidebarOpen = false;
        }
    }

    $effect(() => {
        if (!$hikerMode.isActive) {
            showCompassFallbackNotice = false;
            dismissedCompassFallbackNotice = false;
            compassUnstableSinceTs = null;
            compassStableSinceTs = null;
            compassFallbackLatched = false;
            lastReliableCompassHeading = null;
            lastReliableCompassHeadingTs = 0;
            lastAppliedHeading = null;
            lastAppliedCalibration = null;
            return;
        }

        const now = Date.now();
        const isMovingFastForGps = latestGpsSpeedMph >= GPS_COURSE_SPEED_THRESHOLD_MPH;
        const isMovingEnoughForGpsRecovery = latestGpsSpeedMph >= GPS_COURSE_RECOVERY_SPEED_THRESHOLD_MPH;
        const hasGpsHeading = gpsHeading !== null;

        if (compassNeedsCalibration) {
            compassStableSinceTs = null;
            compassUnstableSinceTs ??= now;
            if (!compassFallbackLatched && now - compassUnstableSinceTs >= COMPASS_FALLBACK_ENTER_MS) {
                compassFallbackLatched = true;
            }
        } else {
            compassUnstableSinceTs = null;
            compassStableSinceTs ??= now;
            if (compassFallbackLatched && now - compassStableSinceTs >= COMPASS_FALLBACK_EXIT_MS) {
                compassFallbackLatched = false;
            }
        }

        const canHoldHeading =
            lastReliableCompassHeading !== null &&
            now - lastReliableCompassHeadingTs <= COMPASS_HEADING_HOLD_MS;
        const compassHeldHeading = canHoldHeading
            ? (lastReliableCompassHeading as number)
            : compassHeading;
        const shouldPreferGps =
            (isMovingFastForGps && hasGpsHeading) ||
            (compassFallbackLatched && isMovingEnoughForGpsRecovery && hasGpsHeading);
        const resolvedHeading = shouldPreferGps ? (gpsHeading as number) : compassHeldHeading;
        const shouldFallbackNorthUp = compassFallbackLatched && !isMovingEnoughForGpsRecovery;

        if (
            lastAppliedHeading === null ||
            headingDelta(resolvedHeading, lastAppliedHeading) >= 0.6 ||
            lastAppliedCalibration !== compassFallbackLatched
        ) {
            hikerMode.updateMetrics({
                heading: resolvedHeading,
                isCalibrating: compassFallbackLatched
            });
            lastAppliedHeading = resolvedHeading;
            lastAppliedCalibration = compassFallbackLatched;
        }

        if ($hikerMode.simplifiedHUD) {
            isHeadingUp = false;
            showCompassFallbackNotice = false;
            return;
        }

        if (shouldFallbackNorthUp) {
            if (isHeadingUp) {
                isHeadingUp = false;
            }
            const unstableLongEnough =
                compassUnstableSinceTs !== null &&
                now - compassUnstableSinceTs >= COMPASS_NOTICE_DELAY_MS;
            if (!dismissedCompassFallbackNotice && unstableLongEnough) {
                showCompassFallbackNotice = true;
            }
            return;
        }

        showCompassFallbackNotice = false;
        if (!compassFallbackLatched) {
            dismissedCompassFallbackNotice = false;
        }
        if (!isHeadingUp) {
            isHeadingUp = true;
        }
    });
</script>

<svelte:head>
    <title>Hadrian Atlas</title>
</svelte:head>

<svelte:window ontouchstart={handleHikerTouchStart} ontouchend={handleHikerTouchEnd} />

<!-- Hiker HUD Overlay -->
{#if $hikerMode.isActive}
    <HikerHUD
        onToggleSimplified={toggleSimplifiedHUD}
        onCoinTap={handleCoinTap}
        hideTopCoin={coinMorphing}
        onTopCoinLayout={handleHikerTopCoinLayout}
    />
{/if}

{#if showCompassFallbackNotice && $hikerMode.isActive}
    <div class="fixed top-24 left-1/2 z-[70] flex w-[min(92vw,26rem)] -translate-x-1/2 items-center justify-between gap-2 rounded-xl border border-amber-300/35 bg-amber-500/90 px-3 py-2 text-slate-950 shadow-2xl">
        <p class="text-[10px] font-black uppercase tracking-[0.12em]">Compass unstable; using North-Up for now.</p>
        <button
            type="button"
            class="shrink-0 rounded-md border border-slate-900/25 bg-slate-950/15 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] hover:bg-slate-950/25"
            onclick={() => {
                showCompassFallbackNotice = false;
                dismissedCompassFallbackNotice = true;
            }}
        >
            Skip
        </button>
    </div>
{/if}

{#if latestBadge}
    <div class="fixed top-36 right-4 z-[70] max-w-[280px] rounded-xl border border-emerald-300/30 bg-emerald-500/90 px-3 py-2 text-slate-950 shadow-2xl">
        <p class="text-[9px] font-black uppercase tracking-[0.2em]">Badge Unlocked</p>
        <p class="text-sm font-black">{latestBadge.name}</p>
        <p class="text-[11px] font-semibold">{latestBadge.description}</p>
    </div>
{/if}

{#if showMobileSplash}
    <div class="fixed inset-0 z-[120] md:hidden overflow-hidden splash-screen" role="status" aria-live="polite" aria-label="Loading Hadrian Atlas">
        <img src="/loading-screen-hadrians-wall-path-map.png" alt="" class="absolute inset-0 h-full w-full object-cover splash-image" />
        <div class="absolute inset-0 bg-gradient-to-b from-slate-950/25 via-slate-900/40 to-slate-950/90"></div>
        <div class="absolute inset-x-0 px-6" style="bottom: calc(env(safe-area-inset-bottom, 0px) + 1.75rem);">
            <p class="text-[11px] font-black uppercase tracking-[0.22em] text-amber-100/95 drop-shadow-sm splash-headline">Hadrian Atlas</p>
            <p class="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-200/90 splash-subline">Loading trail intelligence…</p>
            <div class="mt-3 h-1.5 overflow-hidden rounded-full border border-white/20 bg-slate-950/55">
                <span class="block h-full rounded-full bg-gradient-to-r from-blue-400 via-cyan-300 to-amber-300 splash-progress"></span>
            </div>
        </div>
    </div>
{/if}

<div class="flex h-screen w-full overflow-hidden bg-canvas text-slate-300 font-sans antialiased text-[13px] selection:bg-blue-500/30 relative">
    <!-- Sticky Header (Mobile) -->
    {#if isMobile}
        <header class="fixed top-0 inset-x-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-white/5 safe-p-top transition-transform duration-300 {!isSidebarOpen ? 'translate-y-0' : '-translate-y-full'}" style="-webkit-backdrop-filter: blur(20px);">
            <div class="flex items-center justify-between h-14 px-4">
                <div class="flex flex-col">
                    <h1 class="text-white font-black uppercase text-[10px] tracking-[0.2em]">Hadrian Atlas</h1>
                </div>
                <div class="flex items-center gap-2">
                    <button
                        bind:this={mobileCoinButton}
                        onclick={handleCoinTap}
                        class="flex items-center justify-center rounded-full border transition-all duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] {$hikerMode.isActive ? 'h-[3.375rem] w-[3.375rem]' : 'h-9 w-9'} {coinMetallic || $hikerMode.isActive ? 'border-amber-200/70 bg-gradient-to-br from-amber-100 via-yellow-200 to-amber-500 shadow-[0_0_18px_rgba(251,191,36,0.45)]' : 'border-blue-300/55 bg-transparent shadow-[0_0_12px_rgba(59,130,246,0.35)]'} {coinAnimating ? 'scale-110 rotate-[360deg]' : ''} {coinMorphing || $hikerMode.isActive ? 'pointer-events-none opacity-0 scale-75' : 'opacity-100 scale-100'}"
                        aria-label="Triple tap Roman Coin to toggle Hiker Mode"
                        title="Triple Tap Roman Coin"
                    >
                        <img src="/logo-coin.png" alt="Roman Coin Toggle" class="object-contain drop-shadow-sm {$hikerMode.isActive ? 'h-9 w-9' : 'h-6 w-6'}" />
                    </button>
                    <div class="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/5">
                        <div class="w-1.5 h-1.5 rounded-full {isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'} animate-pulse"></div>
                        <span class="text-[8px] font-black uppercase tracking-widest {isOnline ? 'text-emerald-500' : 'text-orange-500'}">{isOnline ? 'Live' : 'Offline'}</span>
                    </div>
                </div>
            </div>
        </header>
    {/if}

    <!-- Mobile Backdrop: Closes sidebar when map strip is tapped -->
    {#if isMobile && isSidebarOpen}
        <button 
            onclick={() => isSidebarOpen = false} 
            class="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            style="-webkit-backdrop-filter: blur(8px);"
            aria-label="Return to Map"
        ></button>
    {/if}

    <aside class="{isSidebarOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:-translate-x-full'} fixed inset-x-0 bottom-0 md:inset-y-0 md:left-0 z-40 h-[85vh] md:h-full md:w-[320px] bg-surface/95 backdrop-blur-2xl border-t md:border-t-0 md:border-r border-white/10 transition-transform duration-500 md:duration-300 md:relative flex flex-col shadow-2xl rounded-t-2xl md:rounded-none overflow-hidden" style="-webkit-backdrop-filter: blur(40px);">
        <!-- Drawer Handle for Mobile -->
        {#if isMobile}
            <button
                type="button"
                class="w-full flex justify-center py-2 shrink-0"
                onclick={() => isSidebarOpen = false}
                ontouchstart={handleDrawerHandleTouchStart}
                ontouchend={handleDrawerHandleTouchEnd}
                aria-label="Close panel"
                title="Swipe down or tap to close"
            >
                <div class="w-12 h-1 bg-white/20 rounded-full"></div>
            </button>
        {/if}
        
        <header class="p-4 border-b border-white/5 flex flex-col gap-4">
            <div class="flex items-center justify-between">
                <div class="flex flex-col">
                    <h1 class="text-white font-black uppercase text-[11px] tracking-[0.2em]">Hadrian Atlas</h1>
                    <span class="text-[9px] text-slate-500 font-bold uppercase tracking-widest">v4.2 Tactical Instrument</span>
                </div>
                <div class="flex items-center gap-3">
                    {#if isMobile}
                        <button onclick={() => isSidebarOpen = false} class="p-2 text-slate-500 hover:text-white transition-colors">{@html icons.close}</button>
                    {/if}
                                    <div class="flex gap-1.5 items-center">
                                        <div class="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/5">
                                            <div class="w-1.5 h-1.5 rounded-full {isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'} animate-pulse"></div>
                                            <span class="text-[8px] font-black uppercase tracking-widest {isOnline ? 'text-emerald-500' : 'text-orange-500'}">{isOnline ? 'Live' : 'Offline'}</span>
                                        </div>
                                        <div class="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                                    </div>
                    
                </div>
            </div>

            <div class="flex p-0.5 bg-inset rounded-lg border border-white/5">
                <button onclick={() => { mode = 'plan'; selectedPOI = null; }} class="flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all active:scale-95 {mode === 'plan' ? 'bg-white/10 shadow-sm text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}">Plan</button>
                <button onclick={() => mode = 'explore'} class="flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all active:scale-95 {mode === 'explore' ? 'bg-white/10 shadow-sm text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}">Explore</button>
            </div>
        </header>

        <div class="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth custom-scrollbar pb-32">
            {#if mode === 'plan'}
                <div class="p-4 space-y-4" in:fade>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between px-3 bg-inset py-2.5 rounded-lg border border-white/5 text-[10px] font-bold tabular-nums">
                            <span class="flex items-center gap-2 text-slate-500 uppercase tracking-tighter">{@html icons.sun} 06:14 / 20:08</span>
                            <span class="text-blue-400 uppercase tracking-widest">54°F · Mostly Clear</span>
                        </div>

                        <div class="grid grid-cols-3 gap-1 bg-inset p-3 rounded-lg border border-white/5 text-white shadow-inner">
                            <div class="text-center"><span class="block text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Distance</span><span class="font-bold text-xs tracking-tighter tabular-nums">46.0 MI</span></div>
                            <div class="text-center border-x border-white/5"><span class="block text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Gain</span><span class="font-bold text-xs tracking-tighter tabular-nums">+3,508 FT</span></div>
                            <div class="text-center"><span class="block text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Avg Pace</span><span class="font-bold text-xs tracking-tighter tabular-nums">2.8 MPH</span></div>
                        </div>
                    </div>

                    <div class="space-y-1.5">
                        {#each itinerary as stage, i}
                            <div in:fade={{ delay: i * 50 }}>
                                <div 
                                    role="button" 
                                    tabindex="0" 
                                    onclick={() => toggleStage(stage.id)} 
                                    onkeydown={(e) => e.key === 'Enter' && toggleStage(stage.id)}
                                    class="w-full text-left p-3 rounded-lg border transition-all active:scale-[0.98] {selectedStageId === stage.id ? 'bg-white/5 border-blue-500/30 shadow-glow' : 'bg-transparent border-transparent hover:bg-white/5'}"
                                >
                                    <div class="flex justify-between items-start mb-1.5 pointer-events-none">
                                        <div class="flex flex-col">
                                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{stage.romanDate}</span>
                                            <h3 class="text-[13px] font-bold text-white tracking-tight leading-tight">{stage.from} → {stage.to}</h3>
                                        </div>
                                        <div class="text-lg filter grayscale opacity-50">{stage.mithraicSymbol}</div>
                                    </div>
                                    <div class="flex gap-3 text-[10px] text-slate-400 uppercase tracking-tighter font-bold tabular-nums pointer-events-none">
                                        <span class="flex items-center gap-1">{@html icons.clock} {stage.timeHours[0]}-{stage.timeHours[1]}h</span>
                                        <span class="flex items-center gap-1">{@html icons.mountain} +{stage.elevationGainFt}ft</span>
                                        <span class="flex items-center gap-1 text-blue-400">{@html icons.footprints} {stage.distanceMi} mi</span>
                                    </div>
                                    
                                    {#if selectedStageId === stage.id}
                                        <div 
                                            class="mt-4 pt-4 border-t border-white/5 space-y-4" 
                                            transition:slide 
                                            role="presentation"
                                            onclick={(e) => e.stopPropagation()}
                                            onkeydown={(e) => e.key === 'Enter' && e.stopPropagation()}
                                        >
                                            <div class="grid grid-cols-2 gap-2">
                                                <div class="bg-inset p-2.5 rounded-md border border-white/5"><span class="block text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Surface</span><span class="text-[11px] font-bold text-slate-300 truncate block">{stage.surface}</span></div>
                                                <div class="bg-inset p-2.5 rounded-md border border-white/5"><span class="block text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Logistics</span><span class="text-[11px] font-bold {stage.supplyStatus === 'Critical' ? 'text-orange-400' : 'text-slate-300'}">{stage.supplyStatus}</span></div>
                                            </div>
                                            
                                            <div class="bg-inset p-3 rounded-md border border-white/5 space-y-3">
                                                <button onclick={(e) => { e.stopPropagation(); toggleMilestones(stage.id); }} class="w-full flex items-center justify-between group">
                                                    <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 group-hover:text-blue-400 transition-colors">Trail Milestones</span>
                                                    <div class="text-slate-600 transition-transform {expandedMilestoneStages.has(stage.id) ? '' : '-rotate-90'}">{@html icons.caret}</div>
                                                </button>
                                                
                                                {#if expandedMilestoneStages.has(stage.id)}
                                                    <div class="space-y-3" transition:slide>
                                                        {#each stage.milestones as ms}
                                                            <div class="flex items-start gap-3 border-l border-white/10 pl-3 relative group/ms">
                                                                <div class="absolute -left-[3px] top-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                                                                <div class="flex-1 min-w-0">
                                                                    <div class="flex justify-between items-center gap-2 mb-1">
                                                                        <span class="text-[11px] font-black uppercase tracking-tighter truncate text-slate-200">{ms.name}</span>
                                                                        <div class="flex items-center gap-2">
                                                                            <span class="text-[10px] font-mono text-blue-400 tabular-nums">{new Date(new Date("2026-04-12T09:00:00").getTime() + (ms.mi / 2.8) * 3600000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                                            <button onclick={(e) => { e.stopPropagation(); flyToMilestone(stage, ms); }} class="p-1 hover:bg-white/10 rounded transition-colors opacity-0 group-hover/ms:opacity-100">{@html icons.arrowRight}</button>
                                                                        </div>
                                                                    </div>
                                                                    <p class="text-[11px] text-slate-500 leading-snug italic">"{ms.intel}"</p>
                                                                </div>
                                                            </div>
                                                        {/each}
                                                    </div>
                                                {/if}
                                            </div>

                                            <div class="bg-white/5 p-3 rounded-md border border-white/5">
                                                <span class="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Fueling Strategy</span>
                                                <ul class="space-y-1.5">
                                                    {#each stage.fuelingLogistics as item}
                                                        <li class="flex items-start gap-2 text-[11px] text-slate-400 leading-snug">
                                                            <div class="mt-1.5 w-1 h-1 rounded-full bg-slate-600 shrink-0"></div>
                                                            <span>{item}</span>
                                                        </li>
                                                    {/each}
                                                </ul>
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {:else if selectedPOI}
                <div class="p-6 space-y-6 flex flex-col h-full overflow-hidden" in:fly={{ x: 20, duration: 300 }}>
                    <button onclick={() => selectedPOI = null} class="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-500 hover:text-blue-400 transition-colors tracking-[0.2em] active:scale-95">{@html icons.arrowLeft} Back to Registry</button>
                    
                    <div class="space-y-4">
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex flex-col gap-1.5">
                                <h2 class="text-xl font-bold text-white leading-tight tracking-tight">{selectedPOI.title || selectedPOI.name}</h2>
                                {#if (selectedPOI as any).types}
                                    <div class="flex gap-1.5">
                                        {#each (selectedPOI as any).types as type}
                                            <span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm {type === 'hub' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : type === 'heritage' ? 'bg-slate-500/20 text-slate-400 border border-slate-500/20' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'}">{type}</span>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                            {#if selectedPOI.special === 'mithras'}<div class="text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]">{@html icons.star}</div>{/if}
                        </div>

                        <div class="flex flex-wrap gap-2 pt-2">
                            {#if selectedPOI.url && selectedPOI.url !== '#'}
                                <a href={selectedPOI.url} target="_blank" class="px-3 py-2 bg-white/10 hover:bg-white/15 text-white border border-white/5 rounded-md font-black text-[10px] uppercase tracking-widest transition-all shadow-sm">Wikipedia</a>
                            {/if}
                            <button onclick={() => mapComponent?.flyToPOI(selectedPOI)} class="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-black text-[10px] uppercase tracking-widest transition-all shadow-glow flex items-center gap-2">Take me there {@html icons.arrowRight}</button>
                        </div>
                    </div>

                    <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                        {#if selectedPOI.bourdainIntel}
                            <div class="bg-amber-500/5 border border-amber-500/10 p-4 rounded-lg space-y-2.5">
                                <span class="text-[10px] font-black uppercase text-amber-500 tracking-[0.15em] flex items-center gap-2">Bourdain's Intel</span>
                                <p class="text-[13px] font-medium text-amber-200/80 leading-relaxed italic">"{selectedPOI.bourdainIntel}"</p>
                            </div>
                        {/if}

                        {#if selectedPOI.fryeIntel}
                            <div class="bg-white/5 border border-white/5 p-4 rounded-lg space-y-2.5">
                                <span class="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] flex items-center gap-2">Frye's Perspective</span>
                                <p class="text-[13px] font-medium text-slate-300 leading-relaxed italic">"{selectedPOI.fryeIntel}"</p>
                            </div>
                        {/if}

                        {#if selectedPOI.rickStevesIntel}
                            <div class="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-lg space-y-2.5">
                                <span class="text-[10px] font-black uppercase text-emerald-500 tracking-[0.15em] flex items-center gap-2">Rick Steves' Advice</span>
                                <p class="text-[13px] font-medium text-emerald-200/80 leading-relaxed italic">"{selectedPOI.rickStevesIntel}"</p>
                            </div>
                        {/if}

                        {#if selectedPOI.photoIntel}
                            <div class="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-lg space-y-2.5">
                                <span class="text-[10px] font-black uppercase text-indigo-400 tracking-[0.15em] flex items-center gap-2">{@html icons.camera} Photography Tips</span>
                                <p class="text-[13px] font-medium text-indigo-200/80 leading-relaxed italic">"{selectedPOI.photoIntel}"</p>
                            </div>
                        {/if}

                        <div class="font-serif italic text-[15px] text-slate-400 leading-relaxed border-t border-white/5 pt-6">"{selectedPOI.summary || "Extracting archaeological data..."}"</div>
                    </div>
                </div>
            {:else}
                <div class="p-4 space-y-6" in:fade>
                    <div class="flex flex-col gap-4">
                        <div class="relative group">
                            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">{@html icons.search}</div>
                            <input type="text" bind:this={searchInput} bind:value={searchQuery} placeholder="Search Registry..." class="w-full bg-inset border border-white/5 rounded-lg py-2.5 pl-9 pr-4 text-[12px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-white/5 transition-all shadow-inner placeholder:text-slate-600" />
                        </div>
                        
                        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                            <button onclick={() => activeCategories.heritage = !activeCategories.heritage} class="px-2.5 py-1.5 rounded-md border text-[10px] font-black uppercase tracking-tighter transition-all {activeCategories.heritage ? 'bg-slate-700 border-slate-600 text-white shadow-sm' : 'bg-inset border-white/5 text-slate-500'} flex items-center gap-1.5 text-nowrap">Heritage {#if activeCategories.heritage} {@html icons.check} {/if}</button>
                            <button onclick={() => activeCategories.pubs = !activeCategories.pubs} class="px-2.5 py-1.5 rounded-md border text-[10px] font-black uppercase tracking-tighter transition-all {activeCategories.pubs ? 'bg-amber-600 border-amber-500 text-white shadow-sm' : 'bg-inset border-white/5 text-slate-500'} flex items-center gap-1.5 text-nowrap">Pubs {#if activeCategories.pubs} {@html icons.check} {/if}</button>
                            <button onclick={() => activeCategories.discovery = !activeCategories.discovery} class="px-2.5 py-1.5 rounded-md border text-[10px] font-black uppercase tracking-tighter transition-all {activeCategories.discovery ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-inset border-white/5 text-slate-500'} flex items-center gap-1.5 text-nowrap">Discovery {#if activeCategories.discovery} {@html icons.check} {/if}</button>
                        </div>
                    </div>

                    <div class="space-y-6">
                        {#if activeCategories.heritage}
                            <section class="space-y-3">
                                <button onclick={() => expandedSections.heritage = !expandedSections.heritage} class="w-full flex items-center justify-between px-1 group">
                                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover:text-slate-300 transition-colors">English Heritage</span>
                                    <div class="text-slate-600 transition-transform {expandedSections.heritage ? '' : '-rotate-90'}">{@html icons.caret}</div>
                                </button>
                                {#if expandedSections.heritage}
                                    <div class="grid grid-cols-1 bg-inset border border-white/5 rounded-lg divide-y divide-white/5 shadow-sm overflow-hidden" transition:slide>
                                        {#each englishHeritageSites.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())) as site}
                                            <button class="w-full text-left p-3 hover:bg-white/5 transition-colors group flex flex-col gap-1 relative" onclick={() => handlePOIClick(site)}>
                                                <div class="flex items-center gap-3">
                                                    <div class="w-7 h-7 rounded-md bg-slate-800 border border-white/5 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">{@html icons.landmark}</div>
                                                    <div class="flex-1 min-w-0 flex items-center gap-2">
                                                        <span class="font-bold text-slate-300 group-hover:text-blue-400 truncate tracking-tight">{site.name}</span>
                                                        {#if site.special === 'mithras'}<div class="text-amber-400 animate-pulse">{@html icons.star}</div>{/if}
                                                    </div>
                                                </div>
                                                {#if selectedPOI && (selectedPOI as any).name === site.name}
                                                    <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-glow"></div>
                                                {/if}
                                            </button>
                                        {/each}
                                    </div>
                                {/if}
                            </section>
                        {/if}

                        {#if activeCategories.pubs}
                            <section class="space-y-3">
                                <button onclick={() => expandedSections.hospitality = !expandedSections.hospitality} class="w-full flex items-center justify-between px-1 group">
                                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover:text-slate-300 transition-colors">Hospitality</span>
                                    <div class="text-slate-600 transition-transform {expandedSections.hospitality ? '' : '-rotate-90'}">{@html icons.caret}</div>
                                </button>
                                {#if expandedSections.hospitality}
                                    <div class="grid grid-cols-1 bg-inset border border-white/5 rounded-lg divide-y divide-white/5 shadow-sm overflow-hidden" transition:slide>
                                        {#each hospitalitySites.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())) as site}
                                            <button class="w-full text-left p-3 hover:bg-white/5 transition-colors group flex items-center gap-3 relative" onclick={() => handlePOIClick(site)}>
                                                <div class="w-7 h-7 rounded-md {site.category === 'brewery' ? 'bg-amber-600' : 'bg-orange-700'} border border-white/5 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">{@html icons.beer}</div>
                                                <span class="font-bold text-slate-300 group-hover:text-blue-400 truncate tracking-tight">{site.name}</span>
                                                {#if selectedPOI && (selectedPOI as any).name === site.name}
                                                    <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-glow"></div>
                                                {/if}
                                            </button>
                                        {/each}
                                    </div>
                                {/if}
                            </section>
                        {/if}

                        {#if activeCategories.discovery}
                            <section class="space-y-3">
                                <button onclick={() => expandedSections.discovery = !expandedSections.discovery} class="w-full flex items-center justify-between px-1 group">
                                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover:text-slate-300 transition-colors">Nearby Discovery</span>
                                    <div class="text-slate-600 transition-transform {expandedSections.discovery ? '' : '-rotate-90'}">{@html icons.caret}</div>
                                </button>
                                {#if expandedSections.discovery}
                                    <div class="space-y-1.5" transition:slide>
                                        {#each filteredDiscovery.slice(0, 20) as poi, i}
                                            <button class="w-full text-left p-3 bg-inset hover:bg-white/5 rounded-lg border border-white/5 hover:border-blue-500/30 transition-all group flex items-center gap-3 relative active:scale-[0.98]" onclick={() => handlePOIClick(poi)}>
                                                <div class="text-slate-500 group-hover:text-blue-400 shrink-0 transition-colors">{@html icons.discovery}</div>
                                                <div class="flex-1 min-w-0">
                                                    <div class="flex justify-between items-center mb-0.5">
                                                        <span class="font-bold text-slate-300 group-hover:text-blue-400 truncate tracking-tight">{poi.title}</span>
                                                        <span class="text-[9px] font-mono text-slate-600 tabular-nums">RANK {Math.round(poi.rank)}</span>
                                                    </div>
                                                    <div class="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                                        <div class="bg-blue-500/50 h-full transition-all duration-500" style="width: {Math.min(100, poi.rank * 2)}%"></div>
                                                    </div>
                                                </div>
                                                {#if selectedPOI && (selectedPOI as any).pageid === poi.pageid}
                                                    <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-glow"></div>
                                                {/if}
                                            </button>
                                        {/each}
                                    </div>
                                {/if}
                            </section>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>
        <footer class="p-4 bg-inset border-t border-white/5 text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] text-center">System Atlas · Hadrian Workstation v4.2</footer>
    </aside>

    <main class="flex-1 relative bg-slate-100 overflow-hidden">
        <div class="absolute inset-0">
            <Map
                bind:this={mapComponent}
                initialPOIs={data.initialPOIs}
                bind:selectedPOI
                {selectedStageId}
                {mapStyle}
                {selectedRoute}
                {isHeadingUp}
                {isMobile}
                {showMilestones}
                hikerActive={$hikerMode.isActive}
                hikerHeading={$hikerMode.heading}
                hikerSimplified={$hikerMode.simplifiedHUD}
                lowPowerMode={$hikerMode.isLowBattery}
                freezeMap={Boolean(hikerIntelCard)}
                onPoiSelect={handlePOIClick}
                onNavigationUpdate={handleNavigationUpdate}
                onHikerPoiSelect={handleHikerPoiSelect}
                onMapReady={handleMapReady}
            />
        </div>

        {#if !isMobile}
            <button
                onclick={handleCoinTap}
                class="absolute bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] {coinMetallic || $hikerMode.isActive ? 'border-amber-200/70 bg-gradient-to-br from-amber-100 via-yellow-200 to-amber-500 shadow-[0_0_24px_rgba(251,191,36,0.55)]' : 'border-blue-300/55 bg-transparent shadow-[0_0_16px_rgba(59,130,246,0.4)]'} {coinAnimating ? 'scale-110 rotate-[360deg]' : ''}"
                aria-label="Triple tap Roman Coin to toggle Hiker Mode"
                title="Triple Tap Roman Coin"
            >
                <img src="/logo-coin.png" alt="Roman Coin Toggle" class="h-10 w-10 object-contain drop-shadow-md" />
            </button>
        {/if}

        {#if hikerIntelCard}
            <div class="absolute inset-0 z-[65] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
                <div class="w-full max-w-md rounded-2xl border border-amber-300/30 bg-slate-900/95 p-5 shadow-2xl">
                    <div class="mb-3 flex items-start justify-between gap-4">
                        <div>
                            <p class="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">Intel Card</p>
                            <h3 class="text-xl font-black text-white">{hikerIntelCard.title || hikerIntelCard.name}</h3>
                        </div>
                        <button onclick={closeIntelCard} class="rounded-md border border-white/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-200 hover:bg-white/10">Close</button>
                    </div>
                    <p class="text-sm leading-relaxed text-slate-300">{hikerIntelCard.summary || hikerIntelCard.intel || 'No field notes cached for this waypoint yet.'}</p>
                </div>
            </div>
        {/if}
        <div class="{isMobile ? 'absolute bottom-32 right-4 flex flex-col items-end gap-3 z-30' : 'absolute top-4 right-4 z-30 flex flex-col items-end gap-2'}">
            <!-- Navigation Instruments -->
            <div class="flex p-0.5 bg-white/95 border border-slate-200 shadow-2xl overflow-hidden rounded-lg" style="-webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);">
                <button onclick={() => mapComponent?.triggerLocateMe()} class="{isMobile ? 'p-2.5' : 'p-1.5'} text-slate-600 active:text-blue-600 border-r border-slate-100 transition-all" title="Show My Location">{@html icons.locate}</button>
                <button onclick={() => isHeadingUp = !isHeadingUp} disabled={$hikerMode.simplifiedHUD} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2 py-1.5 text-[8px]'} font-black uppercase transition-all {isHeadingUp ? 'bg-blue-600 text-white' : 'text-slate-500 active:bg-slate-50'} {$hikerMode.simplifiedHUD ? 'opacity-40 cursor-not-allowed' : ''}" title="Toggle Heading Up Mode">
                    {$hikerMode.simplifiedHUD ? 'North' : isHeadingUp ? 'Heading' : 'North'}
                </button>
                <button onclick={() => showMilestones = !showMilestones} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2 py-1.5 text-[8px]'} font-black uppercase transition-all {showMilestones ? 'bg-amber-600 text-white' : 'text-slate-500 active:bg-slate-50'} border-l border-slate-100" title="Toggle Milestones Layer">
                    Logistics
                </button>
            </div>

            <!-- Route Switcher -->
            <div class="flex p-0.5 bg-white/95 border border-slate-200 shadow-2xl overflow-hidden rounded-lg" style="-webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);">
                <button onclick={() => selectedRoute = 'osm'} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2 py-1.5 text-[8px]'} font-black uppercase transition-all {selectedRoute === 'osm' ? 'bg-blue-600 text-white' : 'text-slate-500 active:bg-slate-50'}" title="High-Res OSM Footpath">Footpath</button>
                <button onclick={() => selectedRoute = 'simplified'} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2 py-1.5 text-[8px]'} font-black uppercase transition-all {selectedRoute === 'simplified' ? 'bg-blue-600 text-white' : 'text-slate-500 active:bg-slate-50'} border-l border-slate-100" title="Decimated OSM">Simple</button>
            </div>

            <!-- Style Switcher -->
            <div class="flex p-0.5 bg-white/95 border border-slate-200 shadow-2xl overflow-hidden rounded-lg" style="-webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);">
                <button onclick={() => mapStyle = 'topo'} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2.5 py-1.5 text-[9px]'} font-black uppercase transition-all {mapStyle === 'topo' ? 'bg-slate-900 text-white' : 'text-slate-500 active:bg-slate-50'}">Topo</button>
                <button onclick={() => mapStyle = 'satellite'} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2.5 py-1.5 text-[9px]'} font-black uppercase transition-all {mapStyle === 'satellite' ? 'bg-slate-900 text-white' : 'text-slate-500 active:bg-slate-50'} border-x border-slate-100">Sat</button>
                <button onclick={() => mapStyle = 'streets'} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2.5 py-1.5 text-[9px]'} font-black uppercase transition-all {mapStyle === 'streets' ? 'bg-slate-900 text-white' : 'text-slate-500 active:bg-slate-50'}">Roads</button>
            </div>
            
            <button class="{isMobile ? 'p-4 rounded-lg' : 'p-3 rounded-md'} bg-white/95 border border-slate-200 shadow-2xl active:scale-90 transition-all text-slate-900 active:text-blue-600 flex items-center justify-center" style="-webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);" onclick={toggleSearch} title="Search Registry">{@html icons.search}</button>
        </div>
    </main>

    <!-- Fixed Bottom Tab Bar (Mobile) -->
    {#if isMobile}
        <nav class="fixed bottom-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl border-t border-white/10 safe-p-bottom transition-transform duration-300 {selectedPOI ? 'translate-y-full' : ''}" style="-webkit-backdrop-filter: blur(20px);">
            <div class="flex items-center justify-around h-16">
                <button 
                    onclick={() => { mode = 'plan'; isSidebarOpen = true; selectedPOI = null; }}
                    class="flex flex-col items-center gap-1 flex-1 {mode === 'plan' && isSidebarOpen ? 'text-blue-400' : 'text-slate-500'}"
                >
                    <div class="p-1">{@html icons.list}</div>
                    <span class="text-[9px] font-black uppercase tracking-widest">Plan</span>
                </button>
                <button 
                    onclick={() => { mode = 'explore'; isSidebarOpen = true; selectedPOI = null; }}
                    class="flex flex-col items-center gap-1 flex-1 {mode === 'explore' && isSidebarOpen ? 'text-blue-400' : 'text-slate-500'}"
                >
                    <div class="p-1">{@html icons.compass}</div>
                    <span class="text-[9px] font-black uppercase tracking-widest">Explore</span>
                </button>
                <button 
                    onclick={() => isSidebarOpen = false}
                    class="flex flex-col items-center gap-1 flex-1 {!isSidebarOpen ? 'text-blue-400' : 'text-slate-500'}"
                >
                    <div class="p-1">{@html icons.map}</div>
                    <span class="text-[9px] font-black uppercase tracking-widest">Map</span>
                </button>
                <button 
                    onclick={toggleSearch}
                    class="flex flex-col items-center gap-1 flex-1 text-slate-500"
                >
                    <div class="p-1">{@html icons.search}</div>
                    <span class="text-[9px] font-black uppercase tracking-widest">Registry</span>
                </button>
            </div>
        </nav>
    {/if}
</div>

<style>
    :global(.custom-scrollbar::-webkit-scrollbar) { width: 4px; }
    :global(.custom-scrollbar::-webkit-scrollbar-track) { background: transparent; }
    :global(.custom-scrollbar::-webkit-scrollbar-thumb) { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
    :global(.custom-scrollbar::-webkit-scrollbar-thumb:hover) { background: rgba(255, 255, 255, 0.2); }
    :global(.scrollbar-hide::-webkit-scrollbar) { display: none; }

    :global(:root) {
        --motion-duration-micro: 120ms;
        --motion-duration-ui: 180ms;
        --motion-duration-panel: 240ms;
        --motion-duration-nav: 460ms;
        --motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
        --motion-ease-emphasized: cubic-bezier(0.22, 1, 0.36, 1);
        --motion-ease-exit: cubic-bezier(0.4, 0, 1, 1);
    }

    .splash-screen {
        animation: splash-fade-in var(--motion-duration-ui) var(--motion-ease-standard) both;
    }

    .splash-image {
        transform-origin: 50% 40%;
        animation: splash-ken-burns var(--motion-duration-nav) var(--motion-ease-emphasized) both;
        will-change: transform, opacity;
    }

    .splash-headline {
        animation: splash-rise var(--motion-duration-panel) var(--motion-ease-standard) 50ms both;
    }

    .splash-subline {
        animation: splash-rise var(--motion-duration-panel) var(--motion-ease-standard) 110ms both;
    }

    .splash-progress {
        transform-origin: 0 50%;
        animation: splash-progress 720ms var(--motion-ease-emphasized) 120ms both;
        will-change: transform, opacity;
    }

    @keyframes splash-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes splash-ken-burns {
        from {
            opacity: 0.92;
            transform: scale(1.06) translateY(6px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }

    @keyframes splash-rise {
        from {
            opacity: 0;
            transform: translateY(9px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes splash-progress {
        from {
            transform: scaleX(0.22);
            opacity: 0.7;
        }
        to {
            transform: scaleX(1);
            opacity: 1;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .splash-screen,
        .splash-image,
        .splash-headline,
        .splash-subline,
        .splash-progress {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
        }

        .splash-image,
        .splash-headline,
        .splash-subline {
            transform: none !important;
        }

        .splash-progress {
            transform: scaleX(1);
        }
    }
</style>
