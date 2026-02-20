import { fetchWikiPOIs } from '$lib/services/wikipedia';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, data }) => {
    // Initial coordinates: Once Brewed [-2.3958, 55.0036]
    // Note: Wikipedia API takes lat, lon
    // We pass the SvelteKit fetch to the service for optimized SSR requests
    const initialPOIs = await fetchWikiPOIs(55.0036, -2.3958, 8000, fetch);

    return {
        ...data,
        initialPOIs
    };
};
