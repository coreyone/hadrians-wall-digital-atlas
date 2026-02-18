import * as turf from '@turf/turf';
import type { HikerBadge } from '$lib/stores/hikerMode';

interface BadgeTarget {
    id: string;
    name: string;
    description: string;
    coords: [number, number];
    radiusMeters: number;
}

const BADGE_TARGETS: BadgeTarget[] = [
    {
        id: 'birdoswald',
        name: 'Banna Vanguard',
        description: 'Reached Birdoswald and the longest surviving wall segment.',
        coords: [-2.6023, 54.9894],
        radiusMeters: 130
    },
    {
        id: 'housesteads',
        name: 'Housesteads Sentinel',
        description: 'Passed Housesteads Roman Fort on the ridgeline.',
        coords: [-2.331, 55.013],
        radiusMeters: 140
    },
    {
        id: 'mithras',
        name: 'Mithras Initiate',
        description: 'Stepped into the Carrawburgh Temple of Mithras perimeter.',
        coords: [-2.223, 55.036],
        radiusMeters: 120
    },
    {
        id: 'corbridge',
        name: 'Frontier Finisher',
        description: 'Entered Corbridge Roman Town and completed the frontier arc.',
        coords: [-2.017, 54.975],
        radiusMeters: 150
    }
];

class GamificationService {
    private unlocked = new Set<string>();

    update(currentCoord: [number, number], walkedMiles: number, totalMiles: number) {
        const point = turf.point(currentCoord);
        const newlyUnlocked: HikerBadge[] = [];

        for (const target of BADGE_TARGETS) {
            if (this.unlocked.has(target.id)) continue;

            const distanceMeters =
                turf.distance(point, turf.point(target.coords), { units: 'kilometers' }) * 1000;

            if (distanceMeters <= target.radiusMeters) {
                this.unlocked.add(target.id);
                newlyUnlocked.push({
                    id: target.id,
                    name: target.name,
                    description: target.description
                });
            }
        }

        const integrity = Math.max(0, Math.min(100, (walkedMiles / Math.max(totalMiles, 0.1)) * 100));

        return {
            integrity,
            badges: this.getBadges(),
            newlyUnlocked
        };
    }

    getBadges(): HikerBadge[] {
        return BADGE_TARGETS.filter((target) => this.unlocked.has(target.id)).map((target) => ({
            id: target.id,
            name: target.name,
            description: target.description
        }));
    }

    reset() {
        this.unlocked.clear();
    }
}

export const gamificationService = new GamificationService();
