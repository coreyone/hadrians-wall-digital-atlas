import { describe, expect, it } from 'vitest';
import * as turf from '@turf/turf';
import { selectRenderableWikiPOIs } from './wikiPins';
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
