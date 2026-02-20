# Wallcast: Product Manager's Guide

## Overview
**Wallcast** is a geo-aware audio storytelling feature for the Hadrian's Wall Smart Map. It delivers AI-generated "micro-podcasts" about historical landmarks as users hike the trail.

**Key Philosophy:** "Right Story, Right Place."
- **Closest First:** The interface always prioritizes the episode closest to the user's current location.
- **Gamified Unlocking:** Users get a "Segment Unlocked" reward when they physically reach a site (<30m), but audio is accessible nearby to prevent frustration.

---

## 🚀 How to Generate Content (The "Magic" Button)
As a PM, you don't write the scripts. You run the **Generation Pipeline**. This single command ingests Wikipedia content, uses Gemini to write a script, and ElevenLabs to voice it.

### Prerequisites
Ensure you have the API keys in your `.env` file:
```bash
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
```

### 1. The Command
Run this from your terminal project root:
```bash
bun run scripts/generate-wallcast.ts --segment "seg-01" --force
```

**Options:**
- `--segment <id>`: Generate for a specific segment ID (e.g., "seg-01"). If omitted, it *could* try to generate for ALL (costly!).
- `--dry-run`: Runs the pipeline *without* spending API credits. Great for checking the script writing without generating audio.
- `--force`: Overwrites existing audio/manifests.

### 2. What Happens?
1.  **Ingestion**: Fetches Wikipedia data for the segment's POI (e.g., "Segedunum").
2.  **Scripting (Gemini)**: Writes a 2-person dialogue (Host & Expert) tailored to the hiking context.
3.  **Synthesis (ElevenLabs)**: Converts text to speech using premium voices.
4.  **Mastering (FFmpeg)**: Combines the voices into a single `.mp3` episode with normalization.
5.  **Manifest Update**: Adds the episode to `static/wallcast/manifest.json`.

---

## 🛠 Testing & Verification
We have built a specific tool for you to verify the mechanism without hiking to Newcastle.

**URL:** `/test/wallcast` (e.g., `http://localhost:5173/test/wallcast`)

### How to Verify
1.  **Initialize**: Click "Initialize (Load Manifest)" to load the generated episodes.
2.  **Simulate Location**:
    -   Enter a Latitude/Longitude near a target (e.g., `54.9881, -1.5349` for Wallsend).
    -   Watch the **State Dump**.
3.  **Observe Behavior**:
    -   **Sorting**: The "The Roman Army" episode should jump to the top of the list if you simulate being near it.
    -   **Unlocking**: If you get within 30m, the `unlocked` array will populate, and you might see a "🎉 Unlocked" banner.
    -   **Persistence**: Reload the page. The unlocked state and your last played spot should persist.

---

## 📦 What's in the Box? (Technical Artifacts)
-   **Store (`$lib/wallcast/store.svelte.ts`)**: The brain. Handles geolocation math, sorting, and audio playback state.
-   **Player (`WallcastPlayer.svelte`)**: The persistent bar at the bottom of the screen.
-   **Feed (`routes/wallcast/+page.svelte`)**: The main list view of episodes.
