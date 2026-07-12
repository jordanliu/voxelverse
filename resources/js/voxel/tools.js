import { boxCells, expandBrush, floodFillCells, lineCells, applySymmetry } from './raycast.js';
import { voxelKey, inGridBounds, MAX_STROKE_CELLS, MAX_SCENE_VOXELS } from './constants.js';

export const TOOLS = {
    navigate: { id: 'navigate', label: 'Navigate', shortcut: 'H' },
    add: { id: 'add', label: 'Add', shortcut: '1' },
    erase: { id: 'erase', label: 'Erase', shortcut: '2' },
    paint: { id: 'paint', label: 'Paint', shortcut: '3' },
    eyedropper: { id: 'eyedropper', label: 'Eyedropper', shortcut: '4' },
    line: { id: 'line', label: 'Line', shortcut: 'L' },
    box: { id: 'box', label: 'Box fill', shortcut: 'B' },
    boxErase: { id: 'boxErase', label: 'Box erase', shortcut: 'Shift+B' },
    flood: { id: 'flood', label: 'Flood fill', shortcut: 'F' },
};

const DRAG_TOOLS = new Set(['line', 'box', 'boxErase']);
const STROKE_TOOLS = new Set(['erase', 'paint']); // add is single-click only

export class ToolController {
    constructor(scene, history, state) {
        this.scene = scene;
        this.history = history;
        this.state = state;
        this._dragStart = null;
        this._dragging = false;
        this._preview = [];
        this._lastCellKey = null;
        this._mode = null; // 'stroke' | 'drag'
        this._lastAddKey = null;
        this._lastAddAt = 0;
        this._addGestureId = null;
    }

    get colorIndex() {
        return this.state.colorIndex | 0;
    }

    get materialIndex() {
        return this.state.materialIndex | 0;
    }

    get brushSize() {
        return Math.max(1, Math.min(8, Number(this.state.brushSize) || 1));
    }

    get symmetry() {
        return this.state.symmetry || { x: false, y: false, z: false };
    }

    voxelData() {
        return { c: this.colorIndex, m: this.materialIndex };
    }

    isActive() {
        return this._dragging;
    }

    placementPoint(hit) {
        if (!hit) return null;
        if (hit.place) {
            const p = {
                x: hit.place.x | 0,
                y: hit.place.y | 0,
                z: hit.place.z | 0,
            };
            if (!inGridBounds(p.x, p.y, p.z)) return null;
            return p;
        }
        return null;
    }

    targetPoint(hit) {
        if (!hit || hit.ground || hit.voxel == null) return null;
        const p = { x: hit.x | 0, y: hit.y | 0, z: hit.z | 0 };
        // Allow targeting existing voxels even if somehow OOB (legacy); still prefer in-bounds
        return p;
    }

    writeCells(cells, mode) {
        const layer = this.scene.activeLayer;
        if (!layer || layer.locked) {
            return { changes: [], message: 'Layer is locked' };
        }
        if (!cells?.length) {
            return { changes: [], message: null };
        }

        const entries = [];
        const seen = new Set();
        let outOfBounds = 0;
        let capped = false;
        const sceneCount = this.scene.voxelCount();

        for (const cell of cells) {
            if (entries.length >= MAX_STROKE_CELLS) {
                capped = true;
                break;
            }
            const x = cell.x | 0;
            const y = cell.y | 0;
            const z = cell.z | 0;
            if (!inGridBounds(x, y, z)) {
                outOfBounds += 1;
                continue;
            }
            const key = voxelKey(x, y, z);
            if (seen.has(key)) continue;
            seen.add(key);

            const existing = layer.voxels.get(key) || null;
            if (mode === 'add') {
                if (existing) continue;
                if (sceneCount + entries.length >= MAX_SCENE_VOXELS) {
                    capped = true;
                    break;
                }
                entries.push({ x, y, z, data: this.voxelData() });
            } else if (mode === 'erase') {
                if (!existing) continue;
                entries.push({ x, y, z, data: null });
            } else if (mode === 'paint') {
                if (!existing) continue;
                if ((existing.c | 0) === this.colorIndex && ((existing.m ?? 0) | 0) === this.materialIndex) {
                    continue;
                }
                entries.push({ x, y, z, data: this.voxelData() });
            }
        }

        const changes = this.scene.setVoxels(entries);
        this.history.recordChanges(changes, mode);
        if (!changes.length && outOfBounds > 0) {
            return { changes: [], message: 'Outside the grid' };
        }
        if (capped && changes.length) {
            return { changes, message: 'Selection capped for performance' };
        }
        if (capped && !changes.length) {
            return { changes: [], message: 'Model is at the voxel limit' };
        }
        return { changes, message: null };
    }

