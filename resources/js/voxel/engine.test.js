import { describe, expect, it } from 'vitest';
import { VoxelScene } from './scene.js';
import { HistoryStack } from './history.js';
import { buildMeshData } from './mesh.js';
import { raycastVoxels, lineCells, boxCells, floodFillCells, applySymmetry, expandBrush } from './raycast.js';
import { validateSceneData, deserializeScene } from './serialize.js';
import { ToolController } from './tools.js';
import { GRID_MAX, GRID_MIN, inGridBounds } from './constants.js';

describe('VoxelScene', () => {
    it('adds and deletes voxels including negative coordinates', () => {
        const scene = VoxelScene.createEmpty();
        expect(scene.setVoxel(-2, 0, 3, { c: 1, m: 0 })).toBe(true);
        expect(scene.getVoxel(-2, 0, 3)).toEqual({ c: 1, m: 0 });
        expect(scene.setVoxel(-2, 0, 3, null)).toBe(true);
        expect(scene.getVoxel(-2, 0, 3)).toBeNull();
        expect(scene.voxelCount()).toBe(0);
    });

    it('cleans empty occupancy and respects layer lock/visibility', () => {
        const scene = VoxelScene.createEmpty();
        scene.setVoxel(0, 0, 0, { c: 0, m: 0 });
        scene.setLayerLocked(scene.activeLayerId, true);
        expect(scene.setVoxel(1, 0, 0, { c: 0, m: 0 })).toBe(false);
        scene.setLayerLocked(scene.activeLayerId, false);
        scene.setLayerVisible(scene.activeLayerId, false);
        expect(scene.getTopVoxel(0, 0, 0, { visibleOnly: true })).toBeNull();
        scene.setLayerVisible(scene.activeLayerId, true);
        expect(scene.getTopVoxel(0, 0, 0)?.c).toBe(0);
    });

    it('handles chunk boundary coordinates', () => {
        const scene = VoxelScene.createEmpty();
        scene.setVoxel(15, 0, 0, { c: 0, m: 0 });
        scene.setVoxel(16, 0, 0, { c: 1, m: 0 });
        expect(scene.voxelCount()).toBe(2);
        expect(scene.getVoxel(15, 0, 0).c).toBe(0);
        expect(scene.getVoxel(16, 0, 0).c).toBe(1);
    });

    it('serializes and deserializes round-trip', () => {
        const scene = VoxelScene.createEmpty('House');
        scene.setVoxel(1, 2, 3, { c: 2, m: 1 });
        const json = scene.serialize();
        const restored = VoxelScene.deserialize(json);
        expect(restored.meta.title).toBe('House');
        expect(restored.getVoxel(1, 2, 3)).toEqual({ c: 2, m: 1 });
    });
});

describe('mesh', () => {
    it('removes hidden faces between neighbors', () => {
        const scene = VoxelScene.createEmpty();
        scene.setVoxel(0, 0, 0, { c: 0, m: 0 });
        const single = buildMeshData(scene);
        scene.setVoxel(1, 0, 0, { c: 0, m: 0 });
        const pair = buildMeshData(scene);
        expect(pair.faceCount).toBeLessThan(single.faceCount * 2);
        expect(pair.faceCount).toBe(20);
    });

    it('groups geometry by material index', () => {
        const scene = VoxelScene.createEmpty();
        scene.setVoxel(0, 0, 0, { c: 0, m: 0 });
        scene.setVoxel(2, 0, 0, { c: 0, m: 5 });
        const data = buildMeshData(scene);
        expect(data.groups.length).toBe(2);
        expect(data.groups.map((g) => g.materialIndex).sort()).toEqual([0, 5]);
        expect(data.groups.reduce((n, g) => n + g.count, 0)).toBe(data.indices.length);
    });
});

