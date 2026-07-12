export const CHUNK_SIZE = 16;
export const SCENE_VERSION = 1;

/** Ground grid size (world units). Centered at origin → cells from GRID_MIN..GRID_MAX. */
export const GRID_SIZE = 32;
export const GRID_MIN = -Math.floor(GRID_SIZE / 2); // -16
export const GRID_MAX = Math.floor(GRID_SIZE / 2) - 1; // 15
export const GRID_Y_MIN = 0;
export const GRID_Y_MAX = GRID_SIZE - 1; // 31

/** Safety caps so large box/flood ops cannot freeze the tab */
export const MAX_STROKE_CELLS = 20_000;
export const MAX_BOX_VOLUME = GRID_SIZE * GRID_SIZE * GRID_SIZE; // 32768
export const MAX_SCENE_VOXELS = 250_000;

export function inGridBounds(x, y, z) {
    return (
        x >= GRID_MIN && x <= GRID_MAX
        && z >= GRID_MIN && z <= GRID_MAX
        && y >= GRID_Y_MIN && y <= GRID_Y_MAX
    );
}

export const MATERIALS = [
    { id: 'wood', label: 'Wood', description: 'Visible procedural grain for timber-like blocks.', roughness: 0.74, metalness: 0.0, emissive: 0.0, pattern: 'wood' },
    { id: 'stone', label: 'Stone', description: 'Rough mineral surface with stronger tonal flecks.', roughness: 0.96, metalness: 0.0, emissive: 0.0, pattern: 'stone' },
    { id: 'brushed-metal', label: 'Brushed Metal', description: 'Metallic response with directional brushing.', roughness: 0.3, metalness: 0.7, emissive: 0.0, pattern: 'metal' },
    { id: 'glass', label: 'Glass', description: 'Translucent, clear-coated surface for windows and bottles.', roughness: 0.06, metalness: 0.0, emissive: 0.0, clearcoat: 0.82, clearcoatRoughness: 0.05, transmission: 0.12, ior: 1.45, physical: true, transparent: true, opacity: 0.46, depthWrite: false, pattern: 'glass' },
    { id: 'rubber', label: 'Rubber', description: 'Deeply matte with almost no reflected highlight.', roughness: 1.0, metalness: 0.0, emissive: 0.0, pattern: 'rubber' },
    { id: 'neon', label: 'Neon', description: 'Bright self-lit finish for signs and glowing accents.', roughness: 0.32, metalness: 0.0, emissive: 0.9, emissiveColor: 0xffd1b8, pattern: 'neon' },
    { id: 'ceramic', label: 'Ceramic', description: 'Hard glazed surface with a crisp highlight.', roughness: 0.14, metalness: 0.02, emissive: 0.0, clearcoat: 0.78, clearcoatRoughness: 0.08, physical: true, pattern: 'ceramic' },
    { id: 'fabric', label: 'Fabric', description: 'Soft matte surface with a woven micro-pattern.', roughness: 0.98, metalness: 0.0, emissive: 0.0, pattern: 'fabric' },
    { id: 'ice', label: 'Ice', description: 'Cool translucent finish with a frosted tint.', roughness: 0.12, metalness: 0.0, emissive: 0.0, clearcoat: 0.48, clearcoatRoughness: 0.12, transmission: 0.2, ior: 1.31, physical: true, transparent: true, opacity: 0.62, depthWrite: false, pattern: 'ice' },
    { id: 'gold', label: 'Gold', description: 'Warm reflective metal for trim and accents.', roughness: 0.24, metalness: 0.78, emissive: 0.0, pattern: 'gold' },
    { id: 'clay', label: 'Clay', description: 'Soft, matte finish suited to sculpted forms.', roughness: 0.92, metalness: 0.0, emissive: 0.0, pattern: 'plain' },
];

export const LIGHTING_PRESETS = [
    { id: 'soft-studio', label: 'Soft Studio' },
    { id: 'golden-hour', label: 'Golden Hour' },
    { id: 'cool-moonlight', label: 'Cool Moonlight' },
    { id: 'neutral-product', label: 'Neutral Product' },
];

export const DEFAULT_PALETTE = [
    '#F4C7B0', '#E8A0BF', '#BA90C6', '#C0DBEA',
    '#A8D8B9', '#FFE6A7', '#FFB4A2', '#B8C0FF',
    '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF',
    '#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFFFFC',
    '#6D6875', '#4A4E69', '#22223B', '#FFFFFF',
];

export function voxelKey(x, y, z) {
    return `${x},${y},${z}`;
}

export function parseVoxelKey(key) {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
}

export function chunkKey(cx, cy, cz) {
    return `${cx},${cy},${cz}`;
}

export function worldToChunk(x, y, z) {
    return {
        cx: Math.floor(x / CHUNK_SIZE),
        cy: Math.floor(y / CHUNK_SIZE),
        cz: Math.floor(z / CHUNK_SIZE),
        lx: ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
        ly: ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
        lz: ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    };
}

export function createId(prefix = 'id') {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    return {
        r: ((n >> 16) & 255) / 255,
        g: ((n >> 8) & 255) / 255,
        b: (n & 255) / 255,
    };
}
