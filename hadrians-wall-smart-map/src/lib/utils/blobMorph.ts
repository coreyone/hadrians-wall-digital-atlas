const PH = 34;

export interface BlobMorphOptions {
    from: HTMLElement | DOMRect;
    to: HTMLElement | DOMRect;
    direction?: 'expand' | 'collapse';
    durationMs?: number;
    bounce?: number;
    zIndex?: number;
    contentSource?: HTMLElement | null;
}

interface SpringConfig {
    stiffness: number;
    damping: number;
    mass: number;
}

interface MorphShape {
    d: string;
    width: number;
    height: number;
}

function toRect(target: HTMLElement | DOMRect): DOMRect {
    if (target instanceof HTMLElement) return target.getBoundingClientRect();
    return target;
}

function roundPx(value: number) {
    return Number(value.toFixed(2));
}

function lerp(from: number, to: number, t: number) {
    return from + (to - from) * t;
}

function clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
}

function squishSpring(durationSec: number, defaultDurationSec = 0.62, bounce = 0.38): SpringConfig {
    const normalizedDuration = Math.max(0.42, durationSec / defaultDurationSec);
    const boundedBounce = clamp01(bounce);
    const stiffness = 230 + boundedBounce * 340;
    const damping = 28 - boundedBounce * 9;
    const mass = Math.max(0.56, Math.min(2.2, normalizedDuration));
    return { stiffness, damping, mass };
}

function pillPathCentered(pillWidth: number, maxWidth: number): MorphShape {
    const pr = PH / 2;
    const x = (maxWidth - pillWidth) / 2;
    const d = [
        `M ${roundPx(x)},${roundPx(pr)}`,
        `A ${roundPx(pr)},${roundPx(pr)} 0 0 1 ${roundPx(x + pr)},0`,
        `H ${roundPx(x + pillWidth - pr)}`,
        `A ${roundPx(pr)},${roundPx(pr)} 0 0 1 ${roundPx(x + pillWidth)},${roundPx(pr)}`,
        `A ${roundPx(pr)},${roundPx(pr)} 0 0 1 ${roundPx(x + pillWidth - pr)},${roundPx(PH)}`,
        `H ${roundPx(x + pr)}`,
        `A ${roundPx(pr)},${roundPx(pr)} 0 0 1 ${roundPx(x)},${roundPx(pr)}`,
        'Z'
    ].join(' ');
    return {
        d,
        width: pillWidth,
        height: PH
    };
}

export function morphPathCenter(pw: number, bw: number, th: number, tInput: number): MorphShape {
    const t = clamp01(tInput);
    const pillW = Math.max(PH, Math.min(pw, bw));
    const blobW = Math.max(pillW, bw);
    const targetH = Math.max(PH, th);
    const bodyH = PH + (targetH - PH) * t;

    if (t <= 0 || bodyH - PH < 8) {
        return pillPathCentered(pillW, blobW);
    }

    const pr = PH / 2;
    const curve = 14 * t;
    const bodyTop = PH - curve;
    const cr = Math.min(16, (bodyH - PH) * 0.45);
    const bodyW = pillW + (blobW - pillW) * t;
    const qEndX = Math.min(pillW + curve, bodyW - cr);
    const ox = (blobW - bodyW) / 2;

    const d = [
        `M ${roundPx(ox)},${roundPx(pr)}`,
        `A ${roundPx(pr)},${roundPx(pr)} 0 0 1 ${roundPx(ox + pr)},0`,
        `H ${roundPx(ox + pillW - pr)}`,
        `A ${roundPx(pr)},${roundPx(pr)} 0 0 1 ${roundPx(ox + pillW)},${roundPx(pr)}`,
        `Q ${roundPx(ox + pillW)},${roundPx(bodyTop + curve)} ${roundPx(ox + qEndX)},${roundPx(bodyTop + curve)}`,
        `A ${roundPx(cr)},${roundPx(cr)} 0 0 1 ${roundPx(ox + bodyW)},${roundPx(bodyTop + curve + cr)}`,
        `V ${roundPx(bodyH - cr)}`,
        `A ${roundPx(cr)},${roundPx(cr)} 0 0 1 ${roundPx(ox + bodyW - cr)},${roundPx(bodyH)}`,
        `H ${roundPx(ox + cr)}`,
        `A ${roundPx(cr)},${roundPx(cr)} 0 0 1 ${roundPx(ox)},${roundPx(bodyH - cr)}`,
        `V ${roundPx(pr)}`,
        `A ${roundPx(pr)},${roundPx(pr)} 0 0 1 ${roundPx(ox)},${roundPx(pr)}`,
        'Z'
    ].join(' ');

    return {
        d,
        width: bodyW,
        height: bodyH
    };
}

