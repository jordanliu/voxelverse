import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildMeshData } from '../voxel/mesh.js';
import { MATERIALS, GRID_SIZE } from '../voxel/constants.js';

const LIGHTING = {
    'soft-studio': {
        bg: [0.96, 0.94, 0.91],
        key: { color: 0xfff1e0, intensity: 1.35, pos: [8, 12, 6] },
        fill: { color: 0xc9d9ff, intensity: 0.45, pos: [-8, 4, -4] },
        rim: { color: 0xffe0c2, intensity: 0.55, pos: [0, 6, -10] },
        ambient: 0.42,
    },
    'golden-hour': {
        bg: [0.98, 0.9, 0.78],
        key: { color: 0xffb36b, intensity: 1.5, pos: [10, 6, 4] },
        fill: { color: 0x7aa0ff, intensity: 0.3, pos: [-6, 3, -6] },
        rim: { color: 0xffd7a8, intensity: 0.7, pos: [-2, 8, -8] },
        ambient: 0.35,
    },
    'cool-moonlight': {
        bg: [0.78, 0.84, 0.92],
        key: { color: 0xc8d8ff, intensity: 1.1, pos: [4, 14, 2] },
        fill: { color: 0x8aa4d8, intensity: 0.4, pos: [-8, 2, 4] },
        rim: { color: 0xa8c0ff, intensity: 0.5, pos: [0, 4, -10] },
        ambient: 0.3,
    },
    'neutral-product': {
        bg: [0.92, 0.92, 0.93],
        key: { color: 0xffffff, intensity: 1.2, pos: [6, 10, 8] },
        fill: { color: 0xffffff, intensity: 0.5, pos: [-6, 4, -2] },
        rim: { color: 0xffffff, intensity: 0.35, pos: [0, 8, -8] },
        ambient: 0.45,
    },
};

function finishShader(pattern) {
    switch (pattern) {
        case 'wood':
            return `
                float vvGrain = sin((vVvPosition.x + vVvPosition.z) * 8.0 + sin(vVvPosition.y * 4.0) * 2.0);
                float vvBands = smoothstep(0.35, 0.9, vvGrain);
                diffuseColor.rgb *= mix(0.91, 1.07, vvBands);
            `;
        case 'stone':
            return `
                float vvStone = fract(sin(dot(floor(vVvPosition * 2.0), vec3(21.17, 48.31, 9.73))) * 15731.743);
                diffuseColor.rgb *= mix(0.84, 1.07, vvStone);
            `;
        case 'metal':
            return `
                float vvBrush = 0.965 + 0.055 * sin((vVvPosition.y + vVvPosition.x * 0.16) * 30.0);
                diffuseColor.rgb *= vvBrush;
            `;
        case 'glass':
            return `
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.93, 1.0), 0.2);
            `;
        case 'rubber':
            return `
                float vvRubber = fract(sin(dot(floor(vVvPosition * 5.0), vec3(17.1, 31.7, 11.3))) * 103.0);
                diffuseColor.rgb *= mix(0.78, 0.94, vvRubber);
            `;
        case 'neon':
            return `
                diffuseColor.rgb *= 1.12;
            `;
        case 'ceramic':
            return `
                diffuseColor.rgb *= 1.015;
            `;
        case 'fabric':
            return `
                float vvWarp = step(0.72, fract(vVvPosition.x * 7.0)) + step(0.72, fract(vVvPosition.z * 7.0));
                diffuseColor.rgb *= mix(0.88, 1.02, clamp(vvWarp * 0.5, 0.0, 1.0));
            `;
        case 'ice':
            return `
                float vvIce = fract(sin(dot(floor(vVvPosition * 4.0), vec3(19.2, 41.4, 73.1))) * 127.1);
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.68, 0.86, 1.0), 0.25);
                diffuseColor.rgb *= mix(0.92, 1.04, vvIce);
            `;
        case 'gold':
            return `
                diffuseColor.rgb *= vec3(1.08, 0.86, 0.42);
            `;
        default:
            return '';
    }
}

