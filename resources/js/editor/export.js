import { buildMeshData } from '../voxel/mesh.js';

function slugify(name) {
    return String(name || 'voxelverse')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'voxelverse';
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function downloadText(text, filename, mime = 'text/plain') {
    downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

export function exportSceneJson(scene, title = 'Untitled') {
    const data = scene.serialize();
    const pretty = JSON.stringify(data, null, 2);
    downloadText(pretty, `${slugify(title)}.voxel.json`, 'application/json');
}

export function exportPng(dataUrl, title = 'Untitled') {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${slugify(title)}.png`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export function exportObj(scene, title = 'Untitled') {
    const mesh = buildMeshData(scene);
    if (!mesh.vertexCount) {
        throw new Error('Nothing to export - add some voxels first.');
    }

    const lines = [];
    lines.push('# Voxelverse OBJ export');
    lines.push(`# ${title}`);
    lines.push('o VoxelModel');

    const pos = mesh.positions;
    for (let i = 0; i < pos.length; i += 3) {
        lines.push(`v ${pos[i]} ${pos[i + 1]} ${pos[i + 2]}`);
    }

    const nrm = mesh.normals;
    for (let i = 0; i < nrm.length; i += 3) {
        lines.push(`vn ${nrm[i]} ${nrm[i + 1]} ${nrm[i + 2]}`);
    }

    const idx = mesh.indices;
    for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i] + 1;
        const b = idx[i + 1] + 1;
        const c = idx[i + 2] + 1;
        lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
    }

    downloadText(lines.join('\n'), `${slugify(title)}.obj`, 'text/plain');
}

export function exportVoxLikeJson(scene, title = 'Untitled') {
    // Compact voxel list for interoperability / re-import later
    const voxels = [];
    for (const layer of scene.layers) {
        if (!layer.visible) continue;
        for (const [key, v] of layer.voxels) {
            const [x, y, z] = key.split(',').map(Number);
            voxels.push({ x, y, z, c: v.c, m: v.m ?? 0, layer: layer.name });
        }
    }
    const payload = {
        format: 'voxelverse-voxels',
        version: 1,
        title,
        palette: [...scene.palette],
        materials: [...scene.materials],
        voxels,
    };
    downloadText(JSON.stringify(payload, null, 2), `${slugify(title)}.voxels.json`, 'application/json');
}
