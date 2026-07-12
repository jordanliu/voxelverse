import { CHUNK_SIZE, hexToRgb, worldToChunk, MATERIALS, voxelKey } from './constants.js';

const FACES = [
    { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], normal: [1, 0, 0], shade: 0.85 },
    { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], normal: [-1, 0, 0], shade: 0.75 },
    { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], normal: [0, 1, 0], shade: 1.0 },
    { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], normal: [0, -1, 0], shade: 0.55 },
    { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], normal: [0, 0, 1], shade: 0.9 },
    { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], normal: [0, 0, -1], shade: 0.7 },
];

/**
 * Build mesh data grouped by material index for multi-material rendering.
 */
export function buildMeshData(scene) {
    const occupancy = new Map();
    for (const layer of scene.layers) {
        if (!layer.visible) continue;
        for (const [key, voxel] of layer.voxels) {
            if (!occupancy.has(key)) {
                occupancy.set(key, voxel);
            }
        }
    }

    // Bucket faces by material index
    const buckets = new Map();
    const ensureBucket = (mi) => {
        if (!buckets.has(mi)) {
            buckets.set(mi, {
                positions: [],
                normals: [],
                colors: [],
                indices: [],
                vertexBase: 0,
            });
        }
        return buckets.get(mi);
    };

    for (const [key, voxel] of occupancy) {
        const [x, y, z] = key.split(',').map(Number);
        const hex = scene.palette[voxel.c] || '#FFFFFF';
        const rgb = hexToRgb(hex);
        const mi = Math.max(0, Math.min(MATERIALS.length - 1, (voxel.m ?? 0) | 0));
        const bucket = ensureBucket(mi);

        for (const face of FACES) {
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];
            if (occupancy.has(voxelKey(nx, ny, nz))) continue;

            const base = bucket.vertexBase;
            for (const corner of face.corners) {
                bucket.positions.push(x + corner[0], y + corner[1], z + corner[2]);
                bucket.normals.push(face.normal[0], face.normal[1], face.normal[2]);
                bucket.colors.push(rgb.r * face.shade, rgb.g * face.shade, rgb.b * face.shade);
            }
            bucket.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
            bucket.vertexBase += 4;
        }
    }

    // Merge buckets into single buffers with groups
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];
    const groups = [];
    let indexOffset = 0;
    let vertexOffset = 0;

    const materialOrder = [...buckets.keys()].sort((a, b) => a - b);
    for (const mi of materialOrder) {
        const b = buckets.get(mi);
        const start = indexOffset;
        for (let i = 0; i < b.positions.length; i += 1) positions.push(b.positions[i]);
        for (let i = 0; i < b.normals.length; i += 1) normals.push(b.normals[i]);
        for (let i = 0; i < b.colors.length; i += 1) colors.push(b.colors[i]);
        for (const idx of b.indices) {
            indices.push(idx + vertexOffset);
        }
        const count = b.indices.length;
        groups.push({ materialIndex: mi, start, count });
        indexOffset += count;
        vertexOffset += b.vertexBase;
    }

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        colors: new Float32Array(colors),
        indices: new Uint32Array(indices),
        groups,
        vertexCount: vertexOffset,
        faceCount: indices.length / 3,
    };
}

export function dirtyChunksForChanges(changes) {
    const set = new Set();
    for (const change of changes) {
        const { cx, cy, cz } = worldToChunk(change.x, change.y, change.z);
        set.add(`${cx},${cy},${cz}`);
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            const n = worldToChunk(change.x + dx, change.y + dy, change.z + dz);
            set.add(`${n.cx},${n.cy},${n.cz}`);
        }
    }
    return set;
}

export { CHUNK_SIZE };
