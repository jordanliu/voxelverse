import { CHUNK_SIZE, chunkKey, createId, DEFAULT_PALETTE, MATERIALS, voxelKey, worldToChunk } from './constants.js';

export class VoxelScene {
    constructor(options = {}) {
        this.palette = options.palette ? [...options.palette] : [...DEFAULT_PALETTE];
        this.materials = options.materials ? [...options.materials] : MATERIALS.map((m) => m.id);
        this.environment = options.environment || 'soft-studio';
        this.layers = options.layers || [this._createLayer('Layer 1')];
        this.activeLayerId = options.activeLayerId || this.layers[0].id;
        this.meta = options.meta || { title: 'Untitled' };
        this._listeners = new Set();
        this._chunkIndex = new Map();
        this._batchDepth = 0;
        this._batchDirty = false;
        this._batchDetail = { type: 'batch' };
        this._rebuildChunkIndex();
    }

    onChange(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    /** Suppress per-voxel emits; one emit when the outermost batch ends. */
    beginBatch() {
        this._batchDepth += 1;
    }

    endBatch(detail = null) {
        if (this._batchDepth > 0) {
            this._batchDepth -= 1;
        }
        if (detail) {
            this._batchDirty = true;
            this._batchDetail = detail;
        }
        if (this._batchDepth === 0 && this._batchDirty) {
            this._batchDirty = false;
            const d = this._batchDetail;
            this._batchDetail = { type: 'batch' };
            this._emit(d);
        }
    }

    transaction(fn) {
        this.beginBatch();
        try {
            return fn();
        } finally {
            this.endBatch({ type: 'batch' });
        }
    }

    _emit(detail = {}) {
        if (this._batchDepth > 0) {
            this._batchDirty = true;
            this._batchDetail = detail;
            return;
        }
        for (const fn of this._listeners) {
            fn(detail);
        }
    }

    _createLayer(name) {
        return {
            id: createId('layer'),
            name,
            visible: true,
            locked: false,
            voxels: new Map(),
        };
    }

    _rebuildChunkIndex() {
        this._chunkIndex.clear();
        for (const layer of this.layers) {
            for (const key of layer.voxels.keys()) {
                const [x, y, z] = key.split(',').map(Number);
                this._markChunk(layer.id, x, y, z);
            }
        }
    }

    _markChunk(layerId, x, y, z) {
        const { cx, cy, cz } = worldToChunk(x, y, z);
        const ck = chunkKey(cx, cy, cz);
        if (!this._chunkIndex.has(ck)) {
            this._chunkIndex.set(ck, new Set());
        }
        this._chunkIndex.get(ck).add(layerId);
    }

    get activeLayer() {
        return this.layers.find((l) => l.id === this.activeLayerId) || this.layers[0];
    }

    setActiveLayer(id) {
        if (this.layers.some((l) => l.id === id)) {
            this.activeLayerId = id;
            this._emit({ type: 'active-layer' });
        }
    }

    getVoxel(x, y, z, layerId = null) {
        const layer = layerId
            ? this.layers.find((l) => l.id === layerId)
            : this.activeLayer;
        if (!layer) {
            return null;
        }
        return layer.voxels.get(voxelKey(x, y, z)) || null;
    }

    hasVoxel(x, y, z, { visibleOnly = false, includeLocked = true } = {}) {
        for (const layer of this.layers) {
            if (visibleOnly && !layer.visible) {
                continue;
            }
            if (!includeLocked && layer.locked) {
                continue;
            }
            if (layer.voxels.has(voxelKey(x, y, z))) {
                return true;
            }
        }
        return false;
    }

    getTopVoxel(x, y, z, { visibleOnly = true } = {}) {
        for (let i = this.layers.length - 1; i >= 0; i -= 1) {
            const layer = this.layers[i];
            if (visibleOnly && !layer.visible) {
                continue;
            }
            const v = layer.voxels.get(voxelKey(x, y, z));
            if (v) {
                return { ...v, layerId: layer.id };
            }
        }
        return null;
    }

    setVoxel(x, y, z, data, layerId = null) {
        const layer = layerId
            ? this.layers.find((l) => l.id === layerId)
            : this.activeLayer;
        if (!layer || layer.locked) {
            return false;
        }
        const key = voxelKey(x, y, z);
        const prev = layer.voxels.get(key) || null;
        if (data == null) {
            if (!prev) {
                return false;
            }
            layer.voxels.delete(key);
        } else {
            layer.voxels.set(key, { c: data.c, m: data.m ?? 0 });
            this._markChunk(layer.id, x, y, z);
        }
        this._emit({ type: 'voxel', x, y, z, layerId: layer.id, prev, next: data });
        return true;
    }

    setVoxels(entries, layerId = null) {
        const layer = layerId
            ? this.layers.find((l) => l.id === layerId)
            : this.activeLayer;
        if (!layer || layer.locked) {
            return [];
        }
        const changes = [];
        for (const { x, y, z, data } of entries) {
            const key = voxelKey(x, y, z);
            const prev = layer.voxels.get(key) || null;
            if (data == null) {
                if (!prev) {
                    continue;
                }
                layer.voxels.delete(key);
            } else {
                if (prev && prev.c === data.c && (prev.m ?? 0) === (data.m ?? 0)) {
                    continue;
                }
                layer.voxels.set(key, { c: data.c, m: data.m ?? 0 });
                this._markChunk(layer.id, x, y, z);
            }
            changes.push({ x, y, z, prev, next: data, layerId: layer.id });
        }
        if (changes.length) {
            this._emit({ type: 'voxels', changes, layerId: layer.id });
        }
        return changes;
    }

    voxelCount() {
        let n = 0;
        for (const layer of this.layers) {
            n += layer.voxels.size;
        }
        return n;
    }

    bounds() {
        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;
        let any = false;
        for (const layer of this.layers) {
            for (const key of layer.voxels.keys()) {
                const [x, y, z] = key.split(',').map(Number);
                any = true;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                minZ = Math.min(minZ, z);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
                maxZ = Math.max(maxZ, z);
            }
        }
        if (!any) {
            return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0, empty: true };
        }
        return { minX, minY, minZ, maxX, maxY, maxZ, empty: false };
    }

