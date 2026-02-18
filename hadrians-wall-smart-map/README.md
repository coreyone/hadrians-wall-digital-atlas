# Hadrian's Wall Digital Atlas

A high-density tactical instrument and context-aware intelligence map for the Hadrian's Wall Path (2026 Trek). Designed as a Progressive Web App (PWA) for offline reliability and mobile-first utility.

## 📱 Features

### Tactical Navigation & Planning
-   **Interactive Map**: Vector-based mapping (MapLibre GL JS) with Topographic, Satellite, and Street views.
-   **Smart Corridor Logic**: Filters Points of Interest (POIs) to a 1.2km (15-minute walk) corridor along the trail, reducing noise.
-   **Route Variants**: Toggle between high-resolution OSM footpaths and simplified routing.
-   **Real-time Positioning**: GPS tracking with accuracy visualization and heading-up mode.

### Itinerary Management
-   **7-Day Stage Breakdown**: detailed logistics for each day including distance, elevation gain, and estimated time.
-   **Supply Status**: Indicators for critical resupply points (Food/Water).
-   **Milestones**: "Pace" markers and key landmarks with estimated arrival times based on a 2.8mph pace.
-   **Elevation Profiles**: Integrated gain/loss metrics for every stage.

### Intelligence Registry
-   **Curated Intel**: Consolidated wisdom from Anthony Bourdain, Rick Steves, and historical context from Frye.
-   **Categorized POIs**:
    -   🏛️ **Heritage**: English Heritage sites and Roman forts.
    -   🍺 **Hospitality**: Pubs, breweries, and cafes.
    -   🔭 **Discovery**: Hidden gems and ranked Wikipedia entities.
-   **Offline Wikipedia**: Fetches and caches summaries for historical sites.

### Mobile-First & PWA
-   **App-like UX**: Fixed bottom navigation bar, sticky headers, and touch-optimized tap targets.
-   **Offline Capable**: Service Worker caching for map tiles and essential assets.
-   **Installable**: Full PWA manifest support for "Add to Home Screen" on iOS and Android.

## 🛠️ Tech Stack

-   **Framework**: SvelteKit (Static Adapter)
-   **Styling**: Tailwind CSS v4 + Custom "Tactical" Design System
-   **Map Engine**: MapLibre GL JS
-   **Data Sources**:
    -   OpenStreetMap (Vector Tiles via OpenFreeMap)
    -   Esri World Imagery
    -   MediaWiki API (Wikipedia)
    -   Turf.js (Geospatial Analysis)
-   **Build Tool**: Vite

## 🚀 Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    # or
    bun install
    ```

2.  **Start the development server**:
    ```bash
    npm run dev
    # or
    bun run dev
    ```

3.  **Build for production**:
    ```bash
    npm run build
    ```

4.  **Preview production build**:
    ```bash
    npm run preview
    ```

## 📱 Mobile Installation (iOS)
1.  Open the app in Safari.
2.  Tap the **Share** button.
3.  Select **"Add to Home Screen"**.
4.  Launch from the home screen for the full full-screen experience.

---

## 📰 Internal Memo: Deployment of Digital Atlas v4.2

**For Immediate Release: Personal Expedition Tooling**

**A bespoke tactical instrument designed to eliminate uncertainty and maximize discovery for the 2026 Expedition.**

**Summary**
Corey O'Neal today announced the final deployment of the **Hadrian's Wall Digital Atlas**, a custom-engineered Progressive Web App (PWA) designed exclusively for his upcoming 2026 trek. Unlike commercial alternatives, this tool prioritizes specific "corridor intelligence"—filtering out noise to focus solely on the 15-minute walking radius of the trail—ensuring high-value historical and logistical data is instantly accessible, even without a cell signal.

**The Problem**
Generic mapping tools (AllTrails, Google Maps) fail in the specific context of a long-distance historical trek. They require constant connectivity, lack integrated historical context (combining Frye’s history with Bourdain’s culinary intel), and drown the user in irrelevant data. The cognitive load of switching between a guidebook, a separate map app, and a trail PDF is too high for a solo walker facing fatigue and variable weather.

**The Solution**
The Digital Atlas solves this by pre-caching high-resolution topographic and satellite data for offline use. It integrates a curated "Intelligence Registry" directly onto the map, highlighting critical logistics (pubs, water) alongside deep historical context. The "Smart Corridor" logic acts as a digital blinder, showing only what is reachable, ensuring decisions are made quickly and confidently.

> "I didn't want a map; I wanted a tactical instrument. Something that tells me not just where I am, but where the nearest pint and Roman fort are, without needing a cell tower."
> — **Corey O'Neal**, Lead Developer & Sole User.

### ❓ Internal FAQs

**Q: Why build a custom app instead of using AllTrails?**
**A:** AllTrails is for hiking; this is for *experiencing*. Generic apps don't tell you which pub has the best cask ale or which pile of rocks was once a Mithraic temple. This app integrates my specific itinerary, "Bourdain-style" food intel, and historical data into one view.

**Q: What happens when the signal dies in Northumberland?**
**A:** The system is designed as **"Offline First."** Vector tiles, route geometry, and wiki summaries are cached on the device via a Service Worker. The app functions as a standalone GPS unit, independent of the cloud.

**Q: How does this help with "decision fatigue"?**
**A:** By using "Corridor Logic." The app *only* shows points of interest within a 1.2km radius of the path. I don't need to know about a museum 5 miles away; I need to know what's reachable *now*.
