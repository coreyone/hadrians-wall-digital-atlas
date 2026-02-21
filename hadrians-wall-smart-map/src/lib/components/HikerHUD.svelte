<script lang="ts">
    import { onMount, tick } from "svelte";
    import { hikerMode } from "$lib/stores/hikerMode";
    import { fly } from "svelte/transition";
    import Coin3D from "$lib/components/Coin3D.svelte";

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
        onTopCoinLayout,
    }: Props = $props();

    let topCoinButton = $state<HTMLButtonElement | null>(null);
    let coinComponent = $state<ReturnType<typeof Coin3D>>();

    export function wake() {
        coinComponent?.wake();
    }

    function publishTopCoinLayout() {
        if (!topCoinButton || !onTopCoinLayout) return;
        onTopCoinLayout(topCoinButton.getBoundingClientRect());
    }

    onMount(() => {
        const handleResize = () => publishTopCoinLayout();
        void tick().then(() => publishTopCoinLayout());
        window.addEventListener("resize", handleResize);
        window.addEventListener("orientationchange", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("orientationchange", handleResize);
        };
    });

    $effect(() => {
        hideTopCoin;
        onTopCoinLayout;
        void tick().then(() => publishTopCoinLayout());
    });

    function weatherIconClass(condition: string) {
        const normalized = condition.toLowerCase();
        if (normalized.includes("rain") || normalized.includes("shower"))
            return "hn-cloud";
        if (normalized.includes("cloud") || normalized.includes("overcast"))
            return "hn-cloud";
        if (normalized.includes("wind")) return "hn-refresh";
        return "hn-sun";
    }

    function progressPercent(progress: number, goal: number) {
        if (goal <= 0) return 0;
        return Math.max(0, Math.min(100, (progress / goal) * 100));
    }

    function formatPace(
        minutesPerMile: number | null,
        goalComplete: boolean,
        deadlinePassed: boolean,
    ) {
        if (goalComplete) return "Done";
        if (deadlinePassed) return "Past 5PM";
        if (
            minutesPerMile === null ||
            !Number.isFinite(minutesPerMile) ||
            minutesPerMile <= 0
        ) {
            return "--";
        }
        const totalSeconds = Math.round(minutesPerMile * 60);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}/mi`;
    }
</script>

<div
    class="fixed left-1/2 -translate-x-1/2 z-[60]"
    style="top: calc(env(safe-area-inset-top, 0px) + 0.75rem);"
    in:fly={{ y: -40, duration: 500 }}
>
    <div class="relative flex h-18 w-18 items-center justify-center">
        <div
            class="absolute inset-0 rounded-full border border-amber-300/40 animate-[spin_12s_linear_infinite] transition-opacity duration-300 {hideTopCoin
                ? 'opacity-0'
                : 'opacity-100'}"
        ></div>
        <div
            class="absolute inset-2 rounded-full border border-amber-100/40 border-dashed animate-[spin_18s_linear_infinite_reverse] transition-opacity duration-300 {hideTopCoin
                ? 'opacity-0'
                : 'opacity-100'}"
        ></div>
        <button
            type="button"
            onclick={onCoinTap}
            bind:this={topCoinButton}
            class="relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 {hideTopCoin
                ? 'pointer-events-none scale-75 opacity-0'
                : 'scale-100 opacity-100'}"
            aria-label="Triple tap Roman Coin to exit Hiker Mode"
            title="Triple tap to exit Hiker Mode"
        >
            <div class="h-full w-full relative">
                <Coin3D
                    bind:this={coinComponent}
                    class="w-full h-full"
                    interactive={true}
                />
            </div>
        </button>

        {#if $hikerMode.liveLastSeen}
            <div
                class="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-max text-center transition-all duration-300 {hideTopCoin
                    ? 'opacity-0 scale-95'
                    : 'opacity-100 scale-100'}"
            >
                <div
                    class="inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 backdrop-blur border border-amber-500/30 px-2.5 py-1 text-[10px] font-black tracking-widest text-white shadow-lg"
                >
                    <span class="relative flex h-2 w-2">
                        <span
                            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"
                        ></span>
                        <span
                            class="relative inline-flex h-2 w-2 rounded-full bg-amber-500"
                        ></span>
                    </span>
                    <span class="uppercase text-amber-200">Live</span>
                    {#if $hikerMode.liveBattery !== undefined && $hikerMode.liveBattery > 0}
                        <span class="text-slate-400">·</span>
                        <span class="text-emerald-400 flex items-center gap-1">
                            <i class="hn hn-battery-full text-[12px]"></i>
                            iPhone {$hikerMode.liveBattery}%
                        </span>
                    {/if}
                    <span class="text-slate-400">·</span>
                    <span class="text-slate-300">
                        {(() => {
                            const lastSeenTime = new Date(
                                $hikerMode.liveLastSeen,
                            ).getTime();
                            const now = Date.now();
                            const diffMs = Math.max(0, now - lastSeenTime);
                            const diffMins = Math.floor(diffMs / 60000);
                            return diffMins === 0
                                ? "Just now"
                                : `${diffMins}m ago`;
                        })()}
                    </span>
                </div>
            </div>
        {/if}
    </div>
</div>

<div
    class="fixed bottom-6 inset-x-3 z-[60]"
    in:fly={{ y: 40, duration: 500, delay: 120 }}
>
    <div
        class="crt-hud-panel ds-panel ds-panel-strong rounded-2xl border p-3 shadow-2xl backdrop-blur-xl {$hikerMode.simplifiedHUD
            ? 'text-[15px]'
            : 'text-[13px]'}"
    >
        <div class="mb-2 flex items-center justify-between gap-2">
            <div
                class="hud-kicker flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]"
            >
                <i
                    class={`hn ${weatherIconClass($hikerMode.weatherCondition)} weather-pixel-icon`}
                    aria-label={$hikerMode.weatherCondition}
                ></i>
                <span
                    >{$hikerMode.weatherTempF.toFixed(0)}F · {$hikerMode.weatherCondition}</span
                >
            </div>
            <div class="flex items-center gap-2">
                {#if $hikerMode.isLowBattery}
                    <span
                        class="hud-alert-chip rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em]"
                        >Low Battery</span
                    >
                {/if}
                <button
                    onclick={() => hikerMode.toggleCompass()}
                    class="hud-toggle ds-chip pointer-events-auto rounded-md border px-2 py-1 text-[13px] font-black uppercase tracking-[0.2em] transition-colors flex items-center justify-center {$hikerMode.isCompassActive
                        ? 'text-blue-600 border-blue-200 bg-blue-50'
                        : 'text-slate-400 border-slate-200 hover:text-slate-600'}"
                    aria-label="Toggle Compass"
                    title={$hikerMode.isCompassActive
                        ? "Compass ON"
                        : "Compass OFF"}
                >
                    <i class="hn hn-arrow-alt-circle-up"></i>
                </button>
                <button
                    onclick={onToggleSimplified}
                    class="hud-toggle ds-chip pointer-events-auto rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em]"
                >
                    {$hikerMode.simplifiedHUD ? "Full HUD" : "Simplified"}
                </button>
            </div>
        </div>

        <div class="mb-3 grid grid-cols-4 gap-2 text-center">
            <div>
                <p
                    class="hud-label text-[9px] font-black uppercase tracking-[0.2em]"
                >
                    Walked
                </p>
                <p class="hud-value font-black tabular-nums">
                    {$hikerMode.distanceWalkedMiles.toFixed(1)} mi
                </p>
            </div>
            <div>
                <p
                    class="hud-label text-[9px] font-black uppercase tracking-[0.2em]"
                >
                    Remain
                </p>
                <p class="hud-value font-black tabular-nums">
                    {$hikerMode.totalMilesRemaining.toFixed(1)} mi
                </p>
            </div>
            <div>
                <p
                    class="hud-label text-[9px] font-black uppercase tracking-[0.2em]"
                >
                    ETA
                </p>
                <p class="hud-highlight font-black tabular-nums">
                    {$hikerMode.eta}
                </p>
            </div>
            <div>
                <p
                    class="hud-label text-[9px] font-black uppercase tracking-[0.16em]"
                >
                    Pace to 5PM
                </p>
                <p class="hud-value font-black tabular-nums">
                    {formatPace(
                        $hikerMode.requiredPaceMinPerMileToDailyGoal,
                        $hikerMode.dailyRemainingMiles <= 0,
                        $hikerMode.dailyGoalDeadlinePassed,
                    )}
                </p>
            </div>
        </div>

        <div class="mb-3 space-y-2">
            <div
                class="hud-progress-card hud-progress-card--daily rounded-lg border px-2.5 py-2"
            >
                <div
                    class="hud-progress-title mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.16em]"
                >
                    <span>Daily Plan</span>
                    <span class="tabular-nums"
                        >{$hikerMode.distanceToday.toFixed(1)} / {$hikerMode.dailyGoalMiles.toFixed(
                            1,
                        )} mi</span
                    >
                </div>
                <div
                    class="hud-progress-track h-1.5 overflow-hidden rounded-full"
                >
                    <span
                        class="hud-progress-fill block h-full rounded-full"
                        style="width: {progressPercent(
                            $hikerMode.distanceToday,
                            $hikerMode.dailyGoalMiles,
                        )}%;"
                    ></span>
                </div>
            </div>

            <div
                class="hud-progress-card hud-progress-card--full rounded-lg border px-2.5 py-2"
            >
                <div
                    class="hud-progress-title mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.14em]"
                >
                    <span>Full Hike Carlisle to Corbridge</span>
                    <div class="flex items-center gap-2">
                        <span class="tabular-nums"
                            >{$hikerMode.fullTripProgressMiles.toFixed(1)} / {$hikerMode.fullTripGoalMiles.toFixed(
                                1,
                            )} mi</span
                        >
                        <span
                            class="hud-integrity rounded-full border px-1.5 py-0.5 text-[8px] font-black tracking-[0.16em]"
                        >
                            {$hikerMode.integrity.toFixed(0)}%
                        </span>
                    </div>
                </div>
                <div
                    class="hud-progress-track h-1.5 overflow-hidden rounded-full"
                >
                    <span
                        class="hud-progress-fill block h-full rounded-full"
                        style="width: {progressPercent(
                            $hikerMode.fullTripProgressMiles,
                            $hikerMode.fullTripGoalMiles,
                        )}%;"
                    ></span>
                </div>
            </div>
        </div>

        <div
            class="mb-2 flex items-center justify-between text-[10px] font-bold"
        >
            <span class="hud-pos flex items-center gap-1"
                >▲ {$hikerMode.elevationGain} ft / 500m</span
            >
            <span class="hud-neg flex items-center gap-1"
                >▼ {$hikerMode.elevationLoss} ft / 500m</span
            >
            <span class="hud-heading">HDG {$hikerMode.heading.toFixed(0)}°</span
            >
        </div>

        {#if $hikerMode.isOffTrail}
            <div
                class="hud-alert mb-2 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
            >
                Off-trail drift: {$hikerMode.driftMeters.toFixed(0)}m
            </div>
        {/if}

        {#if $hikerMode.badges.length > 0}
            <div class="flex flex-wrap gap-1.5">
                {#each $hikerMode.badges.slice(-3) as badge (badge.id)}
                    <span
                        class="hud-badge rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em]"
                        >{badge.name}</span
                    >
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .crt-hud-panel {
        position: relative;
        color: var(--text-primary);
        border-color: var(--stroke-default);
        background: radial-gradient(
                130% 95% at 18% 0%,
                oklch(0.94 0.07 255 / 0.24),
                transparent 56%
            ),
            linear-gradient(
                180deg,
                oklch(0.995 0.01 230 / 0.96),
                oklch(0.97 0.014 230 / 0.94)
            );
        box-shadow: var(--shadow-lg);
    }

    .crt-hud-panel::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: linear-gradient(
            180deg,
            oklch(0.995 0.01 230 / 0.65),
            transparent 30%
        );
        opacity: 0.4;
    }

    .crt-hud-panel > * {
        position: relative;
        z-index: 1;
    }

    .hud-kicker,
    .hud-label {
        color: var(--text-muted);
    }

    .weather-pixel-icon {
        font-size: 0.9rem;
        color: var(--action-primary);
    }

    .hud-value,
    .hud-heading {
        color: var(--text-primary);
        text-shadow: none;
    }

    .hud-highlight {
        color: var(--action-primary);
        text-shadow: none;
    }

    .hud-toggle {
        border-color: var(--stroke-default);
        background: var(--surface-raised);
        color: var(--text-secondary);
        box-shadow: var(--shadow-sm);
    }

    .hud-toggle:hover {
        background: var(--surface-hover);
    }

    .hud-alert-chip,
    .hud-alert {
        border-color: var(--warning-200);
        background: var(--warning-50);
        color: oklch(0.44 0.13 85);
        box-shadow: var(--shadow-sm);
    }

    .hud-progress-card {
        border-color: var(--stroke-default);
        background: var(--surface);
        box-shadow: inset 0 0 0 1px var(--stroke-subtle);
    }

    .hud-progress-title {
        color: var(--text-secondary);
    }

    .hud-progress-track {
        background: var(--n100);
    }

    .hud-progress-fill {
        background: linear-gradient(90deg, var(--blue-400), var(--blue-600));
        box-shadow: 0 1px 2px oklch(0.2 0.03 250 / 0.16);
    }

    .hud-progress-card--daily .hud-progress-fill {
        background: linear-gradient(90deg, var(--blue-300), var(--blue-500));
    }

    .hud-progress-card--full .hud-progress-fill {
        background: linear-gradient(90deg, var(--blue-400), var(--blue-600));
    }

    .hud-integrity {
        border-color: var(--stroke-default);
        background: var(--surface-raised);
        color: var(--text-secondary);
        text-shadow: none;
    }

    .hud-pos,
    .hud-neg {
        color: var(--text-secondary);
    }

    .hud-badge {
        border-color: var(--info-200);
        background: var(--info-50);
        color: oklch(0.44 0.12 210);
    }
</style>