    addLayer(name = null) {
        if (this.layers.length >= 32) {
            return null;
        }
        const layer = this._createLayer(name || `Layer ${this.layers.length + 1}`);
        this.layers.push(layer);
        this.activeLayerId = layer.id;
        this._emit({ type: 'layers' });
        return layer;
    }

    renameLayer(id, name) {
        const layer = this.layers.find((l) => l.id === id);
        if (!layer) {
            return false;
        }
        layer.name = name.slice(0, 40);
        this._emit({ type: 'layers' });
        return true;
    }

    duplicateLayer(id) {
        if (this.layers.length >= 32) {
            return null;
        }
        const src = this.layers.find((l) => l.id === id);
        if (!src) {
            return null;
        }
        const copy = this._createLayer(`${src.name} copy`);
        copy.visible = src.visible;
        copy.locked = false;
        copy.voxels = new Map(src.voxels);
        const idx = this.layers.findIndex((l) => l.id === id);
        this.layers.splice(idx + 1, 0, copy);
        this.activeLayerId = copy.id;
        this._rebuildChunkIndex();
        this._emit({ type: 'layers' });
        return copy;
    }

    deleteLayer(id) {
        if (this.layers.length <= 1) {
            return false;
        }
        const idx = this.layers.findIndex((l) => l.id === id);
        if (idx < 0) {
            return false;
        }
        this.layers.splice(idx, 1);
        if (this.activeLayerId === id) {
            this.activeLayerId = this.layers[Math.max(0, idx - 1)].id;
        }
        this._rebuildChunkIndex();
        this._emit({ type: 'layers' });
        return true;
    }

    setLayerVisible(id, visible) {
        const layer = this.layers.find((l) => l.id === id);
        if (!layer) {
            return false;
        }
        layer.visible = !!visible;
        this._emit({ type: 'layers' });
        return true;
    }

    setLayerLocked(id, locked) {
        const layer = this.layers.find((l) => l.id === id);
        if (!layer) {
            return false;
        }
        layer.locked = !!locked;
        this._emit({ type: 'layers' });
        return true;
    }

