import { MATERIALS, LIGHTING_PRESETS } from '../voxel/constants.js';
import { VoxelScene } from '../voxel/scene.js';
import { HistoryStack } from '../voxel/history.js';
import { ToolController, TOOLS } from '../voxel/tools.js';
import { raycastVoxels } from '../voxel/raycast.js';
import { deserializeScene, sceneStats } from '../voxel/serialize.js';
import { StudioRenderer } from '../render/studio.js';
import {
    createDraftAutosave,
    createLocalId,
    clearActiveDraftId,
    getActiveDraftId,
    getDraft,
    getDeviceId,
    getOwnership,
    saveDraft,
    saveOwnership,
    setActiveDraftId,
} from '../storage/drafts.js';
import { exportObj, exportPng, exportSceneJson, exportVoxLikeJson } from './export.js';
import { createDrawer } from '../ui/drawer.js';

const DEFAULT_MATERIAL_INDEX = Math.max(0, MATERIALS.findIndex((material) => material.id === 'clay'));

function showFallback(el, message) {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute('hidden');
    el.classList.add('is-open');
    const detail = el.querySelector('[data-error-detail]');
    if (detail && message) detail.textContent = message;
}

function hideLoading() {
    const loading = document.getElementById('vv-loading');
    if (!loading) return;
    loading.classList.add('is-hidden');
    loading.addEventListener('transitionend', () => loading.setAttribute('hidden', ''), { once: true });
}

const root = document.getElementById('vv-editor');
if (root) {
    document.getElementById('vv-webgl-fallback')?.setAttribute('hidden', '');
    bootEditor(root).catch((err) => {
        console.error(err);
        hideLoading();
        showFallback(document.getElementById('vv-webgl-fallback'), err?.message || String(err));
    });
}

