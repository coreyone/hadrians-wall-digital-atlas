import * as turf from '@turf/turf';
import type { Feature, LineString, Point } from 'geojson';
import type { WikiPOI } from '$lib/services/wikipedia';
import Supercluster from 'supercluster';

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

/**
 * Clusters POIs using Supercluster.
 * Returns a mix of individual WikiPOIs and Clusters.
 */
export function getClusteredWikiPOIs(
    pois: WikiPOI[],
    zoom: number,
    bbox: [number, number, number, number],
    options: { radius?: number; maxZoom?: number } = {}
) {
    const index = new Supercluster({
        radius: options.radius || 40,
        maxZoom: options.maxZoom || 16,
        // We can attach properties to clusters
        map: (props) => ({ 
            sumRank: props.rank || 0,
            count: 1,
            topRank: props.rank || 0,
            topTitle: props.title || ''
        }),
        reduce: (acc, props) => {
            acc.sumRank += props.sumRank;
            acc.count += props.count;
            if (props.topRank > acc.topRank) {
                acc.topRank = props.topRank;
                acc.topTitle = props.topTitle;
            }
        }
    });

    const features: Feature<Point, WikiPOI>[] = pois.map(poi => ({
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [poi.lon, poi.lat]
        },
        properties: poi
    }));

    index.load(features);
    return index.getClusters(bbox, Math.floor(zoom));
}
