
type WikipediaSummary = {
    title: string;
    extract: string;
    content_urls?: {
        desktop?: {
            page?: string;
        };
    };
};

const fetchSummaryByTitle = async (title: string): Promise<WikipediaSummary | null> => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    return await response.json();
};

const searchWikipediaTitle = async (term: string): Promise<string | null> => {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&utf8=1&format=json&srlimit=1`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const best = data?.query?.search?.[0]?.title;
    return typeof best === "string" && best.length > 0 ? best : null;
};

export const fetchWikipediaContent = async (term: string) => {
    // Attempt exact and cleaned variants first, then fallback to Wikipedia search.
    const cleanedParen = term.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
    const cleanedRoman = term
        .replace(/\bRoman (Town|Fort)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    const candidates = Array.from(new Set([term, cleanedParen, cleanedRoman].filter(Boolean)));

    try {
        for (const candidate of candidates) {
            const summary = await fetchSummaryByTitle(candidate);
            if (!summary) continue;

            return {
                title: summary.title,
                extract: summary.extract,
                url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`
            };
        }

        const resolvedTitle = await searchWikipediaTitle(term);
        if (!resolvedTitle) {
            throw new Error("No Wikipedia title found via fallback search.");
        }

        const summary = await fetchSummaryByTitle(resolvedTitle);
        if (!summary) {
            throw new Error(`Found fallback title "${resolvedTitle}" but could not fetch summary.`);
        }

        return {
            title: summary.title,
            extract: summary.extract,
            url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`
        };
    } catch (error) {
        console.error(`Error fetching Wikipedia content for ${term}:`, error);
        return null;
    }
};

export const fetchPOIContent = async (poiId: string) => {
    // Placeholder to fetch POI descriptions from local database or Markdown files
    // For now, return a mock string
    return {
        id: poiId,
        description: `Historical context for POI ${poiId}. This location was significant for...`
    };
};