    brushAt(x, y, z) {
        return expandBrush(x, y, z, this.brushSize, this.symmetry);
    }

    pointerDown(hit) {
        this._lastCellKey = null;
        this._dragStart = null;
        this._preview = [];
        this._dragging = false;
        this._mode = null;

        const tool = this.state.tool;
        if (!tool || tool === 'navigate') {
            return { type: 'none', message: null };
        }

        if (tool === 'eyedropper') {
            const target = this.targetPoint(hit);
            if (!target || !hit.voxel) {
                return { type: 'none', message: 'Click a voxel to sample' };
            }
            this.state.colorIndex = hit.voxel.c | 0;
            this.state.materialIndex = (hit.voxel.m ?? 0) | 0;
            return {
                type: 'eyedropper',
                colorIndex: this.state.colorIndex,
                materialIndex: this.state.materialIndex,
                message: null,
            };
        }

        if (tool === 'flood') {
            const target = this.targetPoint(hit);
            if (!target) {
                return { type: 'none', message: 'Flood needs an existing voxel' };
            }
            const filled = floodFillCells(this.scene, target);
            if (!filled.length) {
                return { type: 'none', message: 'Nothing to fill' };
            }
            const cells = applySymmetry(filled, this.symmetry);
            this.history.beginStroke('flood');
            const { changes, message } = this.writeCells(cells, 'paint');
            this.history.endStroke();
            if (!changes.length) {
                return { type: 'none', message: message || 'Nothing changed' };
            }
            return { type: 'commit', count: changes.length, message: null };
        }

        // Add: one click = one placement (no hold-to-paint, no double-fire)
        if (tool === 'add') {
            const pos = this.placementPoint(hit);
            if (!pos) {
                return { type: 'none', message: 'Aim at the grid or a face' };
            }
            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            const cellKey = voxelKey(pos.x, pos.y, pos.z);
            // Harden against duplicate pointerdown / ghost mouse-after-touch
            if (this._lastAddKey === cellKey && (now - this._lastAddAt) < 180) {
                return { type: 'none', message: null };
            }
            if ((now - this._lastAddAt) < 50) {
                return { type: 'none', message: null };
            }
            // Always size 1 for a single block; symmetry still applies
            const cells = expandBrush(pos.x, pos.y, pos.z, 1, this.symmetry)
                .filter((c) => inGridBounds(c.x, c.y, c.z));
            this.history.beginStroke('add');
            const { changes, message } = this.writeCells(cells, 'add');
            this.history.endStroke();
            if (!changes.length) {
                return { type: 'none', message: message || 'Cell occupied' };
            }
            this._lastAddKey = cellKey;
            this._lastAddAt = now;
            return { type: 'commit', count: changes.length, message: null, once: true };
        }

        if (DRAG_TOOLS.has(tool)) {
            let start = null;
            if (tool === 'boxErase') {
                // Allow start from placement or target so drag volume works from ground too
                start = this.targetPoint(hit) || this.placementPoint(hit);
            } else {
                start = this.placementPoint(hit);
            }
            if (!start) {
                return { type: 'none', message: 'Aim at the grid or a voxel' };
            }
            this._dragStart = start;
            this._dragging = true;
            this._mode = 'drag';
            this._preview = applySymmetry([start], this.symmetry)
                .filter((c) => inGridBounds(c.x, c.y, c.z));
            return { type: 'drag-start', preview: this._preview, message: null };
        }

        if (STROKE_TOOLS.has(tool)) {
            const pos = this.targetPoint(hit);
            if (!pos) {
                return { type: 'none', message: tool === 'paint' ? 'Paint needs an existing voxel' : 'Erase needs an existing voxel' };
            }
            this.history.beginStroke(tool);
            this._dragging = true;
            this._mode = 'stroke';
            this._applyStrokeHit(hit);
            return { type: 'stroke', preview: this._hoverPreview(hit), message: null };
        }

        return { type: 'none', message: null };
    }