describe('tools', () => {
    function makeTools(overrides = {}) {
        const scene = VoxelScene.createEmpty();
        const history = new HistoryStack();
        const state = {
            tool: 'add',
            colorIndex: 1,
            materialIndex: 2,
            brushSize: 1,
            symmetry: { x: false, y: false, z: false },
            planeLock: null,
            ...overrides,
        };
        return { scene, history, state, tools: new ToolController(scene, history, state) };
    }

    it('paints existing voxels', () => {
        const { scene, state, tools } = makeTools({ tool: 'paint', colorIndex: 3 });
        scene.setVoxel(0, 0, 0, { c: 0, m: 0 });
        const hit = {
            x: 0, y: 0, z: 0,
            voxel: { c: 0, m: 0 },
            place: { x: 0, y: 1, z: 0 },
            faceNormal: { x: 0, y: 1, z: 0 },
        };
        const down = tools.pointerDown(hit);
        expect(down.type).toBe('stroke');
        tools.pointerUp();
        expect(scene.getVoxel(0, 0, 0)).toEqual({ c: 3, m: 2 });
    });

    it('eyedrops color and material', () => {
        const { scene, state, tools } = makeTools({ tool: 'eyedropper' });
        scene.setVoxel(1, 0, 0, { c: 4, m: 6 });
        const hit = {
            x: 1, y: 0, z: 0,
            voxel: { c: 4, m: 6 },
            place: { x: 1, y: 1, z: 0 },
            faceNormal: { x: 0, y: 1, z: 0 },
        };
        const res = tools.pointerDown(hit);
        expect(res.type).toBe('eyedropper');
        expect(state.colorIndex).toBe(4);
        expect(state.materialIndex).toBe(6);
    });

    it('commits a line on drag end', () => {
        const { scene, tools } = makeTools({ tool: 'line' });
        const startHit = {
            ground: true,
            place: { x: 0, y: 0, z: 0 },
            x: 0, y: -1, z: 0,
            voxel: null,
            faceNormal: { x: 0, y: 1, z: 0 },
        };
        expect(tools.pointerDown(startHit).type).toBe('drag-start');
        const endHit = {
            ground: true,
            place: { x: 3, y: 0, z: 0 },
            x: 3, y: -1, z: 0,
            voxel: null,
            faceNormal: { x: 0, y: 1, z: 0 },
        };
        tools.pointerMove(endHit);
        const up = tools.pointerUp();
        expect(up.type).toBe('commit');
        expect(scene.voxelCount()).toBe(4);
    });

    it('box fills a volume', () => {
        const { scene, tools } = makeTools({ tool: 'box' });
        tools.pointerDown({
            ground: true, place: { x: 0, y: 0, z: 0 }, x: 0, y: -1, z: 0, voxel: null,
            faceNormal: { x: 0, y: 1, z: 0 },
        });
        tools.pointerMove({
            ground: true, place: { x: 1, y: 0, z: 1 }, x: 1, y: -1, z: 1, voxel: null,
            faceNormal: { x: 0, y: 1, z: 0 },
        });
        expect(tools.pointerUp().type).toBe('commit');
        expect(scene.voxelCount()).toBe(4);
    });

    it('caps huge box selections', () => {
        const cells = boxCells({ x: -16, y: 0, z: -16 }, { x: 15, y: 31, z: 15 });
        expect(cells.length).toBeLessThanOrEqual(32 * 32 * 32);
        expect(cells.length).toBeGreaterThan(0);
    });

    it('flood fills connected region', () => {
        const { scene, tools } = makeTools({ tool: 'flood', colorIndex: 2 });
        scene.setVoxel(0, 0, 0, { c: 0, m: 0 });
        scene.setVoxel(1, 0, 0, { c: 0, m: 0 });
        scene.setVoxel(5, 0, 0, { c: 0, m: 0 });
        const res = tools.pointerDown({
            x: 0, y: 0, z: 0, voxel: { c: 0, m: 0 }, place: { x: 0, y: 1, z: 0 },
            faceNormal: { x: 0, y: 1, z: 0 },
        });
        expect(res.type).toBe('commit');
        expect(scene.getVoxel(0, 0, 0).c).toBe(2);
        expect(scene.getVoxel(1, 0, 0).c).toBe(2);
        expect(scene.getVoxel(5, 0, 0).c).toBe(0);
    });

    it('applies x symmetry on add', () => {
        const { scene, tools } = makeTools({
            tool: 'add',
            symmetry: { x: true, y: false, z: false },
        });
        const res = tools.pointerDown({
            ground: true, place: { x: 3, y: 0, z: 1 }, x: 3, y: -1, z: 1, voxel: null,
            faceNormal: { x: 0, y: 1, z: 0 },
        });
        expect(res.type).toBe('commit');
        expect(scene.getVoxel(3, 0, 1)).toBeTruthy();
        expect(scene.getVoxel(-3, 0, 1)).toBeTruthy();
    });

    it('add places a single cell without hold stroke', () => {
        const { scene, tools } = makeTools({ tool: 'add', brushSize: 8 });
        const hit = {
            ground: true, place: { x: 1, y: 0, z: 1 }, x: 1, y: -1, z: 1, voxel: null,
            faceNormal: { x: 0, y: 1, z: 0 },
        };
        expect(tools.pointerDown(hit).type).toBe('commit');
        expect(scene.voxelCount()).toBe(1);
        // Holding / moving should not keep placing
        expect(tools.isActive()).toBe(false);
        tools.pointerMove({
            ground: true, place: { x: 2, y: 0, z: 1 }, x: 2, y: -1, z: 1, voxel: null,
            faceNormal: { x: 0, y: 1, z: 0 },
        });
        expect(scene.voxelCount()).toBe(1);
    });

    it('add ignores rapid duplicate pointerDown on same cell', () => {
        const { scene, tools } = makeTools({ tool: 'add' });
        const hit = {
            ground: true, place: { x: 4, y: 0, z: 0 }, x: 4, y: -1, z: 0, voxel: null,
            faceNormal: { x: 0, y: 1, z: 0 },
        };
        expect(tools.pointerDown(hit).type).toBe('commit');
        // Same cell immediately - should no-op (cell occupied + debounce)
        const again = tools.pointerDown(hit);
        expect(again.type).toBe('none');
        expect(scene.voxelCount()).toBe(1);
    });

    it('rejects placement outside the grid', () => {
        const { scene, tools } = makeTools({ tool: 'add' });
        const outside = GRID_MAX + 5;
        const res = tools.pointerDown({
            ground: true,
            place: { x: outside, y: 0, z: 0 },
            x: outside, y: -1, z: 0,
            voxel: null,
            faceNormal: { x: 0, y: 1, z: 0 },
        });
        expect(res.type).toBe('none');
        expect(scene.voxelCount()).toBe(0);
        expect(inGridBounds(GRID_MIN, 0, GRID_MIN)).toBe(true);
        expect(inGridBounds(outside, 0, 0)).toBe(false);
    });
});

