<script lang="ts">
    import { onMount, tick } from 'svelte';
    import { hikerMode } from '$lib/stores/hikerMode';
    import { fly } from 'svelte/transition';

interface Props {
    onToggleSimplified?: () => void;
    onCoinTap?: () => void;
    hideTopCoin?: boolean;
    onTopCoinLayout?: (rect: DOMRect) => void;
}

let {
    onToggleSimplified,
    onCoinTap,
    hideTopCoin = false,
    onTopCoinLayout
}: Props = $props();

let topCoinButton = $state<HTMLButtonElement | null>(null);

function publishTopCoinLayout() {
    if (!topCoinButton || !onTopCoinLayout) return;
    onTopCoinLayout(topCoinButton.getBoundingClientRect());
}

onMount(() => {
    const handleResize = () => publishTopCoinLayout();
    void tick().then(() => publishTopCoinLayout());
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
    };
});

$effect(() => {
    hideTopCoin;
    onTopCoinLayout;
    void tick().then(() => publishTopCoinLayout());
});

    function weatherGlyph(condition: string) {
        const normalized = condition.toLowerCase();
        if (normalized.includes('rain') || normalized.includes('shower')) return '☔';
        if (normalized.includes('cloud') || normalized.includes('overcast')) return '☁';
        if (normalized.includes('wind')) return '🌀';
        return '☀';
    }

    function segments(totalMiles: number) {
        const count = Math.max(1, Math.round(totalMiles));
        return Array.from({ length: count }, (_, i) => i);
    }

    function progressPercent(progress: number, goal: number) {
        if (goal <= 0) return 0;
        return Math.max(0, Math.min(100, (progress / goal) * 100));
    }

</script>

<div class="fixed left-1/2 -translate-x-1/2 z-[60]" style="top: calc(env(safe-area-inset-top, 0px) + 0.75rem);" in:fly={{ y: -40, duration: 500 }}>
    <div class="relative flex h-18 w-18 items-center justify-center">
        <div class="absolute inset-0 rounded-full border border-amber-300/40 animate-[spin_12s_linear_infinite] transition-opacity duration-300 {hideTopCoin ? 'opacity-0' : 'opacity-100'}"></div>
        <div class="absolute inset-2 rounded-full border border-amber-100/40 border-dashed animate-[spin_18s_linear_infinite_reverse] transition-opacity duration-300 {hideTopCoin ? 'opacity-0' : 'opacity-100'}"></div>
        <button
            type="button"
            onclick={onCoinTap}
            bind:this={topCoinButton}
            class="relative flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/80 bg-slate-900/85 shadow-[0_0_20px_rgba(245,158,11,0.45)] transition-all duration-300 {hideTopCoin ? 'pointer-events-none scale-75 opacity-0' : 'scale-100 opacity-100'}"
            aria-label="Triple tap Roman Coin to exit Hiker Mode"
            title="Triple tap to exit Hiker Mode"
        >
            <img src="/logo-coin.png" alt="Roman Coin" class="h-8 w-8 object-contain" />
        </button>
    </div>
</div>

