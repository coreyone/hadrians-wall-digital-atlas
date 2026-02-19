import { describe, expect, it } from 'vitest';
import * as turf from '@turf/turf';
import { selectRenderableWikiPOIs, getClusteredWikiPOIs } from './wikiPins';
import type { WikiPOI } from '$lib/services/wikipedia';

const samplePOI = (pageid: number, lon: number, lat: number): WikiPOI => ({
    pageid,
    title: `POI-${pageid}`,
    lat,
    lon,
    dist: 100,
    primary: '',
    url: `https://example.com/${pageid}`,
    rank: 50
});

describe('selectRenderableWikiPOIs', () => {
    it('filters to unseen POIs inside the corridor', () => {
        const corridor = turf.polygon([
            [
                [-2.2, 55.0],
                [-2.0, 55.0],
                [-2.0, 55.2],
                [-2.2, 55.2],
                [-2.2, 55.0]
            ]
        ]);

        const pois = [
            samplePOI(1, -2.1, 55.1),
            samplePOI(2, -1.6, 55.1)
        ];

        const selected = selectRenderableWikiPOIs(pois, {
            renderedPageIds: new Set([1]),
            corridor
        });

        expect(selected).toHaveLength(0);
    });

    it('falls back to line-distance filtering when corridor is invalid', () => {
        const badCorridor = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: {} } as any;
        const line = turf.lineString([
            [-2.2, 55.0],
            [-2.0, 55.2]
        ]);
        const near = samplePOI(11, -2.1, 55.1);
        const far = samplePOI(12, -1.0, 55.1);

        const selected = selectRenderableWikiPOIs([near, far], {
            renderedPageIds: new Set<number>(),
            corridor: badCorridor,
            fallbackLine: line,
            fallbackMaxDistanceKm: 2
        });

        expect(selected.map((poi) => poi.pageid)).toEqual([11]);
    });
});

describe('getClusteredWikiPOIs', () => {
    const mockPOIs: WikiPOI[] = [
        { pageid: 1, title: 'POI 1', lat: 55.0, lon: -2.0, dist: 10, primary: 'yes', url: '', rank: 50 },
        { pageid: 2, title: 'POI 2', lat: 55.0001, lon: -2.0001, dist: 10, primary: 'yes', url: '', rank: 40 },
        { pageid: 3, title: 'POI 3', lat: 55.1, lon: -2.1, dist: 10, primary: 'yes', url: '', rank: 30 }
    ];

    it('clusters nearby POIs at low zoom', () => {
        const bbox: [number, number, number, number] = [-2.2, 54.9, -1.9, 55.2];
        const clusters = getClusteredWikiPOIs(mockPOIs, 10, bbox);
        
        // POI 1 and 2 should be clustered, POI 3 should be separate
        expect(clusters.length).toBeLessThan(3);
    });

    it('does not cluster distant POIs at high zoom', () => {
        const bbox: [number, number, number, number] = [-2.2, 54.9, -1.9, 55.2];
        const clusters = getClusteredWikiPOIs(mockPOIs, 18, bbox);
        
        expect(clusters.length).toBe(3);
    });

    it('correctly reduces properties for clusters', () => {
        const bbox: [number, number, number, number] = [-2.2, 54.9, -1.9, 55.2];
        const clusters = getClusteredWikiPOIs(mockPOIs, 5, bbox);
        
        expect(clusters.length).toBe(1);
        const cluster = clusters[0] as any;
        expect(cluster.properties.cluster).toBe(true);
        expect(cluster.properties.point_count).toBe(3);
        expect(cluster.properties.topTitle).toBe('POI 1'); // Highest rank
    });
});
