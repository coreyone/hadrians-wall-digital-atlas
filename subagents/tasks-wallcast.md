# Wallcast Implementation Tasks

## High-Level Phases

- [ ] **Phase 1: Foundation (CLI & Infra)**
    - [ ] 1.1 Define Data Schemas (`src/lib/server/wallcast/schema.ts`)
        - Create Zod schemas for `WallcastManifest`, `Episode`, `Segment`, `Speaker`, `Script`.
        - Ensure strict typing for `speaker_id` (Scholar, Archaeologist, etc.).
    - [ ] 1.2 Scaffold CLI Utility (`scripts/generate-wallcast.ts`)
        - Create a Bun-compatible script that parses command line args (`--segment`, `--dry-run`).
        - Verify environment environment variables (ELEVENLABS_KEY, GEMINI_KEY).
    - [ ] 1.3 Implement Ingestion Layer (`src/lib/server/wallcast/ingestion.ts`)
        - Function to fetch Wikipedia content for given search terms/entities.
        - Basic parsing to extract text and dates.
    - [ ] 1.4 Implement LLM Script Generation (`src/lib/server/wallcast/llm.ts`)
        - Interface for `generateScript(context: string): Promise<ScriptJSON>`.
        - Implementation using an LLM provider (or mock for dev).
    - [ ] 1.5 Implement TTS Audio Synthesis (`src/lib/server/wallcast/tts.ts`)
        - Interface for `synthesizeLine(text: string, speaker: SpeakerID): Promise<Buffer>`.
        - Caching logic (hash text -> check file existence).
    - [ ] 1.6 Implement Audio Engineering (`src/lib/server/wallcast/audio.ts`)
        - Function to stitch audio buffers using FFmpeg (via `bun:spawn` or `fluent-ffmpeg`).
        - Normalization logic.
    - [ ] 1.7 Testing & Verification
        - Validate generated manifest against `WallcastManifest` schema.
        - Verify audio file generation (length, format).

- [ ] **Phase 2: Mechanism (Core Logic)**
    - Implement the client-side state machine (Svelte 5 Runes) and Audio Service (Howler.js).
    - Goal: A headless audio player that manages state, unlocking, and playlist logic correctly.

- [ ] **Phase 3: Interface (UI & Map)**
    - Build the "Podcast" tab, HikerHUD integration, and MapLibre layers.
    - Goal: A fully functional UI where users can see episodes on the map and control playback.

- [ ] **Phase 4: Hardening (Offline & Perf)**
    - Implement Service Worker caching strategies, performance tuning, and heavy testing.
    - Goal: Flawless offline execution and LCP < 2.5s.

## Relevant Files
- `src/lib/server/wallcast/schema.ts` - Zod definitions.
- `scripts/generate-wallcast.ts` - Main CLI entry point.
- `src/lib/server/wallcast/ingestion.ts` - Content fetcher.
- `src/lib/server/wallcast/llm.ts` - Script generator.
- `src/lib/server/wallcast/tts.ts` - Audio synthesizer.
- `src/lib/server/wallcast/audio.ts` - Audio post-processing.
- `tests/wallcast/generation.test.ts` - Unit tests for the pipeline.
