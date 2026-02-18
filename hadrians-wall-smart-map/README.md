# Hadrian's Wall Smart Map

A context-aware, 15-minute corridor intelligence map for the Hadrian's Wall Path.

## Tech Stack
- **Framework**: SvelteKit
- **Styling**: Tailwind CSS v4 + Bits UI philosophy
- **Map**: MapLibre GL JS
- **Data**: MediaWiki API + Turf.js for geospatial filtering

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   ```

2. Start the dev server:
   ```bash
   bun run dev
   ```

3. Open http://localhost:5173

## Features
- **Corridor Logic**: Only shows Wikipedia POIs within 1.2km (15 min walk) of the trail.
- **Overnight Hubs**: Highlights key stops like Carlisle, Once Brewed, and Corbridge.
- **Mobile First**: Responsive sidebar/drawer layout.
