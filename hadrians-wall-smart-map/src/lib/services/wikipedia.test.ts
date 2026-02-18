import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __resetWikipediaCachesForTests,
    fetchWikiPOIs
} from './wikipedia';

function jsonResponse(body: any) {
    return {
        ok: true,
        json: async () => body
    } as Response;
}

describe('fetchWikiPOIs resilience', () => {
    beforeEach(() => {
        __resetWikipediaCachesForTests();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('retries transient failures and returns results', async () => {
        const fetcher = vi
            .fn()
            .mockRejectedValueOnce(new Error('transient fail'))
            .mockResolvedValueOnce(
                jsonResponse({
                    query: {
                        geosearch: [
                            {
                                pageid: 100,
                                title: 'Sample Fort',
                                lat: 55.0,
                                lon: -2.2,
                                dist: 120,
                                primary: ''
                            }
                        ]
                    }
                })
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    query: {
                        pages: {
                            100: {
                                extract: 'Roman frontier site',
                                fullurl: 'https://en.wikipedia.org/?curid=100'
                            }
                        }
                    }
                })
            );

        const pois = await fetchWikiPOIs(55.0, -2.2, 3000, fetcher as unknown as typeof fetch);
        expect(pois).toHaveLength(1);
        expect(pois[0].pageid).toBe(100);
        expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it('falls back to nearby cached POIs even when cache radius differs', async () => {
        const warmFetcher = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({
                    query: {
                        geosearch: [
                            {
                                pageid: 100,
                                title: 'Sample Fort',
                                lat: 55.0,
                                lon: -2.2,
                                dist: 120,
                                primary: ''
                            }
                        ]
                    }
                })
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    query: {
                        pages: {
                            100: {
                                extract: 'Roman frontier site',
                                fullurl: 'https://en.wikipedia.org/?curid=100'
                            }
                        }
                    }
                })
            );

        const warmed = await fetchWikiPOIs(55.0, -2.2, 8000, warmFetcher as unknown as typeof fetch);
        expect(warmed).toHaveLength(1);

        const emptyFetcher = vi
            .fn()
            .mockResolvedValue(jsonResponse({ query: { geosearch: [] } }));

        const fallback = await fetchWikiPOIs(55.01, -2.21, 3000, emptyFetcher as unknown as typeof fetch);
        expect(fallback).toHaveLength(1);
        expect(fallback[0].pageid).toBe(100);
    });

    it('does not cache empty failures permanently', async () => {
        const failingFetcher = vi.fn().mockRejectedValue(new Error('network down'));
        const first = await fetchWikiPOIs(54.99, -2.3, 3000, failingFetcher as unknown as typeof fetch);
        expect(first).toEqual([]);

        const recoveringFetcher = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({
                    query: {
                        geosearch: [
                            {
                                pageid: 200,
                                title: 'Recovered Site',
                                lat: 54.99,
                                lon: -2.3,
                                dist: 90,
                                primary: ''
                            }
                        ]
                    }
                })
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    query: {
                        pages: {
                            200: {
                                extract: 'Recovered data',
                                fullurl: 'https://en.wikipedia.org/?curid=200'
                            }
                        }
                    }
                })
            );

        const second = await fetchWikiPOIs(54.99, -2.3, 3000, recoveringFetcher as unknown as typeof fetch);
        expect(second).toHaveLength(1);
        expect(second[0].pageid).toBe(200);
        expect(recoveringFetcher).toHaveBeenCalledTimes(2);
    });
});
