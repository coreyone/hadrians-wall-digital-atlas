export interface CompassState {
    heading: number;
    variance: number;
    needsCalibration: boolean;
    permission: PermissionStateLike;
    motionPermission: PermissionStateLike;
    accuracy: number | null;
    source: HeadingSource;
    secureContext: boolean;
}

type PermissionStateLike = 'granted' | 'denied' | 'prompt';
type HeadingSource = 'webkit' | 'alpha' | 'none';

type CompassListener = (state: CompassState) => void;

interface HeadingSample {
    value: number;
    ts: number;
}

interface HeadingReading {
    heading: number;
    source: HeadingSource;
    accuracy: number | null;
}

const CALIBRATION_WINDOW_MS = 3200;
const CALIBRATION_VARIANCE_THRESHOLD_DEG = 15;
const WEBKIT_ACCURACY_THRESHOLD_DEG = 28;
const HEADING_STALE_MS = 2200;
const MOTION_RATE_ACTIVE_THRESHOLD = 18;
const SMOOTHING_STILL = 0.14;
const SMOOTHING_ACTIVE = 0.3;

class CompassService {
    private listeners = new Set<CompassListener>();
    private headingSamples: HeadingSample[] = [];
    private lastHeading: number | null = null;
    private pendingHeading: HeadingReading | null = null;
    private lastHeadingTs = 0;
    private rafId: number | null = null;
    private running = false;
    private permission: PermissionStateLike = 'prompt';
    private motionPermission: PermissionStateLike = 'prompt';
    private source: HeadingSource = 'none';
    private accuracy: number | null = null;
    private motionRate = 0;
    private lastMotionTs = 0;

    subscribe(listener: CompassListener) {
        this.listeners.add(listener);
        listener(this.snapshot());
        return () => this.listeners.delete(listener);
    }

    async requestPermission(): Promise<boolean> {
        if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
            this.permission = 'denied';
            this.motionPermission = 'denied';
            this.emit();
            return false;
        }

        if (!this.isSecureEnvironment()) {
            this.permission = 'denied';
            this.motionPermission = 'denied';
            this.emit();
            return false;
        }

