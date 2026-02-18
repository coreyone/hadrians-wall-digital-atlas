class AudioService {
    private context: AudioContext | null = null;
    private stepTimer: ReturnType<typeof setInterval> | null = null;
    private currentSpeed = 0;
    private enabled = false;

    async resume() {
        if (typeof window === 'undefined') return;
        if (!this.context) {
            this.context = new AudioContext();
        }
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
        if (!enabled) {
            this.stop();
            return;
        }
        this.schedule();
    }

    updateSpeed(speedMph: number) {
        this.currentSpeed = speedMph;
        this.schedule();
    }

    stop() {
        if (this.stepTimer) {
            clearInterval(this.stepTimer);
            this.stepTimer = null;
        }
    }

    private schedule() {
        if (!this.enabled || this.currentSpeed <= 1.5) {
            this.stop();
            return;
        }

        if (!this.context) return;

        const clamped = Math.max(1.5, Math.min(4.5, this.currentSpeed));
        const intervalMs = Math.round(700 - (clamped - 1.5) * 180);

        if (this.stepTimer) {
            clearInterval(this.stepTimer);
        }

        this.stepTimer = setInterval(() => this.playFootstep(), Math.max(160, intervalMs));
    }

    private playFootstep() {
        if (!this.context) return;

        const now = this.context.currentTime;
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const filter = this.context.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.value = 95 + Math.random() * 30;

        filter.type = 'lowpass';
        filter.frequency.value = 320;

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.context.destination);

        osc.start(now);
        osc.stop(now + 0.12);
    }
}

export const audioService = new AudioService();
