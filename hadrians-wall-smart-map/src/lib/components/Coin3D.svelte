<script module lang="ts">
    import * as THREE from "three";
    import { GLTFLoader as GLTFLoaderType } from "three/examples/jsm/loaders/GLTFLoader.js";

    interface ThreeResources {
        THREE: typeof THREE;
        GLTFLoader: typeof GLTFLoaderType;
        modelData: any; // GLTF result
    }

    let resourcesPromise: Promise<ThreeResources> | null = null;

    export function prefetchCoin() {
        if (typeof window === "undefined") return;

        if (!resourcesPromise) {
            resourcesPromise = new Promise((resolve, reject) => {
                const idle =
                    (window as any).requestIdleCallback ||
                    ((cb: any) => setTimeout(cb, 1));
                idle(async () => {
                    try {
                        const [threeModule, loaderModule] = await Promise.all([
                            import("three"),
                            import("three/examples/jsm/loaders/GLTFLoader.js"),
                        ]);

                        const loader = new loaderModule.GLTFLoader();
                        loader.load(
                            "/logo-coin-model.glb",
                            (gltf) => {
                                resolve({
                                    THREE: threeModule,
                                    GLTFLoader: loaderModule.GLTFLoader,
                                    modelData: gltf,
                                });
                            },
                            undefined,
                            (err) => reject(err),
                        );
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        }
        return resourcesPromise;
    }
</script>

<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import { hikerMode } from "$lib/stores/hikerMode";

    interface Props {
        class?: string;
        interactive?: boolean;
    }

    let { class: className = "", interactive = false }: Props = $props();

    let container: HTMLDivElement | undefined = $state();
    let canvas: HTMLCanvasElement | undefined = $state();

    // State
    let isLoaded = $state(false);
    let isVisible = $state(false);
    let error = $state(false);
    let isSleeping = $state(false);
    let lastActivityTime = $state(Date.now());
    const SLEEP_TIMEOUT = 10000; // 10 seconds of idle before sleep

    // Scene refs
    let renderer: THREE.WebGLRenderer | undefined;
    let scene: THREE.Scene | undefined;
    let camera: THREE.PerspectiveCamera | undefined;
    let model: THREE.Group | undefined;
    let animationFrameId: number;
    let observer: IntersectionObserver | undefined;

    // Animation vars
    let isJiggling = false;
    let jiggleTime = 0;
    const JIGGLE_DURATION = 0.5;
    let pivot: THREE.Group | undefined;

    async function loadResources() {
        if (!browser) return;
        try {
            // Ensure prefetch is started if not already
            const resources = await prefetchCoin();
            if (resources) {
                init(resources);
            }
        } catch (e) {
            console.error("Failed to load 3D libraries/model", e);
            error = true;
        }
    }

    function init({ THREE, modelData }: ThreeResources) {
        if (!container || !THREE || !modelData) return;

        // Scene setup
        scene = new THREE.Scene();

        // Camera setup
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.z = 7;

        // Renderer setup
        renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: "low-power",
            precision: "mediump",
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        // Clear container loop (safety)
        while (container.firstChild && container.firstChild !== canvas) {
            container.removeChild(container.firstChild);
        }

        renderer.domElement.style.position = "absolute";
        renderer.domElement.style.top = "0";
        renderer.domElement.style.left = "0";
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.style.pointerEvents = "none"; // Pass interactions to container
        container.appendChild(renderer.domElement);
        canvas = renderer.domElement;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 5, 5);
        scene.add(dirLight);

        const spotLight = new THREE.SpotLight(0xffd700, 20);
        spotLight.position.set(0, 5, 10);
        spotLight.angle = Math.PI / 4;
        spotLight.penumbra = 0.1;
        scene.add(spotLight);

        // Setup Model from Cache
        // CLONE the scene to allow independent instances
        model = modelData.scene.clone();

        if (model) {
            // Apply gold emissive effect to meshes
            model.traverse((child: any) => {
                if (child.isMesh) {
                    const material = child.material;
                    if (material) {
                        material.emissive = new THREE.Color(0xffd700);
                        material.emissiveIntensity = 0.15;
                    }
                }
            });

            // Center model
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            // Scale model to fit nicely
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 4.8 / maxDim;
            model.scale.set(scale, scale, scale);

            // Initial rotation setup
            model.rotation.y = 0;

            // Wrap in pivot for stable animation/centering
            pivot = new THREE.Group();
            pivot.add(model);

            // Move pivot down -1.8 units to center within the UI circle
            pivot.position.y = -1.8;

            scene.add(pivot);
            isLoaded = true;
            animate();
        }

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
            if (!container || !camera || !renderer) return;
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
        });
        resizeObserver.observe(container);
    }

    const FPS_LIMIT = 30;
    const FRAME_MIN_TIME = 1000 / FPS_LIMIT;
    let lastRenderTime = 0;

    function animate() {
        if (!isVisible || !browser || isSleeping) return;

        // Idle sleep check
        if (Date.now() - lastActivityTime > SLEEP_TIMEOUT) {
            isSleeping = true;
            return;
        }

        animationFrameId = requestAnimationFrame(animate);

        const now = performance.now();
        if (now - lastRenderTime < FRAME_MIN_TIME) return;
        lastRenderTime = now;

        if (pivot && renderer && scene && camera) {
            const time = performance.now() * 0.001;

            // Floating effect - oscillates around the offset y=-1.8
            pivot.position.y = -1.8 + Math.sin(time * 2) * 0.15;

            // Base spin - only if hiker mode is active
            if ($hikerMode.isActive) {
                pivot.rotation.y += 0.01;
            }

            // Jiggle logic
            if (isJiggling) {
                jiggleTime += 0.05;
                if (jiggleTime > JIGGLE_DURATION) {
                    isJiggling = false;
                    jiggleTime = 0;
                    // Reset additional transforms
                    pivot.rotation.z = 0;
                    pivot.rotation.x = 0;
                } else {
                    const intensity = 1 - jiggleTime / JIGGLE_DURATION;
                    const shake = Math.sin(jiggleTime * 30) * 0.2 * intensity;
                    pivot.rotation.z = shake;
                    pivot.rotation.x = shake * 0.5;
                }
            } else {
                // Smooth decay for any residual rotation
                pivot.rotation.z *= 0.9;
                pivot.rotation.x *= 0.9;
            }

            renderer.render(scene, camera);
        }
    }

    // Interaction handler
    export function wake() {
        const wasSleeping = isSleeping;
        lastActivityTime = Date.now();
        isSleeping = false;
        if (wasSleeping && isVisible && isLoaded) {
            animate();
        }
    }

    export function triggerJiggle() {
        if (!model) return;
        wake();
        isJiggling = true;
        jiggleTime = 0;
    }

    onMount(() => {
        if (!browser) return;

        // Intersection Observer for lazy loading and pausing animation
        observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const wasVisible = isVisible;
                    isVisible = entry.isIntersecting;

                    if (isVisible && !wasVisible && isLoaded) {
                        wake();
                    }

                    if (isVisible && !model && !error) {
                        loadResources();
                    }
                });
            },
            { rootMargin: "100px" },
        );

        if (container) observer.observe(container);
    });

    onDestroy(() => {
        if (typeof window !== "undefined") {
            cancelAnimationFrame(animationFrameId);
            if (renderer) {
                renderer.dispose();
                container?.removeChild(renderer.domElement);
            }
            // Dispose logic for cloned model...
            if (model) {
                model.traverse((child: any) => {
                    if (child.isMesh) {
                        // Don't dispose geometry/material if shared?
                        // Three.js GLTFLoader reuses geometry/material on clone by default?
                        // Actually, clone() of a Group usually shallow-copies meshes but shares geometry/material.
                        // So we should NOT dispose shared geometry/material if we want other instances to live.
                        // BUT proper referencing counting is hard here.
                        // For now, simpler to NOT dispose geometry/materials, let Browser GC handle it if all refs are gone.
                        // Or just dispose scene-specific stuff.
                    }
                });
            }
            if (observer) observer.disconnect();
        }
    });

    function handleClick() {
        if (interactive) {
            triggerJiggle();
        }
    }
</script>

<div
    class="relative overflow-visible z-10 {className}"
    bind:this={container}
    onclick={handleClick}
    onkeydown={(e) => e.key === "Enter" && handleClick()}
    role="button"
    tabindex={interactive ? 0 : -1}
    aria-label="3D Coin Model"
>
    <!-- Fallback Image (visible until loaded) -->
    <img
        src="/logo-coin.png"
        alt="Roman Coin"
        class="absolute inset-0 w-full h-full object-contain transition-opacity duration-500 {isLoaded
            ? 'opacity-0'
            : 'opacity-100'}"
        loading="eager"
    />
</div>

<style>
    div {
        display: block;
        /* Container must have dimensions set by parent */
    }
</style>
