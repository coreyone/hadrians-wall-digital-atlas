
export const fetchWikipediaContent = async (term: string) => {
    // Basic Wikipedia API fetch (mock for now or real implementation)
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch Wikipedia page: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            title: data.title,
            extract: data.extract,
            url: data.content_urls.desktop.page
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