function buildOverlay(zIndex: number) {
    const root = document.createElement('div');
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.pointerEvents = 'none';
    root.style.zIndex = String(zIndex);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(window.innerWidth));
    svg.setAttribute('height', String(window.innerHeight));
    svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    svg.style.position = 'absolute';
    svg.style.inset = '0';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    const gradientId = `blob-grad-${Math.random().toString(36).slice(2)}`;
    grad.setAttribute('id', gradientId);
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '100%');

    const stopA = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopA.setAttribute('offset', '0%');
    stopA.setAttribute('stop-color', '#fef3c7');
    const stopB = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopB.setAttribute('offset', '60%');
    stopB.setAttribute('stop-color', '#fbbf24');
    const stopC = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopC.setAttribute('offset', '100%');
    stopC.setAttribute('stop-color', '#d97706');
    grad.append(stopA, stopB, stopC);

    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    const glowId = `blob-glow-${Math.random().toString(36).slice(2)}`;
    glow.setAttribute('id', glowId);
    const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '6');
    blur.setAttribute('result', 'blur');
    const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const mergeA = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeA.setAttribute('in', 'blur');
    const mergeB = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeB.setAttribute('in', 'SourceGraphic');
    merge.append(mergeA, mergeB);
    glow.append(blur, merge);

    defs.append(grad, glow);
    svg.append(defs);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', `url(#${gradientId})`);
    path.setAttribute('filter', `url(#${glowId})`);
    path.setAttribute('opacity', '0.98');
    svg.append(path);

    root.append(svg);
    document.body.append(root);

    return {
        root,
        path
    };
}

function resolveSpriteSrc(contentSource: HTMLElement | null | undefined) {
    if (!contentSource) return null;
    if (contentSource instanceof HTMLImageElement) return contentSource.src || null;
    const img = contentSource.querySelector('img');
    if (img && img instanceof HTMLImageElement) return img.src || null;
    return null;
}

export async function runBlobMorph(options: BlobMorphOptions) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const fromRect = toRect(options.from);
    const toRectResolved = toRect(options.to);
    if (fromRect.width <= 0 || fromRect.height <= 0 || toRectResolved.width <= 0 || toRectResolved.height <= 0) return;

    const direction = options.direction ?? 'expand';
    const durationMs = Math.max(220, options.durationMs ?? 620);
    const spring = squishSpring(durationMs / 1000, 0.62, options.bounce ?? 0.38);
    const overlay = buildOverlay(options.zIndex ?? 115);

    const spriteSrc = resolveSpriteSrc(
        options.contentSource ??
            (options.from instanceof HTMLElement ? options.from : null)
    );
    const sprite =
        spriteSrc !== null
            ? (() => {
                    const el = document.createElement('img');
                    el.src = spriteSrc;
                    el.alt = '';
                    el.decoding = 'async';
                    el.style.position = 'fixed';
                    el.style.left = '0';
                    el.style.top = '0';
                    el.style.margin = '0';
                    el.style.pointerEvents = 'none';
                    el.style.transformOrigin = '50% 50%';
                    el.style.willChange = 'transform, width, height';
                    el.style.transition = 'none';
                    el.style.filter = 'drop-shadow(0 1px 2px rgba(15, 23, 42, 0.4))';
                    overlay.root.append(el);
                    return el;
              })()
            : null;

    if (sprite) {
        const initialSize = Math.max(18, Math.min(fromRect.width, fromRect.height) * 0.68);
        sprite.style.width = `${roundPx(initialSize)}px`;
        sprite.style.height = `${roundPx(initialSize)}px`;
    }

    const start = 0;
    const target = 1;
    let x = start;
    let v = 0;
    let rafId: number | null = null;
    let lastTs = performance.now();

    const basePillWidth = Math.max(PH, Math.min(fromRect.width, toRectResolved.width));
    const baseBlobWidth = Math.max(basePillWidth, Math.max(fromRect.width, toRectResolved.width));
    const baseTargetHeight = Math.max(PH, Math.max(fromRect.height, toRectResolved.height));

    await new Promise<void>((resolve) => {
        const finalize = () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            overlay.root.remove();
            resolve();
        };

        const render = (progress: number) => {
            const s = clamp01(progress);
            const shapeT = direction === 'expand' ? s : 1 - s;
            const shape = morphPathCenter(basePillWidth, baseBlobWidth, baseTargetHeight, shapeT);
            const cx = lerp(fromRect.left + fromRect.width / 2, toRectResolved.left + toRectResolved.width / 2, s);
            const cy = lerp(fromRect.top + fromRect.height / 2, toRectResolved.top + toRectResolved.height / 2, s);
            const tx = cx - shape.width / 2;
            const ty = cy - shape.height / 2;

            overlay.path.setAttribute('d', shape.d);
            overlay.path.setAttribute('transform', `translate(${roundPx(tx)} ${roundPx(ty)})`);

            if (sprite) {
                const fromIcon = Math.max(18, Math.min(fromRect.width, fromRect.height) * 0.66);
                const toIcon = Math.max(20, Math.min(toRectResolved.width, toRectResolved.height) * 0.66);
                const iconSize = lerp(fromIcon, toIcon, s);
                const spin = (direction === 'expand' ? 1 : -1) * 42 * s;
                sprite.style.width = `${roundPx(iconSize)}px`;
                sprite.style.height = `${roundPx(iconSize)}px`;
                sprite.style.transform =
                    `translate(${roundPx(cx - iconSize / 2)}px, ${roundPx(cy - iconSize / 2)}px) ` +
                    `rotate(${roundPx(spin)}deg)`;
            }
        };

        const step = (ts: number) => {
            const dt = Math.min(0.033, (ts - lastTs) / 1000);
            lastTs = ts;

            const delta = x - target;
            const accel = (-spring.stiffness * delta - spring.damping * v) / spring.mass;
            v += accel * dt;
            x += v * dt;

            const clamped = clamp01(x);
            render(clamped);

            const settled =
                Math.abs(x - target) < 0.0015 && Math.abs(v) < 0.003;

            if (settled || clamped >= 0.999) {
                render(target);
                finalize();
                return;
            }

            rafId = requestAnimationFrame(step);
        };

        render(start);
        rafId = requestAnimationFrame(step);
    });
}