async function bootEditor(root) {
    const canvas = document.getElementById('vv-canvas');
    if (!canvas) {
        throw new Error('Editor canvas missing from page');
    }

    const desktopBanner = document.getElementById('vv-mobile-desktop-banner');
    const dismissDesktopBanner = document.getElementById('vv-dismiss-desktop-banner');
    const desktopBannerKey = 'vv:mobile-desktop-banner-dismissed';
    let bannerDismissed = false;
    try {
        bannerDismissed = localStorage.getItem(desktopBannerKey) === '1';
    } catch (_) {
        // A privacy-restricted browser can still use the editor without this preference.
    }
    if (desktopBanner && !bannerDismissed) {
        desktopBanner.hidden = false;
        dismissDesktopBanner?.addEventListener('click', () => {
            desktopBanner.hidden = true;
            try {
                localStorage.setItem(desktopBannerKey, '1');
            } catch (_) {
                // Keep the dismissal in memory if storage is unavailable.
            }
        });
    }

    const publicId = root.dataset.publicId || '';
    const apiBase = root.dataset.apiBase || '/api';

    // Drawers (Vaul-like)
    const publishDrawer = createDrawer(document.getElementById('vv-publish-dialog'));
    const recoveryDrawer = createDrawer(document.getElementById('vv-recovery-dialog'));
    const mqDesktop = window.matchMedia('(min-width: 900px)');
    const inspectorDrawer = createDrawer(document.getElementById('vv-inspector-drawer'), {
        // Desktop: always-visible side panel. Mobile: bottom drawer.
        persistent: mqDesktop.matches,
        startOpen: mqDesktop.matches,
        modal: !mqDesktop.matches,
        dismissible: !mqDesktop.matches,
        onOpenChange(open) {
            document.querySelectorAll('[aria-controls="vv-inspector-drawer"]').forEach((button) => {
                button.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        },
    });

    function syncInspectorMode() {
        const host = document.getElementById('vv-inspector-drawer');
        if (!host) return;
        if (mqDesktop.matches) {
            // Force desktop panel visible - never hide
            host.classList.add('is-open', 'vv-desktop-panel');
            host.hidden = false;
            host.removeAttribute('hidden');
            host.setAttribute('aria-hidden', 'false');
            host.setAttribute('aria-modal', 'false');
            document.documentElement.classList.remove('vv-drawer-open');
        } else {
            host.classList.remove('vv-desktop-panel');
            host.setAttribute('aria-modal', 'true');
            if (!inspectorDrawer.isOpen()) {
                host.classList.remove('is-open');
                host.hidden = true;
                host.setAttribute('hidden', '');
                host.setAttribute('aria-hidden', 'true');
            }
        }
    }
    syncInspectorMode();
    mqDesktop.addEventListener?.('change', () => {
        syncInspectorMode();
        if (mqDesktop.matches) {
            inspectorDrawer.open();
        } else {
            inspectorDrawer.close();
        }
    });

    document.querySelectorAll('[aria-controls="vv-inspector-drawer"]').forEach((button) => {
        button.addEventListener('click', () => inspectorDrawer.toggle());
    });
    document.getElementById('vv-close-inspector')?.addEventListener('click', () => {
        if (!mqDesktop.matches) inspectorDrawer.close();
    });

    const helpDrawer = createDrawer(document.getElementById('vv-help-drawer'), {
        modal: true,
        dismissible: true,
    });
    document.getElementById('vv-open-help-mobile')?.addEventListener('click', () => helpDrawer.toggle());

    let renderer;
    try {
        renderer = new StudioRenderer(canvas);
        hideLoading();
    } catch (e) {
        console.error(e);
        showFallback(document.getElementById('vv-webgl-fallback'), e?.message || String(e));
        return;
    }

    const state = {
        tool: 'add',
        colorIndex: 0,
        materialIndex: DEFAULT_MATERIAL_INDEX,
        brushSize: 1,
        symmetry: { x: false, y: false, z: false },
        planeLock: null,
        draftId: null,
        editKey: null,
        sourcePublicId: null,
        publishedId: publicId || null,
        spaceNavigate: false,
        lastEditTool: 'add',
    };

    // Default: left-drag edits; orbit/pan/zoom via alt/right/middle/scroll/navigate tool
    renderer.setNavigateMode(false);

    let scene = VoxelScene.createEmpty('Untitled');
    const history = new HistoryStack();
    const tools = new ToolController(scene, history, state);

    // Load draft / published / remix / edit key from URL
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const editKeyFromHash = hashParams.get('key');
    const remixId = params.get('remix');
    const draftParam = params.get('draft');
    const newParam = ['1', 'true'].includes(params.get('new'));

    if (editKeyFromHash) {
        state.editKey = editKeyFromHash;
    }

    if (publicId) {
        const ownership = await getOwnership(publicId);
        if (ownership?.editKey) {
            state.editKey = ownership.editKey;
        }
        try {
            const res = await fetch(`${apiBase}/models/${publicId}/scene`);
            if (res.ok) {
                const data = await res.json();
                scene = VoxelScene.deserialize(data.scene);
                tools.scene = scene;
                state.publishedId = publicId;
                document.getElementById('vv-title').value = data.title || 'Untitled';
                scene.meta.title = data.title || 'Untitled';
            }
        } catch (e) {
            console.warn('Could not load published model', e);
        }
    } else if (remixId) {
        try {
            const res = await fetch(`${apiBase}/models/${remixId}/scene`);
            if (res.ok) {
                const data = await res.json();
                if (data.allow_remix === false) {
                    alert('Remixing is not allowed for this model.');
                } else {
                    scene = VoxelScene.deserialize(data.scene);
                    tools.scene = scene;
                    state.sourcePublicId = remixId;
                    const title = `Remix of ${data.title || 'model'}`;
                    scene.meta.title = title;
                    document.getElementById('vv-title').value = title;
                }
            }
        } catch (e) {
            console.warn(e);
        }
    } else if (draftParam) {
        try {
            const draft = await getDraft(draftParam);
            if (draft?.scene) {
                scene = VoxelScene.deserialize(draft.scene);
                tools.scene = scene;
                state.draftId = draft.id;
                state.sourcePublicId = draft.sourcePublicId || null;
                state.publishedId = draft.publishedId || null;
                document.getElementById('vv-title').value = draft.title || 'Untitled';
            }
        } catch (e) {
            console.warn('Draft load failed', e);
        }
    } else if (!newParam) {
        try {
            const activeId = await getActiveDraftId();
            if (activeId) {
                const draft = await getDraft(activeId);
                if (draft?.scene) {
                    scene = VoxelScene.deserialize(draft.scene);
                    tools.scene = scene;
                    state.draftId = draft.id;
                    state.sourcePublicId = draft.sourcePublicId || null;
                    state.publishedId = draft.publishedId || null;
                    document.getElementById('vv-title').value = draft.title || 'Untitled';
                }
            }
        } catch (e) {
            console.warn('Active draft restore failed', e);
        }
    }

    if (newParam) {
        await clearActiveDraftId();
    }

    if (!state.draftId) {
        state.draftId = createLocalId();
        try {
            await setActiveDraftId(state.draftId);
        } catch (e) {
            console.warn('Could not persist active draft id', e);
        }
    }

    tools.scene = scene;
    renderer.setEnvironment(scene.environment);
    if (scene.meta?.studio) {
        renderer.applyStudioAppearance(scene.meta.studio);
    }
    renderer.setGroundColor(renderer.bgColor);
    syncStudioControls();
    renderer.rebuild(scene);
    renderer.frameModel(scene);
    updateStatus();
    renderPalette();
    renderLayers();
    fillSelects();

    function persistStudioMeta() {
        scene.meta = scene.meta || {};
        scene.meta.studio = renderer.getStudioAppearance();
    }

    function setGridSwitch(on) {
        const toggle = document.getElementById('vv-toggle-grid');
        if (!toggle) return;
        toggle.classList.toggle('is-on', on);
        toggle.setAttribute('aria-checked', on ? 'true' : 'false');
    }

    function syncStudioControls() {
        const app = renderer.getStudioAppearance();
        const ground = document.getElementById('vv-ground-color');
        const grid = document.getElementById('vv-grid-color');
        if (ground) ground.value = app.background || app.ground;
        if (grid) grid.value = app.gridLine;
        setGridSwitch(app.gridVisible);
    }

    const autosave = createDraftAutosave({
        getPayload: async () => {
            persistStudioMeta();
            return {
                id: state.draftId,
                title: document.getElementById('vv-title').value || 'Untitled',
                scene: scene.serialize(),
                voxelCount: scene.voxelCount(),
                sourcePublicId: state.sourcePublicId,
                publishedId: state.publishedId,
            };
        },
        onStatus: (status) => {
            const labels = {
                pending: 'Unsaved…',
                saving: 'Saving…',
                saved: 'Saved',
                error: 'Save failed',
            };
            const text = labels[status] || status;
            const el = document.getElementById('vv-save-status');
            if (el) {
                const dot = el.querySelector('.vv-status-dot');
                const label = el.querySelector('.vv-status-text');
                if (dot) dot.dataset.state = status;
                if (label) label.textContent = text;
            }
        },
    });

    const flushAutosaveOnExit = () => {
        void autosave.flush();
    };
    const flushAutosaveWhenHidden = () => {
        if (document.visibilityState === 'hidden') {
            flushAutosaveOnExit();
        }
    };
    window.addEventListener('pagehide', flushAutosaveOnExit);
    document.addEventListener('visibilitychange', flushAutosaveWhenHidden);

    function bindScene(nextScene) {
        scene = nextScene;
        tools.scene = scene;
        scene.onChange(() => {
            renderer.rebuild(scene);
            updateStatus();
            autosave.touch();
            renderLayers();
        });
    }

    bindScene(scene);

    function updateStatus() {
        const stats = sceneStats(scene);
        document.getElementById('vv-voxel-count').textContent = `${stats.voxelCount} voxels`;
        document.getElementById('vv-layer-status').textContent = scene.activeLayer?.name || 'Layer';
        document.getElementById('vv-undo').disabled = !history.canUndo;
        document.getElementById('vv-redo').disabled = !history.canRedo;
    }

    function renderPalette() {
        const el = document.getElementById('vv-palette');
        el.innerHTML = '';
        scene.palette.forEach((hex, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `vv-swatch${i === state.colorIndex ? ' vv-swatch-active' : ''}`;
            btn.style.background = hex;
            btn.title = hex;
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', i === state.colorIndex ? 'true' : 'false');
            btn.setAttribute('aria-label', `Color ${hex}`);
            btn.addEventListener('click', () => {
                state.colorIndex = i;
                document.getElementById('vv-color-hex').value = hex;
                document.getElementById('vv-color-picker').value = hex;
                renderPalette();
            });
            el.appendChild(btn);
        });
    }

    let pendingDeleteLayerId = null;
    const deleteLayerDialog = document.getElementById('vv-delete-layer-dialog');
    const deleteLayerConfirm = document.getElementById('vv-delete-layer-confirm');

    function closeDeleteLayerDialog() {
        if (!deleteLayerDialog) return;
        deleteLayerDialog.hidden = true;
        pendingDeleteLayerId = null;
    }

    function openDeleteLayerDialog(layer) {
        if (!deleteLayerDialog) return;
        pendingDeleteLayerId = layer.id;
        deleteLayerDialog.querySelector('.vv-modal-title').textContent = `Delete “${layer.name}”?`;
        deleteLayerDialog.hidden = false;
        deleteLayerConfirm?.focus();
    }

    deleteLayerDialog?.querySelectorAll('[data-delete-layer-cancel]').forEach((button) => {
        button.addEventListener('click', closeDeleteLayerDialog);
    });

    deleteLayerConfirm?.addEventListener('click', () => {
        if (!pendingDeleteLayerId) return;
        scene.deleteLayer(pendingDeleteLayerId);
        closeDeleteLayerDialog();
        renderer.rebuild(scene);
        renderLayers();
        updateStatus();
        autosave.touch();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && deleteLayerDialog && !deleteLayerDialog.hidden) {
            event.preventDefault();
            closeDeleteLayerDialog();
        }
    });

    function renderLayers() {
        const el = document.getElementById('vv-layers');
        el.innerHTML = '';
        [...scene.layers].reverse().forEach((layer) => {
            const li = document.createElement('li');
            li.className = 'vv-layer-row';
            li.dataset.active = layer.id === scene.activeLayerId ? 'true' : 'false';
            li.innerHTML = `
                <button type="button" class="vv-btn" data-vis style="padding:0.25rem 0.4rem;font-size:0.75rem;min-height:1.75rem" aria-label="Toggle visibility">${layer.visible ? '◉' : '○'}</button>
                <button type="button" class="vv-btn" data-lock style="padding:0.25rem 0.4rem;font-size:0.75rem;min-height:1.75rem" aria-label="Toggle lock">${layer.locked ? '▣' : '□'}</button>
                <button type="button" class="flex-1 truncate text-left text-sm tracking-tight" data-select>${escapeHtml(layer.name)}</button>
                <button type="button" class="vv-btn" data-del style="padding:0.25rem 0.4rem;font-size:0.75rem;min-height:1.75rem" aria-label="Delete layer">×</button>
            `;
            li.querySelector('[data-select]').addEventListener('click', () => {
                scene.setActiveLayer(layer.id);
                renderLayers();
                updateStatus();
            });
            li.querySelector('[data-vis]').addEventListener('click', () => {
                scene.setLayerVisible(layer.id, !layer.visible);
                renderer.rebuild(scene);
                renderLayers();
            });
            li.querySelector('[data-lock]').addEventListener('click', () => {
                scene.setLayerLocked(layer.id, !layer.locked);
                renderLayers();
            });
            li.querySelector('[data-del]').addEventListener('click', () => {
                if (scene.layers.length <= 1) return;
                openDeleteLayerDialog(layer);
            });
            el.appendChild(li);
        });
        syncMaterialControl();
    }

    function syncMaterialControl() {
        const preset = MATERIALS[state.materialIndex] || MATERIALS[0];
        const description = document.getElementById('vv-material-description');
        if (description) {
            description.textContent = preset.description || 'Applies to new / painted voxels.';
        }
        const apply = document.getElementById('vv-apply-material');
        const layer = scene.activeLayer;
        if (apply) {
            apply.disabled = !layer || layer.locked || layer.voxels.size === 0;
            apply.title = layer?.locked
                ? 'Unlock the active layer to apply a material'
                : 'Apply this finish to every voxel in the active layer';
        }
    }

    function fillSelects() {
        const mat = document.getElementById('vv-material');
        mat.innerHTML = MATERIALS.map((m, i) => `<option value="${i}">${m.label}</option>`).join('');
        mat.value = String(state.materialIndex);
        syncMaterialControl();
        const light = document.getElementById('vv-lighting');
        light.innerHTML = LIGHTING_PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
        light.value = scene.environment;
    }

    function isNavigateMode() {
        return state.tool === 'navigate' || state.spaceNavigate;
    }

    function setTool(id) {
        if (drawing) cancelDrawing();
        if (id !== 'navigate') {
            state.lastEditTool = id;
        }
        state.tool = id;
        renderer.setNavigateMode(isNavigateMode());
        document.querySelectorAll('[data-tool]').forEach((btn) => {
            const active = btn.dataset.tool === id;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        canvas.style.cursor = isNavigateMode() ? 'grab' : 'crosshair';
        showPreview([]);
    }

    // Controls help panel toggle
    const helpRoot = document.getElementById('vv-help');
    const helpToggle = document.getElementById('vv-help-toggle');
    const helpBody = document.getElementById('vv-help-body');
    const HELP_KEY = 'vv:help-open';

    function setHelpOpen(open) {
        helpRoot?.classList.toggle('is-collapsed', !open);
        if (helpToggle) {
            helpToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        if (helpBody) {
            if (open) {
                helpBody.hidden = false;
                helpBody.removeAttribute('hidden');
            } else {
                helpBody.hidden = true;
                helpBody.setAttribute('hidden', '');
            }
        }
        try {
            localStorage.setItem(HELP_KEY, open ? '1' : '0');
        } catch (_) { /* ignore */ }
    }

    // Controls help collapsed by default (especially mobile)
    const helpPref = (() => {
        try {
            return localStorage.getItem(HELP_KEY);
        } catch {
            return null;
        }
    })();
    setHelpOpen(helpPref === '1');

    helpToggle?.addEventListener('click', () => {
        const open = helpToggle.getAttribute('aria-expanded') !== 'true';
        setHelpOpen(open);
    });

    document.querySelectorAll('[data-tool]').forEach((btn) => {
        btn.addEventListener('click', () => setTool(btn.dataset.tool));
    });

    document.getElementById('vv-brush-size').addEventListener('input', (e) => {
        state.brushSize = Number(e.target.value);
        document.getElementById('vv-brush-size-label').textContent = String(state.brushSize);
        e.target.setAttribute('aria-valuenow', String(state.brushSize));
    });

    document.querySelectorAll('[data-sym]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const axis = btn.dataset.sym;
            state.symmetry[axis] = !state.symmetry[axis];
            btn.classList.toggle('is-on', state.symmetry[axis]);
            btn.setAttribute('aria-pressed', state.symmetry[axis] ? 'true' : 'false');
        });
    });

    document.getElementById('vv-material').addEventListener('change', (e) => {
        state.materialIndex = Number(e.target.value);
        syncMaterialControl();
    });

    document.getElementById('vv-apply-material')?.addEventListener('click', () => {
        const layer = scene.activeLayer;
        if (!layer || layer.locked || !layer.voxels.size) return;

        const materialIndex = state.materialIndex | 0;
        const entries = [];
        for (const [key, voxel] of layer.voxels) {
            if ((voxel.m ?? 0) === materialIndex) continue;
            const [x, y, z] = key.split(',').map(Number);
            entries.push({ x, y, z, data: { c: voxel.c, m: materialIndex } });
        }

        const changes = scene.setVoxels(entries);
        history.recordChanges(changes, 'apply material');
        updateStatus();
        syncMaterialControl();
        setToolMessage(changes.length
            ? `Applied ${MATERIALS[materialIndex]?.label || 'material'} to ${changes.length} voxels`
            : 'Layer already uses this material');
    });

    function syncLightControls() {
        const L = renderer.getLightSettings();
        const map = [
            ['vv-light-ambient', 'vv-light-ambient-val', L.ambient],
            ['vv-light-key', 'vv-light-key-val', L.key],
            ['vv-light-fill', 'vv-light-fill-val', L.fill],
            ['vv-light-rim', 'vv-light-rim-val', L.rim],
            ['vv-light-exposure', 'vv-light-exposure-val', L.exposure],
        ];
        for (const [id, vid, val] of map) {
            const input = document.getElementById(id);
            const label = document.getElementById(vid);
            if (input) input.value = String(val);
            if (label) label.textContent = Number(val).toFixed(2);
        }
        const kc = document.getElementById('vv-light-key-color');
        if (kc && L.keyColor) kc.value = L.keyColor.startsWith('#') ? L.keyColor : `#${L.keyColor}`;
    }

    function applyLightFromUi() {
        renderer.setLightOverrides({
            ambient: Number(document.getElementById('vv-light-ambient')?.value || 0.42),
            key: Number(document.getElementById('vv-light-key')?.value || 1.35),
            fill: Number(document.getElementById('vv-light-fill')?.value || 0.45),
            rim: Number(document.getElementById('vv-light-rim')?.value || 0.55),
            exposure: Number(document.getElementById('vv-light-exposure')?.value || 1.05),
            keyColor: document.getElementById('vv-light-key-color')?.value || '#fff1e0',
        });
        syncLightControls();
        persistStudioMeta();
        autosave.touch();
    }

    document.getElementById('vv-lighting').addEventListener('change', (e) => {
        scene.setEnvironment(e.target.value);
        // Preserve custom background when switching lighting presets
        const prevBg = renderer.bgColor;
        const wasCustom = renderer._bgCustom;
        renderer.setEnvironment(e.target.value);
        if (wasCustom) {
            renderer.setBackgroundColor(prevBg);
        }
        syncStudioControls();
        syncLightControls();
        persistStudioMeta();
        autosave.touch();
    });

    document.getElementById('vv-light-advanced-toggle')?.addEventListener('click', () => {
        const panel = document.getElementById('vv-light-advanced');
        const btn = document.getElementById('vv-light-advanced-toggle');
        const open = panel?.hidden;
        if (panel) panel.hidden = !open;
        btn?.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) syncLightControls();
    });

    ['vv-light-ambient', 'vv-light-key', 'vv-light-fill', 'vv-light-rim', 'vv-light-exposure'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', applyLightFromUi);
    });
    document.getElementById('vv-light-key-color')?.addEventListener('input', applyLightFromUi);
    document.getElementById('vv-light-reset')?.addEventListener('click', () => {
        renderer.resetLightOverrides();
        syncLightControls();
        persistStudioMeta();
        autosave.touch();
    });

    syncLightControls();

    document.getElementById('vv-ground-color')?.addEventListener('input', (e) => {
        renderer.setGroundColor(e.target.value);
        persistStudioMeta();
        autosave.touch();
    });
    document.getElementById('vv-grid-color')?.addEventListener('input', (e) => {
        renderer.setGridLineColor(e.target.value);
        persistStudioMeta();
        autosave.touch();
    });

    document.getElementById('vv-color-hex').addEventListener('change', (e) => {
        let hex = e.target.value.trim();
        if (!hex.startsWith('#')) hex = `#${hex}`;
        if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
        scene.updatePaletteColor(state.colorIndex, hex.toUpperCase());
        document.getElementById('vv-color-picker').value = hex;
        renderPalette();
        renderer.rebuild(scene);
        autosave.touch();
    });

    document.getElementById('vv-color-picker').addEventListener('input', (e) => {
        const hex = e.target.value.toUpperCase();
        document.getElementById('vv-color-hex').value = hex;
        scene.updatePaletteColor(state.colorIndex, hex);
        renderPalette();
        renderer.rebuild(scene);
        autosave.touch();
    });

    document.getElementById('vv-add-color').addEventListener('click', () => {
        const hex = document.getElementById('vv-color-picker').value.toUpperCase();
        const idx = scene.addPaletteColor(hex);
        if (idx >= 0) {
            state.colorIndex = idx;
            renderPalette();
            autosave.touch();
        }
    });

    document.getElementById('vv-add-layer').addEventListener('click', () => {
        scene.addLayer();
        renderLayers();
        updateStatus();
        autosave.touch();
    });

    document.querySelectorAll('[data-view]').forEach((btn) => {
        btn.addEventListener('click', () => renderer.setView(btn.dataset.view, scene));
    });
    document.getElementById('vv-focus').addEventListener('click', () => renderer.frameModel(scene));
    document.getElementById('vv-toggle-grid').addEventListener('click', () => {
        const next = !renderer.showGrid;
        renderer.setGridVisible(next);
        setGridSwitch(next);
        persistStudioMeta();
        autosave.touch();
    });
    document.getElementById('vv-toggle-proj').addEventListener('click', (e) => {
        const next = renderer.projection === 'orthographic' ? 'perspective' : 'orthographic';
        renderer.setProjection(next);
        e.currentTarget.textContent = next === 'orthographic' ? 'Ortho' : 'Persp';
        e.currentTarget.classList.toggle('is-on', next === 'perspective');
    });

    document.getElementById('vv-undo').addEventListener('click', () => {
        // History batches scene emits → single rebuild via onChange
        if (history.undo(scene)) {
            updateStatus();
            autosave.touch();
        }
    });
    document.getElementById('vv-redo').addEventListener('click', () => {
        if (history.redo(scene)) {
            updateStatus();
            autosave.touch();
        }
    });

    document.getElementById('vv-title').addEventListener('input', (e) => {
        scene.meta.title = e.target.value;
        autosave.touch();
    });

    // Pointer interaction - strict state machine
    // idle → drawing (edit tools) | navigating (camera) → idle
    let drawing = false;
    let cameraGesture = false;
    let activePointerId = null;
    let pointerBusy = false; // blocks re-entrant pointerdown until up/cancel
    let lastPointerType = null;
    let lastPointerAt = 0;

    function setToolMessage(msg) {
        const el = document.getElementById('vv-coords');
        if (!el) return;
        if (msg) el.textContent = msg;
    }

    function showPreview(cells) {
        if (cells?.length) {
            renderer.setPreview(cells, scene.palette[state.colorIndex] || '#ffffff');
        } else {
            renderer.setPreview([]);
        }
    }

    function isCameraPointer(event) {
        if (event.button === 1 || event.button === 2) return true;
        if (event.altKey) return true;
        if (isNavigateMode()) return true;
        return false;
    }

    function endDrawing() {
        if (!drawing) return;
        const result = tools.pointerUp();
        drawing = false;
        activePointerId = null;
        renderer.setEditingPointer(false);
        renderer.setNavigateMode(isNavigateMode());
        // Drag commits emit once via setVoxels → onChange rebuild
        // If nothing changed, force a status refresh
        showPreview([]);
        updateStatus();
        autosave.touch();
        if (result?.message) setToolMessage(result.message);
        canvas.style.cursor = isNavigateMode() ? 'grab' : 'crosshair';
    }

    function cancelDrawing() {
        if (!drawing) return;
        tools.cancel();
        drawing = false;
        activePointerId = null;
        renderer.setEditingPointer(false);
        renderer.setNavigateMode(isNavigateMode());
        showPreview([]);
        canvas.style.cursor = isNavigateMode() ? 'grab' : 'crosshair';
    }

    // Capture first so Alt+drag can switch OrbitControls to rotate before its
    // own pointer handler sees the event. Normal left-drag editing remains
    // protected because editor mode maps the left mouse button to no action.
    canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;

        // Camera gestures - leave OrbitControls alone
        if (isCameraPointer(e)) {
            cancelDrawing();
            pointerBusy = false;
            cameraGesture = true;
            renderer.setNavigateMode(true);
            renderer.controls.enabled = true;
            if (e.button === 0) canvas.style.cursor = 'grabbing';
            return;
        }

        // Only primary button for tools
        if (e.button !== 0) return;
        if (isNavigateMode()) return;

        // Ignore re-entrant / duplicate downs (ghost mouse after touch, double-fire)
        const now = performance.now();
        if (pointerBusy || drawing) return;
        if (
            lastPointerType === 'touch'
            && e.pointerType === 'mouse'
            && (now - lastPointerAt) < 700
        ) {
            e.preventDefault();
            return;
        }
        if (activePointerId != null && e.pointerId !== activePointerId) return;

        e.preventDefault();
        pointerBusy = true;
        lastPointerType = e.pointerType || 'mouse';
        lastPointerAt = now;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        activePointerId = e.pointerId;

        const ray = renderer.getRay(e.clientX, e.clientY);
        const hit = raycastVoxels(ray.origin, ray.direction, scene);
        if (hit) {
            document.getElementById('vv-coords').textContent = hit.ground
                ? `${hit.place.x},${hit.place.y},${hit.place.z}`
                : `${hit.x},${hit.y},${hit.z}`;
        }

        const result = tools.pointerDown(hit);

        if (result.type === 'none') {
            if (result.message) setToolMessage(result.message);
            try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            activePointerId = null;
            pointerBusy = false;
            return;
        }

        if (result.type === 'eyedropper') {
            const hex = scene.palette[state.colorIndex] || '#F4C7B0';
            document.getElementById('vv-color-hex').value = hex;
            document.getElementById('vv-color-picker').value = hex;
            document.getElementById('vv-material').value = String(state.materialIndex);
            syncMaterialControl();
            renderPalette();
            setToolMessage(`Picked ${hex}`);
            try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            activePointerId = null;
            // Keep busy until pointerup so a second down in the same click can't re-fire
            return;
        }

        if (result.type === 'commit') {
            // Single-shot tools (add, flood) - one placement per gesture
            showPreview([]);
            try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            // Keep pointerBusy until pointerup to swallow duplicate downs
            activePointerId = e.pointerId;
            return;
        }

        // stroke or drag-start
        drawing = true;
        renderer.setEditingPointer(true);
        // stroke writes trigger scene.onChange → single rebuild
        showPreview(result.preview);
    }, { capture: true });

    canvas.addEventListener('pointermove', (e) => {
        if (cameraGesture) return;

        // Hover preview when not drawing
        if (!drawing) {
            if (isNavigateMode()) return;
            const ray = renderer.getRay(e.clientX, e.clientY);
            const hit = raycastVoxels(ray.origin, ray.direction, scene);
            if (hit) {
                document.getElementById('vv-coords').textContent = hit.ground
                    ? `${hit.place.x},${hit.place.y},${hit.place.z}`
                    : `${hit.x},${hit.y},${hit.z}`;
            }
            const result = tools.pointerMove(hit);
            showPreview(result.preview);
            return;
        }

        // Must be our active pointer with button held
        if (activePointerId != null && e.pointerId !== activePointerId) return;
        if (e.buttons !== undefined && (e.buttons & 1) === 0) {
            endDrawing();
            return;
        }

        const ray = renderer.getRay(e.clientX, e.clientY);
        const hit = raycastVoxels(ray.origin, ray.direction, scene);
        if (hit) {
            document.getElementById('vv-coords').textContent = hit.ground
                ? `${hit.place.x},${hit.place.y},${hit.place.z}`
                : `${hit.x},${hit.y},${hit.z}`;
        }
        const result = tools.pointerMove(hit);
        showPreview(result.preview);
        // stroke writes trigger scene.onChange → rebuild; no second rebuild here
    });

    const finishPointer = (e) => {
        if (cameraGesture) {
            cameraGesture = false;
            pointerBusy = false;
            activePointerId = null;
            renderer.setNavigateMode(isNavigateMode());
            canvas.style.cursor = isNavigateMode() ? 'grab' : 'crosshair';
            return;
        }
        if (drawing && (activePointerId == null || e.pointerId === activePointerId)) {
            endDrawing();
            try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        }
        // Always clear click lock on up so the next click can place
        if (activePointerId == null || e.pointerId === activePointerId) {
            pointerBusy = false;
            activePointerId = null;
        }
    };

    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', (e) => {
        if (drawing) cancelDrawing();
        cameraGesture = false;
        pointerBusy = false;
        activePointerId = null;
        renderer.setNavigateMode(isNavigateMode());
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });

    // Block synthetic click after pointer handling (extra safety)
    canvas.addEventListener('click', (e) => {
        if (state.tool === 'add' || state.tool === 'flood' || state.tool === 'eyedropper') {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);

    canvas.addEventListener('wheel', () => {
        if (!drawing) renderer.controls.enabled = true;
    }, { passive: true });

    // Keyboard
    const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight']);

    window.addEventListener('keydown', (e) => {
        if (isTypingTarget(e.target)) return;
        const mod = e.metaKey || e.ctrlKey;

        // WASD move + Q/E rotate (Shift = faster). Cmd/Ctrl+S still saves.
        if (!mod && MOVE_CODES.has(e.code)) {
            if (e.code === 'KeyS' && mod) {
                // unreachable with !mod, kept for clarity
            } else {
                e.preventDefault();
                renderer.setKey(e.code, true);
                return;
            }
        }

        // Hold Space = temporary navigate (orbit/pan/zoom)
        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault();
            state.spaceNavigate = true;
            renderer.setNavigateMode(true);
            canvas.style.cursor = 'grab';
            return;
        }

        if (mod && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            const ok = e.shiftKey ? history.redo(scene) : history.undo(scene);
            if (ok) {
                updateStatus();
                autosave.touch();
            }
            return;
        }
        if (mod && e.key.toLowerCase() === 's') {
            e.preventDefault();
            autosave.flush();
            return;
        }
        if (e.key === 'Escape') {
            if (typeof cancelDrawing === 'function') cancelDrawing();
            publishDrawer.close();
            recoveryDrawer.close();
            if (!mqDesktop.matches) inspectorDrawer.close();
            setExportMenuOpen?.(false);
            return;
        }
        if (e.key.toLowerCase() === 'h' && !mod) setTool('navigate');
        if (e.key === '1') setTool('add');
        if (e.key === '2') setTool('erase');
        if (e.key === '3') setTool('paint');
        if (e.key === '4') setTool('eyedropper');
        if (e.key.toLowerCase() === 'l' && !mod) setTool('line');
        if (e.key.toLowerCase() === 'b' && !mod) setTool(e.shiftKey ? 'boxErase' : 'box');
        if (e.key.toLowerCase() === 'f' && !mod) setTool('flood');
        if (e.key === '[') {
            state.brushSize = Math.max(1, state.brushSize - 1);
            document.getElementById('vv-brush-size').value = state.brushSize;
            document.getElementById('vv-brush-size-label').textContent = String(state.brushSize);
        }
        if (e.key === ']') {
            state.brushSize = Math.min(8, state.brushSize + 1);
            document.getElementById('vv-brush-size').value = state.brushSize;
            document.getElementById('vv-brush-size-label').textContent = String(state.brushSize);
        }
        // Symmetry: use Shift+X/Y/Z so plain Z doesn't fight camera (Z not in WASD but was toggle)
        // Keep X/Y/Z symmetry on those keys when not using modifiers
        if (e.key.toLowerCase() === 'x' && !mod) {
            state.symmetry.x = !state.symmetry.x;
            const b = document.querySelector('[data-sym="x"]');
            b?.classList.toggle('is-on', state.symmetry.x);
            b?.setAttribute('aria-pressed', state.symmetry.x ? 'true' : 'false');
        }
        if (e.key.toLowerCase() === 'y' && !mod) {
            state.symmetry.y = !state.symmetry.y;
            const b = document.querySelector('[data-sym="y"]');
            b?.classList.toggle('is-on', state.symmetry.y);
            b?.setAttribute('aria-pressed', state.symmetry.y ? 'true' : 'false');
        }
        if (e.key.toLowerCase() === 'z' && !mod) {
            state.symmetry.z = !state.symmetry.z;
            const b = document.querySelector('[data-sym="z"]');
            b?.classList.toggle('is-on', state.symmetry.z);
            b?.setAttribute('aria-pressed', state.symmetry.z ? 'true' : 'false');
        }
        if (e.key.toLowerCase() === 'g' && !mod) {
            const next = !renderer.showGrid;
            renderer.setGridVisible(next);
            setGridSwitch(next);
            persistStudioMeta();
            autosave.touch();
        }
        if (e.key === '0') renderer.setView('iso', scene);
        if (e.key.toLowerCase() === 'p' && !mod) {
            openPublish();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (MOVE_CODES.has(e.code)) {
            renderer.setKey(e.code, false);
        }
        if (e.code === 'Space') {
            state.spaceNavigate = false;
            renderer.setNavigateMode(isNavigateMode());
            canvas.style.cursor = isNavigateMode() ? 'grab' : 'crosshair';
        }
    });

    window.addEventListener('blur', () => {
        renderer.clearKeys();
        state.spaceNavigate = false;
        renderer.setNavigateMode(isNavigateMode());
    });

    // Publish flow
    function openPublish() {
        if (!mqDesktop.matches) inspectorDrawer.close();
        document.getElementById('vv-pub-title').value = document.getElementById('vv-title').value || 'Untitled';
        const errEl = document.getElementById('vv-publish-error');
        errEl.hidden = true;
        errEl.textContent = '';
        publishDrawer.open();
    }

    document.getElementById('vv-publish').addEventListener('click', openPublish);
    document.getElementById('vv-publish-cancel').addEventListener('click', () => publishDrawer.close());
    document.getElementById('vv-recovery-close').addEventListener('click', () => recoveryDrawer.close());

    // Export menu (desktop dropdown) / drawer (mobile vaul)
    const exportBtn = document.getElementById('vv-export');
    const exportMenu = document.getElementById('vv-export-menu');
    const importJsonInput = document.getElementById('vv-import-json');
    const exportDrawer = createDrawer(document.getElementById('vv-export-drawer'), {
        modal: true,
        dismissible: true,
    });
    document.getElementById('vv-close-export')?.addEventListener('click', () => {
        if (!mqDesktop.matches) exportDrawer.close();
    });

    function closeExportUI() {
        if (exportMenu) { exportMenu.hidden = true; exportMenu.setAttribute('hidden', ''); }
        exportBtn?.setAttribute('aria-expanded', 'false');
        exportDrawer.close();
    }

    function setExportMenuOpen(open) {
        if (!exportMenu || !exportBtn) return;
        if (open) {
            exportMenu.hidden = false;
            exportMenu.removeAttribute('hidden');
        } else {
            exportMenu.hidden = true;
            exportMenu.setAttribute('hidden', '');
        }
        exportBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    exportBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (mqDesktop.matches) {
            setExportMenuOpen(exportMenu.hidden);
        } else {
            exportDrawer.toggle();
        }
    });

    document.addEventListener('click', (e) => {
        if (!mqDesktop.matches) return;
        if (!exportMenu || exportMenu.hidden) return;
        if (exportMenu.contains(e.target) || exportBtn?.contains(e.target)) return;
        setExportMenuOpen(false);
    });

    importJsonInput?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        try {
            const data = JSON.parse(await file.text());
            const imported = deserializeScene(data);
            bindScene(imported);
            state.publishedId = null;
            state.editKey = null;
            state.sourcePublicId = null;

            const title = imported.meta?.title || file.name.replace(/\.voxel\.json$|\.json$/i, '') || 'Untitled';
            document.getElementById('vv-title').value = title;
            document.getElementById('vv-pub-desc').value = '';
            document.getElementById('vv-pub-name').value = '';
            document.getElementById('vv-pub-tags').value = '';
            document.querySelector('#vv-publish-form input[name="visibility"][value="public"]')?.click();
            document.querySelector('#vv-publish-form input[name="allow_remix"]').checked = true;
            imported.meta = { ...(imported.meta || {}), title };
            renderer.setEnvironment(imported.environment);
            if (imported.meta?.studio) renderer.applyStudioAppearance(imported.meta.studio);
            syncStudioControls();
            syncLightControls();
            renderer.rebuild(imported);
            renderer.frameModel(imported);
            renderPalette();
            renderLayers();
            updateStatus();
            persistStudioMeta();
            autosave.touch();
            setToolMessage(`Imported ${file.name}`);
        } catch (error) {
            setToolMessage(error.message || 'Could not import JSON');
        }
    });

    document.querySelectorAll('[data-export]').forEach((item) => {
        item.addEventListener('click', async () => {
            const kind = item.dataset.export;
            const title = document.getElementById('vv-title')?.value || scene.meta?.title || 'Untitled';
            closeExportUI();
            try {
                if (kind === 'png') {
                    const showGrid = renderer.showGrid;
                    renderer.setGridVisible(false);
                    await new Promise((r) => requestAnimationFrame(() => r()));
                    const dataUrl = renderer.captureThumbnail(1024);
                    renderer.setGridVisible(showGrid);
                    exportPng(dataUrl, title);
                } else if (kind === 'json') {
                    persistStudioMeta();
                    exportSceneJson(scene, title);
                } else if (kind === 'voxels') {
                    exportVoxLikeJson(scene, title);
                } else if (kind === 'obj') {
                    exportObj(scene, title);
                }
            } catch (err) {
                alert(err.message || 'Export failed');
            }
        });
    });

    document.querySelector('[data-import="json"]')?.addEventListener('click', () => {
        closeExportUI();
        importJsonInput?.click();
    });

    document.getElementById('vv-publish-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const submit = document.getElementById('vv-publish-submit');
        const errEl = document.getElementById('vv-publish-error');
        errEl.hidden = true;
        errEl.textContent = '';
        submit.disabled = true;
        submit.textContent = 'Publishing…';

        try {
            persistStudioMeta();
            await autosave.flush();
            const gridWasOn = renderer.showGrid;
            renderer.setGridVisible(false);
            renderer.setGroundVisible(true);
            renderer.frameModel(scene);
            // allow a frame
            await new Promise((r) => requestAnimationFrame(() => r()));
            const thumbnail = renderer.captureThumbnail(512);
            renderer.setGridVisible(gridWasOn);

            const tags = String(form.tags.value || '')
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, 5);

            const stats = sceneStats(scene);
            // Ensure latest studio colors (bg/ground/grid/lighting) are in the payload
            persistStudioMeta();
            const body = {
                title: form.title.value.slice(0, 80),
                description: form.description.value.slice(0, 500),
                display_name: form.display_name.value.slice(0, 40),
                tags,
                visibility: form.visibility.value,
                allow_remix: form.allow_remix.checked,
                scene: scene.serialize(),
                thumbnail,
                voxel_count: stats.voxelCount,
                dimensions: stats.dimensions,
                palette_count: stats.paletteCount,
                material_count: stats.materialCount,
                source_public_id: state.sourcePublicId,
                device_id: getDeviceId(),
            };

            const updating = state.publishedId && state.editKey;
            const url = updating
                ? `${apiBase}/models/${state.publishedId}`
                : `${apiBase}/models`;
            const method = updating ? 'PUT' : 'POST';
            if (updating) {
                body.edit_key = state.editKey;
            }

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: JSON.stringify(body),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || Object.values(data.errors || {}).flat().join(' ') || 'Publish failed');
            }

            state.publishedId = data.public_id;
            state.editKey = data.edit_key || state.editKey;
            if (state.editKey) {
                await saveOwnership({
                    publicId: data.public_id,
                    editKey: state.editKey,
                    title: body.title,
                });
            }

            await saveDraft({
                id: state.draftId,
                title: body.title,
                scene: scene.serialize(),
                voxelCount: stats.voxelCount,
                publishedId: data.public_id,
                sourcePublicId: state.sourcePublicId,
            });
            await clearActiveDraftId();

            const publicUrl = data.public_url || `${window.location.origin}/m/${data.public_id}`;
            const editUrl = `${window.location.origin}/editor/${data.public_id}#key=${state.editKey}`;
            document.getElementById('vv-public-link').value = publicUrl;
            document.getElementById('vv-edit-link').value = editUrl;
            document.getElementById('vv-open-public').href = publicUrl;
            publishDrawer.close();
            recoveryDrawer.open();

            // Update URL without reload when first publish
            if (!publicId) {
                historyReplace(`/editor/${data.public_id}`);
            }
        } catch (err) {
            errEl.textContent = err.message || 'Publish failed';
            errEl.hidden = false;
        } finally {
            submit.disabled = false;
            submit.textContent = 'Publish';
        }
    });

    document.querySelectorAll('[data-copy]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const input = document.getElementById(btn.dataset.copy);
            await navigator.clipboard.writeText(input.value);
            btn.textContent = 'Copied';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
        });
    });

}

function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function escapeHtml(str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function historyReplace(path) {
    window.history.replaceState({}, '', path);
}
