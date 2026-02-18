import * as turf from '@turf/turf';
import type { Feature, LineString } from 'geojson';
import type { WikiPOI } from '$lib/services/wikipedia';

interface SelectRenderableWikiPOIsOptions {
    renderedPageIds: Set<number>;
    corridor?: any;
    fallbackLine?: Feature<LineString> | LineString | null;
    fallbackMaxDistanceKm?: number;
}

export function selectRenderableWikiPOIs(
    pois: WikiPOI[],
    {
        renderedPageIds,
        corridor = null,
        fallbackLine = null,
        fallbackMaxDistanceKm = 2.5
    }: SelectRenderableWikiPOIsOptions
): WikiPOI[] {
    const unseen = pois.filter((poi) => !renderedPageIds.has(poi.pageid));
    if (unseen.length === 0) return [];

    const corridorCandidates: WikiPOI[] = [];
    let corridorErrored = false;

    if (corridor) {
        for (const poi of unseen) {
            try {
                const pt = turf.point([poi.lon, poi.lat]);
                if (turf.booleanPointInPolygon(pt, corridor)) {
                    corridorCandidates.push(poi);
                }
            } catch {
                corridorErrored = true;
                break;
            }
        }
        if (!corridorErrored) {
            if (corridorCandidates.length > 0 || !fallbackLine) {
                return corridorCandidates;
            }
        }
    }

    if (fallbackLine) {
        const line =
            fallbackLine.type === 'Feature'
                ? fallbackLine
                : turf.feature(fallbackLine);
        return unseen.filter((poi) => {
            const pt = turf.point([poi.lon, poi.lat]);
            const distance = turf.pointToLineDistance(pt, line, {
                units: 'kilometers'
            });
            return distance <= fallbackMaxDistanceKm;
        });
    }

    return corridorErrored ? unseen : [];
}
