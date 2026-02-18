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

// In-memory caches
const poiCache = new Map<string, WikiPOI[]>();
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

export async function fetchWikiPOIs(lat: number, lon: number, radius = 1200, customFetch?: typeof fetch): Promise<WikiPOI[]> {
    const cacheKey = `${lat.toFixed(4)}|${lon.toFixed(4)}|${radius}`;
    if (poiCache.has(cacheKey)) {
        return poiCache.get(cacheKey)!;
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
        const geoRes = await fetcher(`${WIKIPEDIA_API_URL}?${geoParams.toString()}`);
        const geoData = await geoRes.json();

        if (!geoData.query?.geosearch) return [];

        const pageIds = geoData.query.geosearch.map((p: any) => p.pageid).join('|');

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

        const metaRes = await fetcher(`${WIKIPEDIA_API_URL}?${metaParams.toString()}`);
        const metaData = await metaRes.json();
        const pages = metaData.query.pages;

        const results = geoData.query.geosearch.map((item: any) => {
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
        
        poiCache.set(cacheKey, results);
        return results;
    } catch (error) {
        console.error('Failed to fetch Wikipedia data:', error);
        return [];
    }
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
