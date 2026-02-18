export interface CompassState {
    heading: number;
    variance: number;
    needsCalibration: boolean;
    permission: PermissionStateLike;
}

type PermissionStateLike = 'granted' | 'denied' | 'prompt';

type CompassListener = (state: CompassState) => void;

interface HeadingSample {
    value: number;
    ts: number;
}

const CALIBRATION_WINDOW_MS = 3000;
const CALIBRATION_THRESHOLD_DEG = 15;
const SMOOTHING = 0.22;

class CompassService {
    private listeners = new Set<CompassListener>();
    private headingSamples: HeadingSample[] = [];
    private lastHeading = 0;
    private running = false;
    private permission: PermissionStateLike = 'prompt';

    subscribe(listener: CompassListener) {
        this.listeners.add(listener);
        listener(this.snapshot());
        return () => this.listeners.delete(listener);
    }

    async requestPermission(): Promise<boolean> {
        if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
            this.permission = 'denied';
            return false;
        }

        const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
            requestPermission?: () => Promise<'granted' | 'denied'>;
        };

        if (typeof orientationEvent.requestPermission === 'function') {
            try {
                const response = await orientationEvent.requestPermission();
                this.permission = response;
                return response === 'granted';
            } catch {
                this.permission = 'denied';
                return false;
            }
        }

        this.permission = 'granted';
        return true;
    }

    async start() {
        if (typeof window === 'undefined' || this.running) return this.permission === 'granted';

        if (this.permission !== 'granted') {
            const granted = await this.requestPermission();
            if (!granted) {
                this.emit();
                return false;
            }
        }

        window.addEventListener('deviceorientation', this.handleOrientation, true);
        this.running = true;
        return true;
    }

    stop() {
        if (typeof window === 'undefined' || !this.running) return;
        window.removeEventListener('deviceorientation', this.handleOrientation, true);
        this.running = false;
        this.headingSamples = [];
    }

    private handleOrientation = (event: DeviceOrientationEvent) => {
        const heading = this.extractHeading(event);
        if (heading === null) return;

        if (this.lastHeading === 0) {
            this.lastHeading = heading;
        } else {
            this.lastHeading = this.interpolateAngle(this.lastHeading, heading, SMOOTHING);
        }

        this.headingSamples.push({ value: this.lastHeading, ts: Date.now() });
        this.trimSamples();
        this.emit();
    };

    private extractHeading(event: DeviceOrientationEvent): number | null {
        const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
        let heading = typeof webkitHeading === 'number' ? webkitHeading : null;

        if (heading === null && typeof event.alpha === 'number') {
            heading = (360 - event.alpha) % 360;
        }

        if (heading === null) return null;

        const rotation = typeof window !== 'undefined' ? window.screen.orientation?.angle ?? 0 : 0;
        heading = (heading + rotation + 360) % 360;
        return heading;
    }

    private trimSamples() {
        const cutoff = Date.now() - CALIBRATION_WINDOW_MS;
        while (this.headingSamples.length > 0 && this.headingSamples[0].ts < cutoff) {
            this.headingSamples.shift();
        }
    }

    private computeVariance() {
        if (this.headingSamples.length < 4) return 0;

        const radians = this.headingSamples.map((sample) => (sample.value * Math.PI) / 180);
        const x = radians.reduce((sum, value) => sum + Math.cos(value), 0) / radians.length;
        const y = radians.reduce((sum, value) => sum + Math.sin(value), 0) / radians.length;
        const r = Math.sqrt(x * x + y * y);
        if (r <= 0) return 180;
        return Math.sqrt(-2 * Math.log(r)) * (180 / Math.PI);
    }

    private interpolateAngle(from: number, to: number, t: number) {
        const delta = ((((to - from) % 360) + 540) % 360) - 180;
        return (from + delta * t + 360) % 360;
    }

    private snapshot(): CompassState {
        const variance = this.computeVariance();
        return {
            heading: this.lastHeading,
            variance,
            needsCalibration: variance > CALIBRATION_THRESHOLD_DEG,
            permission: this.permission
        };
    }

    private emit() {
        const state = this.snapshot();
        for (const listener of this.listeners) {
            listener(state);
        }
    }
}

export const compassService = new CompassService();
