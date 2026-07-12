import { voxelKey, GRID_MIN, GRID_MAX, MAX_BOX_VOLUME, MAX_STROKE_CELLS } from './constants.js';

/**
 * Grid raycast against occupied voxels (Amanatides & Woo style).
 */
export function raycastVoxels(origin, direction, scene, options = {}) {
    const maxDistance = options.maxDistance ?? 256;
    const visibleOnly = options.visibleOnly !== false;

    const ox = origin.x;
    const oy = origin.y;
    const oz = origin.z;
    let dx = direction.x;
    let dy = direction.y;
    let dz = direction.z;

    const len = Math.hypot(dx, dy, dz);
    if (len === 0) {
        return null;
    }
    dx /= len;
    dy /= len;
    dz /= len;

    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);

    const stepX = dx >= 0 ? 1 : -1;
    const stepY = dy >= 0 ? 1 : -1;
    const stepZ = dz >= 0 ? 1 : -1;

    const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
    const tDeltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);

    const frac = (v, step) => (step > 0 ? 1 - (v - Math.floor(v)) : v - Math.floor(v));
    let tMaxX = tDeltaX === Infinity ? Infinity : tDeltaX * frac(ox, stepX);
    let tMaxY = tDeltaY === Infinity ? Infinity : tDeltaY * frac(oy, stepY);
    let tMaxZ = tDeltaZ === Infinity ? Infinity : tDeltaZ * frac(oz, stepZ);

    let faceNormal = { x: -stepX, y: 0, z: 0 };
    let t = 0;

    for (let i = 0; i < maxDistance * 3; i += 1) {
        const hit = scene.getTopVoxel(x, y, z, { visibleOnly });
        if (hit) {
            return {
                x, y, z,
                voxel: hit,
                faceNormal,
                distance: t,
                place: {
                    x: x + faceNormal.x,
                    y: y + faceNormal.y,
                    z: z + faceNormal.z,
                },
            };
        }

        if (tMaxX < tMaxY) {
            if (tMaxX < tMaxZ) {
                t = tMaxX;
                x += stepX;
                tMaxX += tDeltaX;
                faceNormal = { x: -stepX, y: 0, z: 0 };
            } else {
                t = tMaxZ;
                z += stepZ;
                tMaxZ += tDeltaZ;
                faceNormal = { x: 0, y: 0, z: -stepZ };
            }
        } else if (tMaxY < tMaxZ) {
            t = tMaxY;
            y += stepY;
            tMaxY += tDeltaY;
            faceNormal = { x: 0, y: -stepY, z: 0 };
        } else {
            t = tMaxZ;
            z += stepZ;
            tMaxZ += tDeltaZ;
            faceNormal = { x: 0, y: 0, z: -stepZ };
        }

        if (t > maxDistance) {
            break;
        }
    }

    // Ground plane y = 0 - only accept hits on the grid footprint
    if (Math.abs(dy) > 1e-8) {
        const tGround = (0 - oy) / dy;
        if (tGround > 1e-6 && tGround < maxDistance) {
            const gx = Math.floor(ox + dx * tGround);
            const gz = Math.floor(oz + dz * tGround);
            if (gx >= GRID_MIN && gx <= GRID_MAX && gz >= GRID_MIN && gz <= GRID_MAX) {
                return {
                    x: gx,
                    y: -1,
                    z: gz,
                    voxel: null,
                    faceNormal: { x: 0, y: 1, z: 0 },
                    distance: tGround,
                    place: { x: gx, y: 0, z: gz },
                    ground: true,
                };
            }
        }
    }

    return null;
}

/** Mirror cells across origin planes for X/Y/Z symmetry. */
export function applySymmetry(cells, symmetry = {}) {
    if (!symmetry.x && !symmetry.y && !symmetry.z) {
        return cells.map((c) => ({ x: c.x | 0, y: c.y | 0, z: c.z | 0 }));
    }
    const seen = new Set();
    const out = [];
    const push = (x, y, z) => {
        const key = voxelKey(x, y, z);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ x, y, z });
    };
    for (const cell of cells) {
        let set = [{ x: cell.x | 0, y: cell.y | 0, z: cell.z | 0 }];
        if (symmetry.x) {
            set = set.flatMap((p) => [p, { x: -p.x, y: p.y, z: p.z }]);
        }
        if (symmetry.y) {
            set = set.flatMap((p) => [p, { x: p.x, y: -p.y, z: p.z }]);
        }
        if (symmetry.z) {
            set = set.flatMap((p) => [p, { x: p.x, y: p.y, z: -p.z }]);
        }
        for (const p of set) push(p.x, p.y, p.z);
    }
    return out;
}

export function expandBrush(cx, cy, cz, size, symmetry = {}) {
    const s = Math.max(1, size | 0);
    const half = Math.floor((s - 1) / 2);
    const cells = [];
    const seen = new Set();

    const push = (x, y, z) => {
        const key = voxelKey(x, y, z);
        if (seen.has(key)) return;
        seen.add(key);
        cells.push({ x, y, z });
    };

    for (let x = cx - half; x <= cx - half + s - 1; x += 1) {
        for (let y = cy - half; y <= cy - half + s - 1; y += 1) {
            for (let z = cz - half; z <= cz - half + s - 1; z += 1) {
                push(x | 0, y | 0, z | 0);
            }
        }
    }

    return applySymmetry(cells, symmetry);
}