function applyFinishShader(material, preset) {
    const pattern = preset.pattern || 'plain';
    if (pattern === 'plain') return;

    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vVvPosition;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvVvPosition = transformed;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\nvarying vec3 vVvPosition;`)
            .replace('#include <color_fragment>', `#include <color_fragment>\n${finishShader(pattern)}`);
    };
    material.customProgramCacheKey = () => `voxelverse-finish-${preset.id}`;
}

export class StudioRenderer {
    constructor(canvas, options = {}) {
        if (!canvas) {
            throw new Error('Canvas element is required');
        }

        this.canvas = canvas;
        this.mode = options.mode || 'editor';
        this.scene = new THREE.Scene();
        this.camera = null;
        this.projection = 'orthographic';

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: true,
                alpha: false,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance',
            });
        } catch (err) {
            throw new Error(`WebGL init failed: ${err?.message || err}`);
        }

        if (!this.renderer.getContext()) {
            throw new Error('WebGL context unavailable');
        }

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;

        this.root = new THREE.Group();
        this.scene.add(this.root);

        this.modelGroup = new THREE.Group();
        this.root.add(this.modelGroup);

        this.mesh = null;
        this.previewMesh = null;
        this.grid = null;
        this.ground = null;
        this.axes = null;
        this.showGrid = true;
        this.showGround = true;
        this.bgColor = '#f5efe6';
        this.groundColor = '#e9e2d8';
        this.gridLineColor = '#f7f3ec';
        this.linkGroundToBackground = false;

        this.lights = {};
        this._setupLights('soft-studio');
        this._setupHelpers();
        this._setupCamera();

        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.12;
        this.controls.enablePan = true;
        this.controls.enableZoom = true;
        this.controls.enableRotate = true;
        this.controls.screenSpacePanning = true;
        this.controls.zoomSpeed = 1.1;
        this.controls.rotateSpeed = 0.85;
        this.controls.panSpeed = 0.9;
        this.controls.minZoom = 0.25;
        this.controls.maxZoom = 8;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 200;
        // Viewer: full orbit on left-drag. Editor: left reserved for tools until navigate mode.
        this.controls.mouseButtons = {
            LEFT: this.mode === 'viewer' ? THREE.MOUSE.ROTATE : -1,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
        };
        this.lightOverrides = null;
        this.lightingPresetId = 'soft-studio';
        this.toneExposure = 1.05;
        this.controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
        };
        this.controls.target.set(0.5, 0.5, 0.5);
        this.controls.update();

        // Keep scroll-zoom available even while editing with the left button
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // WASDQE keyboard navigation state
        this._keys = new Set();
        this._moveSpeed = 8; // units per second
        this._lastFrame = performance.now();
        this._keyVec = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._forward = new THREE.Vector3();
        this._up = new THREE.Vector3(0, 1, 0);

        this._raf = null;
        this._onResize = () => this.resize();
        window.addEventListener('resize', this._onResize);
        this.resize();
        this.start();
    }

    setKey(code, down) {
        if (down) this._keys.add(code);
        else this._keys.delete(code);
    }

    clearKeys() {
        this._keys.clear();
    }

    _applyKeyboardMove(dt) {
        if (!this._keys.size) return;

        const boost = (this._keys.has('ShiftLeft') || this._keys.has('ShiftRight')) ? 2.2 : 1;
        const moveSpeed = this._moveSpeed * dt * boost;
        let x = 0; // A/D - strafe on ground
        let z = 0; // W/S - forward/back on ground
        let rotY = 0; // Q/E - orbit left/right around target

        if (this._keys.has('KeyW')) z -= 1;
        if (this._keys.has('KeyS')) z += 1;
        if (this._keys.has('KeyA')) x -= 1;
        if (this._keys.has('KeyD')) x += 1;
        // Q/E: rotate (orbit) around the focus target
        if (this._keys.has('KeyQ')) rotY += 1;
        if (this._keys.has('KeyE')) rotY -= 1;

        if (x === 0 && z === 0 && rotY === 0) return;

        this.camera.updateMatrixWorld(true);

        // Q/E - horizontal orbit around controls.target
        if (rotY !== 0) {
            const angle = rotY * 1.6 * dt * boost; // radians/sec feel
            const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
            offset.applyAxisAngle(this._up, angle);
            this.camera.position.copy(this.controls.target).add(offset);
            this.camera.lookAt(this.controls.target);
        }

        // WASD - ground-plane move (camera + target together)
        if (x !== 0 || z !== 0) {
            this.camera.getWorldDirection(this._forward);
            this._forward.y = 0;
            if (this._forward.lengthSq() < 1e-6) {
                this._forward.set(0, 0, -1);
            } else {
                this._forward.normalize();
            }
            this._right.crossVectors(this._forward, this._up).normalize();
            this._keyVec.set(0, 0, 0)
                .addScaledVector(this._right, x)
                .addScaledVector(this._forward, -z);
            if (this._keyVec.lengthSq() > 1e-8) {
                this._keyVec.normalize().multiplyScalar(moveSpeed);
                this.camera.position.add(this._keyVec);
                this.controls.target.add(this._keyVec);
            }
        }

        this.controls.update();
    }

    _setupCamera() {
        const aspect = this._aspect();
        const frustum = 12;
        this.orthoSize = frustum;
        this.camera = new THREE.OrthographicCamera(
            -frustum * aspect,
            frustum * aspect,
            frustum,
            -frustum,
            0.1,
            500,
        );
        this.camera.position.set(16, 14, 16);
        this.camera.lookAt(0.5, 0.5, 0.5);
        this.perspCamera = new THREE.PerspectiveCamera(40, aspect, 0.1, 500);
        this.perspCamera.position.copy(this.camera.position);
    }

    _aspect() {
        const w = this.canvas.clientWidth || 1;
        const h = this.canvas.clientHeight || 1;
        return w / h;
    }

    _setupLights(presetId) {
        // remove old
        for (const key of Object.keys(this.lights)) {
            this.scene.remove(this.lights[key]);
        }
        this.lights = {};

        const preset = LIGHTING[presetId] || LIGHTING['soft-studio'];
        // Keep user background if already customized; otherwise use preset wash
        if (!this._bgCustom) {
            const c = new THREE.Color().setRGB(...preset.bg);
            this.bgColor = `#${c.getHexString()}`;
        }
        this.scene.background = new THREE.Color(this.bgColor);

        const o = this.lightOverrides || {};
        const ambientI = o.ambient ?? preset.ambient;
        const keyI = o.key ?? preset.key.intensity;
        const fillI = o.fill ?? preset.fill.intensity;
        const rimI = o.rim ?? preset.rim.intensity;
        const keyColor = o.keyColor != null ? o.keyColor : preset.key.color;
        this.toneExposure = o.exposure ?? 1.05;
        this.renderer.toneMappingExposure = this.toneExposure;

        const ambient = new THREE.AmbientLight(0xffffff, ambientI);
        this.scene.add(ambient);
        this.lights.ambient = ambient;

        const hemi = new THREE.HemisphereLight(0xfff6ea, 0xb8c4d8, 0.35);
        this.scene.add(hemi);
        this.lights.hemi = hemi;

        const makeDir = (color, intensity, pos, castShadow = false) => {
            const light = new THREE.DirectionalLight(color, intensity);
            light.position.set(...pos);
            if (castShadow) {
                light.castShadow = true;
                light.shadow.mapSize.set(1024, 1024);
                light.shadow.camera.near = 0.5;
                light.shadow.camera.far = 80;
                light.shadow.camera.left = -20;
                light.shadow.camera.right = 20;
                light.shadow.camera.top = 20;
                light.shadow.camera.bottom = -20;
                light.shadow.bias = -0.0005;
                light.shadow.radius = 3;
            }
            this.scene.add(light);
            return light;
        };

        this.lights.key = makeDir(keyColor, keyI, preset.key.pos, true);
        this.lights.fill = makeDir(preset.fill.color, fillI, preset.fill.pos);
        this.lights.rim = makeDir(preset.rim.color, rimI, preset.rim.pos);
        this.environment = presetId;
        this.lightingPresetId = presetId;
        this._presetSnapshot = {
            ambient: preset.ambient,
            key: preset.key.intensity,
            fill: preset.fill.intensity,
            rim: preset.rim.intensity,
            exposure: 1.05,
            keyColor: `#${new THREE.Color(preset.key.color).getHexString()}`,
        };
    }

    _setupHelpers() {
        // Match constants GRID_SIZE so placement bounds align with the ground plane
        this.gridSize = GRID_SIZE;
        this.gridDivisions = GRID_SIZE;
        this._bgCustom = false;

        const groundGeo = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
        this._gridTexture = this._makeGridTexture(
            this.gridDivisions,
            this.groundColor,
            this.gridLineColor,
        );

        this.groundMatWithGrid = new THREE.MeshStandardMaterial({
            map: this._gridTexture,
            roughness: 0.95,
            metalness: 0,
        });
        this.groundMatPlain = new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.groundColor),
            roughness: 0.95,
            metalness: 0,
        });

        this.ground = new THREE.Mesh(groundGeo, this.groundMatWithGrid);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.set(0, 0, 0);
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        this.grid = this.ground;
        this.axes = null;
        this.scene.background = new THREE.Color(this.bgColor);
    }

    _makeGridTexture(divisions, fillHex, lineHex) {
        const pxPerCell = 16;
        const size = divisions * pxPerCell;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = fillHex;
        ctx.fillRect(0, 0, size, size);

        ctx.strokeStyle = lineHex;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= divisions; i += 1) {
            const p = i * pxPerCell + 0.5;
            ctx.moveTo(p, 0);
            ctx.lineTo(p, size);
            ctx.moveTo(0, p);
            ctx.lineTo(size, p);
        }
        ctx.stroke();

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.anisotropy = 1;
        tex.needsUpdate = true;
        return tex;
    }

    _rebuildGridTexture() {
        const prev = this._gridTexture;
        this._gridTexture = this._makeGridTexture(
            this.gridDivisions,
            this.groundColor,
            this.gridLineColor,
        );
        if (this.groundMatWithGrid) {
            this.groundMatWithGrid.map = this._gridTexture;
            this.groundMatWithGrid.needsUpdate = true;
        }
        if (this.groundMatPlain) {
            this.groundMatPlain.color.set(this.groundColor);
            this.groundMatPlain.needsUpdate = true;
        }
        if (this.ground) {
            this.ground.material = this.showGrid ? this.groundMatWithGrid : this.groundMatPlain;
        }
        prev?.dispose();
    }

    setEnvironment(id) {
        this.lightOverrides = null;
        this._setupLights(id);
    }

    getLightSettings() {
        const base = this._presetSnapshot || {
            ambient: 0.42, key: 1.35, fill: 0.45, rim: 0.55, exposure: 1.05, keyColor: '#fff1e0',
        };
        const o = this.lightOverrides || {};
        return {
            ambient: o.ambient ?? base.ambient,
            key: o.key ?? base.key,
            fill: o.fill ?? base.fill,
            rim: o.rim ?? base.rim,
            exposure: o.exposure ?? base.exposure,
            keyColor: o.keyColor
                ? (typeof o.keyColor === 'string' ? o.keyColor : `#${new THREE.Color(o.keyColor).getHexString()}`)
                : base.keyColor,
            presetId: this.lightingPresetId,
        };
    }

    setLightOverrides(partial = {}) {
        const cur = this.getLightSettings();
        this.lightOverrides = {
            ambient: partial.ambient ?? cur.ambient,
            key: partial.key ?? cur.key,
            fill: partial.fill ?? cur.fill,
            rim: partial.rim ?? cur.rim,
            exposure: partial.exposure ?? cur.exposure,
            keyColor: partial.keyColor != null
                ? (typeof partial.keyColor === 'string'
                    ? new THREE.Color(partial.keyColor).getHex()
                    : partial.keyColor)
                : (this.lightOverrides?.keyColor ?? undefined),
        };
        // Re-apply current preset with overrides
        this._setupLights(this.lightingPresetId || 'soft-studio');
    }

    resetLightOverrides() {
        this.lightOverrides = null;
        this._setupLights(this.lightingPresetId || 'soft-studio');
    }

    setBackgroundColor(hex) {
        this._bgCustom = true;
        this.bgColor = normalizeHex(hex);
        this.scene.background = new THREE.Color(this.bgColor);
        if (this.linkGroundToBackground) {
            this.groundColor = this.bgColor;
            this._rebuildGridTexture();
        }
    }

    setGroundColor(hex) {
        this.groundColor = normalizeHex(hex);
        if (this.linkGroundToBackground) {
            this._bgCustom = true;
            this.bgColor = this.groundColor;
            this.scene.background = new THREE.Color(this.bgColor);
        }
        this._rebuildGridTexture();
    }

    setLinkGroundToBackground(linked) {
        this.linkGroundToBackground = !!linked;
        if (this.linkGroundToBackground) {
            // Prefer background as the shared color when linking
            this.groundColor = this.bgColor;
            this._rebuildGridTexture();
        }
    }

    setGridLineColor(hex) {
        this.gridLineColor = normalizeHex(hex);
        this._rebuildGridTexture();
    }

    setGridVisible(v) {
        this.showGrid = !!v;
        if (this.ground) {
            this.ground.material = this.showGrid ? this.groundMatWithGrid : this.groundMatPlain;
            this.ground.material.needsUpdate = true;
        }
    }

    setGroundVisible(v) {
        this.showGround = v;
        if (this.ground) {
            this.ground.visible = v;
        }
    }

    getStudioAppearance() {
        return {
            background: this.bgColor,
            ground: this.groundColor,
            gridLine: this.gridLineColor,
            gridVisible: this.showGrid,
            linkGroundToBackground: this.linkGroundToBackground,
            lighting: this.getLightSettings(),
        };
    }

    applyStudioAppearance(opts = {}) {
        if (typeof opts.linkGroundToBackground === 'boolean') {
            this.linkGroundToBackground = opts.linkGroundToBackground;
        }
        if (opts.background) {
            this._bgCustom = true;
            this.bgColor = normalizeHex(opts.background);
            this.scene.background = new THREE.Color(this.bgColor);
        }
        if (opts.ground) {
            this.groundColor = normalizeHex(opts.ground);
        }
        if (this.linkGroundToBackground && opts.background) {
            this.groundColor = this.bgColor;
        } else if (this.linkGroundToBackground && opts.ground && !opts.background) {
            this.bgColor = this.groundColor;
            this._bgCustom = true;
            this.scene.background = new THREE.Color(this.bgColor);
        }
        if (opts.gridLine) this.gridLineColor = normalizeHex(opts.gridLine);
        if (typeof opts.gridVisible === 'boolean') this.showGrid = opts.gridVisible;
        this._rebuildGridTexture();
        // Re-assert background after lighting setup may have run
        this.scene.background = new THREE.Color(this.bgColor);
        if (opts.lighting) {
            const L = opts.lighting;
            if (L.presetId) {
                this.lightingPresetId = L.presetId;
            }
            this.lightOverrides = {
                ambient: L.ambient,
                key: L.key,
                fill: L.fill,
                rim: L.rim,
                exposure: L.exposure,
                keyColor: L.keyColor ? new THREE.Color(L.keyColor).getHex() : undefined,
            };
            this._setupLights(this.lightingPresetId || 'soft-studio');
            // Lighting must not wipe saved custom background
            this.scene.background = new THREE.Color(this.bgColor);
        }
    }

    setProjection(mode) {
        const aspect = this._aspect();
        if (mode === 'perspective') {
            this.projection = 'perspective';
            this.perspCamera.aspect = aspect;
            this.perspCamera.position.copy(this.camera.position);
            this.perspCamera.quaternion.copy(this.camera.quaternion);
            this.perspCamera.updateProjectionMatrix();
            this.controls.object = this.perspCamera;
            this.camera = this.perspCamera;
        } else {
            this.projection = 'orthographic';
            const frustum = this.orthoSize;
            const ortho = new THREE.OrthographicCamera(
                -frustum * aspect,
                frustum * aspect,
                frustum,
                -frustum,
                0.1,
                500,
            );
            ortho.position.copy(this.camera.position);
            ortho.quaternion.copy(this.camera.quaternion);
            this.camera = ortho;
            this.controls.object = ortho;
        }
        this.controls.update();
    }

    resize() {
        const parent = this.canvas.parentElement;
        const w = parent?.clientWidth || this.canvas.clientWidth || 1;
        const h = parent?.clientHeight || this.canvas.clientHeight || 1;
        this.renderer.setSize(w, h, false);
        const aspect = w / Math.max(h, 1);
        if (this.projection === 'orthographic') {
            const frustum = this.orthoSize;
            this.camera.left = -frustum * aspect;
            this.camera.right = frustum * aspect;
            this.camera.top = frustum;
            this.camera.bottom = -frustum;
            // Preserve OrbitControls zoom factor
            this.camera.updateProjectionMatrix();
        } else {
            this.camera.aspect = aspect;
            this.camera.updateProjectionMatrix();
        }
    }

    setNavigateMode(enabled) {
        // When navigating, left-drag orbits. When editing, left-drag is reserved for tools.
        this.controls.mouseButtons.LEFT = enabled ? THREE.MOUSE.ROTATE : -1;
        this.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
        this.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
        this.controls.enableRotate = true;
        this.controls.enablePan = true;
        this.controls.enableZoom = true;
        this.controls.enabled = true;
    }

    setEditingPointer(active) {
        // Hard-disable orbit while a voxel stroke is active
        if (active) {
            this.controls.enabled = false;
        } else {
            this.controls.enabled = true;
            this.setNavigateMode(false);
        }
    }

    start() {
        const loop = (now) => {
            this._raf = requestAnimationFrame(loop);
            const dt = Math.min(0.05, (now - this._lastFrame) / 1000);
            this._lastFrame = now;
            this._applyKeyboardMove(dt);
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };
        this._lastFrame = performance.now();
        loop(this._lastFrame);
    }

    stop() {
        if (this._raf) {
            cancelAnimationFrame(this._raf);
        }
        window.removeEventListener('resize', this._onResize);
        this.controls.dispose();
        this.renderer.dispose();
    }

    rebuild(voxelScene) {
        if (this.mesh) {
            this.modelGroup.remove(this.mesh);
            this.mesh.geometry.dispose();
            if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach((m) => m.dispose());
            } else {
                this.mesh.material.dispose();
            }
            this.mesh = null;
        }

        const data = buildMeshData(voxelScene);
        if (!data.vertexCount) {
            return;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
        geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));

        // One physical material per material group so voxel.m is visible.
        const matList = [];
        const groupMats = data.groups?.length
            ? data.groups
            : [{ materialIndex: 0, start: 0, count: data.indices.length }];

        for (const g of groupMats) {
            geometry.addGroup(g.start, g.count, matList.length);
            const preset = MATERIALS[g.materialIndex] || MATERIALS[0];
            const MaterialClass = preset.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
            const material = new MaterialClass({
                vertexColors: true,
                roughness: preset.roughness,
                metalness: preset.metalness,
                emissive: new THREE.Color(preset.emissiveColor || 0x000000),
                emissiveIntensity: preset.emissive || 0,
                flatShading: true,
                transparent: preset.transparent === true,
                opacity: preset.opacity ?? 1,
                depthWrite: preset.depthWrite ?? !preset.transparent,
                side: preset.transparent ? THREE.DoubleSide : THREE.FrontSide,
            });
            material.name = preset.label;
            material.userData.vvMaterialId = preset.id;
            if (preset.clearcoat != null) {
                material.clearcoat = preset.clearcoat;
                material.clearcoatRoughness = preset.clearcoatRoughness ?? 0.2;
            }
            if (preset.sheen != null && 'sheen' in material) {
                material.sheen = preset.sheen;
                material.sheenRoughness = 0.22;
            }
            if (preset.transmission != null && 'transmission' in material) {
                material.transmission = preset.transmission;
                material.ior = preset.ior ?? 1.45;
            }
            applyFinishShader(material, preset);
            matList.push(material);
        }

        this.mesh = new THREE.Mesh(geometry, matList.length === 1 ? matList[0] : matList);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.modelGroup.add(this.mesh);
    }

    setPreview(cells, colorHex = '#ffffff') {
        if (this.previewMesh) {
            this.modelGroup.remove(this.previewMesh);
            this.previewMesh.geometry.dispose();
            this.previewMesh.material.dispose();
            this.previewMesh = null;
        }
        if (!cells?.length) {
            return;
        }

        const geo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(colorHex),
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            roughness: 0.8,
        });
        const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
        const dummy = new THREE.Object3D();
        cells.forEach((c, i) => {
            dummy.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        this.previewMesh = mesh;
        this.modelGroup.add(mesh);
    }

    frameModel(voxelScene, padding = 1.4) {
        const bounds = voxelScene.bounds();
        if (bounds.empty) {
            this.controls.target.set(0.5, 0.5, 0.5);
            this.camera.position.set(16, 14, 16);
            this.controls.update();
            return;
        }
        const cx = (bounds.minX + bounds.maxX + 1) / 2;
        const cy = (bounds.minY + bounds.maxY + 1) / 2;
        const cz = (bounds.minZ + bounds.maxZ + 1) / 2;
        const size = Math.max(
            bounds.maxX - bounds.minX + 1,
            bounds.maxY - bounds.minY + 1,
            bounds.maxZ - bounds.minZ + 1,
            4,
        );
        this.controls.target.set(cx, cy, cz);
        const dist = size * padding;
        this.camera.position.set(cx + dist, cy + dist * 0.85, cz + dist);
        if (this.projection === 'orthographic') {
            this.orthoSize = size * 0.9;
            this.resize();
        }
        this.controls.update();
    }

    setView(name, voxelScene) {
        const bounds = voxelScene.bounds();
        const cx = bounds.empty ? 0.5 : (bounds.minX + bounds.maxX + 1) / 2;
        const cy = bounds.empty ? 0.5 : (bounds.minY + bounds.maxY + 1) / 2;
        const cz = bounds.empty ? 0.5 : (bounds.minZ + bounds.maxZ + 1) / 2;
        const size = bounds.empty
            ? 8
            : Math.max(bounds.maxX - bounds.minX + 1, bounds.maxY - bounds.minY + 1, bounds.maxZ - bounds.minZ + 1, 4);
        const d = size * 1.6;
        this.controls.target.set(cx, cy, cz);
        const views = {
            iso: [cx + d, cy + d * 0.85, cz + d],
            front: [cx, cy, cz + d * 1.4],
            back: [cx, cy, cz - d * 1.4],
            left: [cx - d * 1.4, cy, cz],
            right: [cx + d * 1.4, cy, cz],
            top: [cx, cy + d * 1.4, cz + 0.01],
        };
        const pos = views[name] || views.iso;
        this.camera.position.set(...pos);
        if (this.projection === 'orthographic') {
            this.orthoSize = size * 0.95;
            this.resize();
        }
        this.controls.update();
    }

    getNdc(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: ((clientX - rect.left) / rect.width) * 2 - 1,
            y: -((clientY - rect.top) / rect.height) * 2 + 1,
        };
    }

    getRay(clientX, clientY) {
        const ndc = this.getNdc(clientX, clientY);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.camera);
        return {
            origin: {
                x: raycaster.ray.origin.x,
                y: raycaster.ray.origin.y,
                z: raycaster.ray.origin.z,
            },
            direction: {
                x: raycaster.ray.direction.x,
                y: raycaster.ray.direction.y,
                z: raycaster.ray.direction.z,
            },
        };
    }

    captureThumbnail(size = 512) {
        this.renderer.render(this.scene, this.camera);
        const src = this.canvas;
        const out = document.createElement('canvas');
        out.width = size;
        out.height = size;
        const ctx = out.getContext('2d');
        const sw = src.width;
        const sh = src.height;
        const side = Math.min(sw, sh);
        const sx = (sw - side) / 2;
        const sy = (sh - side) / 2;
        ctx.fillStyle = this.bgColor || '#f5efe6';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(src, sx, sy, side, side, 0, 0, size, size);
        return out.toDataURL('image/png');
    }
}

function normalizeHex(hex) {
    if (!hex || typeof hex !== 'string') return '#e9e2d8';
    let h = hex.trim();
    if (!h.startsWith('#')) h = `#${h}`;
    if (/^#[0-9A-Fa-f]{3}$/.test(h)) {
        h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return '#e9e2d8';
    return h.toUpperCase();
}
