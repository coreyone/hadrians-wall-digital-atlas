<script lang="ts">
    import { onMount } from 'svelte';
    import Map from '$lib/components/Map.svelte';
    import type { PageData } from './$types';
    import { fetchPageSummary } from '$lib/services/wikipedia';
    import { itinerary, englishHeritageSites, hospitalitySites, overnightStops } from '$lib/data/trail';
    import { fade, fly, slide } from 'svelte/transition';

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
        name?: string;
    }

    let isSidebarOpen = $state(true); 
    let selectedPOI = $state<POI | null>(null);
    let searchQuery = $state('');
    let isHeadingUp = $state(false);
    let mapComponent: any = $state();
    let isMobile = $state(false);
    
    type AppMode = 'plan' | 'explore';
    let mode = $state<AppMode>('plan');
    let selectedStageId = $state<number | null>(null);
    let mapStyle = $state('topo');
    let selectedRoute = $state('osm');
    let showMilestones = $state(true);
    let expandedMilestoneStages = $state(new Set<number>());

    onMount(() => {
        const mql = window.matchMedia('(max-width: 768px)');
        isMobile = mql.matches;
        mql.addEventListener('change', (e) => isMobile = e.matches);
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
        close: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>`
    };

    let filteredDiscovery = $derived(data.initialPOIs.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase())));
</script>

<svelte:head>
    <title>Hadrian Atlas</title>
</svelte:head>

<div class="flex h-screen w-full overflow-hidden bg-canvas text-slate-300 font-sans antialiased text-[13px] selection:bg-blue-500/30 relative">
    <!-- Mobile Backdrop: Closes sidebar when map strip is tapped -->
    {#if isMobile && isSidebarOpen}
        <button 
            onclick={() => isSidebarOpen = false} 
            class="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
            aria-label="Return to Map"
        ></button>
    {/if}

    <aside class="{isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-[calc(100%-64px)] md:w-[320px] bg-surface/95 backdrop-blur-2xl border-r border-white/5 transition-transform duration-300 md:relative md:translate-x-0 flex flex-col shadow-2xl">
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
                    <div class="flex gap-1">
                        <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        <div class="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                    </div>
                </div>
            </div>

            <div class="flex p-0.5 bg-inset rounded-lg border border-white/5">
                <button onclick={() => { mode = 'plan'; selectedPOI = null; }} class="flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all active:scale-95 {mode === 'plan' ? 'bg-white/10 shadow-sm text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}">Plan</button>
                <button onclick={() => mode = 'explore'} class="flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all active:scale-95 {mode === 'explore' ? 'bg-white/10 shadow-sm text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}">Explore</button>
            </div>
        </header>

        <div class="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth custom-scrollbar">
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
                                <button onclick={() => toggleStage(stage.id)} class="w-full text-left p-3 rounded-lg border transition-all active:scale-[0.98] {selectedStageId === stage.id ? 'bg-white/5 border-blue-500/30 shadow-glow' : 'bg-transparent border-transparent hover:bg-white/5'}">
                                    <div class="flex justify-between items-start mb-1.5">
                                        <div class="flex flex-col">
                                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{stage.romanDate}</span>
                                            <h3 class="text-[13px] font-bold text-white tracking-tight leading-tight">{stage.from} → {stage.to}</h3>
                                        </div>
                                        <div class="text-lg filter grayscale opacity-50">{stage.mithraicSymbol}</div>
                                    </div>
                                    <div class="flex gap-3 text-[10px] text-slate-400 uppercase tracking-tighter font-bold tabular-nums">
                                        <span class="flex items-center gap-1">{@html icons.clock} {stage.timeHours[0]}-{stage.timeHours[1]}h</span>
                                        <span class="flex items-center gap-1">{@html icons.mountain} +{stage.elevationGainFt}ft</span>
                                        <span class="flex items-center gap-1 text-blue-400">Grade: {Math.round(((i + 1) / 7) * 100)}%</span>
                                    </div>
                                    
                                    {#if selectedStageId === stage.id}
                                        <div class="mt-4 pt-4 border-t border-white/5 space-y-4" transition:slide>
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
                                </button>
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

                        <div class="font-serif italic text-[15px] text-slate-400 leading-relaxed border-t border-white/5 pt-6">"{selectedPOI.summary || "Extracting archaeological data..."}"</div>
                    </div>
                </div>
            {:else}
                <div class="p-4 space-y-6" in:fade>
                    <div class="flex flex-col gap-4">
                        <div class="relative group">
                            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">{@html icons.search}</div>
                            <input type="text" bind:value={searchQuery} placeholder="Search Registry..." class="w-full bg-inset border border-white/5 rounded-lg py-2.5 pl-9 pr-4 text-[12px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-white/5 transition-all shadow-inner placeholder:text-slate-600" />
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
            <Map bind:this={mapComponent} initialPOIs={data.initialPOIs} bind:selectedPOI {selectedStageId} {mapStyle} {selectedRoute} {isHeadingUp} {isMobile} {showMilestones} onPoiSelect={handlePOIClick} />
        </div>
        <div class="{isMobile ? 'absolute bottom-32 right-4 flex flex-col items-end gap-3 z-30' : 'absolute top-4 right-4 z-30 flex flex-col items-end gap-2'}">
            <!-- Navigation Instruments -->
            <div class="flex p-0.5 bg-white/95 backdrop-blur-xl rounded-[35%] border border-slate-200 shadow-2xl overflow-hidden">
                <button onclick={() => isHeadingUp = !isHeadingUp} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2 py-1.5 text-[8px]'} font-black uppercase transition-all {isHeadingUp ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}" title="Toggle Heading Up Mode">
                    {isHeadingUp ? 'Heading Up' : 'North Up'}
                </button>
                <button onclick={() => showMilestones = !showMilestones} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2 py-1.5 text-[8px]'} font-black uppercase transition-all {showMilestones ? 'bg-amber-600 text-white' : 'text-slate-500 hover:bg-slate-50'} border-l border-slate-100" title="Toggle Milestones Layer">
                    Milestones
                </button>
            </div>

            <!-- Route Switcher -->
            <div class="flex p-0.5 bg-white/95 backdrop-blur-xl rounded-[35%] border border-slate-200 shadow-2xl overflow-hidden">
                <button onclick={() => selectedRoute = 'osm'} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2 py-1.5 text-[8px]'} font-black uppercase transition-all {selectedRoute === 'osm' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}" title="High-Res OSM Footpath">Footpath</button>
                <button onclick={() => selectedRoute = 'simplified'} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2 py-1.5 text-[8px]'} font-black uppercase transition-all {selectedRoute === 'simplified' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'} border-l border-slate-100" title="Decimated OSM">Simple</button>
            </div>

            <!-- Style Switcher -->
            <div class="flex p-0.5 bg-white/95 backdrop-blur-xl rounded-[35%] border border-slate-200 shadow-2xl overflow-hidden">
                <button onclick={() => mapStyle = 'topo'} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2.5 py-1.5 text-[9px]'} font-black uppercase transition-all {mapStyle === 'topo' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}">Topo</button>
                <button onclick={() => mapStyle = 'satellite'} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2.5 py-1.5 text-[9px]'} font-black uppercase transition-all {mapStyle === 'satellite' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'} border-x border-slate-100">Sat</button>
                <button onclick={() => mapStyle = 'streets'} class="{isMobile ? 'px-3 py-2 text-[10px]' : 'px-2.5 py-1.5 text-[9px]'} font-black uppercase transition-all {mapStyle === 'streets' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}">Roads</button>
            </div>
            
            <button class="{isMobile ? 'p-4 rounded-[35%]' : 'p-3 rounded-md'} bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl active:scale-90 transition-all text-slate-900 hover:text-blue-600 flex items-center justify-center" onclick={() => isSidebarOpen = !isSidebarOpen} title="Toggle Sidebar">{@html icons.search}</button>
        </div>
    </main>
</div>

<style>
    :global(.custom-scrollbar::-webkit-scrollbar) { width: 4px; }
    :global(.custom-scrollbar::-webkit-scrollbar-track) { background: transparent; }
    :global(.custom-scrollbar::-webkit-scrollbar-thumb) { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
    :global(.custom-scrollbar::-webkit-scrollbar-thumb:hover) { background: rgba(255, 255, 255, 0.2); }
    :global(.scrollbar-hide::-webkit-scrollbar) { display: none; }
</style>
