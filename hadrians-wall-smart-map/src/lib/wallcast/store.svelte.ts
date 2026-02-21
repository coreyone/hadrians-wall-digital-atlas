
import { untrack } from 'svelte';
import { Howl, Howler } from 'howler';
import type { Episode, Segment } from '$lib/server/wallcast/schema';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export class WallcastStore {
    // Svelte 5 Runes for Reactivity
    playbackState = $state<PlaybackState>('idle');
    currentEpisode = $state<Episode | null>(null);
    playlist = $state<Episode[]>([]); // Initialize empty playlist
    segments = $state<Map<string, Segment>>(new Map());
    progress = $state(0); // 0 to 1
    duration = $state(0); // seconds
    volume = $state(1.0);
    unlockedSegments = $state<Set<string>>(new Set());
    userLocation = $state<{ lat: number; lon: number } | null>(null);

    // Internal generic Howl instance
    private _sound: Howl | null = null;
    private _rafId: number | null = null;

    constructor() {
        // Load unlocked segments from localStorage if available
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem('wallcast_unlocked');
            if (saved) {
                try {
                    this.unlockedSegments = new Set(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to load unlocked segments", e);
                }
            }
        }
    }

    init() {
        // Attempt to restore playback state if playlist is loaded
        $effect(() => {
            if (this.playlist.length > 0 && typeof localStorage !== 'undefined') {
                const savedProgressJSON = localStorage.getItem('wallcast_progress_map');
                if (savedProgressJSON) {
                    try {
                        const progressMap = JSON.parse(savedProgressJSON);
                        // We could use this map to show progress bars on all cards in the future

                        // Restore last played episode if set
                        const lastEpId = localStorage.getItem('wallcast_last_episode');
                        if (lastEpId && !this.currentEpisode) {
                            const ep = this.playlist.find(e => e.id === lastEpId);
                            if (ep) {
                                // Load but don't auto-play
                                this.loadEpisode(ep, false);
                                // Set initial progress from map
                                this.progress = progressMap[lastEpId] || 0;
                            }
                        }
                    } catch (e) {
                        console.error("Failed to restore progress map", e);
                    }
                }
            }
        });

        // Auto-save unlocked state
        $effect(() => {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('wallcast_unlocked', JSON.stringify(Array.from(this.unlockedSegments)));
            }
        });

        // Auto-save current episode and its progress
        $effect(() => {
            if (typeof localStorage !== 'undefined' && this.currentEpisode) {
                localStorage.setItem('wallcast_last_episode', this.currentEpisode.id);

                // Keep a map of ALL progress so users dont lose their spot when switching episodes
                const savedProgressJSON = localStorage.getItem('wallcast_progress_map');
                const progressMap = savedProgressJSON ? JSON.parse(savedProgressJSON) : {};

                progressMap[this.currentEpisode.id] = this.progress;
                localStorage.setItem('wallcast_progress_map', JSON.stringify(progressMap));
            }
        });
    }

    loadEpisode(episode: Episode, autoPlay = true) {
        this.unload();
        this.currentEpisode = episode;
        this.playbackState = 'loading';

        this._sound = new Howl({
            src: [episode.file_path],
            html5: true, // Force HTML5 Audio for large files/streaming/caching
            preload: true,
            onload: () => {
                this.playbackState = 'idle';
                this.duration = this._sound?.duration() || 0;
                // Restore progress if it was set before load
                if (this.progress > 0) {
                    this.seek(this.progress);
                }
                if (autoPlay) this.play();
            },
            onplay: () => {
                this.playbackState = 'playing';
                this._startProgressLoop();
            },
            onpause: () => {
                this.playbackState = 'paused';
                this._stopProgressLoop();
            },
            onend: () => {
                this.playbackState = 'idle';
                this.progress = 1;
                this._stopProgressLoop();
            },
            onloaderror: (_id, err) => {
                console.error("Wallcast Audio Error:", err);
                this.playbackState = 'error';
            }
        });
    }

    checkProximity(lat: number, lon: number) {
        // Untrack to prevent infinite loops when called from an effect
        untrack(() => {
            try {
                this.userLocation = { lat, lon };

                // Threshold in meters (e.g., 30m for unlock reward)
                const UNLOCK_THRESHOLD_METERS = 30;

                // 1. Calculate distances for all segments
                const distances = new Map<string, number>();

                for (const [segId, segment] of this.segments) {
                    if (segment.coordinates && segment.coordinates.length > 0) {
                        const [segLat, segLon] = segment.coordinates[0];
                        const dist = this._getDistanceFromLatLonInMeters(lat, lon, segLat, segLon);
                        distances.set(segId, dist);

                        // Check for unlock reward (Gamification)
                        if (dist <= UNLOCK_THRESHOLD_METERS) {
                            this.unlock(segId);
                        }
                    }
                }

                // 2. Sort playlist by distance (Closest First)
                this.playlist = [...this.playlist].sort((a, b) => {
                    const distA = a.segment_id ? distances.get(a.segment_id) ?? Infinity : Infinity;
                    const distB = b.segment_id ? distances.get(b.segment_id) ?? Infinity : Infinity;
                    return distA - distB;
                });
            } catch (e) {
                console.error("Error in checkProximity:", e);
            }
        });
    }

    play() {
        if (this._sound) {
            this._sound.play();
            this.playbackState = 'playing';
        }
    }

    pause() {
        if (this._sound) {
            this._sound.pause();
            this.playbackState = 'paused';
        }
    }

    seek(percent: number) {
        if (this._sound) {
            const time = this._sound.duration() * Math.min(Math.max(percent, 0), 1);
            this._sound.seek(time);
            this.progress = percent;
        }
    }

    unload() {
        if (this._sound) {
            this._sound.unload();
            this._sound = null;
        }
        this._stopProgressLoop();
        this.playbackState = 'idle';
        this.progress = 0;
    }

    closePlayer() {
        this.unload();
        this.currentEpisode = null;
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('wallcast_last_episode');
        }
    }

    private _startProgressLoop() {
        this._stopProgressLoop();
        const loop = () => {
            if (this._sound && this.playbackState === 'playing') {
                const seek = this._sound.seek() as number;
                const duration = this._sound.duration();
                if (duration > 0) {
                    this.progress = seek / duration;
                }
                this._rafId = requestAnimationFrame(loop);
            }
        };
        this._rafId = requestAnimationFrame(loop);
    }

    private _stopProgressLoop() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    unlock(segmentId: string) {
        if (!this.unlockedSegments.has(segmentId)) {
            // Re-assign to trigger reactivity if needed
            const newSet = new Set(this.unlockedSegments);
            newSet.add(segmentId);
            this.unlockedSegments = newSet;
        }
    }

    async loadManifest() {
        try {
            const res = await fetch('/wallcast/manifest.json');
            if (!res.ok) throw new Error('Failed to load manifest');
            const data = await res.json(); // Type: WallcastManifest

            // Populate Segments
            const newSegments = new Map<string, Segment>();
            if (data.segments) {
                for (const seg of data.segments) {
                    newSegments.set(seg.id, seg);
                }
            }
            this.segments = newSegments;

            // Populate Playlist
            if (data.episodes) {
                this.playlist = data.episodes;
            }

            console.log("Wallcast Manifest Loaded", { episodes: this.playlist.length, segments: this.segments.size });
        } catch (e) {
            console.error("Wallcast Manifest Error:", e);
        }
    }

    // Simple Haversine distance in meters
    private _getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371e3; // metres
        const q1 = lat1 * Math.PI / 180;
        const q2 = lat2 * Math.PI / 180;
        const dq = (lat2 - lat1) * Math.PI / 180;
        const dl = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(dq / 2) * Math.sin(dq / 2) +
            Math.cos(q1) * Math.cos(q2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }
}

// Global Singleton
export const wallcast = new WallcastStore();
