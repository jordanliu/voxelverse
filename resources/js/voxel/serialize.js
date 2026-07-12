import { VoxelScene } from './scene.js';

export const MAX_VOXELS = 250_000;
export const MAX_LAYERS = 32;
export const MAX_PALETTE = 256;

export function validateSceneData(data) {
    const errors = [];
    if (!data || typeof data !== 'object') {
        return { ok: false, errors: ['Scene must be an object'] };
    }
    if (data.version !== 1) {
        errors.push('Unsupported scene version');
    }
    if (!Array.isArray(data.palette) || data.palette.length < 1 || data.palette.length > MAX_PALETTE) {
        errors.push('Invalid palette');
    }
    if (!Array.isArray(data.layers) || data.layers.length < 1 || data.layers.length > MAX_LAYERS) {
        errors.push('Invalid layers');
    }
    let voxels = 0;
    if (Array.isArray(data.layers)) {
        for (const layer of data.layers) {
            if (!layer || typeof layer !== 'object') {
                errors.push('Invalid layer');
                continue;
            }
            const entries = layer.voxels ? Object.keys(layer.voxels) : [];
            voxels += entries.length;
            for (const key of entries) {
                if (!/^-?\d+,-?\d+,-?\d+$/.test(key)) {
                    errors.push(`Invalid voxel key: ${key}`);
                    break;
                }
            }
        }
    }
    if (voxels > MAX_VOXELS) {
        errors.push(`Too many voxels (${voxels})`);
    }
    return { ok: errors.length === 0, errors, voxelCount: voxels };
}

export function serializeScene(scene) {
    return scene.serialize();
}

export function deserializeScene(data) {
    const result = validateSceneData(data);
    if (!result.ok) {
        throw new Error(result.errors.join('; '));
    }
    return VoxelScene.deserialize(data);
}

export function sceneStats(scene) {
    const bounds = scene.bounds();
    return {
        voxelCount: scene.voxelCount(),
        paletteCount: scene.palette.length,
        materialCount: scene.materials.length,
        layerCount: scene.layers.length,
        dimensions: bounds.empty
            ? { x: 0, y: 0, z: 0 }
            : {
                x: bounds.maxX - bounds.minX + 1,
                y: bounds.maxY - bounds.minY + 1,
                z: bounds.maxZ - bounds.minZ + 1,
            },
        bounds,
    };
}