export function lineCells(a, b) {
    if (!a || !b) return [];
    const cells = [];
    let x0 = a.x | 0;
    let y0 = a.y | 0;
    let z0 = a.z | 0;
    const x1 = b.x | 0;
    const y1 = b.y | 0;
    const z1 = b.z | 0;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const dz = Math.abs(z1 - z0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    const sz = z0 < z1 ? 1 : -1;
    let dm = Math.max(dx, dy, dz);
    const n = dm;
    let cx = dy - dx;
    let cy = dz - dx;
    let cz = dz - dy;
    // 3D Bresenham
    let err1, err2;
    const xd = dx;
    const yd = dy;
    const zd = dz;
    if (xd >= yd && xd >= zd) {
        err1 = 2 * yd - xd;
        err2 = 2 * zd - xd;
        for (let i = 0; i <= xd; i += 1) {
            cells.push({ x: x0, y: y0, z: z0 });
            if (err1 > 0) {
                y0 += sy;
                err1 -= 2 * xd;
            }
            if (err2 > 0) {
                z0 += sz;
                err2 -= 2 * xd;
            }
            err1 += 2 * yd;
            err2 += 2 * zd;
            x0 += sx;
        }
    } else if (yd >= xd && yd >= zd) {
        err1 = 2 * xd - yd;
        err2 = 2 * zd - yd;
        for (let i = 0; i <= yd; i += 1) {
            cells.push({ x: x0, y: y0, z: z0 });
            if (err1 > 0) {
                x0 += sx;
                err1 -= 2 * yd;
            }
            if (err2 > 0) {
                z0 += sz;
                err2 -= 2 * yd;
            }
            err1 += 2 * xd;
            err2 += 2 * zd;
            y0 += sy;
        }
    } else {
        err1 = 2 * yd - zd;
        err2 = 2 * xd - zd;
        for (let i = 0; i <= zd; i += 1) {
            cells.push({ x: x0, y: y0, z: z0 });
            if (err1 > 0) {
                y0 += sy;
                err1 -= 2 * zd;
            }
            if (err2 > 0) {
                x0 += sx;
                err2 -= 2 * zd;
            }
            err1 += 2 * yd;
            err2 += 2 * xd;
            z0 += sz;
        }
    }
    return cells;
}

export function boxCells(a, b, maxCells = MAX_BOX_VOLUME) {
    if (!a || !b) return [];
    const minX = Math.min(a.x, b.x) | 0;
    const maxX = Math.max(a.x, b.x) | 0;
    const minY = Math.min(a.y, b.y) | 0;
    const maxY = Math.max(a.y, b.y) | 0;
    const minZ = Math.min(a.z, b.z) | 0;
    const maxZ = Math.max(a.z, b.z) | 0;
    const volume = (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1);
    const cap = Math.min(maxCells, MAX_STROKE_CELLS);
    if (volume > cap) {
        // Shrink toward start corner so preview stays responsive
        return boxCellsClamped(a, b, cap);
    }
    const cells = [];
    for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
            for (let z = minZ; z <= maxZ; z += 1) {
                cells.push({ x, y, z });
            }
        }
    }
    return cells;
}

function boxCellsClamped(a, b, cap) {
    const sx = Math.sign((b.x | 0) - (a.x | 0)) || 1;
    const sy = Math.sign((b.y | 0) - (a.y | 0)) || 1;
    const sz = Math.sign((b.z | 0) - (a.z | 0)) || 1;
    const cells = [];
    const ax = a.x | 0;
    const ay = a.y | 0;
    const az = a.z | 0;
    const bx = b.x | 0;
    const by = b.y | 0;
    const bz = b.z | 0;
    for (let x = ax; sx > 0 ? x <= bx : x >= bx; x += sx) {
        for (let y = ay; sy > 0 ? y <= by : y >= by; y += sy) {
            for (let z = az; sz > 0 ? z <= bz : z >= bz; z += sz) {
                cells.push({ x, y, z });
                if (cells.length >= cap) return cells;
            }
        }
    }
    return cells;
}

export function floodFillCells(scene, start, _matchFn, limit = MAX_STROKE_CELLS) {
    const layer = scene.activeLayer;
    if (!layer || layer.locked) {
        return [];
    }
    const sx = start.x | 0;
    const sy = start.y | 0;
    const sz = start.z | 0;
    const target = layer.voxels.get(voxelKey(sx, sy, sz));
    if (!target) {
        return [];
    }
    const tc = target.c | 0;
    const matches = _matchFn || ((voxel) => (voxel?.c | 0) === tc);

    // Index queue (O(1) dequeue) instead of Array.shift O(n)
    const queue = [{ x: sx, y: sy, z: sz }];
    let qHead = 0;
    const seen = new Set([voxelKey(sx, sy, sz)]);
    const result = [];

    while (qHead < queue.length && result.length < limit) {
        const p = queue[qHead++];
        const v = layer.voxels.get(voxelKey(p.x, p.y, p.z));
        if (!v || !matches(v)) {
            continue;
        }
        result.push(p);
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            const nx = p.x + dx;
            const ny = p.y + dy;
            const nz = p.z + dz;
            const key = voxelKey(nx, ny, nz);
            if (seen.has(key)) continue;
            seen.add(key);
            const nv = layer.voxels.get(key);
            if (nv && matches(nv)) {
                queue.push({ x: nx, y: ny, z: nz });
            }
        }
    }

    return result;
}
