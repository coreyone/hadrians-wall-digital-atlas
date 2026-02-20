<script lang="ts">
    import { wallcast } from "$lib/wallcast/store.svelte";
    import { type Episode, type Segment } from "$lib/server/wallcast/schema";

    // Mock Data
    const mockSegment: Segment = {
        id: "seg-test",
        name: "Segedunum Roman Fort",
        coordinates: [[54.9881, -1.5349]], // Wallsend
        distance_miles: 0,
    };

    const mockEpisode: Episode = {
        id: "test-ep-1",
        title: "The Roman Army",
        duration_seconds: 60,
        file_path:
            "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
        file_size_bytes: 100000,
        hash: "mockhash",
        segment_id: "seg-test",
        script: { title: "Test Script", lines: [] },
        speakers: ["scholar"],
    };

    // User Location Simulation
    let lat = $state(54.988); // Start near Wallsend
    let lon = $state(-1.535);

    async function init() {
        // Use the real load method to verify end-to-end
        await wallcast.loadManifest();

        // Populate with mock if empty (fallback for testing without build)
        if (wallcast.playlist.length === 0) {
            wallcast.segments.set(mockSegment.id, mockSegment);
            wallcast.playlist = [mockEpisode];
        }

        wallcast.checkProximity(lat, lon); // Initial check
    }

    function updateLocation() {
        // Move closer or further
        wallcast.checkProximity(lat, lon);
    }

    $effect(() => {
        updateLocation();
    });

    function togglePlay() {
        if (wallcast.playbackState === "playing") {
            wallcast.pause();
        } else {
            wallcast.play();
        }
    }
</script>

<div class="p-8 max-w-md mx-auto space-y-6">
    <h1 class="text-2xl font-bold">Wallcast Mechanism Test</h1>

    <button
        class="bg-blue-600 text-white px-4 py-2 rounded w-full"
        onclick={init}
    >
        Initialize (Load Manifest)
    </button>

    <div class="border p-4 rounded bg-gray-50 space-y-2">
        <h2 class="font-bold">Simulation</h2>
        <div class="flex flex-col gap-2">
            <label class="text-sm">
                Latitude: <input
                    type="number"
                    step="0.0001"
                    bind:value={lat}
                    class="border p-1 w-full"
                />
            </label>
            <label class="text-sm">
                Longitude: <input
                    type="number"
                    step="0.0001"
                    bind:value={lon}
                    class="border p-1 w-full"
                />
            </label>
        </div>
        <p class="text-xs text-gray-500">
            Target: {mockSegment.coordinates[0][0]}, {mockSegment
                .coordinates[0][1]}
        </p>
    </div>

    <div class="border p-4 rounded bg-gray-50">
        <h2 class="font-bold mb-2">State Dump</h2>
        <pre class="text-xs overflow-auto max-h-40">{JSON.stringify(
                {
                    state: wallcast.playbackState,
                    unlocked: Array.from(wallcast.unlockedSegments),
                    userLoc: wallcast.userLocation,
                    progress: wallcast.progress.toFixed(2),
                },
                null,
                2,
            )}</pre>
    </div>

    <div class="flex gap-2">
        <button
            class="bg-green-500 text-white px-4 py-2 rounded flex-1"
            onclick={togglePlay}
        >
            {wallcast.playbackState === "playing" ? "Pause" : "Play"}
        </button>
    </div>

    <div class="w-full bg-gray-200 rounded-full h-2.5">
        <div
            class="bg-blue-600 h-2.5 rounded-full"
            style="width: {wallcast.progress * 100}%"
        ></div>
    </div>

    {#if wallcast.unlockedSegments.has(mockEpisode.segment_id!)}
        <div
            class="bg-green-100 text-green-800 p-2 rounded text-center font-bold"
        >
            🎉 Segment Unlocked!
        </div>
    {/if}
</div>
