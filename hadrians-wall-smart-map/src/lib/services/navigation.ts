import * as turf from '@turf/turf';
import type { Feature, LineString } from 'geojson';
import { itinerary, trailGeoJSON } from '$lib/data/trail';

const WALKING_STAGES = itinerary.filter((stage) => stage.distanceMi > 0);
const PLAN_TOTAL_MILES = WALKING_STAGES.reduce((sum, stage) => sum + stage.distanceMi, 0);
const NEXT_WINDOW_MILES = 0.310686; // ~500m

interface PositionSample {
    ts: number;
    coord: [number, number];
}

export interface NavigationMetrics {
    snappedCoord: [number, number];
    rawCoord: [number, number];
    driftMeters: number;
    distanceWalkedMiles: number;
    totalMiles: number;
    totalMilesRemaining: number;
    speedMph: number;
    eta: string;
    elevationGain: number;
    elevationLoss: number;
    weather: {
        condition: string;
        tempF: number;
    };
    dailyGoalMiles: number;
    dailyProgressMiles: number;
    dailyRemainingMiles: number;
    planTotalMiles: number;
    planProgressMiles: number;
    planRemainingMiles: number;
    gpsHeading?: number | null;
    gpsSpeedMph?: number | null;
}

class NavigationService {
    private samples: PositionSample[] = [];

    updatePosition(coord: [number, number], ts = Date.now()): NavigationMetrics {
        const line = trailGeoJSON as Feature<LineString>;
        const rawPoint = turf.point(coord);
        const snapped = turf.nearestPointOnLine(line, rawPoint, { units: 'miles' });

        const snappedCoord = snapped.geometry.coordinates as [number, number];
        const driftMeters = ((snapped.properties.dist as number | undefined) ?? 0) * 1609.34;
        const distanceWalkedMiles = (snapped.properties.location as number | undefined) ?? 0;

        const totalMiles = PLAN_TOTAL_MILES;
        const planProgressMiles = Math.max(0, Math.min(distanceWalkedMiles, PLAN_TOTAL_MILES));
        const totalMilesRemaining = Math.max(0, totalMiles - planProgressMiles);

        this.samples.push({ ts, coord: snappedCoord });
        this.samples = this.samples.filter((sample) => ts - sample.ts <= 60000);

        const speedMph = this.computeRollingSpeed();
        const eta = this.computeEta(totalMilesRemaining, speedMph, ts);
        const stage = this.resolveStage(planProgressMiles);
        const dailyGoalMiles = stage.stage.distanceMi;
        const dailyProgressMiles = Math.max(
            0,
            Math.min(dailyGoalMiles, planProgressMiles - stage.startMile)
        );
        const dailyRemainingMiles = Math.max(0, dailyGoalMiles - dailyProgressMiles);

        const upcomingMiles = Math.min(
            NEXT_WINDOW_MILES,
            Math.max(0, stage.endMile - planProgressMiles)
        );
        const stageMiles = Math.max(stage.stage.distanceMi, 0.01);
        const elevationGain = Math.round((stage.stage.elevationGainFt / stageMiles) * upcomingMiles);
        const elevationLoss = Math.round((stage.stage.elevationLossFt / stageMiles) * upcomingMiles);

        return {
            snappedCoord,
            rawCoord: coord,
            driftMeters,
            distanceWalkedMiles,
            totalMiles,
            totalMilesRemaining,
            speedMph,
            eta,
            elevationGain,
            elevationLoss,
            dailyGoalMiles,
            dailyProgressMiles,
            dailyRemainingMiles,
            planTotalMiles: totalMiles,
            planProgressMiles,
            planRemainingMiles: totalMilesRemaining,
            weather: {
                condition: stage.stage.weather.condition,
                tempF: stage.stage.weather.tempHigh
            }
        };
    }

    private computeRollingSpeed() {
        if (this.samples.length < 2) return 0;

        const first = this.samples[0];
        const last = this.samples[this.samples.length - 1];
        const elapsedHours = Math.max((last.ts - first.ts) / 3600000, 1 / 3600000);

        let miles = 0;
        for (let i = 1; i < this.samples.length; i++) {
            miles += turf.distance(
                turf.point(this.samples[i - 1].coord),
                turf.point(this.samples[i].coord),
                { units: 'miles' }
            );
        }

        return miles / elapsedHours;
    }

    private computeEta(milesRemaining: number, speedMph: number, nowTs: number) {
        const effectiveSpeed = speedMph > 0.4 ? speedMph : 2.8;
        const etaMs = nowTs + (milesRemaining / effectiveSpeed) * 3600000;
        return new Date(etaMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    private resolveStage(distanceWalkedMiles: number) {
        let cursor = 0;
        for (const stage of WALKING_STAGES) {
            const end = cursor + stage.distanceMi;
            if (distanceWalkedMiles <= end) {
                return {
                    stage,
                    startMile: cursor,
                    endMile: end
                };
            }
            cursor = end;
        }

        const stage = WALKING_STAGES[WALKING_STAGES.length - 1];
        return {
            stage,
            startMile: Math.max(0, cursor - stage.distanceMi),
            endMile: cursor
        };
    }
}

export const navigationService = new NavigationService();