        const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
            requestPermission?: () => Promise<'granted' | 'denied'>;
        };

        if (typeof orientationEvent.requestPermission === 'function') {
            try {
                const response = await orientationEvent.requestPermission();
                this.permission = response;
            } catch {
                this.permission = 'denied';
            }
        } else {
            this.permission = 'granted';
        }

        if (typeof DeviceMotionEvent !== 'undefined') {
            const motionEvent = DeviceMotionEvent as typeof DeviceMotionEvent & {
                requestPermission?: () => Promise<'granted' | 'denied'>;
            };
            if (typeof motionEvent.requestPermission === 'function') {
                try {
                    this.motionPermission = await motionEvent.requestPermission();
                } catch {
                    this.motionPermission = 'denied';
                }
            } else {
                this.motionPermission = 'granted';
            }
        } else {
            this.motionPermission = 'denied';
        }

        this.emit();
        return this.permission === 'granted';
    }

    async start() {
        if (typeof window === 'undefined' || this.running) return this.permission === 'granted';

        if (!this.isSecureEnvironment()) {
            this.permission = 'denied';
            this.motionPermission = 'denied';
            this.emit();
            return false;
        }

        if (this.permission === 'denied') {
            this.emit();
            return false;
        }

        if (this.permission !== 'granted') {
            const granted = await this.requestPermission();
            if (!granted) {
                this.emit();
                return false;
            }
        }

        window.addEventListener('deviceorientation', this.handleOrientation, true);
        window.addEventListener('devicemotion', this.handleMotion, true);
        this.running = true;
        this.emit();
        return true;
    }

    stop() {
        if (typeof window === 'undefined' || !this.running) return;
        window.removeEventListener('deviceorientation', this.handleOrientation, true);
        window.removeEventListener('devicemotion', this.handleMotion, true);
        this.running = false;
        this.headingSamples = [];
        this.pendingHeading = null;
        this.lastHeadingTs = 0;
        this.motionRate = 0;
        this.lastMotionTs = 0;
        this.source = 'none';
        this.accuracy = null;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.emit();
    }

    private handleOrientation = (event: DeviceOrientationEvent) => {
        const reading = this.extractHeading(event);
        if (!reading) return;
        this.pendingHeading = reading;
        this.lastHeadingTs = Date.now();
        this.source = reading.source;
        this.accuracy = reading.accuracy;
        this.scheduleFrame();
    };

    private handleMotion = (event: DeviceMotionEvent) => {
        const alpha = event.rotationRate?.alpha;
        const beta = event.rotationRate?.beta;
        const gamma = event.rotationRate?.gamma;
        const rates = [alpha, beta, gamma].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        if (rates.length === 0) return;

        this.motionRate = Math.sqrt(rates.reduce((sum, value) => sum + value * value, 0));
        this.lastMotionTs = Date.now();
    };

    private scheduleFrame() {
        if (this.rafId !== null) return;
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.flushFrame();
        });
    }

    private flushFrame() {
        if (!this.pendingHeading) return;
        const reading = this.pendingHeading;
        this.pendingHeading = null;

        if (this.lastHeading === null) {
            this.lastHeading = reading.heading;
        } else {
            this.lastHeading = this.interpolateAngle(
                this.lastHeading,
                reading.heading,
                this.resolveSmoothing()
            );
        }

        this.headingSamples.push({ value: this.lastHeading, ts: Date.now() });
        this.trimSamples();
        this.emit();
    }

    private resolveSmoothing() {
        const motionFresh = Date.now() - this.lastMotionTs <= 1000;
        if (motionFresh && this.motionRate >= MOTION_RATE_ACTIVE_THRESHOLD) {
            return SMOOTHING_ACTIVE;
        }
        return SMOOTHING_STILL;
    }

    private extractHeading(event: DeviceOrientationEvent): HeadingReading | null {
        const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
        const webkitAccuracy = (event as DeviceOrientationEvent & { webkitCompassAccuracy?: number }).webkitCompassAccuracy;
        if (typeof webkitHeading === 'number' && Number.isFinite(webkitHeading)) {
            return {
                heading: this.normalizeDegrees(webkitHeading),
                source: 'webkit',
                accuracy:
                    typeof webkitAccuracy === 'number' && Number.isFinite(webkitAccuracy)
                        ? Math.abs(webkitAccuracy)
                        : null
            };
        }

        if (typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
            let heading = this.normalizeDegrees(360 - event.alpha);
            const angle = this.getScreenAngle();
            heading = this.normalizeDegrees(heading + angle);
            return { heading, source: 'alpha', accuracy: null };
        }

        return null;
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

    private getScreenAngle() {
        if (typeof window === 'undefined') return 0;
        const orientation = window.screen.orientation;
        if (orientation && typeof orientation.angle === 'number' && Number.isFinite(orientation.angle)) {
            return orientation.angle;
        }
        const legacyOrientation = (window as Window & { orientation?: number }).orientation;
        if (typeof legacyOrientation === 'number' && Number.isFinite(legacyOrientation)) {
            return legacyOrientation;
        }
        return 0;
    }

    private normalizeDegrees(value: number) {
        return ((value % 360) + 360) % 360;
    }

    private isSecureEnvironment() {
        if (typeof window === 'undefined') return false;
        return window.isSecureContext;
    }

    private interpolateAngle(from: number, to: number, t: number) {
        const delta = ((((to - from) % 360) + 540) % 360) - 180;
        return this.normalizeDegrees(from + delta * t);
    }

    private snapshot(): CompassState {
        const variance = this.computeVariance();
        const heading = this.lastHeading ?? 0;
        const stale = this.running && (Date.now() - this.lastHeadingTs > HEADING_STALE_MS || this.lastHeading === null);
        const lowAccuracy =
            this.source === 'webkit' &&
            typeof this.accuracy === 'number' &&
            this.accuracy > WEBKIT_ACCURACY_THRESHOLD_DEG;
        return {
            heading,
            variance,
            needsCalibration:
                this.permission !== 'granted' ||
                stale ||
                variance > CALIBRATION_VARIANCE_THRESHOLD_DEG ||
                lowAccuracy,
            permission: this.permission,
            motionPermission: this.motionPermission,
            accuracy: this.accuracy,
            source: stale ? 'none' : this.source,
            secureContext: this.isSecureEnvironment()
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