<div class="fixed bottom-6 inset-x-3 z-[60]" in:fly={{ y: 40, duration: 500, delay: 120 }}>
    <div class="rounded-2xl border border-white/15 p-3 shadow-2xl backdrop-blur-xl {$hikerMode.isDaytime ? 'bg-slate-900/82 text-white' : 'bg-slate-900/60 text-slate-100'} {$hikerMode.simplifiedHUD ? 'text-[15px]' : 'text-[13px]'}">
        <div class="mb-2 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                <span>{weatherGlyph($hikerMode.weatherCondition)}</span>
                <span>{$hikerMode.weatherTempF.toFixed(0)}F · {$hikerMode.weatherCondition}</span>
            </div>
            <div class="flex items-center gap-2">
                {#if $hikerMode.isLowBattery}
                    <span class="rounded-full border border-orange-300/40 bg-orange-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-orange-200">Low Battery</span>
                {/if}
                <button onclick={onToggleSimplified} class="pointer-events-auto rounded-md border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-100 hover:bg-white/10">
                    {$hikerMode.simplifiedHUD ? 'Full HUD' : 'Simplified'}
                </button>
            </div>
        </div>

        <div class="mb-3 grid grid-cols-4 gap-2 text-center">
            <div>
                <p class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Walked</p>
                <p class="font-black tabular-nums">{$hikerMode.distanceWalkedMiles.toFixed(1)} mi</p>
            </div>
            <div>
                <p class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Remain</p>
                <p class="font-black tabular-nums">{$hikerMode.totalMilesRemaining.toFixed(1)} mi</p>
            </div>
            <div>
                <p class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">ETA</p>
                <p class="font-black tabular-nums text-amber-300">{$hikerMode.eta}</p>
            </div>
            <div>
                <p class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Speed</p>
                <p class="font-black tabular-nums">{$hikerMode.speedMph.toFixed(1)} mph</p>
            </div>
        </div>

        <div class="mb-3 space-y-2">
            <div class="rounded-lg border border-amber-300/30 bg-amber-500/10 px-2.5 py-2">
                <div class="mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.16em] text-amber-100">
                    <span>Daily Plan</span>
                    <span class="tabular-nums">{$hikerMode.distanceToday.toFixed(1)} / {$hikerMode.dailyGoalMiles.toFixed(1)} mi</span>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <span
                        class="block h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500"
                        style="width: {progressPercent($hikerMode.distanceToday, $hikerMode.dailyGoalMiles)}%;"
                    ></span>
                </div>
            </div>

            <div class="rounded-lg border border-blue-300/30 bg-blue-500/10 px-2.5 py-2">
                <div class="mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.14em] text-blue-100">
                    <span>Full Hike Carlisle to Corbridge</span>
                    <span class="tabular-nums">{$hikerMode.fullTripProgressMiles.toFixed(1)} / {$hikerMode.fullTripGoalMiles.toFixed(1)} mi</span>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <span
                        class="block h-full rounded-full bg-gradient-to-r from-blue-300 to-blue-500"
                        style="width: {progressPercent($hikerMode.fullTripProgressMiles, $hikerMode.fullTripGoalMiles)}%;"
                    ></span>
                </div>
            </div>
        </div>

        <div class="mb-2 flex items-center justify-between text-[10px] font-bold">
            <span class="flex items-center gap-1 text-emerald-300">▲ {$hikerMode.elevationGain} ft / 500m</span>
            <span class="flex items-center gap-1 text-rose-300">▼ {$hikerMode.elevationLoss} ft / 500m</span>
            <span class="text-slate-300">HDG {$hikerMode.heading.toFixed(0)}°</span>
        </div>

        <div class="mb-2">
            <div class="mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                <span class="flex items-center gap-1">👣 Trail Integrity</span>
                <span>{$hikerMode.integrity.toFixed(0)}%</span>
            </div>
            <div class="grid gap-0.5" style="grid-template-columns: repeat({Math.max(1, Math.round($hikerMode.totalMiles))}, minmax(0, 1fr));">
                {#each segments($hikerMode.totalMiles) as mileIndex (mileIndex)}
                    <span class="h-1 rounded-sm {mileIndex < Math.floor($hikerMode.distanceWalkedMiles) ? 'bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-white/10'}"></span>
                {/each}
            </div>
        </div>

        {#if $hikerMode.isOffTrail}
            <div class="mb-2 rounded-md border border-rose-300/40 bg-rose-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-rose-100">
                Off-trail drift: {$hikerMode.driftMeters.toFixed(0)}m
            </div>
        {/if}

        {#if $hikerMode.badges.length > 0}
            <div class="flex flex-wrap gap-1.5">
                {#each $hikerMode.badges.slice(-3) as badge (badge.id)}
                    <span class="rounded-full border border-emerald-300/35 bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-emerald-100">{badge.name}</span>
                {/each}
            </div>
        {/if}
    </div>
</div>
