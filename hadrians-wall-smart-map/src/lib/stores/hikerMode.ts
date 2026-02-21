import { writable } from 'svelte/store';

export interface HikerBadge {
    id: string;
    name: string;
    description: string;
}

interface HikerState {
    isActive: boolean;
    is3D: boolean;
    isCompassActive: boolean;
    isCalibrating: boolean;
    heading: number;
    pitch: number;
    distanceToday: number;
    dailyGoalMiles: number;
    dailyRemainingMiles: number;
    requiredSpeedMphToDailyGoal: number | null;
    requiredPaceMinPerMileToDailyGoal: number | null;
    dailyGoalDeadlinePassed: boolean;
    distanceWalkedMiles: number;
    totalMiles: number;
    totalMilesRemaining: number;
    fullTripGoalMiles: number;
    fullTripProgressMiles: number;
    fullTripRemainingMiles: number;
    speedMph: number;
    eta: string;
    elevationGain: number;
    elevationLoss: number;
    integrity: number; // 0-100%
    isLowBattery: boolean;
    simplifiedHUD: boolean;
    isDaytime: boolean;
    weatherTempF: number;
    weatherCondition: string;
    driftMeters: number;
    isOffTrail: boolean;
    badges: HikerBadge[];
    liveBattery?: number;
    liveLastSeen?: string;
}

const initialState: HikerState = {
    isActive: false,
    is3D: false,
    isCompassActive: false,
    isCalibrating: false,
    heading: 0,
    pitch: 60,
    distanceToday: 0,
    dailyGoalMiles: 0,
    dailyRemainingMiles: 0,
    requiredSpeedMphToDailyGoal: null,
    requiredPaceMinPerMileToDailyGoal: null,
    dailyGoalDeadlinePassed: false,
    distanceWalkedMiles: 0,
    totalMiles: 46,
    totalMilesRemaining: 46,
    fullTripGoalMiles: 46,
    fullTripProgressMiles: 0,
    fullTripRemainingMiles: 46,
    speedMph: 0,
    eta: '--:--',
    elevationGain: 0,
    elevationLoss: 0,
    integrity: 0,
    isLowBattery: false,
    simplifiedHUD: false,
    isDaytime: true,
    weatherTempF: 54,
    weatherCondition: 'Partly Cloudy',
    driftMeters: 0,
    isOffTrail: false,
    badges: [],
    liveBattery: undefined,
    liveLastSeen: undefined
};

function createHikerStore() {
    const { subscribe, set, update } = writable<HikerState>(initialState);

    return {
        subscribe,
        activate: () =>
            update((s) => ({
                ...s,
                isActive: true,
                is3D: !s.simplifiedHUD,
                pitch: s.simplifiedHUD ? 0 : 60
            })),
        deactivate: () =>
            update((s) => ({
                ...s,
                isActive: false,
                is3D: false,
                isCalibrating: false,
                isOffTrail: false,
                driftMeters: 0
            })),
        toggleCompass: () =>
            update((s) => ({
                ...s,
                isCompassActive: !s.isCompassActive
            })),
        setHeading: (heading: number) =>
            update((s) => ({
                ...s,
                heading
            })),
        updateMetrics: (metrics: Partial<HikerState>) =>
            update((s) => ({
                ...s,
                ...metrics
            })),
        setLowBattery: (isLowBattery: boolean) =>
            update((s) => ({
                ...s,
                isLowBattery
            })),
        setBadges: (badges: HikerBadge[]) =>
            update((s) => ({
                ...s,
                badges
            })),
        toggleSimplified: () =>
            update((s) => {
                const simplifiedHUD = !s.simplifiedHUD;
                return {
                    ...s,
                    simplifiedHUD,
                    is3D: s.isActive ? !simplifiedHUD : false,
                    pitch: simplifiedHUD ? 0 : 60
                };
            }),
        reset: () => set(initialState)
    };
}

export const hikerMode = createHikerStore();
