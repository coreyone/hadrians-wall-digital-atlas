import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

export interface AvatarConfig {
    facing: number;
    verticalNudge: number;
    scalePercent: number;
}

export function initAvatar3D(canvas: HTMLCanvasElement, config: AvatarConfig) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
        precision: 'mediump'
    });
    // Resolution Capping: Safari energy optimization (Retina 3x -> 2x)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 250);

    const clock = new THREE.Clock();
    let mixer: THREE.AnimationMixer;
    let animationFrameId: number;
    let characterObj: THREE.Group | undefined;
    let baseScale = 1.0;

    // Animation actions
    let runningAction: THREE.AnimationAction | undefined;
    const sillyActions: THREE.AnimationAction[] = [];
    let currentAction: THREE.AnimationAction | undefined;
    let transitionTimeout: ReturnType<typeof setTimeout> | undefined;

    // Timer durations (ms)
    const RUN_DURATION = 15000;
    const SILLY_DURATION = 7000;
    const CROSSFADE_TIME = 1.0; // seconds

    // Performance Optimization: Move updateSize out of requestAnimationFrame
    const updateSize = () => {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (width > 0 && height > 0) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height, false);
        }

        if (characterObj) {
            characterObj.rotation.y = (config.facing * Math.PI) / 180;
            characterObj.position.y = config.verticalNudge;
            characterObj.scale.setScalar(baseScale * (config.scalePercent / 100));
        }
    };

    // Use ResizeObserver instead of polling updateSize in animate loop
    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(canvas);

    // Initial check
    setTimeout(updateSize, 100);

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 3);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 4);
    dirLight.position.set(50, 200, 100);
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 2.5);
    backLight.position.set(-50, -50, -100);
    scene.add(backLight);

    const loader = new GLTFLoader();

    async function loadAnimations() {
        try {
            // 1. Load Base Model + Running
            const gltfBase = await loader.loadAsync('/Running.glb');
            const object = gltfBase.scene;
            characterObj = object;

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            baseScale = 120 / size.y;

            const newBox = new THREE.Box3().setFromObject(object);
            const newCenter = newBox.getCenter(new THREE.Vector3());
            object.position.sub(newCenter);

            scene.add(object);
            mixer = new THREE.AnimationMixer(object);

            if (gltfBase.animations && gltfBase.animations.length > 0) {
                runningAction = mixer.clipAction(gltfBase.animations[0]);
                runningAction.play();
                currentAction = runningAction;
            }

            // 2. Load Silly Animations (Removed non-existent / poor quality ones)
            const sillyFiles = [
                '/Scissor Kick.glb',
                '/Silly Dancing.glb'
            ];

            for (const file of sillyFiles) {
                try {
                    const gltf = await loader.loadAsync(file);
                    if (gltf.animations && gltf.animations.length > 0) {
                        const action = mixer.clipAction(gltf.animations[0]);
                        // Set to weight 0 but don't play() yet to save cycles
                        action.setEffectiveWeight(0);
                        sillyActions.push(action);
                    }
                } catch (e) {
                    console.error(`Failed to load animation ${file}:`, e);
                }
            }

            // 3. Start state machine
            scheduleTransition('silly');
            updateSize(); // Apply final transformations

        } catch (error) {
            console.error('Failed to load Runner assets:', error);
        }
    }

    function scheduleTransition(to: 'running' | 'silly') {
        if (!mixer) return;

        const delay = to === 'silly' ? RUN_DURATION : SILLY_DURATION;

        transitionTimeout = setTimeout(() => {
            if (to === 'silly') {
                if (runningAction && sillyActions.length > 0) {
                    const randomSilly = sillyActions[Math.floor(Math.random() * sillyActions.length)];
                    crossFade(runningAction, randomSilly);
                    scheduleTransition('running');
                }
            } else {
                if (currentAction && runningAction) {
                    crossFade(currentAction, runningAction);
                    scheduleTransition('silly');
                }
            }
        }, delay);
    }

    function crossFade(startAction: THREE.AnimationAction, endAction: THREE.AnimationAction) {
        endAction.enabled = true;
        endAction.setEffectiveTimeScale(1);
        endAction.setEffectiveWeight(1);
        endAction.time = 0;
        endAction.play(); // Start playing on transition

        startAction.crossFadeTo(endAction, CROSSFADE_TIME, true);

        // After transition, we could stop the startAction, but AnimationMixer.crossFadeTo
        // handles the weight blending. 
        currentAction = endAction;
    }

    loadAnimations();

    const FPS_LIMIT = 30;
    const FRAME_MIN_TIME = 1 / FPS_LIMIT;
    let accumulatedTime = 0;

    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        accumulatedTime += delta;

        if (accumulatedTime < FRAME_MIN_TIME) return;

        // Update physics/mixer with the time that actually passed
        if (mixer) {
            mixer.update(accumulatedTime);
        }
        accumulatedTime = 0; // Reset for next frame

        renderer.render(scene, camera);
    }

    animate();

    return () => {
        cancelAnimationFrame(animationFrameId);
        resizeObserver.disconnect();
        if (transitionTimeout) clearTimeout(transitionTimeout);
        renderer.dispose();
        scene.clear();
        if (mixer) mixer.stopAllAction();
    };
}
