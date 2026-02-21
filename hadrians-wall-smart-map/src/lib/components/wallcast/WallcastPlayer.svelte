<script lang="ts">
    import { wallcast } from "$lib/wallcast/store.svelte";
    import { Play, Pause, SkipBack, SkipForward, X } from "lucide-svelte";
    import { fly } from "svelte/transition";
    import { portal } from "$lib/actions/portal";

    let isVisible = $derived(!!wallcast.currentEpisode);
    let episode = $derived(wallcast.currentEpisode);
    let progressPercent = $derived(wallcast.progress * 100);

    function togglePlay() {
        if (wallcast.playbackState === "playing") {
            wallcast.pause();
        } else {
            wallcast.play();
        }
    }

    function closePlayer() {
        if (wallcast.playbackState === "playing") {
            wallcast.pause();
            wallcast.seek(0);
        } else {
            wallcast.closePlayer();
        }
    }

    function formatTime(seconds: number) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    }

    function handleSeek(e: MouseEvent & { currentTarget: HTMLDivElement }) {
        const rect = e.currentTarget.getBoundingClientRect();
        const p = (e.clientX - rect.left) / rect.width;
        wallcast.seek(p);
    }
</script>

{#if isVisible && episode}
    <div
        transition:fly={{ y: 150, duration: 400, opacity: 0 }}
        class="absolute bottom-[108px] lg:bottom-10 left-1/2 -translate-x-1/2 z-[var(--z-toast)] w-[calc(100%-2rem)] max-w-xl mx-auto safe-m-bottom"
    >
        <div
            class="ds-panel ds-panel-strong relative flex flex-col overflow-hidden rounded-2xl border border-stone-200/50 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-stone-700/50 dark:bg-stone-900/95 dark:shadow-black/60 {wallcast.playbackState ===
            'playing'
                ? 'ring-2 ring-blue-500/50 dark:ring-blue-400/50'
                : ''}"
        >
            <!-- Progress Bar -->
            <div
                class="absolute left-0 top-0 h-1 w-full cursor-pointer bg-[var(--stroke-subtle)]"
                role="slider"
                aria-valuenow={progressPercent}
                aria-valuemin="0"
                aria-valuemax="100"
                tabindex="0"
                onclick={handleSeek}
                onkeydown={(e) => {
                    if (e.key === "ArrowRight")
                        wallcast.seek(wallcast.progress + 0.05);
                    if (e.key === "ArrowLeft")
                        wallcast.seek(wallcast.progress - 0.05);
                }}
            >
                <div
                    class="h-full bg-[var(--action-primary)] transition-all duration-100 ease-linear shadow-[0_0_8px_var(--action-primary)]"
                    style="width: {progressPercent}%"
                ></div>
            </div>

            <div class="flex items-center justify-between gap-5 pt-1">
                <!-- Info -->
                <div class="min-w-0 flex-1 pl-1">
                    <h4
                        class="font-display truncate text-base font-bold text-[var(--text-primary)] tracking-tight"
                    >
                        {episode.title}
                    </h4>
                    <p
                        class="font-data mt-0.5 text-nowrap tabular-nums text-[10px] uppercase tracking-wider text-[var(--text-secondary)]"
                    >
                        {formatTime(
                            wallcast.duration > 0
                                ? wallcast.duration * wallcast.progress
                                : 0,
                        )} / {formatTime(
                            wallcast.duration > 0
                                ? wallcast.duration
                                : episode.duration_seconds,
                        )}
                    </p>
                </div>

                <!-- Controls -->
                <div class="flex items-center gap-1 sm:gap-2">
                    <button
                        class="flex h-11 w-11 items-center justify-center rounded-full text-[var(--icon-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--icon-default)] active:scale-95"
                        onclick={() => wallcast.seek(wallcast.progress - 0.1)}
                        aria-label="Skip Back"
                    >
                        <SkipBack size={20} />
                    </button>

                    <button
                        onclick={togglePlay}
                        class="ds-control-fab mx-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[var(--text-primary)] shadow-md transition-transform hover:scale-105 active:scale-95"
                        aria-label={wallcast.playbackState === "playing"
                            ? "Pause"
                            : "Play"}
                    >
                        {#if wallcast.playbackState === "playing"}
                            <Pause size={22} fill="currentColor" />
                        {:else}
                            <Play size={22} fill="currentColor" class="ml-1" />
                        {/if}
                    </button>

                    <button
                        class="flex h-11 w-11 items-center justify-center rounded-full text-[var(--icon-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--icon-default)] active:scale-95"
                        onclick={() => wallcast.seek(wallcast.progress + 0.1)}
                        aria-label="Skip Forward"
                    >
                        <SkipForward size={20} />
                    </button>

                    <div class="mx-1 h-6 w-px bg-[var(--stroke-subtle)]"></div>

                    <!-- Close -->
                    <button
                        onclick={closePlayer}
                        class="flex h-11 w-11 items-center justify-center rounded-full text-[var(--icon-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--icon-default)] active:scale-95"
                        aria-label="Close Player"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Spacer to prevent content from being hidden behind player -->
    <div class="h-20 w-full"></div>
{/if}
