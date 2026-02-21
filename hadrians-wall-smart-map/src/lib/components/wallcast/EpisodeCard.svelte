<script lang="ts">
    import type { Episode } from "$lib/server/wallcast/schema";
    import { wallcast } from "$lib/wallcast/store.svelte";
    import { Play, Pause, Lock, Check } from "lucide-svelte";

    let { episode }: { episode: Episode } = $props();

    let isPlaying = $derived(
        wallcast.currentEpisode?.id === episode.id &&
            wallcast.playbackState === "playing",
    );
    let isCurrent = $derived(wallcast.currentEpisode?.id === episode.id);

    function handlePlay() {
        if (isPlaying) {
            wallcast.pause();
        } else {
            // If it's already current but paused, just play. Otherwise load.
            if (isCurrent) {
                wallcast.play();
            } else {
                wallcast.loadEpisode(episode);
            }
        }
    }

    function formatTime(seconds: number) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    }

    function getSummary(text: string | undefined) {
        if (!text) return "";
        // Extract sentences
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

        // Skip generic greetings/intros
        const genericIntros = [
            "welcome",
            "alright",
            "hello",
            "hi there",
            "back again",
            "joining us",
        ];
        let startIndex = 0;

        while (startIndex < sentences.length) {
            const s = sentences[startIndex].toLowerCase();
            const isGeneric = genericIntros.some((g) => s.includes(g));
            // Only skip if it's short AND generic
            if (isGeneric && s.length < 60) {
                startIndex++;
            } else {
                break;
            }
        }

        let summary = (sentences[startIndex] || sentences[0]).trim();

        // If it's still very short, try to append the next sentence if it fits "one sentence summary" vibe
        if (summary.length < 40 && sentences[startIndex + 1]) {
            summary += " " + sentences[startIndex + 1].trim();
        }

        // Final trim and limit
        if (summary.length > 140) {
            summary = summary.slice(0, 137) + "...";
        }

        return summary;
    }

    const description = $derived(
        getSummary(
            episode.script.lines.find((l) => l.speaker_id === "presenter")
                ?.text,
        ) || episode.script.title,
    );
</script>

<div
    class="ds-panel relative overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:ds-panel-strong group cursor-pointer"
    onclick={handlePlay}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === "Enter" && handlePlay()}
>
    <!-- Status Badge -->
    <div class="absolute right-4 top-4 z-10">
        {#if isCurrent}
            <span class="relative flex h-2 w-2">
                {#if isPlaying}
                    <span
                        class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success-500)] opacity-75"
                    ></span>
                {/if}
                <span
                    class="relative inline-flex h-2 w-2 rounded-full bg-[var(--success-500)]"
                ></span>
            </span>
        {/if}
    </div>

    <!-- Content -->
    <div class="relative z-0 flex items-start gap-5 p-5">
        <button
            onclick={(e) => {
                e.stopPropagation();
                handlePlay();
            }}
            class="ds-control-fab flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[var(--text-primary)] transition-colors hover:text-[var(--action-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={isPlaying ? "Pause" : "Play"}
        >
            {#if isPlaying}
                <Pause size={24} fill="currentColor" />
            {:else}
                <Play size={24} fill="currentColor" class="translate-x-0.5" />
            {/if}
        </button>

        <div class="flex-1 space-y-1.5 pt-1 pr-6">
            <h3
                class="font-display text-xl font-bold leading-tight text-[var(--text-primary)] [text-wrap:balance]"
            >
                {episode.title}
            </h3>
            <p
                class="font-ui text-sm text-[var(--text-secondary)] [text-wrap:pretty]"
            >
                <span
                    class="font-data mr-2 rounded border border-[var(--stroke-subtle)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-secondary)] shadow-sm"
                >
                    {isCurrent && wallcast.duration > 0
                        ? formatTime(wallcast.duration)
                        : formatTime(episode.duration_seconds)}
                </span>
                {description}
            </p>
        </div>
    </div>

    <!-- Progress indicator on current card -->
    {#if isCurrent}
        <div
            class="absolute bottom-0 left-0 right-0 h-1 bg-[var(--stroke-subtle)]"
        >
            <div
                class="h-full bg-[var(--action-primary)] transition-all duration-200 ease-linear shadow-[0_0_8px_var(--action-primary)]"
                style="width: {wallcast.progress * 100}%"
            ></div>
        </div>
    {/if}
</div>
