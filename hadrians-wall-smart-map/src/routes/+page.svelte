<script lang="ts">
    import { onMount, tick } from "svelte";
    import Map from "$lib/components/Map.svelte";
    import HikerHUD from "$lib/components/HikerHUD.svelte";
    import { hikerMode } from "$lib/stores/hikerMode";
    import type { PageData } from "./$types";
    import { fetchPageSummary } from "$lib/services/wikipedia";
    import {
        itinerary,
        englishHeritageSites,
        hospitalitySites,
        overnightStops,
        planAvgSpeedMidMph,
        planTotalMiles,
    } from "$lib/data/trail";
    import { fade, fly, slide } from "svelte/transition";
    import { compassService } from "$lib/services/compass";
    import { gamificationService } from "$lib/services/gamification";
    import { audioService } from "$lib/services/audio";
    import type { NavigationMetrics } from "$lib/services/navigation";
    import { runBlobMorph } from "$lib/utils/blobMorph";
    import Coin3D, { prefetchCoin } from "$lib/components/Coin3D.svelte";

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

    const isBrowser = typeof window !== "undefined";
    const PORTABLE_MQ = "(max-width: 1024px)";
    const MOBILE_MQ = "(max-width: 768px)";

    let isSidebarOpen = $state(false);
    let selectedPOI = $state<POI | null>(null);
    let searchQuery = $state("");
    let isHeadingUp = $state(false);
    let mapComponent: any = $state();
    let isMobile = $state(isBrowser && window.matchMedia(MOBILE_MQ).matches);
    let isPortable = $state(isBrowser && window.matchMedia(PORTABLE_MQ).matches);
    let isOnline = $state(true);

    type AppMode = "plan" | "explore";
    let mode = $state<AppMode>("plan");
    let selectedStageId = $state<number | null>(null);
    let mapStyle = $state("topo");
    let selectedRoute = $state("osm");
    let showMilestones = $state(true);
    let expandedMilestoneStages = $state(new Set<number>());
    let hasRequestedCompassPermission = $state(false);
    let coinAnimating = $state(false);
    let coinMetallic = $state(false);
    let hikerIntelCard = $state<any | null>(null);
    let latestBadge = $state<{ name: string; description: string } | null>(
        null,
    );
    let swipeStartY = $state(0);
    let swipeStartX = $state(0);
    let swipeTracking = $state(false);
    let drawerSwipeStartY = $state(0);
    let drawerSwipeStartX = $state(0);
    let mobileCoinButton = $state<HTMLButtonElement | null>(null);
    let hikerTopCoinRect = $state<DOMRect | null>(null);
    let coinMorphing = $state(false);
    let coinMorphBusy = $state(false);
    let showSplash = $state(isPortable); // Rule of Least Surprise: Start true on portable
    let splashMinElapsed = $state(false);
    let mapReady = $state(false);
    let ukNowTick = $state(Date.now());
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
    let hikerHUDRef = $state<ReturnType<typeof HikerHUD>>();
    let headerCoinRef = $state<ReturnType<typeof Coin3D>>();

    function wakeCoins() {
        headerCoinRef?.wake();
        hikerHUDRef?.wake();
    }

    let discoveredPOIs = $derived(data.initialPOIs ?? []);
    const GPS_COURSE_SPEED_THRESHOLD_MPH = 1.5;
    const GPS_COURSE_RECOVERY_SPEED_THRESHOLD_MPH = 1.1;
    const COMPASS_FALLBACK_ENTER_MS = 2200;
    const COMPASS_FALLBACK_EXIT_MS = 1400;
    const COMPASS_HEADING_HOLD_MS = 8000;
    const COMPASS_NOTICE_DELAY_MS = 3200;
    const MOBILE_SPLASH_MIN_VISIBLE_MS = 2200;
    const MOBILE_SPLASH_HARD_TIMEOUT_MS = 6000;
    
    const planAvgSpeedMidLabel = `${planAvgSpeedMidMph.toFixed(2)} MPH`;
    const PLAN_LIGHT_START_DATE_KEY = "2026-04-11";
    const PLAN_LIGHT_END_DATE_KEY = "2026-04-20";
    const PLAN_LIGHT_WINDOWS = {
        "2026-04-11": {
            goldenHour: "7:09 PM +",
            sunset: "8:09 PM",
            lastLight: "8:45 PM",
        },
        "2026-04-12": {
            goldenHour: "7:11 PM +",
            sunset: "8:11 PM",
            lastLight: "8:47 PM",
        },
        "2026-04-13": {
            goldenHour: "7:13 PM +",
            sunset: "8:13 PM",
            lastLight: "8:49 PM",
        },
        "2026-04-14": {
            goldenHour: "7:15 PM +",
            sunset: "8:15 PM",
            lastLight: "8:52 PM",
        },
        "2026-04-15": {
            goldenHour: "7:17 PM +",
            sunset: "8:17 PM",
            lastLight: "8:54 PM",
        },
        "2026-04-16": {
            goldenHour: "7:19 PM +",
            sunset: "8:19 PM",
            lastLight: "8:56 PM",
        },
        "2026-04-17": {
            goldenHour: "7:21 PM +",
            sunset: "8:21 PM",
            lastLight: "8:58 PM",
        },
        "2026-04-18": {
            goldenHour: "7:23 PM +",
            sunset: "8:23 PM",
            lastLight: "9:00 PM",
        },
        "2026-04-19": {
            goldenHour: "7:24 PM +",
            sunset: "8:24 PM",
            lastLight: "9:02 PM",
        },
        "2026-04-20": {
            goldenHour: "7:26 PM +",
            sunset: "8:26 PM",
            lastLight: "9:04 PM",
        },
    } as const;

    const STAGGER_DELAY = 50;

    function ukDateKey(nowMs = Date.now()) {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/London",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(new Date(nowMs));
    }

    function tripLightDateKey(nowMs = Date.now()) {
        const currentKey = ukDateKey(nowMs);
        if (currentKey < PLAN_LIGHT_START_DATE_KEY)
            return PLAN_LIGHT_START_DATE_KEY;
        if (currentKey > PLAN_LIGHT_END_DATE_KEY)
            return PLAN_LIGHT_END_DATE_KEY;
        return currentKey;
    }

    function tripLightDateLabel(dateKey: string) {
        const date = new Date(`${dateKey}T12:00:00+01:00`);
        const formatted = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/London",
            weekday: "short",
            month: "short",
            day: "numeric",
        }).format(date);
        return `UK · ${formatted}`;
    }

    const planLightWindow = $derived.by(() => {
        const dateKey = tripLightDateKey(ukNowTick);
        const windows =
            PLAN_LIGHT_WINDOWS[dateKey as keyof typeof PLAN_LIGHT_WINDOWS];
        return {
            date: tripLightDateLabel(dateKey),
            goldenHour: windows.goldenHour,
            sunset: windows.sunset,
            lastLight: windows.lastLight,
        };
    });

    let filteredDiscovery = $derived.by(() => {
        const query = searchQuery.trim().toLowerCase();
        return discoveredPOIs
            .filter((poi) => !query || poi.title.toLowerCase().includes(query))
            .sort((a, b) => b.rank - a.rank);
    });

    function normalizeHeading(value: number | null | undefined): number | null {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
            return null;
        return ((value % 360) + 360) % 360;
    }

    function headingDelta(a: number, b: number) {
        return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
    }

    function readSafeAreaTopInsetPx() {
        if (typeof document === "undefined") return 0;
        const probe = document.createElement("div");
        probe.style.cssText =
            "position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);visibility:hidden;pointer-events:none;";
        document.body.appendChild(probe);
        const inset =
            Number.parseFloat(getComputedStyle(probe).paddingTop) || 0;
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

    async function runCoinMorph(direction: "expand" | "collapse") {
        if (!isMobile || !mobileCoinButton || typeof window === "undefined")
            return;

        const liveMobileRect = mobileCoinButton.getBoundingClientRect();
        const mobileCenterX = liveMobileRect.left + liveMobileRect.width / 2;
        const mobileCenterY = liveMobileRect.top + liveMobileRect.height / 2;
        const mobileRestSize = 36;
        const mobileRestRect = new DOMRect(
            mobileCenterX - mobileRestSize / 2,
            mobileCenterY - mobileRestSize / 2,
            mobileRestSize,
            mobileRestSize,
        );
        const hikerRect = hikerTopCoinRect ?? fallbackHikerCoinRect();
        const fromRect = direction === "expand" ? mobileRestRect : hikerRect;
        const toRect = direction === "expand" ? hikerRect : mobileRestRect;

        coinMorphing = true;
        try {
            await tick();
            await new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                ),
            );
            await runBlobMorph({
                from: fromRect,
                to: toRect,
                direction,
                durationMs: 620,
                bounce: 0.42,
                zIndex: 116,
                contentSource: mobileCoinButton,
            });
        } finally {
            coinMorphing = false;
        }
    }

    onMount(() => {
        // Prefetch 3D coin assets when idle
        prefetchCoin();

        const handleOnline = () => (isOnline = true);
        const handleOffline = () => (isOnline = false);
        isOnline = navigator.onLine;
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        const mql = window.matchMedia(MOBILE_MQ);
        const portableMql = window.matchMedia(PORTABLE_MQ);

        isMobile = mql.matches;
        isPortable = portableMql.matches;

        // On mobile, start with sidebar closed to show map; on desktop, start open.
        isSidebarOpen = !isPortable;
        const handleMedia = (e: MediaQueryListEvent) => {
            isMobile = e.matches;
        };
        const handlePortableMedia = (e: MediaQueryListEvent) => {
            isPortable = e.matches;
            if (!e.matches) {
                showSplash = false;
            }
        };
        mql.addEventListener("change", handleMedia);
        portableMql.addEventListener("change", handlePortableMedia);
        const ukTickInterval = setInterval(() => {
            ukNowTick = Date.now();
        }, 60000);

        let splashMinTimer: ReturnType<typeof setTimeout> | null = null;
        let splashHardTimer: ReturnType<typeof setTimeout> | null = null;
        if (isPortable) {
            showSplash = true;
            splashMinElapsed = false;
            splashMinTimer = setTimeout(() => {
                splashMinElapsed = true;
                if (mapReady) {
                    showSplash = false;
                }
            }, MOBILE_SPLASH_MIN_VISIBLE_MS);
            splashHardTimer = setTimeout(() => {
                splashMinElapsed = true;
                if (showSplash) {
                    showSplash = false;
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
        if ("getBattery" in navigator) {
            (navigator as Navigator & { getBattery: () => Promise<any> })
                .getBattery()
                .then((battery) => {
                    batteryRef = battery;
                    batteryHandler = () => {
                        const low = battery.level <= 0.25 && !battery.charging;
                        hikerMode.setLowBattery(low);
                    };
                    batteryHandler();
                    battery.addEventListener("levelchange", batteryHandler);
                    battery.addEventListener("chargingchange", batteryHandler);
                })
                .catch(() => {
                    hikerMode.setLowBattery(false);
                });
        }

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            mql.removeEventListener("change", handleMedia);
            portableMql.removeEventListener("change", handlePortableMedia);
            clearInterval(ukTickInterval);
            if (splashMinTimer) clearTimeout(splashMinTimer);
            if (splashHardTimer) clearTimeout(splashHardTimer);
            if (batteryRef && batteryHandler) {
                batteryRef.removeEventListener("levelchange", batteryHandler);
                batteryRef.removeEventListener(
                    "chargingchange",
                    batteryHandler,
                );
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
        discovery: true,
    });

    // Explore IA: Category Toggles
    let activeCategories = $state({
        heritage: true,
        pubs: true,
        discovery: true,
    });

    let searchInput = $state<HTMLInputElement>();

    let searchNeedle = $derived(searchQuery.trim().toLowerCase());

    let visibleHeritageSites = $derived.by(() =>
        englishHeritageSites.filter(
            (site) =>
                !searchNeedle || site.name.toLowerCase().includes(searchNeedle),
        ),
    );

    let visibleHospitalitySites = $derived.by(() =>
        hospitalitySites.filter(
            (site) =>
                !searchNeedle || site.name.toLowerCase().includes(searchNeedle),
        ),
    );

    let visibleDiscoveryPOIs = $derived(filteredDiscovery.slice(0, 20));

    let activeExploreCategoryCount = $derived.by(
        () =>
            Number(activeCategories.heritage) +
            Number(activeCategories.pubs) +
            Number(activeCategories.discovery),
    );

    let activeRegistryResultCount = $derived.by(() => {
        let total = 0;
        if (activeCategories.heritage) total += visibleHeritageSites.length;
        if (activeCategories.pubs) total += visibleHospitalitySites.length;
        if (activeCategories.discovery) total += visibleDiscoveryPOIs.length;
        return total;
    });

    function resetExploreFilters() {
        searchQuery = "";
        activeCategories = { heritage: true, pubs: true, discovery: true };
    }

    async function handlePOIClick(poi: any) {
        mode = "explore";
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
        mode = "explore";
        isSidebarOpen = true;
        selectedPOI = null;
        // Focus input on next tick
        setTimeout(() => searchInput?.focus(), 50);
    }

    function toggleStage(id: number) {
        selectedStageId = selectedStageId === id ? null : id;
    }

    function isSkinnyPlanStage(stage: { difficulty: string; id: number }) {
        return stage.difficulty === "Departure";
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
        const center = overnightStops.find((h) =>
            h.name.includes(stage.from.split(" ")[0]),
        )?.coords;
        if (center && mapComponent) {
            mapComponent.flyToPOI({ coords: center });
        }
    }

    function generateSparkline(gain: number, loss: number) {
        const h = 20;
        const w = 60;
        const total = gain + loss;
        const ratio = gain / (total || 1);
        const mid = w * ratio;
        return `M 0 ${h} L ${mid} 0 L ${w} ${h}`;
    }

    // Phosphor Icons (Raw SVGs)
    const icons = {
        clock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v40h48A8,8,0,0,1,192,128Z"></path></svg>`,
        map: `<i class="hn hn-globe-americas-solid" style="font-size: 1.25rem;"></i>`,
        compass: `<i class="hn hn-bank-solid" style="font-size: 1.25rem;"></i>`,
        list: `<i class="hn hn-bars" style="font-size: 1.25rem;"></i>`,
        mountain: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M252.92,210.14l-96-160a16,16,0,0,0-27.43,0l-25.15,41.91L78.29,50.14a16,16,0,0,0-27.43,0l-48,80a16,16,0,0,0,0,16.53l48,80A16,16,0,0,0,64.57,232h184a8,8,0,0,0,6.85-12.14ZM64.57,216,24,142.67,64.57,75.33,105.14,142.67Zm177.14,0H121.71l21.43-35.71,25.14,41.9a8,8,0,0,0,13.72-8.24l-31.15-51.91L192,92.67,241.71,175.33Z"></path></svg>`,
        shopping: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M239.38,90.47A15.94,15.94,0,0,0,224,80H64V56A16,16,0,0,0,48,40H24a8,8,0,0,0,0,16H48V192a16,16,0,0,0,16,16H192a8,8,0,0,0,0-16H64V96H224l-18.4,82.82A16,16,0,0,1,190,192H96a8,8,0,0,0,0,16h94a32,32,0,0,0,31.27-25.05L240,99.76A15.86,15.94,0,0,0,239.38,90.47ZM100,216a20,20,0,1,0,20,20A20,20,0,0,0,100,216Zm100,0a20,20,0,1,0,20,20A20,20,0,0,0,200,216Z"></path></svg>`,
        arrowLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`,
        landmark: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M240,208H224V101.33l10.67,5.34a8,8,0,0,0,7.15-14.34l-104-52a8,8,0,0,0-7.15,0l-104,52a8,8,0,0,0,7.15,14.34L48,101.33V208H32a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM64,109.33l64-32,64,32V208H64Z"></path></svg>`,
        beer: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M232,64H208V56a16,16,0,0,0-16-16H40A16,16,0,0,0,24,56V208a32,32,0,0,0,32,32H160a32,32,0,0,0,32-32V184h8a32,32,0,0,0,32-32V96A32,32,0,0,0,232,64Zm-56,144a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56H176Zm40-56a16,16,0,0,1-16,16H192V80h16a16,16,0,0,1,16,16ZM64,88a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H72A8,8,0,0,1,64,88Zm0,32a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H72A8,8,0,0,1,64,120Zm0,32a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H72A8,8,0,0,1,64,152Z"></path></svg>`,
        search: `<i class="hn hn-search" style="font-size: 1.25rem;"></i>`,
        caret: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L100,192.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"></path></svg>`,
        discovery: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Zm-32,0a56,56,0,1,1-56-56A56.06,56.06,0,0,1,184,128Zm-16,0a40,40,0,1,0-40,40A40,40,0,0,0,168,128Z"></path></svg>`,
        star: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M234.29,114.85l-45,38.83L203,207.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,225.57A16.4,16.4,0,0,1,53,207.75l13.76-54.07-45-38.83A16.46,16.46,0,0,1,31.08,86l57.51-8.45,25.76-55.68a16.36,16.36,0,0,1,29.27,0l25.76,55.68,57.51,8.45A16.46,16.46,0,0,1,234.29,114.85Z"></path></svg>`,
        sun: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16a8,8,0,0,0-11.32,11.32Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM197.66,186.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM240,120H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16ZM40,120H16a8,8,0,0,0,0,16H40a8,8,0,0,0,0-16Zm157.66-61.66a8,8,0,0,0-11.32-11.32l-16,16a8,8,0,0,0,11.32,11.32Zm-77.66,161.66V240a8,8,0,0,0,16,0V220a8,8,0,0,0-16,0Z"></path></svg>`,
        footprints: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M100,140a36,36,0,0,0-36,36v20a12,12,0,0,0,12,12h48a12,12,0,0,0,12-12V176A36,36,0,0,0,100,140Zm20,56a4,4,0,0,1-4,4H80a4,4,0,0,1-4-4V176a20,20,0,0,1,40,0ZM188,140a36,36,0,0,0-36,36v20a12,12,0,0,0,12,12h48a12,12,0,0,0,12-12V176A36,36,0,0,0,188,140Zm20,56a4,4,0,0,1-4,4H168a4,4,0,0,1-4-4V176a20,20,0,0,1,40,0Z"></path></svg>`,
        arrowRight: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L204.69,128,138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66ZM120,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16h72A8,8,0,0,1,120,128Z"></path></svg>`,
        camera: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M208,56H168V48a16,16,0,0,0-16-16H104A16,16,0,0,0,88,48v8H48A32,32,0,0,0,16,88V192a32,32,0,0,0,32,32H208a32,32,0,0,0,32-32V88A32,32,0,0,0,208,56Zm-80,128a40,40,0,1,1,40-40A40,40,0,0,1,128,184ZM104,48h48v8H104Zm104,160H48a16,16,0,0,1-16-16V88a16,16,0,0,1,16-16H208a16,16,0,0,1,16,16v88A16,16,0,0,1,208,208Z"></path></svg>`,
        locate: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM128,64a64,64,0,1,0,64,64A64.07,64.1,0,0,0,128,64Zm0,112a48,48,0,1,1,48-48A48.05,48.05,0,0,1,128,176Zm0-64a16,16,0,1,0,16,16A16,16,0,0,0,128,112Z"></path></svg>`,
        close: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>`,
    };

    let lastTap = 0;
    let tapCount = 0;

    async function activateHikerMode() {
        if (!isPortable) return;
        if (coinMorphBusy) return;
        coinMorphBusy = true;
        try {
            coinMetallic = true;
            coinAnimating = true;
            if (navigator.vibrate) navigator.vibrate(300);

            if (isPortable) {
                await runCoinMorph("expand");
            }

            hikerMode.activate();

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

    $effect(() => {
        if (!isPortable && $hikerMode.isActive) {
            deactivateHikerMode();
        }
    });

    async function deactivateHikerModeWithMorph() {
        if (coinMorphBusy) return;
        coinMorphBusy = true;
        try {
            if (isPortable) {
                await runCoinMorph("collapse");
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
            typeof metrics.gpsSpeedMph === "number" &&
            Number.isFinite(metrics.gpsSpeedMph)
                ? Math.max(0, metrics.gpsSpeedMph)
                : Math.max(0, metrics.speedMph);

        const game = gamificationService.update(
            metrics.snappedCoord,
            metrics.distanceWalkedMiles,
            metrics.totalMiles,
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
            requiredPaceMinPerMileToDailyGoal:
                metrics.requiredPaceMinPerMileToDailyGoal,
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
            isDaytime: hour >= 7 && hour < 18,
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
        if (isPortable && splashMinElapsed) {
            showSplash = false;
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
        const isMovingFastForGps =
            latestGpsSpeedMph >= GPS_COURSE_SPEED_THRESHOLD_MPH;
        const isMovingEnoughForGpsRecovery =
            latestGpsSpeedMph >= GPS_COURSE_RECOVERY_SPEED_THRESHOLD_MPH;
        const hasGpsHeading = gpsHeading !== null;

        if (compassNeedsCalibration) {
            compassStableSinceTs = null;
            compassUnstableSinceTs ??= now;
            if (
                !compassFallbackLatched &&
                now - compassUnstableSinceTs >= COMPASS_FALLBACK_ENTER_MS
            ) {
                compassFallbackLatched = true;
            }
        } else {
            compassUnstableSinceTs = null;
            compassStableSinceTs ??= now;
            if (
                compassFallbackLatched &&
                now - compassStableSinceTs >= COMPASS_FALLBACK_EXIT_MS
            ) {
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
            (compassFallbackLatched &&
                isMovingEnoughForGpsRecovery &&
                hasGpsHeading);
        const resolvedHeading = shouldPreferGps
            ? (gpsHeading as number)
            : compassHeldHeading;
        const shouldFallbackNorthUp =
            compassFallbackLatched && !isMovingEnoughForGpsRecovery;

        if (
            lastAppliedHeading === null ||
            headingDelta(resolvedHeading, lastAppliedHeading) >= 0.6 ||
            lastAppliedCalibration !== compassFallbackLatched
        ) {
            hikerMode.updateMetrics({
                heading: resolvedHeading,
                isCalibrating: compassFallbackLatched,
            });
            lastAppliedHeading = resolvedHeading;
            lastAppliedCalibration = compassFallbackLatched;
        }

        if ($hikerMode.simplifiedHUD || !$hikerMode.isCompassActive) {
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

<svelte:window
    ontouchstart={handleHikerTouchStart}
    ontouchend={handleHikerTouchEnd}
/>

<!-- Hiker HUD Overlay -->
{#if $hikerMode.isActive && isPortable}
    <HikerHUD
        bind:this={hikerHUDRef}
        onToggleSimplified={toggleSimplifiedHUD}
        onCoinTap={handleCoinTap}
        hideTopCoin={coinMorphing}
        onTopCoinLayout={handleHikerTopCoinLayout}
    />
{/if}

{#if showCompassFallbackNotice && $hikerMode.isActive && isPortable}
    <div
        class="fixed top-24 left-1/2 z-[70] flex w-[min(92vw,26rem)] -translate-x-1/2 items-center justify-between gap-2 rounded-xl border border-amber-300/35 bg-amber-500/90 px-3 py-2 text-slate-950 shadow-2xl"
    >
        <p class="text-[10px] font-black uppercase tracking-[0.12em]">
            Compass unstable; using North-Up for now.
        </p>
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
    <div
        class="fixed top-36 right-4 z-[70] max-w-[280px] rounded-xl border border-emerald-300/30 bg-emerald-500/90 px-3 py-2 text-slate-950 shadow-2xl"
    >
        <p class="text-[9px] font-black uppercase tracking-[0.2em]">
            Badge Unlocked
        </p>
        <p class="text-sm font-black">{latestBadge.name}</p>
        <p class="text-[11px] font-semibold">{latestBadge.description}</p>
    </div>
{/if}

{#if showSplash}
    <div
        class="fixed inset-0 z-[120] lg:hidden overflow-hidden splash-screen"
        role="status"
        aria-live="polite"
        aria-label="Loading Hadrian Atlas"
    >
        <img
            src="/loading-screen-hadrians-wall-path-map.png"
            alt=""
            class="absolute inset-0 h-full w-full object-cover splash-image"
        />
        <div
            class="absolute inset-0 bg-gradient-to-b from-slate-950/25 via-slate-900/40 to-slate-950/90"
        ></div>
        <div
            class="absolute inset-x-0 px-6"
            style="bottom: calc(env(safe-area-inset-bottom, 0px) + 1.75rem);"
        >
            <p
                class="text-[11px] font-black uppercase tracking-[0.22em] text-amber-100/95 drop-shadow-sm splash-headline"
            >
                Hadrian Atlas
            </p>
            <p
                class="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-800/90 splash-subline"
            >
                Loading trail intelligence…
            </p>
            <div
                class="mt-3 h-1.5 overflow-hidden rounded-full border border-white/20 bg-slate-950/55"
            >
                <span
                    class="block h-full rounded-full bg-gradient-to-r from-blue-400 via-cyan-300 to-amber-300 splash-progress"
                ></span>
            </div>
        </div>
    </div>
{/if}

<div
    class="crt-workstation flex h-[100dvh] w-full overflow-hidden bg-canvas text-slate-900 antialiased text-[13px] selection:bg-blue-500/30 relative"
>
    <!-- Sticky Header (Mobile) -->
    {#if isMobile}
        <header
            class="crt-mobile-header fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200 pt-[env(safe-area-inset-top)] transition-transform duration-300 {!isSidebarOpen
                ? 'translate-y-0'
                : '-translate-y-full'}"
            style="-webkit-backdrop-filter: blur(20px);"
        >
            <div class="flex items-center justify-between h-14 px-4">
                <button
                    class="flex items-center gap-2 text-left active:opacity-70 transition-opacity"
                    onclick={() => (isSidebarOpen = true)}
                    aria-label="Open Plan and Explore"
                >
                    <span
                        class="atlas-logo-mark atlas-logo-mark-mobile"
                        aria-hidden="true"
                    >
                        <span class="atlas-logo-north-star"></span>
                    </span>
                    <div class="flex flex-col">
                        <h1
                            class="text-slate-900 font-black uppercase text-[10px] tracking-[0.2em]"
                        >
                            Hadrian Atlas
                        </h1>
                    </div>
                </button>
                <div class="flex items-center gap-2">
                    <button
                        bind:this={mobileCoinButton}
                        onclick={handleCoinTap}
                        class="flex items-center justify-center rounded-full border transition-all duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] {$hikerMode.isActive
                            ? 'h-[3.375rem] w-[3.375rem]'
                            : 'h-9 w-9'} {coinMetallic || $hikerMode.isActive
                            ? 'border-amber-200/70 bg-gradient-to-br from-amber-100 via-yellow-200 to-amber-500 shadow-[0_0_18px_rgba(251,191,36,0.45)]'
                            : 'border-amber-300/60 bg-white/95 shadow-[0_0_12px_rgba(251,191,36,0.2)]'} {coinAnimating
                            ? 'scale-110 rotate-[360deg]'
                            : ''} {coinMorphing || $hikerMode.isActive
                            ? 'pointer-events-none opacity-0 scale-75'
                            : 'opacity-100 scale-100'}"
                        aria-label="Triple tap Roman Coin to toggle Hiker Mode"
                        title="Triple Tap Roman Coin"
                    >
                        <div
                            class="{$hikerMode.isActive
                                ? 'h-9 w-9'
                                : 'h-6 w-6'} relative"
                        >
                            <Coin3D
                                bind:this={headerCoinRef}
                                class="w-full h-full drop-shadow-sm"
                                interactive={false}
                            />
                        </div>
                    </button>
                    <div
                        class="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/5"
                    >
                        <div
                            class="w-1.5 h-1.5 rounded-full {isOnline
                                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'} animate-pulse"
                        ></div>
                        <span
                            class="text-[10px] font-black uppercase tracking-widest {isOnline
                                ? 'text-emerald-600'
                                : 'text-orange-600'}"
                            >{isOnline ? "Live" : "Offline"}</span
                        >
                    </div>
                </div>
            </div>
        </header>
    {/if}

    <!-- Mobile Backdrop: Closes sidebar when map strip is tapped -->
    {#if isMobile && isSidebarOpen}
        <button
            onclick={() => (isSidebarOpen = false)}
            class="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            style="-webkit-backdrop-filter: blur(8px);"
            aria-label="Return to Map"
        ></button>
    {/if}

    <aside
        class="crt-sidebar crt-shell {isSidebarOpen
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:-translate-x-full'} fixed inset-x-0 bottom-0 md:inset-y-0 md:left-0 z-40 h-[94vh] md:h-full md:w-[352px] bg-white/98 backdrop-blur-2xl border-t md:border-t-0 md:border-r border-slate-200 transition-transform duration-500 md:duration-300 {isSidebarOpen
            ? 'md:relative'
            : 'fixed md:fixed'} flex flex-col shadow-2xl rounded-t-2xl md:rounded-none overflow-hidden"
        style="-webkit-backdrop-filter: blur(40px);"
    >
        <!-- Drawer Handle for Mobile -->
        {#if isMobile}
            <button
                type="button"
                class="w-full flex justify-center py-2 shrink-0"
                onclick={() => (isSidebarOpen = false)}
                ontouchstart={handleDrawerHandleTouchStart}
                ontouchend={handleDrawerHandleTouchEnd}
                aria-label="Close panel"
                title="Swipe down or tap to close"
            >
                <div class="w-12 h-1 bg-slate-300 rounded-full"></div>
            </button>
        {/if}

        <header
            class="px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-slate-200/60 flex flex-col gap-4"
        >
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                    <span class="atlas-logo-mark" aria-hidden="true">
                        <span class="atlas-logo-north-star"></span>
                    </span>
                    <div class="flex flex-col">
                        <h1
                            class="text-slate-900 font-black uppercase text-[11px] tracking-[0.2em]"
                        >
                            Hadrian Atlas
                        </h1>
                        <span
                            class="text-[9px] text-slate-500 font-bold uppercase tracking-widest"
                            >v4.2 Tactical Instrument</span
                        >
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    {#if isMobile}
                        <button
                            onclick={() => (isSidebarOpen = false)}
                            class="p-2 text-slate-500 hover:text-slate-900 transition-colors"
                            >{@html icons.close}</button
                        >
                    {/if}
                    <div class="flex gap-1.5 items-center">
                        <div
                            class="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm bg-white/5 border border-slate-200/60"
                        >
                            <div
                                class="w-1.5 h-1.5 rounded-full {isOnline
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                    : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'} animate-pulse"
                            ></div>
                            <span
                                class="text-[10px] font-black uppercase tracking-widest {isOnline
                                    ? 'text-emerald-600'
                                    : 'text-orange-600'}"
                                >{isOnline ? "Live" : "Offline"}</span
                            >
                        </div>
                        <div
                            class="w-1.5 h-1.5 rounded-full bg-slate-700"
                        ></div>
                    </div>
                </div>
            </div>

            <div
                class="ds-segmented flex bg-slate-50/50 rounded-lg border border-slate-200/60 overflow-hidden"
            >
                <button
                    onclick={() => {
                        mode = "plan";
                        selectedPOI = null;
                    }}
                    class="ds-segmented-btn flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 {mode ===
                    'plan'
                        ? 'ds-segmented-btn-active bg-white shadow-sm text-slate-900'
                        : 'ds-segmented-btn-inactive text-slate-500 hover:text-slate-600 hover:bg-slate-100'}"
                    >Plan</button
                >
                <button
                    onclick={() => (mode = "explore")}
                    class="ds-segmented-btn flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 {mode ===
                    'explore'
                        ? 'ds-segmented-btn-active bg-white shadow-sm text-slate-900'
                        : 'ds-segmented-btn-inactive text-slate-500 hover:text-slate-600 hover:bg-slate-100'}"
                    >Explore</button
                >
            </div>
        </header>

        <div
            class="flex-1 min-h-0 overflow-x-hidden scroll-smooth custom-scrollbar {selectedPOI
                ? 'overflow-hidden pb-0'
                : 'overflow-y-auto pb-32 md:pb-6'}"
        >
            {#if mode === "plan"}
                <div class="p-4 space-y-4" in:fade>
                    <div class="space-y-3">
                        <div
                            class="ds-panel flex items-center justify-between gap-2 px-3 bg-slate-50/50 py-2.5 rounded-lg border border-slate-200/60 text-[10px] font-bold tabular-nums"
                        >
                            <span
                                class="flex items-center gap-2 text-slate-600 uppercase tracking-tighter text-pretty md:text-nowrap"
                                ><i
                                    class="hn hn-clock plan-light-strip__icon"
                                    aria-hidden="true"
                                ></i>{planLightWindow.date}</span
                            >
                            <span
                                class="text-blue-600 uppercase tracking-widest text-pretty text-right md:text-nowrap"
                                >54°F · Mostly Clear</span
                            >
                        </div>

                        <div
                            class="ds-panel plan-light-strip px-3 py-2 rounded-lg border border-slate-200/60"
                        >
                            <div
                                class="plan-light-strip__grid text-[10px] font-black tracking-[0.06em] tabular-nums"
                            >
                                <div class="plan-light-strip__cell">
                                    <span class="plan-light-strip__label"
                                        ><i
                                            class="hn hn-sun plan-light-strip__icon"
                                            aria-hidden="true"
                                        ></i>Golden Hour</span
                                    >
                                    <span
                                        class="plan-light-strip__value text-nowrap"
                                        >{planLightWindow.goldenHour}</span
                                    >
                                </div>
                                <div class="plan-light-strip__cell">
                                    <span class="plan-light-strip__label"
                                        ><i
                                            class="hn hn-sun-solid plan-light-strip__icon"
                                            aria-hidden="true"
                                        ></i>Sunset</span
                                    >
                                    <span
                                        class="plan-light-strip__value text-nowrap"
                                        >{planLightWindow.sunset}</span
                                    >
                                </div>
                                <div class="plan-light-strip__cell">
                                    <span class="plan-light-strip__label"
                                        ><i
                                            class="hn hn-moon plan-light-strip__icon"
                                            aria-hidden="true"
                                        ></i>Last Light</span
                                    >
                                    <span
                                        class="plan-light-strip__value text-nowrap"
                                        >{planLightWindow.lastLight}</span
                                    >
                                </div>
                            </div>
                        </div>

                        <div
                            class="ds-panel grid grid-cols-3 gap-1 bg-slate-50/50 p-3 rounded-lg border border-slate-200/60 text-slate-900 shadow-inner"
                        >
                            <div class="text-center">
                                <span
                                    class="block text-[10px] font-black text-slate-600 uppercase tracking-tighter mb-0.5"
                                    >Distance</span
                                ><span
                                    class="font-bold text-xs tracking-tighter tabular-nums"
                                    >{planTotalMiles.toFixed(1)} MI</span
                                >
                            </div>
                            <div
                                class="text-center border-x border-slate-200/60"
                            >
                                <span
                                    class="block text-[10px] font-black text-slate-600 uppercase tracking-tighter mb-0.5"
                                    >Gain</span
                                ><span
                                    class="font-bold text-xs tracking-tighter tabular-nums"
                                    >+3,508 FT</span
                                >
                            </div>
                            <div class="text-center">
                                <span
                                    class="block text-[10px] font-black text-slate-600 uppercase tracking-tighter mb-0.5"
                                    >Plan Avg Speed</span
                                >
                                <span
                                    class="block font-bold text-xs tracking-tighter tabular-nums"
                                    >{planAvgSpeedMidLabel}</span
                                >
                            </div>
                        </div>
                    </div>

                    <div class="space-y-1.5">
                        <div class="flex items-center px-1.5">
                            <span
                                class="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600"
                                >Daily Stages</span
                            >
                        </div>
                        {#each itinerary as stage, i}
                            {@const skinnyStage = isSkinnyPlanStage(stage)}
                            <div in:fade={{ delay: i * STAGGER_DELAY }}>
                                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                                <div
                                    role={skinnyStage ? undefined : "button"}
                                    tabindex={skinnyStage ? -1 : 0}
                                    onclick={() => {
                                        if (!skinnyStage) toggleStage(stage.id);
                                    }}
                                    onkeydown={(e) => {
                                        if (e.key === "Enter" && !skinnyStage)
                                            toggleStage(stage.id);
                                    }}
                                    class="ds-panel w-full text-left rounded-lg border transition-all {skinnyStage
                                        ? 'p-2.5 md:p-3'
                                        : 'p-3 active:scale-[0.98]'} {selectedStageId ===
                                        stage.id && !skinnyStage
                                        ? 'bg-white/5 border-blue-500/30 shadow-glow'
                                        : 'bg-transparent border-transparent hover:bg-slate-100/50'}"
                                >
                                    <div
                                        class="flex gap-2.5 items-start pointer-events-none"
                                    >
                                        <div
                                            class="shrink-0 {skinnyStage
                                                ? 'min-w-[56px]'
                                                : 'min-w-[52px]'} rounded-md border border-slate-200/60 bg-slate-50/50 px-2 py-1.5 text-center"
                                        >
                                            <span
                                                class="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-600"
                                                >Day {stage.id}</span
                                            >
                                            <span
                                                class="block text-[10px] font-black text-slate-900 mt-0.5"
                                                >{stage.date}</span
                                            >
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <h3
                                                class="text-[13px] font-bold text-slate-900 tracking-tight leading-tight text-pretty"
                                            >
                                                {stage.from} → {stage.to}
                                            </h3>
                                            <div
                                                class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600"
                                            >
                                                {#if skinnyStage}
                                                    {#if stage.planCardNote}
                                                        <span
                                                            class="rounded-sm border border-blue-500/25 px-1.5 py-0.5 bg-blue-500/10 text-blue-300 tracking-[0.08em]"
                                                            >{stage.planCardNote}</span
                                                        >
                                                    {/if}
                                                {:else}
                                                    <span
                                                        class="rounded-sm border border-slate-200/60 px-1.5 py-0.5 bg-slate-50/50"
                                                        >{stage.difficulty}</span
                                                    >
                                                {/if}
                                            </div>
                                        </div>
                                        <i
                                            class={`hn ${stage.mithraicIconClass} stage-mithraic-icon`}
                                            aria-label={`${stage.mithraicGrade} icon`}
                                        ></i>
                                    </div>
                                    {#if !skinnyStage}
                                        <div
                                            class="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1 text-[9px] uppercase tracking-[0.1em] font-bold tabular-nums pointer-events-none"
                                        >
                                            <span
                                                class="rounded-sm border border-slate-200/60 bg-slate-50/50 px-1.5 py-1 text-slate-800 text-center leading-tight"
                                            >
                                                <span
                                                    class="block text-[10px] tracking-[0.12em]"
                                                    >TIME</span
                                                >
                                                <span
                                                    class="block text-[10px] tabular-nums"
                                                    >{stage.timeHours[0]}-{stage
                                                        .timeHours[1]}H</span
                                                >
                                            </span>
                                            <span
                                                class="rounded-sm border border-blue-500/20 bg-blue-500/10 px-1.5 py-1 text-blue-600 text-center leading-tight"
                                                >{stage.distanceMi} mi</span
                                            >
                                            <span
                                                class="rounded-sm border border-slate-200/60 bg-slate-50/50 px-1.5 py-1 text-slate-800 text-center leading-tight"
                                                >+{stage.elevationGainFt} ft</span
                                            >
                                            <span
                                                class="rounded-sm border border-slate-200/60 bg-slate-50/50 px-1.5 py-1 text-center leading-tight {stage.supplyStatus ===
                                                'Critical'
                                                    ? 'text-orange-600'
                                                    : stage.supplyStatus ===
                                                        'Low'
                                                      ? 'text-amber-600'
                                                      : 'text-emerald-600'}"
                                                >{stage.supplyStatus}</span
                                            >
                                        </div>
                                    {/if}

                                    {#if !skinnyStage && selectedStageId === stage.id}
                                        <div
                                            class="mt-4 pt-4 border-t border-slate-200/60 space-y-4"
                                            transition:slide
                                            role="presentation"
                                            onclick={(e) => e.stopPropagation()}
                                            onkeydown={(e) =>
                                                e.key === "Enter" &&
                                                e.stopPropagation()}
                                        >
                                            <div class="grid grid-cols-2 gap-2">
                                                <div
                                                    class="bg-slate-50/50 p-2.5 rounded-md border border-slate-200/60"
                                                >
                                                    <span
                                                        class="block text-[10px] font-black text-slate-600 uppercase tracking-tighter mb-0.5 text-nowrap"
                                                        >Surface</span
                                                    ><span
                                                        class="text-[11px] font-bold text-slate-800 block text-pretty"
                                                        >{stage.surface}</span
                                                    >
                                                </div>
                                                <div
                                                    class="bg-slate-50/50 p-2.5 rounded-md border border-slate-200/60"
                                                >
                                                    <span
                                                        class="block text-[10px] font-black text-slate-600 uppercase tracking-tighter mb-0.5 text-nowrap"
                                                        >Terrain</span
                                                    ><span
                                                        class="text-[11px] font-bold text-slate-800 leading-snug block text-pretty"
                                                        >{stage.terrain}</span
                                                    >
                                                </div>
                                            </div>

                                            <div
                                                class="rounded-md border border-slate-200/60 bg-slate-50/50 px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500"
                                            >
                                                <span class="text-slate-600"
                                                    >Supplies:</span
                                                >
                                                <span
                                                    class="ml-1 {stage.supplyStatus ===
                                                    'Critical'
                                                        ? 'text-orange-600'
                                                        : stage.supplyStatus ===
                                                            'Low'
                                                          ? 'text-amber-600'
                                                          : 'text-emerald-600'}"
                                                    >{stage.supplyStatus}</span
                                                >
                                            </div>

                                            <div
                                                class="bg-slate-50/50 p-3 rounded-md border border-slate-200/60 space-y-3"
                                            >
                                                <button
                                                    onclick={(e) => {
                                                        e.stopPropagation();
                                                        toggleMilestones(
                                                            stage.id,
                                                        );
                                                    }}
                                                    class="w-full flex items-center justify-between group"
                                                >
                                                    <span
                                                        class="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 group-hover:text-blue-600 transition-colors"
                                                        >Trail Milestones ({stage
                                                            .milestones
                                                            .length})</span
                                                    >
                                                    <div
                                                        class="text-slate-600 transition-transform {expandedMilestoneStages.has(
                                                            stage.id,
                                                        )
                                                            ? ''
                                                            : '-rotate-90'}"
                                                    >
                                                        {@html icons.caret}
                                                    </div>
                                                </button>

                                                {#if expandedMilestoneStages.has(stage.id)}
                                                    <div
                                                        class="space-y-3"
                                                        transition:slide
                                                    >
                                                        {#each stage.milestones as ms}
                                                            <div
                                                                class="flex items-start gap-3 border-l border-slate-200/80 pl-3 relative group/ms"
                                                            >
                                                                <div
                                                                    class="absolute -left-[3px] top-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                                                                ></div>
                                                                <div
                                                                    class="flex-1 min-w-0"
                                                                >
                                                                    <div
                                                                        class="flex justify-between items-start gap-2 mb-1"
                                                                    >
                                                                        <span
                                                                            class="flex-1 min-w-0 text-[11px] font-black uppercase tracking-tighter text-slate-900 text-pretty"
                                                                            >{ms.name}</span
                                                                        >
                                                                        <div
                                                                            class="flex items-center gap-2"
                                                                        >
                                                                            <span
                                                                                class="text-[10px] font-mono text-blue-600 tabular-nums text-nowrap"
                                                                                >{new Date(
                                                                                    new Date(
                                                                                        "2026-04-13T09:00:00",
                                                                                    ).getTime() +
                                                                                        (ms.mi /
                                                                                            2.8) *
                                                                                            3600000,
                                                                                ).toLocaleTimeString(
                                                                                    [],
                                                                                    {
                                                                                        hour: "2-digit",
                                                                                        minute: "2-digit",
                                                                                    },
                                                                                )}</span
                                                                            >
                                                                            <button
                                                                                onclick={(
                                                                                    e,
                                                                                ) => {
                                                                                    e.stopPropagation();
                                                                                    flyToMilestone(
                                                                                        stage,
                                                                                        ms,
                                                                                    );
                                                                                }}
                                                                                class="p-1 hover:bg-white/10 rounded transition-colors opacity-0 group-hover/ms:opacity-100"
                                                                                >{@html icons.arrowRight}</button
                                                                            >
                                                                        </div>
                                                                    </div>
                                                                    <p
                                                                        class="text-[11px] text-slate-600 leading-snug italic"
                                                                    >
                                                                        "{ms.intel}"
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        {/each}
                                                    </div>
                                                {/if}
                                            </div>

                                            <div
                                                class="bg-white/5 p-3 rounded-md border border-slate-200/60"
                                            >
                                                <span
                                                    class="block text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2"
                                                    >Food + Logistics Notes</span
                                                >
                                                <ul class="space-y-1.5">
                                                    {#each stage.fuelingLogistics as item}
                                                        <li
                                                            class="flex items-start gap-2 text-[11px] text-slate-500 leading-snug"
                                                        >
                                                            <div
                                                                class="mt-1.5 w-1 h-1 rounded-full bg-slate-600 shrink-0"
                                                            ></div>
                                                            <span
                                                                class="text-pretty"
                                                                >{item}</span
                                                            >
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
                <div
                    class="p-4 md:p-5 space-y-4 md:space-y-5 flex flex-col h-full min-h-0 overflow-hidden"
                    in:fly={{ x: 20, duration: 300 }}
                >
                    <button
                        onclick={() => (selectedPOI = null)}
                        class="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-600 hover:text-blue-600 transition-colors tracking-[0.2em] active:scale-95"
                        >{@html icons.arrowLeft} Back to Registry</button
                    >

                    <div class="space-y-3 md:space-y-4">
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex flex-col gap-1.5">
                                <h2
                                    class="text-xl font-bold text-slate-900 leading-tight tracking-tight text-balance"
                                >
                                    {selectedPOI.title || selectedPOI.name}
                                </h2>
                                {#if (selectedPOI as any).types}
                                    <div class="flex gap-1.5">
                                        {#each (selectedPOI as any).types as type}
                                            <span
                                                class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm {type ===
                                                'hub'
                                                    ? 'bg-blue-500/20 text-blue-600 border border-blue-500/20'
                                                    : type === 'heritage'
                                                      ? 'bg-slate-500/20 text-slate-500 border border-slate-500/20'
                                                      : 'bg-amber-500/20 text-amber-600 border border-amber-500/20'}"
                                                >{type}</span
                                            >
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                            {#if selectedPOI.special === "mithras"}<div
                                    class="text-amber-600 shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                                >
                                    {@html icons.star}
                                </div>{/if}
                        </div>

                        <div class="flex flex-wrap gap-2 pt-2">
                            {#if selectedPOI.url && selectedPOI.url !== "#"}
                                <a
                                    href={selectedPOI.url}
                                    target="_blank"
                                    class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200/60 rounded-md font-black text-[10px] uppercase tracking-widest transition-all shadow-sm"
                                    >Wikipedia</a
                                >
                            {/if}
                            <button
                                onclick={() => {
                                    mapComponent?.flyToPOI(selectedPOI);
                                    if (isMobile) isSidebarOpen = false;
                                }}
                                class="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-black text-[10px] uppercase tracking-widest transition-all shadow-glow flex items-center gap-2"
                                >Take me there {@html icons.arrowRight}</button
                            >
                        </div>
                    </div>

                    <div
                        class="flex-1 min-h-0 overflow-y-auto pr-1 md:pr-2 custom-scrollbar space-y-4 md:space-y-5"
                    >
                        {#if selectedPOI.bourdainIntel}
                            <div
                                class="bg-amber-500/5 border border-amber-500/10 p-4 rounded-lg space-y-2.5"
                            >
                                <span
                                    class="text-[10px] font-black uppercase text-amber-600 tracking-[0.15em] flex items-center gap-2"
                                    >Bourdain's Intel</span
                                >
                                <p
                                    class="text-[13px] font-medium text-amber-900/80 leading-relaxed italic text-pretty"
                                >
                                    "{selectedPOI.bourdainIntel}"
                                </p>
                            </div>
                        {/if}

                        {#if selectedPOI.fryeIntel}
                            <div
                                class="bg-white/5 border border-slate-200/60 p-4 rounded-lg space-y-2.5"
                            >
                                <span
                                    class="text-[10px] font-black uppercase text-slate-800 tracking-[0.15em] flex items-center gap-2"
                                    >Frye's Perspective</span
                                >
                                <p
                                    class="text-[13px] font-medium text-slate-700 leading-relaxed italic text-pretty"
                                >
                                    "{selectedPOI.fryeIntel}"
                                </p>
                            </div>
                        {/if}

                        {#if selectedPOI.rickStevesIntel}
                            <div
                                class="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-lg space-y-2.5"
                            >
                                <span
                                    class="text-[10px] font-black uppercase text-emerald-600 tracking-[0.15em] flex items-center gap-2"
                                    >Rick Steves' Advice</span
                                >
                                <p
                                    class="text-[13px] font-medium text-emerald-900/80 leading-relaxed italic text-pretty"
                                >
                                    "{selectedPOI.rickStevesIntel}"
                                </p>
                            </div>
                        {/if}

                        {#if selectedPOI.photoIntel}
                            <div
                                class="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-lg space-y-2.5"
                            >
                                <span
                                    class="text-[10px] font-black uppercase text-indigo-600 tracking-[0.15em] flex items-center gap-2"
                                    >{@html icons.camera} Photography Tips</span
                                >
                                <p
                                    class="text-[13px] font-medium text-indigo-900/80 leading-relaxed italic text-pretty"
                                >
                                    "{selectedPOI.photoIntel}"
                                </p>
                            </div>
                        {/if}

                        <div
                            class="font-serif italic text-[15px] text-slate-500 leading-relaxed border-t border-slate-200/60 pt-6 text-pretty"
                        >
                            "{selectedPOI.summary ||
                                "Extracting archaeological data..."}"
                        </div>
                    </div>
                </div>
            {:else}
                <div class="p-4 space-y-6" in:fade>
                    <div class="flex flex-col gap-4">
                        <div class="relative group">
                            <div
                                class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-600 group-focus-within:text-blue-600 transition-colors"
                            >
                                {@html icons.search}
                            </div>
                            <input
                                type="text"
                                bind:this={searchInput}
                                bind:value={searchQuery}
                                placeholder="Search places by name..."
                                class="ds-input w-full bg-slate-50/50 border border-slate-200/60 rounded-lg py-2.5 pl-9 pr-4 text-[12px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-white/5 transition-all shadow-inner placeholder:text-slate-600"
                            />
                        </div>

                        <div class="grid grid-cols-3 gap-1.5 pb-1">
                            <button
                                onclick={() =>
                                    (activeCategories.heritage =
                                        !activeCategories.heritage)}
                                class="ds-chip w-full min-w-0 px-1.5 py-1.5 rounded-md border text-[9px] md:text-[10px] font-black uppercase tracking-[0.08em] transition-all {activeCategories.heritage
                                    ? 'ds-chip-active bg-slate-700 border-slate-600 text-white shadow-sm'
                                    : 'bg-slate-50/50 border-slate-200/60 text-slate-600'} flex items-center justify-center gap-1 text-nowrap"
                                >Heritage <span class="tabular-nums"
                                    >{visibleHeritageSites.length}</span
                                >{#if activeCategories.heritage}
                                    {@html icons.check}
                                {/if}</button
                            >
                            <button
                                onclick={() =>
                                    (activeCategories.pubs =
                                        !activeCategories.pubs)}
                                class="ds-chip w-full min-w-0 px-1.5 py-1.5 rounded-md border text-[9px] md:text-[10px] font-black uppercase tracking-[0.08em] transition-all {activeCategories.pubs
                                    ? 'ds-chip-active bg-amber-600 border-amber-500 text-white shadow-sm'
                                    : 'bg-slate-50/50 border-slate-200/60 text-slate-600'} flex items-center justify-center gap-1 text-nowrap"
                                >Pints & Eats <span class="tabular-nums"
                                    >{visibleHospitalitySites.length}</span
                                >{#if activeCategories.pubs}
                                    {@html icons.check}
                                {/if}</button
                            >
                            <button
                                onclick={() =>
                                    (activeCategories.discovery =
                                        !activeCategories.discovery)}
                                class="ds-chip w-full min-w-0 px-1.5 py-1.5 rounded-md border text-[9px] md:text-[10px] font-black uppercase tracking-[0.08em] transition-all {activeCategories.discovery
                                    ? 'ds-chip-active bg-blue-600 border-blue-500 text-white shadow-sm'
                                    : 'bg-slate-50/50 border-slate-200/60 text-slate-600'} flex items-center justify-center gap-1 text-nowrap"
                                >Discovery <span class="tabular-nums"
                                    >{visibleDiscoveryPOIs.length}</span
                                >{#if activeCategories.discovery}
                                    {@html icons.check}
                                {/if}</button
                            >
                        </div>

                        <div
                            class="ds-panel rounded-lg border border-slate-200/60 bg-slate-50/50 p-2.5 space-y-2"
                        >
                            <div
                                class="flex flex-wrap items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-[0.12em]"
                            >
                                <span class="text-slate-600 text-pretty"
                                    >{activeRegistryResultCount} visible result{activeRegistryResultCount ===
                                    1
                                        ? ""
                                        : "s"}</span
                                >
                                <div
                                    class="flex flex-wrap items-center gap-2 md:flex-nowrap"
                                >
                                    <span
                                        class="text-slate-600 text-pretty md:text-nowrap"
                                        >{activeExploreCategoryCount}/3 filters
                                        active</span
                                    >
                                    {#if searchNeedle || activeExploreCategoryCount < 3}
                                        <button
                                            onclick={resetExploreFilters}
                                            class="rounded-sm border border-slate-200/80 px-2 py-1 text-slate-500 hover:text-blue-600 hover:border-blue-500/30 transition-colors"
                                            >Reset</button
                                        >
                                    {/if}
                                </div>
                            </div>
                        </div>
                    </div>

                    {#if activeRegistryResultCount === 0}
                        <div
                            class="rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-3 text-[10px] uppercase tracking-[0.14em] text-slate-600 font-bold"
                        >
                            No matches for current filters. Reset or broaden
                            your search.
                        </div>
                    {/if}

                    <div class="space-y-6">
                        {#if activeCategories.heritage}
                            <section class="space-y-3">
                                <button
                                    onclick={() =>
                                        (expandedSections.heritage =
                                            !expandedSections.heritage)}
                                    class="w-full flex items-center justify-between px-1 group"
                                >
                                    <span
                                        class="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] group-hover:text-slate-800 transition-colors"
                                        >English Heritage</span
                                    >
                                    <div class="flex items-center gap-2">
                                        <span
                                            class="text-[9px] font-black text-slate-600"
                                            >{visibleHeritageSites.length}</span
                                        >
                                        <div
                                            class="text-slate-600 transition-transform {expandedSections.heritage
                                                ? ''
                                                : '-rotate-90'}"
                                        >
                                            {@html icons.caret}
                                        </div>
                                    </div>
                                </button>
                                <p
                                    class="px-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 text-pretty"
                                >
                                    Forts, museums, and archaeological landmarks
                                </p>
                                {#if expandedSections.heritage}
                                    <div
                                        class="grid grid-cols-1 bg-slate-50/50 border border-slate-200/60 rounded-lg divide-y divide-white/5 shadow-sm overflow-hidden"
                                        transition:slide
                                    >
                                        {#if visibleHeritageSites.length === 0}
                                            <div
                                                class="p-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600"
                                            >
                                                No heritage matches.
                                            </div>
                                        {/if}
                                        {#each visibleHeritageSites as site}
                                            <button
                                                class="w-full text-left p-3 hover:bg-slate-100/50 transition-colors group flex flex-col gap-1 relative"
                                                onclick={() =>
                                                    handlePOIClick(site)}
                                            >
                                                <div
                                                    class="flex items-center gap-3"
                                                >
                                                    <div
                                                        class="w-7 h-7 rounded-md bg-blue-950 border border-blue-300/45 flex items-center justify-center text-blue-100 shadow-[0_0_12px_rgba(59,130,246,0.24)] shrink-0 group-hover:scale-110 group-hover:bg-blue-900 group-hover:text-white transition-all"
                                                    >
                                                        <span
                                                            class="scale-110 leading-none"
                                                            >{@html icons.landmark}</span
                                                        >
                                                    </div>
                                                    <div
                                                        class="flex-1 min-w-0 flex items-center gap-2"
                                                    >
                                                        <span
                                                            class="flex-1 min-w-0 font-bold text-slate-800 group-hover:text-blue-600 tracking-tight text-pretty leading-tight"
                                                            >{site.name}</span
                                                        >
                                                        {#if site.special === "mithras"}<div
                                                                class="text-amber-600 animate-pulse"
                                                            >
                                                                {@html icons.star}
                                                            </div>{/if}
                                                    </div>
                                                </div>
                                                {#if selectedPOI && (selectedPOI as any).name === site.name}
                                                    <div
                                                        class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-glow"
                                                    ></div>
                                                {/if}
                                            </button>
                                        {/each}
                                    </div>
                                {/if}
                            </section>
                        {/if}

                        {#if activeCategories.pubs}
                            <section class="space-y-3">
                                <button
                                    onclick={() =>
                                        (expandedSections.hospitality =
                                            !expandedSections.hospitality)}
                                    class="w-full flex items-center justify-between px-1 group"
                                >
                                    <span
                                        class="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] group-hover:text-slate-800 transition-colors"
                                        >Food + Pubs</span
                                    >
                                    <div class="flex items-center gap-2">
                                        <span
                                            class="text-[9px] font-black text-slate-600"
                                            >{visibleHospitalitySites.length}</span
                                        >
                                        <div
                                            class="text-slate-600 transition-transform {expandedSections.hospitality
                                                ? ''
                                                : '-rotate-90'}"
                                        >
                                            {@html icons.caret}
                                        </div>
                                    </div>
                                </button>
                                <p
                                    class="px-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 text-pretty"
                                >
                                    Fuel stops, cafés, and inns on route
                                </p>
                                {#if expandedSections.hospitality}
                                    <div
                                        class="grid grid-cols-1 bg-slate-50/50 border border-slate-200/60 rounded-lg divide-y divide-white/5 shadow-sm overflow-hidden"
                                        transition:slide
                                    >
                                        {#if visibleHospitalitySites.length === 0}
                                            <div
                                                class="p-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600"
                                            >
                                                No food + pub matches.
                                            </div>
                                        {/if}
                                        {#each visibleHospitalitySites as site}
                                            <button
                                                class="w-full text-left p-3 hover:bg-slate-100/50 transition-colors group flex items-center gap-3 relative"
                                                onclick={() =>
                                                    handlePOIClick(site)}
                                            >
                                                <div
                                                    class="w-7 h-7 rounded-md {site.category ===
                                                    'brewery'
                                                        ? 'bg-amber-600'
                                                        : 'bg-orange-700'} border border-slate-200/60 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform"
                                                >
                                                    {@html icons.beer}
                                                </div>
                                                <span
                                                    class="flex-1 min-w-0 font-bold text-slate-800 group-hover:text-blue-600 tracking-tight text-pretty leading-tight"
                                                    >{site.name}</span
                                                >
                                                {#if selectedPOI && (selectedPOI as any).name === site.name}
                                                    <div
                                                        class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-glow"
                                                    ></div>
                                                {/if}
                                            </button>
                                        {/each}
                                    </div>
                                {/if}
                            </section>
                        {/if}

                        {#if activeCategories.discovery}
                            <section class="space-y-3">
                                <button
                                    onclick={() =>
                                        (expandedSections.discovery =
                                            !expandedSections.discovery)}
                                    class="w-full flex items-center justify-between px-1 group"
                                >
                                    <span
                                        class="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] group-hover:text-slate-800 transition-colors"
                                        >Wikipedia Discovery</span
                                    >
                                    <div class="flex items-center gap-2">
                                        <span
                                            class="text-[9px] font-black text-slate-600"
                                            >{visibleDiscoveryPOIs.length}</span
                                        >
                                        <div
                                            class="text-slate-600 transition-transform {expandedSections.discovery
                                                ? ''
                                                : '-rotate-90'}"
                                        >
                                            {@html icons.caret}
                                        </div>
                                    </div>
                                </button>
                                <p
                                    class="px-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 text-pretty"
                                >
                                    Nearby entries from the live discovery feed
                                </p>
                                {#if expandedSections.discovery}
                                    <div class="space-y-1.5" transition:slide>
                                        {#if visibleDiscoveryPOIs.length === 0}
                                            <div
                                                class="rounded-lg border border-slate-200/60 bg-slate-50/50 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600"
                                            >
                                                No discovery matches.
                                            </div>
                                        {/if}
                                        {#each visibleDiscoveryPOIs as poi}
                                            <button
                                                class="w-full text-left p-3 bg-slate-50/50 hover:bg-slate-100/50 rounded-lg border border-slate-200/60 hover:border-blue-500/30 transition-all group flex items-center gap-3 relative active:scale-[0.98]"
                                                onclick={() =>
                                                    handlePOIClick(poi)}
                                            >
                                                <div
                                                    class="text-slate-600 group-hover:text-blue-600 shrink-0 transition-colors"
                                                >
                                                    {@html icons.discovery}
                                                </div>
                                                <div class="flex-1 min-w-0">
                                                    <div
                                                        class="flex justify-between items-start gap-2 mb-0.5"
                                                    >
                                                        <span
                                                            class="flex-1 min-w-0 font-bold text-slate-800 group-hover:text-blue-600 tracking-tight text-pretty"
                                                            >{poi.title}</span
                                                        >
                                                        <span
                                                            class="text-[9px] font-mono text-slate-600 tabular-nums text-nowrap"
                                                            >RANK {Math.round(
                                                                poi.rank,
                                                            )}</span
                                                        >
                                                    </div>
                                                    <div
                                                        class="w-full bg-white/5 h-1 rounded-full overflow-hidden"
                                                    >
                                                        <div
                                                            class="bg-blue-500/50 h-full transition-all duration-500"
                                                            style="width: {Math.min(
                                                                100,
                                                                poi.rank * 2,
                                                            )}%"
                                                        ></div>
                                                    </div>
                                                </div>
                                                {#if selectedPOI && (selectedPOI as any).pageid === poi.pageid}
                                                    <div
                                                        class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-glow"
                                                    ></div>
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
        {#if !selectedPOI}
            <footer
                class="p-4 bg-slate-50/50 border-t border-slate-200/60 text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] text-center"
            >
                FELICITAS TEMPORVM
            </footer>
        {/if}
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
                onInteraction={wakeCoins}
            />
        </div>

        {#if hikerIntelCard}
            <div
                class="absolute inset-0 z-[65] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            >
                <div
                    class="w-full max-w-md rounded-2xl border border-amber-300/30 bg-slate-900/95 p-5 shadow-2xl"
                >
                    <div class="mb-3 flex items-start justify-between gap-4">
                        <div>
                            <p
                                class="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300"
                            >
                                Intel Card
                            </p>
                            <h3 class="text-xl font-black text-white">
                                {hikerIntelCard.title || hikerIntelCard.name}
                            </h3>
                        </div>
                        <button
                            onclick={closeIntelCard}
                            class="rounded-md border border-white/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white hover:bg-white/10"
                            >Close</button
                        >
                    </div>
                    <p class="text-sm leading-relaxed text-slate-300">
                        {hikerIntelCard.summary ||
                            hikerIntelCard.intel ||
                            "No field notes cached for this waypoint yet."}
                    </p>
                </div>
            </div>
        {/if}
        <div
            class="crt-map-controls {isMobile
                ? 'absolute bottom-32 right-4 flex flex-col items-end gap-3 z-30'
                : 'absolute top-4 right-4 z-30 flex flex-col items-end gap-2'}"
        >
            <!-- Navigation Instruments -->
            <div
                class="ds-control-pack flex bg-white/95 border border-slate-200 shadow-2xl overflow-hidden rounded-lg"
                style="-webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);"
            >
                <button
                    onclick={() => mapComponent?.triggerLocateMe()}
                    class="ds-control-btn {isMobile
                        ? 'p-2.5'
                        : 'p-1.5'} text-slate-600 active:text-blue-600 border-r border-slate-100 transition-all"
                    title="Show My Location">{@html icons.locate}</button
                >
                <button
                    onclick={() => (isHeadingUp = !isHeadingUp)}
                    disabled={$hikerMode.simplifiedHUD}
                    class="ds-control-btn {isMobile
                        ? 'px-3 py-2 text-[10px]'
                        : 'px-2 py-1.5 text-[10px]'} font-black uppercase transition-all {isHeadingUp
                        ? 'ds-control-btn-active bg-blue-600 text-white'
                        : 'text-slate-600 active:bg-slate-50'} {$hikerMode.simplifiedHUD
                        ? 'opacity-40 cursor-not-allowed'
                        : ''}"
                    title="Toggle Heading Up Mode"
                >
                    {$hikerMode.simplifiedHUD
                        ? "North"
                        : isHeadingUp
                          ? "Heading"
                          : "North"}
                </button>
                <button
                    onclick={() => (showMilestones = !showMilestones)}
                    class="ds-control-btn {isMobile
                        ? 'px-3 py-2 text-[10px]'
                        : 'px-2 py-1.5 text-[10px]'} font-black uppercase transition-all {showMilestones
                        ? 'ds-control-btn-active bg-amber-600 text-white'
                        : 'text-slate-600 active:bg-slate-50'} border-l border-slate-100"
                    title="Toggle Milestones Layer"
                >
                    Logistics
                </button>
            </div>

            <!-- Route Switcher -->
            <div
                class="ds-control-pack flex bg-white/95 border border-slate-200 shadow-2xl overflow-hidden rounded-lg"
                style="-webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);"
            >
                <button
                    onclick={() => (selectedRoute = "osm")}
                    class="ds-control-btn {isMobile
                        ? 'px-3 py-2 text-[10px]'
                        : 'px-2 py-1.5 text-[10px]'} font-black uppercase transition-all {selectedRoute ===
                    'osm'
                        ? 'ds-control-btn-active bg-blue-600 text-white'
                        : 'text-slate-600 active:bg-slate-50'}"
                    title="High-Res OSM Footpath">Footpath</button
                >
                <button
                    onclick={() => (selectedRoute = "simplified")}
                    class="ds-control-btn {isMobile
                        ? 'px-3 py-2 text-[10px]'
                        : 'px-2 py-1.5 text-[10px]'} font-black uppercase transition-all {selectedRoute ===
                    'simplified'
                        ? 'ds-control-btn-active bg-blue-600 text-white'
                        : 'text-slate-600 active:bg-slate-50'} border-l border-slate-100"
                    title="Decimated OSM">Simple</button
                >
            </div>

            <!-- Style Switcher -->
            <div
                class="ds-control-pack flex bg-white/95 border border-slate-200 shadow-2xl overflow-hidden rounded-lg"
                style="-webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);"
            >
                                <button
                                    onclick={() => (mapStyle = "topo")}
                                    class="ds-control-btn {isPortable
                                        ? 'px-3 py-2 text-[10px]'
                                        : 'px-2.5 py-1.5 text-[9px]'} font-black uppercase transition-all {mapStyle ===
                                    'topo'
                                        ? 'ds-control-btn-active bg-slate-900 text-white'
                                        : 'text-slate-600 active:bg-slate-50'}"
                                    >Topo</button
                                >
                
                <button
                    onclick={() => (mapStyle = "satellite")}
                    class="ds-control-btn {isPortable
                        ? 'px-3 py-2 text-[10px]'
                        : 'px-2.5 py-1.5 text-[9px]'} font-black uppercase transition-all {mapStyle ===
                    'satellite'
                        ? 'ds-control-btn-active bg-slate-900 text-white'
                        : 'text-slate-600 active:bg-slate-50'} border-x border-slate-100"
                    >Sat</button
                >
                <button
                    onclick={() => (mapStyle = "streets")}
                    class="ds-control-btn {isPortable
                        ? 'px-3 py-2 text-[10px]'
                        : 'px-2.5 py-1.5 text-[9px]'} font-black uppercase transition-all {mapStyle ===
                    'streets'
                        ? 'ds-control-btn-active bg-slate-900 text-white'
                        : 'text-slate-600 active:bg-slate-50'}">Roads</button
                >
            </div>

            {#if !isPortable}
                <button
                    class="ds-control-fab p-3 rounded-md bg-white/95 border border-slate-200 shadow-2xl active:scale-90 transition-all text-slate-900 active:text-blue-600 flex items-center justify-center"
                    style="-webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);"
                    onclick={toggleSearch}
                    title="Search Registry">{@html icons.search}</button
                >
            {/if}
        </div>
    </main>

    <!-- Absolute Bottom Tab Bar (Mobile/Tablet) - using absolute instead of fixed to align with h-dvh container -->
    {#if isPortable}
        <nav
            class="crt-mobile-nav crt-shell absolute bottom-0 inset-x-0 z-50 h-[calc(65px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-white/98 backdrop-blur-xl border-t border-slate-200 overflow-hidden transition-transform duration-300 {selectedPOI
                ? 'translate-y-full'
                : ''}"
            style="-webkit-backdrop-filter: blur(20px);"
        >
        >
            <div class="flex items-center justify-around h-16">
                <button
                    onclick={() => {
                        mode = "plan";
                        isSidebarOpen = true;
                        selectedPOI = null;
                    }}
                    class="flex flex-col items-center gap-1 flex-1 {mode ===
                        'plan' && isSidebarOpen
                        ? 'text-blue-600'
                        : 'text-slate-600'}"
                >
                    <div class="p-1">{@html icons.list}</div>
                    <span
                        class="text-[9px] font-black uppercase tracking-widest"
                        >Plan</span
                    >
                </button>
                <button
                    onclick={() => {
                        mode = "explore";
                        isSidebarOpen = true;
                        selectedPOI = null;
                    }}
                    class="flex flex-col items-center gap-1 flex-1 {mode ===
                        'explore' && isSidebarOpen
                        ? 'text-blue-600'
                        : 'text-slate-600'}"
                >
                    <div class="p-1">{@html icons.compass}</div>
                    <span
                        class="text-[9px] font-black uppercase tracking-widest"
                        >Explore</span
                    >
                </button>
                <button
                    onclick={() => (isSidebarOpen = false)}
                    class="flex flex-col items-center gap-1 flex-1 {!isSidebarOpen
                        ? 'text-blue-600'
                        : 'text-slate-600'}"
                >
                    <div class="p-1">{@html icons.map}</div>
                    <span
                        class="text-[9px] font-black uppercase tracking-widest"
                        >Map</span
                    >
                </button>
            </div>
        </nav>
    {/if}
</div>

<style>
    :global(.custom-scrollbar::-webkit-scrollbar) {
        width: 4px;
    }
    :global(.custom-scrollbar::-webkit-scrollbar-track) {
        background: transparent;
    }
    :global(.custom-scrollbar::-webkit-scrollbar-thumb) {
        background: oklch(0.53 0.19 215 / 0.48);
        border-radius: 10px;
    }
    :global(.custom-scrollbar::-webkit-scrollbar-thumb:hover) {
        background: oklch(0.66 0.22 215 / 0.72);
    }
    :global(.scrollbar-hide::-webkit-scrollbar) {
        display: none;
    }

    .splash-screen {
        animation: splash-fade-in var(--motion-duration-ui)
            var(--motion-ease-standard) both;
    }

    .splash-image {
        transform-origin: 50% 40%;
        animation: splash-ken-burns var(--motion-duration-nav)
            var(--motion-ease-emphasized) both;
        will-change: transform, opacity;
    }

    .splash-headline {
        animation: splash-rise var(--motion-duration-panel)
            var(--motion-ease-standard) 50ms both;
    }

    .splash-subline {
        animation: splash-rise var(--motion-duration-panel)
            var(--motion-ease-standard) 110ms both;
    }

    .splash-progress {
        transform-origin: 0 50%;
        animation: splash-progress 720ms var(--motion-ease-emphasized) 120ms
            both;
        will-change: transform, opacity;
    }

    .crt-workstation {
        background: linear-gradient(180deg, var(--bg), var(--n50));
        color: var(--text-primary);
    }

    .crt-mobile-header,
    .crt-mobile-nav {
        border-color: var(--stroke-default);
        background: linear-gradient(
            180deg,
            var(--surface-raised),
            var(--surface)
        );
        box-shadow: var(--shadow-sm);
    }

    .crt-mobile-header h1,
    .crt-sidebar h1,
    .crt-sidebar h2 {
        color: var(--text-primary);
        text-shadow: none;
    }

    .crt-sidebar {
        color: var(--text-primary);
        border-color: var(--stroke-default);
        box-shadow: var(--shadow-lg);
    }

    .crt-sidebar > * {
        position: relative;
        z-index: 1;
    }

    .crt-sidebar header,
    .crt-sidebar footer {
        border-color: var(--stroke-default);
        background: color-mix(
            in oklab,
            var(--surface-raised) 84%,
            var(--action-primary-tint) 16%
        );
    }

    .crt-sidebar .bg-inset {
        background: var(--surface) !important;
        border-color: var(--stroke-subtle) !important;
        box-shadow: inset 0 0 0 1px
            color-mix(
                in oklab,
                var(--action-primary-border) 28%,
                var(--stroke-subtle) 72%
            );
    }

    .crt-sidebar .text-white,
    .crt-sidebar .text-slate-300,
    .crt-sidebar .text-slate-800 {
        color: var(--text-primary) !important;
    }

    .crt-sidebar .text-slate-500,
    .crt-sidebar .text-slate-600,
    .crt-sidebar .text-slate-600 {
        color: var(--text-secondary) !important;
    }

    .crt-sidebar .text-slate-700 {
        color: var(--text-muted) !important;
    }

    .crt-sidebar .text-blue-600,
    .crt-sidebar .text-amber-600,
    .crt-sidebar .text-amber-600 {
        color: var(--action-primary) !important;
        text-shadow: none;
    }

    .crt-sidebar .border-white\/5,
    .crt-sidebar .border-white\/10,
    .crt-sidebar .border-slate-500\/20,
    .crt-sidebar .border-blue-500\/20,
    .crt-sidebar .border-blue-500\/30,
    .crt-sidebar .border-amber-500\/20,
    .crt-sidebar .border-amber-500\/10,
    .crt-sidebar .border-emerald-500\/10,
    .crt-sidebar .border-indigo-500\/10 {
        border-color: var(--stroke-default) !important;
    }

    .crt-sidebar .divide-white\/5 > :not([hidden]) ~ :not([hidden]) {
        border-color: var(--stroke-subtle) !important;
    }

    .crt-sidebar .bg-white\/5,
    .crt-sidebar .bg-white\/10,
    .crt-sidebar .bg-slate-500\/20,
    .crt-sidebar .bg-amber-500\/20,
    .crt-sidebar .bg-amber-500\/5,
    .crt-sidebar .bg-emerald-500\/5,
    .crt-sidebar .bg-indigo-500\/5,
    .crt-sidebar .bg-blue-500\/20 {
        background: color-mix(
            in oklab,
            var(--surface) 84%,
            var(--action-primary-tint) 16%
        ) !important;
    }

    .crt-sidebar .bg-blue-600,
    .crt-sidebar .bg-slate-700,
    .crt-sidebar .bg-amber-600,
    .crt-sidebar .bg-orange-700 {
        background: var(--action-primary) !important;
        color: var(--n0) !important;
        border-color: var(--action-primary-border) !important;
        box-shadow: var(--shadow-sm);
    }

    .crt-sidebar .bg-blue-500\/50,
    .crt-sidebar .bg-blue-500 {
        background: var(--action-primary) !important;
    }

    .crt-sidebar .shadow-glow {
        box-shadow:
            0 0 0 1px
                color-mix(
                    in oklab,
                    var(--action-primary-border) 60%,
                    var(--stroke-default) 40%
                ),
            var(--shadow-sm);
    }

    .crt-sidebar .hover\:bg-white\/5:hover {
        background: var(--surface-hover) !important;
    }

    .crt-sidebar .hover\:text-slate-300:hover,
    .crt-sidebar .hover\:text-white:hover,
    .crt-sidebar .hover\:text-blue-600:hover {
        color: var(--text-primary) !important;
        text-shadow: none;
    }

    .crt-sidebar .hover\:border-blue-500\/30:hover {
        border-color: var(--action-primary-border) !important;
    }

    .crt-map-controls > div,
    .crt-map-controls > button {
        border-color: var(--stroke-default) !important;
        background: color-mix(
            in oklab,
            var(--surface-raised) 88%,
            var(--action-primary-tint) 12%
        ) !important;
        box-shadow: var(--shadow-md);
    }

    .crt-map-controls button {
        color: var(--text-secondary) !important;
        text-shadow: none;
    }

    .crt-map-controls .bg-blue-600,
    .crt-map-controls .bg-amber-600,
    .crt-map-controls .bg-slate-900 {
        background: var(--action-primary) !important;
        color: var(--n0) !important;
    }

    .crt-map-controls .border-slate-100,
    .crt-map-controls .border-slate-200 {
        border-color: var(--stroke-default) !important;
    }

    .crt-map-controls .text-slate-600,
    .crt-map-controls .text-slate-600,
    .crt-map-controls .text-slate-900 {
        color: var(--text-secondary) !important;
    }

    .crt-map-controls .active\:bg-slate-50:active {
        background: var(--surface-hover) !important;
    }

    .crt-mobile-nav .text-slate-600 {
        color: var(--icon-muted) !important;
    }

    .crt-mobile-nav .text-blue-600 {
        color: var(--action-primary) !important;
        text-shadow: none;
    }

    .stage-mithraic-icon {
        font-size: 1.05rem;
        color: var(--icon-default);
        opacity: 0.92;
    }

    @keyframes splash-fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
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