describe('history batching', () => {
    it('undo emits a single scene change', () => {
        const scene = VoxelScene.createEmpty();
        const history = new HistoryStack();
        let emits = 0;
        scene.onChange(() => { emits += 1; });

        history.beginStroke('add');
        history.recordChanges(scene.setVoxels([
            { x: 0, y: 0, z: 0, data: { c: 0, m: 0 } },
            { x: 1, y: 0, z: 0, data: { c: 0, m: 0 } },
            { x: 2, y: 0, z: 0, data: { c: 0, m: 0 } },
        ]), 'add');
        history.endStroke();
        emits = 0;

        history.undo(scene);
        expect(emits).toBe(1);
        expect(scene.voxelCount()).toBe(0);
    });
});

describe('symmetry helpers', () => {
    it('mirrors cells across axes', () => {
        const cells = applySymmetry([{ x: 2, y: 0, z: 1 }], { x: true, y: false, z: true });
        const keys = cells.map((c) => `${c.x},${c.y},${c.z}`).sort();
        expect(keys).toContain('2,0,1');
        expect(keys).toContain('-2,0,1');
        expect(keys).toContain('2,0,-1');
        expect(keys).toContain('-2,0,-1');
    });

    it('expandBrush grows cube and mirrors', () => {
        const cells = expandBrush(0, 0, 0, 2, { x: true, y: false, z: false });
        expect(cells.length).toBeGreaterThanOrEqual(8);
    });
});

describe('history', () => {
    it('undoes and redoes stroke groups', () => {
        const scene = VoxelScene.createEmpty();
        const history = new HistoryStack();
        history.beginStroke('add');
        const changes = scene.setVoxels([
            { x: 0, y: 0, z: 0, data: { c: 0, m: 0 } },
            { x: 1, y: 0, z: 0, data: { c: 0, m: 0 } },
        ]);
        history.recordChanges(changes, 'add');
        history.endStroke();
        expect(scene.voxelCount()).toBe(2);
        history.undo(scene);
        expect(scene.voxelCount()).toBe(0);
        history.redo(scene);
        expect(scene.voxelCount()).toBe(2);
    });
});

describe('raycast', () => {
    it('hits a voxel and misses empty space', () => {
        const scene = VoxelScene.createEmpty();
        scene.setVoxel(0, 0, 5, { c: 0, m: 0 });
        const hit = raycastVoxels({ x: 0.5, y: 0.5, z: -2 }, { x: 0, y: 0, z: 1 }, scene);
        expect(hit?.x).toBe(0);
        expect(hit?.z).toBe(5);
        const miss = raycastVoxels({ x: 10.5, y: 10.5, z: -2 }, { x: 0, y: 0, z: 1 }, scene, { maxDistance: 5 });
        expect(miss === null || miss.ground).toBeTruthy();
    });

    it('builds line and box cells', () => {
        expect(lineCells({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 })).toHaveLength(3);
        expect(boxCells({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 })).toHaveLength(4);
    });

    it('flood fills a connected region', () => {
        const scene = VoxelScene.createEmpty();
        scene.setVoxel(0, 0, 0, { c: 0, m: 0 });
        scene.setVoxel(1, 0, 0, { c: 0, m: 2 });
        scene.setVoxel(3, 0, 0, { c: 0, m: 0 });
        const cells = floodFillCells(scene, { x: 0, y: 0, z: 0 }, () => true);
        expect(cells.length).toBe(2);
    });
});

describe('serialize validation', () => {
    it('rejects invalid scenes', () => {
        expect(validateSceneData({ version: 99 }).ok).toBe(false);
        expect(() => deserializeScene({ version: 1 })).toThrow();
    });
});
