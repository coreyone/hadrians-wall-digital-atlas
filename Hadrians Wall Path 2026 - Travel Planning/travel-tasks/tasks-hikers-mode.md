# Task List: Hiker's Mode (Tactical Instrument)

Based on the "21 crisp requirements" for the Pokémon Go-style Hiker's Mode.

## Relevant Files

- `src/lib/stores/hikerMode.ts` - Global state management for Hiker Mode (active state, metrics, settings).
- `src/lib/services/compass.ts` - Handles `DeviceOrientationEvent`, iOS permissions, and heading calculation.
- `src/lib/services/navigation.ts` - Turf.js logic for snapping position to trail and calculating metrics (ETA, distance).
- `src/lib/services/gamification.ts` - Manages "Trail Integrity," badges, and unlocking logic.
- `src/lib/services/audio.ts` - Manages footstep sounds and audio cues.
- `src/lib/components/HikerHUD.svelte` - The video-game style overlay component (HUD).
- `src/lib/components/Map.svelte` - Modified to handle 3D pitch, bearing updates, and "Glowing Path" rendering.
- `src/routes/+page.svelte` - Integration point for the HUD and Roman Coin gesture.

## Tasks

- [ ] **1.0 Core Hiker Mode Architecture & Activation**
    - [ ] 1.1 Create `hikerMode.ts` store to manage `isActive`, `is3D`, and user preferences.
    - [ ] 1.2 Implement "Triple-Tap" gesture logic on the Roman Coin icon in `+page.svelte` with debounce (prevents accidental triggers).
    - [ ] 1.3 Add Haptic Feedback trigger (using `navigator.vibrate` pattern) on activation (300ms confirmation).
    - [ ] 1.4 Implement CSS animation for the Roman Coin: 360° spin with cubic-bezier easing, transitioning into a metallic HUD emblem.
    - [ ] 1.5 Create the `HikerHUD.svelte` scaffold and conditionally render it in `+page.svelte` when `isActive` is true.
    - [ ] 1.6 Implement "Swipe-Down" gesture logic to exit Hiker's Mode with reverse animation.

- [ ] **2.0 Advanced Navigation & Compass Engine**
    - [ ] 2.1 Create `compass.ts` service to handle `DeviceOrientationEvent`.
    - [ ] 2.2 Implement iOS-specific permission request flow (`DeviceOrientationEvent.requestPermission()`) triggered by the first triple-tap.
    - [ ] 2.3 Implement gyroscope/compass fusion logic to calculate smooth "True Heading."
    - [ ] 2.4 Add "Calibration Prompt" UI if heading variance exceeds 15° over 3 seconds.
    - [ ] 2.5 Modify `Map.svelte` to sync camera bearing with compass heading in real-time (Heading-Up orientation).

- [ ] **3.0 Immersive Map & 3D Visualization**
    - [ ] 3.1 Update `Map.svelte` to switch to `pitch: 60` (3D view) when Hiker Mode activates.
    - [ ] 3.2 Implement `Turf.js` logic (`nearestPointOnLine`) to snap user location ghost marker to the official `trailGeoJSON` line.
    - [ ] 3.3 Create a "Glowing Path" map layer: render the trail corridor as a pulsing, glowing ribbon (using MapLibre line-color/width animations).
    - [ ] 3.4 Implement "Off-Trail Drift" detection: show visual warning arrow if user is >25m from the snapped line.
    - [ ] 3.5 Render nearby POIs (<500m) as floating HTML markers (Diegetic UI) that stay upright in 3D view.

- [ ] **4.0 Heads-Up Display (HUD) Overlay**
    - [ ] 4.1 Build `HikerHUD` UI: Top-center anchored emblem, bottom stats bar.
    - [ ] 4.2 Implement "Distance Remaining" and "Total Miles" calculation based on snapped position.
    - [ ] 4.3 Implement "ETA" logic using a rolling 60-second average speed calculation.
    - [ ] 4.4 Create "Elevation Delta" indicator: analyze next 500m of trail data to show ▲ gain / ▼ loss.
    - [ ] 4.5 Add "Weather Ribbon": minimal icon + temp component using cached forecast data.
    - [ ] 4.6 Implement CSS brightness detection to adapt HUD opacity (High contrast for sun, muted for dusk).

- [ ] **5.0 Gamification & Audio System**
    - [ ] 5.1 Create "Trail Integrity Meter" UI: a segmented Roman milestone bar that fills per mile walked.
    - [ ] 5.2 Implement Badge Logic: unlock micro-achievements when passing specific coordinates (e.g., Housesteads).
    - [ ] 5.3 Build `audio.ts`: synthesized or sample-based footstep sounds triggered when speed > 1.5mph.
    - [ ] 5.4 Add "Intel Card" modal: tapping a floating POI freezes map and shows details without exiting mode.

- [ ] **6.0 Optimization & Accessibility**
    - [ ] 6.1 Implement Battery API check: if <25%, reduce map animation frame rate (throttle updates).
    - [ ] 6.2 Add Accessibility Toggle: "Simplified HUD" (No 3D, Static North-Up, Larger Text).
    - [ ] 6.3 Ensure "Offline-First" resilience: all navigation/snapping logic must work without network.