    pointerMove(hit) {
        if (!this._dragging) {
            return { type: 'hover', preview: this._hoverPreview(hit), message: null };
        }

        if (this._mode === 'drag') {
            if (!this._dragStart) {
                return { type: 'drag', preview: this._preview, message: null };
            }
            const tool = this.state.tool;
            let end = null;
            if (tool === 'boxErase') {
                end = this.targetPoint(hit) || this.placementPoint(hit);
            } else {
                end = this.placementPoint(hit);
            }
            if (!end) {
                return { type: 'drag', preview: this._preview, message: null };
            }
            const base = tool === 'line'
                ? lineCells(this._dragStart, end)
                : boxCells(this._dragStart, end);
            this._preview = applySymmetry(base, this.symmetry)
                .filter((c) => inGridBounds(c.x, c.y, c.z));
            return { type: 'drag', preview: this._preview, message: null };
        }

        // stroke
        if (hit) {
            this._applyStrokeHit(hit);
        }
        return { type: 'stroke', preview: this._hoverPreview(hit), message: null };
    }

    pointerUp() {
        if (!this._dragging) {
            return { type: 'none', message: null };
        }

        const tool = this.state.tool;
        const mode = this._mode;
        this._dragging = false;
        this._mode = null;
        this._lastCellKey = null;

        if (mode === 'drag' && DRAG_TOOLS.has(tool)) {
            const cells = this._preview.slice();
            this._preview = [];
            this._dragStart = null;
            if (!cells.length) {
                return { type: 'none', message: 'Empty selection' };
            }
            this.history.beginStroke(tool);
            const writeMode = tool === 'boxErase' ? 'erase' : 'add';
            const { changes, message } = this.writeCells(cells, writeMode);
            this.history.endStroke();
            if (!changes.length) {
                return { type: 'none', message: message || (tool === 'boxErase' ? 'No voxels to erase' : 'Nothing placed') };
            }
            return { type: 'commit', count: changes.length, message: null };
        }

        this.history.endStroke();
        this._preview = [];
        this._dragStart = null;
        return { type: 'stroke-end', message: null };
    }

    cancel() {
        // Drag tools only preview until up - safe to discard.
        // Stroke tools already wrote voxels; keep history stroke as one undo step.
        if (this._mode === 'stroke') {
            this.history.endStroke();
        } else if (typeof this.history.discardStroke === 'function') {
            this.history.discardStroke();
        } else {
            this.history.endStroke();
        }
        this._dragging = false;
        this._mode = null;
        this._dragStart = null;
        this._preview = [];
        this._lastCellKey = null;
    }

    _applyStrokeHit(hit) {
        const tool = this.state.tool;
        if (tool === 'erase' || tool === 'paint') {
            const pos = this.targetPoint(hit);
            if (!pos) return;
            const key = voxelKey(pos.x, pos.y, pos.z);
            if (this._lastCellKey === key) return;
            this._lastCellKey = key;
            this.writeCells(this.brushAt(pos.x, pos.y, pos.z), tool);
        }
    }

    _hoverPreview(hit) {
        if (!hit) return [];
        const tool = this.state.tool;
        const filterBounds = (cells) => cells.filter((c) => inGridBounds(c.x, c.y, c.z));
        if (tool === 'add' || tool === 'line' || tool === 'box') {
            const pos = this.placementPoint(hit);
            if (!pos) return [];
            // Add always previews a single cell (plus symmetry mirrors)
            const size = 1;
            return filterBounds(expandBrush(pos.x, pos.y, pos.z, size, this.symmetry));
        }
        if (tool === 'erase' || tool === 'paint' || tool === 'boxErase' || tool === 'flood') {
            const pos = this.targetPoint(hit);
            if (!pos) {
                if (tool === 'boxErase') {
                    const p = this.placementPoint(hit);
                    if (!p) return [];
                    return filterBounds(applySymmetry([p], this.symmetry));
                }
                return [];
            }
            const size = (tool === 'flood' || tool === 'boxErase') ? 1 : this.brushSize;
            return filterBounds(expandBrush(pos.x, pos.y, pos.z, size, this.symmetry));
        }
        return [];
    }
}
