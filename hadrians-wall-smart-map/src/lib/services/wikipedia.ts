export interface WikiPOI {
    pageid: number;
    title: string;
    lat: number;
    lon: number;
    dist: number;
    primary: string;
    url: string;
    summary?: string;
    category?: string; 
    rank: number; // Bourdain Score / Impact
    views?: number;
}

const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';
const MAX_FETCH_ATTEMPTS = 3;
const NEARBY_CACHE_FALLBACK_KM = 20;

// In-memory caches
interface PoiCacheEntry {
    lat: number;
    lon: number;
    radius: number;
    pois: WikiPOI[];
}
const poiCache = new Map<string, PoiCacheEntry>();
const summaryCache = new Map<number, string>();

const BOURDAIN_KEYWORDS = [
    'roman', 'fort', 'wall', 'brewery', 'inn', 'pub', 'vineyard', 
    'castle', 'ancient', 'traditional', 'authentic', 'ruin', 'hidden',
    'archaeological', 'medieval', 'ale', 'wine', 'food', 'stone'
];

function calculateRank(item: any): number {
    let score = 0;
    const title = item.title.toLowerCase();
    
    // 1. Keyword match (+15 per match)
    BOURDAIN_KEYWORDS.forEach(word => {
        if (title.includes(word)) score += 15;
    });

    // 2. Page views (if available, logarithmic boost)
    if (item.pageviews) {
        const totalViews = Object.values(item.pageviews).reduce((a: any, b: any) => a + b, 0) as number;
        score += Math.log10(totalViews + 1) * 5;
    }

    // 3. Proximity boost (closer = higher base relevance)
    score += Math.max(0, 20 - (item.dist / 100));

    return Math.round(score);
}

function toCacheKey(lat: number, lon: number, radius: number) {
    return `${lat.toFixed(4)}|${lon.toFixed(4)}|${radius}`;
}

function toKmDistance(aLat: number, aLon: number, bLat: number, bLon: number) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const hav =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * earthRadiusKm * Math.asin(Math.sqrt(hav));
}

function findNearbyCachedPOIs(lat: number, lon: number, radius: number): WikiPOI[] {
    let best: { distance: number; pois: WikiPOI[] } | null = null;
    for (const entry of poiCache.values()) {
        if (entry.pois.length === 0) continue;
        const distance = toKmDistance(lat, lon, entry.lat, entry.lon);
        if (distance > NEARBY_CACHE_FALLBACK_KM) continue;
        if (!best || distance < best.distance) {
            best = { distance, pois: entry.pois };
        }
    }
    return best?.pois ?? [];
}

function cachePOIsIfAny(key: string, lat: number, lon: number, radius: number, pois: WikiPOI[]) {
    if (pois.length === 0) return;
    poiCache.set(key, { lat, lon, radius, pois });
}

async function fetchJsonWithRetry(
    url: string,
    fetcher: typeof fetch
) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
        try {
            const response = await fetcher(url);
            if ('ok' in response && response.ok === false) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

export async function fetchWikiPOIs(lat: number, lon: number, radius = 1200, customFetch?: typeof fetch): Promise<WikiPOI[]> {
    const cacheKey = toCacheKey(lat, lon, radius);
    if (poiCache.has(cacheKey)) {
        return poiCache.get(cacheKey)!.pois;
    }

    const fetcher = customFetch || fetch;

    // Phase 1: Geosearch to get IDs
    const geoParams = new URLSearchParams({
        action: 'query',
        list: 'geosearch',
        gscoord: `${lat}|${lon}`,
        gsradius: radius.toString(),
        gslimit: '50',
        format: 'json',
        origin: '*'
    });

    try {
        const geoData = await fetchJsonWithRetry(`${WIKIPEDIA_API_URL}?${geoParams.toString()}`, fetcher);
        const geoSearch = geoData.query?.geosearch;
        if (!Array.isArray(geoSearch) || geoSearch.length === 0) {
            const nearby = findNearbyCachedPOIs(lat, lon, radius);
            cachePOIsIfAny(cacheKey, lat, lon, radius, nearby);
            return nearby;
        }

        const pageIds = geoSearch.map((p: any) => p.pageid).join('|');

        // Phase 2: Bulk fetch metadata (extracts + pageviews)
        const metaParams = new URLSearchParams({
            action: 'query',
            prop: 'extracts|pageviews|info',
            exintro: '1',
            explaintext: '1',
            exchars: '300', // Keep summaries light for bulk fetch
            pvipdays: '30',
            pageids: pageIds,
            inprop: 'url',
            format: 'json',
            origin: '*'
        });

        const metaData = await fetchJsonWithRetry(`${WIKIPEDIA_API_URL}?${metaParams.toString()}`, fetcher);
        const pages = metaData.query?.pages ?? {};

        const results = geoSearch.map((item: any) => {
            const meta = pages[item.pageid];
            const rank = calculateRank({ ...item, ...meta });
            
            // Cache the summary immediately to prevent future requests
            if (meta?.extract) {
                summaryCache.set(item.pageid, meta.extract);
            }

            return {
                pageid: item.pageid,
                title: item.title,
                lat: item.lat,
                lon: item.lon,
                dist: item.dist,
                primary: item.primary,
                url: meta?.fullurl || `https://en.wikipedia.org/?curid=${item.pageid}`,
                summary: meta?.extract || "",
                rank
            };
        });

        // Sort by rank descending
        results.sort((a: WikiPOI, b: WikiPOI) => b.rank - a.rank);

        const output = results.length > 0 ? results : findNearbyCachedPOIs(lat, lon, radius);
        cachePOIsIfAny(cacheKey, lat, lon, radius, output);
        if (output.length === 0) {
            console.warn('Wikipedia geosearch returned no usable POIs for:', {
                lat,
                lon,
                radius
            });
        }
        return output;
    } catch (error) {
        const nearby = findNearbyCachedPOIs(lat, lon, radius);
        cachePOIsIfAny(cacheKey, lat, lon, radius, nearby);
        if (nearby.length > 0) return nearby;
        console.error('Failed to fetch Wikipedia data:', error);
        return [];
    }
}

export function __resetWikipediaCachesForTests() {
    poiCache.clear();
    summaryCache.clear();
}

export function __seedWikipediaPoiCacheForTests(lat: number, lon: number, radius: number, pois: WikiPOI[]) {
    poiCache.set(toCacheKey(lat, lon, radius), { lat, lon, radius, pois });
}

export async function fetchPageSummary(pageid: number): Promise<string> {
    if (summaryCache.has(pageid)) {
        return summaryCache.get(pageid)!;
    }
    // Fallback if not already fetched in bulk
    const params = new URLSearchParams({
        action: 'query',
        prop: 'extracts',
        exintro: 'true',
        explaintext: 'true',
        pageids: pageid.toString(),
        format: 'json',
        origin: '*'
    });

    try {
        const response = await fetch(`${WIKIPEDIA_API_URL}?${params.toString()}`);
        const data = await response.json();
        if (data.query && data.query.pages && data.query.pages[pageid]) {
            const extract = data.query.pages[pageid].extract;
            summaryCache.set(pageid, extract);
            return extract;
        }
        return "";
    } catch (error) {
        return "";
    }
}