    reorderLayer(id, newIndex) {
        const idx = this.layers.findIndex((l) => l.id === id);
        if (idx < 0) {
            return false;
        }
        const [layer] = this.layers.splice(idx, 1);
        this.layers.splice(Math.max(0, Math.min(newIndex, this.layers.length)), 0, layer);
        this._emit({ type: 'layers' });
        return true;
    }

    mergeDown(id) {
        const idx = this.layers.findIndex((l) => l.id === id);
        if (idx <= 0) {
            return false;
        }
        const upper = this.layers[idx];
        const lower = this.layers[idx - 1];
        if (lower.locked) {
            return false;
        }
        for (const [key, val] of upper.voxels) {
            lower.voxels.set(key, { ...val });
        }
        this.layers.splice(idx, 1);
        this.activeLayerId = lower.id;
        this._rebuildChunkIndex();
        this._emit({ type: 'layers' });
        return true;
    }

    addPaletteColor(hex) {
        if (this.palette.length >= 256) {
            return -1;
        }
        this.palette.push(hex.toUpperCase());
        this._emit({ type: 'palette' });
        return this.palette.length - 1;
    }

    updatePaletteColor(index, hex) {
        if (index < 0 || index >= this.palette.length) {
            return false;
        }
        this.palette[index] = hex.toUpperCase();
        this._emit({ type: 'palette' });
        return true;
    }

    removePaletteColor(index) {
        if (index < 0 || index >= this.palette.length || this.palette.length <= 1) {
            return false;
        }
        if (this.isPaletteIndexUsed(index)) {
            return false;
        }
        this.palette.splice(index, 1);
        for (const layer of this.layers) {
            for (const [key, v] of layer.voxels) {
                if (v.c > index) {
                    layer.voxels.set(key, { ...v, c: v.c - 1 });
                }
            }
        }
        this._emit({ type: 'palette' });
        return true;
    }

    isPaletteIndexUsed(index) {
        for (const layer of this.layers) {
            for (const v of layer.voxels.values()) {
                if (v.c === index) {
                    return true;
                }
            }
        }
        return false;
    }

    setEnvironment(id) {
        this.environment = id;
        this._emit({ type: 'environment' });
    }

    clone() {
        return VoxelScene.deserialize(this.serialize());
    }

    serialize() {
        return {
            version: 1,
            meta: { ...this.meta },
            palette: [...this.palette],
            materials: [...this.materials],
            environment: this.environment,
            activeLayerId: this.activeLayerId,
            layers: this.layers.map((layer) => ({
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                locked: layer.locked,
                voxels: Object.fromEntries(layer.voxels),
            })),
        };
    }

    static deserialize(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid scene');
        }
        if (data.version !== 1) {
            throw new Error(`Unsupported scene version: ${data.version}`);
        }
        const layers = (data.layers || []).map((layer) => ({
            id: layer.id || createId('layer'),
            name: layer.name || 'Layer',
            visible: layer.visible !== false,
            locked: !!layer.locked,
            voxels: new Map(
                Object.entries(layer.voxels || {}).map(([k, v]) => [k, { c: v.c | 0, m: v.m | 0 }]),
            ),
        }));
        if (!layers.length) {
            layers.push({
                id: createId('layer'),
                name: 'Layer 1',
                visible: true,
                locked: false,
                voxels: new Map(),
            });
        }
        return new VoxelScene({
            palette: data.palette,
            materials: data.materials,
            environment: data.environment,
            layers,
            activeLayerId: data.activeLayerId || layers[0].id,
            meta: data.meta,
        });
    }

    static createEmpty(title = 'Untitled') {
        return new VoxelScene({ meta: { title } });
    }
}

export function forEachNeighbor(x, y, z, fn) {
    fn(x + 1, y, z, 0);
    fn(x - 1, y, z, 1);
    fn(x, y + 1, z, 2);
    fn(x, y - 1, z, 3);
    fn(x, y, z + 1, 4);
    fn(x, y, z - 1, 5);
}

export { CHUNK_SIZE, voxelKey };
