<?php

namespace App\Services;

class SceneValidator
{
    public function validate(array $scene): array
    {
        $errors = [];
        $limits = config('voxelverse.limits');
        $coordMin = (int) ($limits['coord_min'] ?? -16);
        $coordMax = (int) ($limits['coord_max'] ?? 15);
        $yMin = (int) ($limits['y_min'] ?? 0);
        $yMax = (int) ($limits['y_max'] ?? 31);
        $materialCount = count(config('voxelverse.materials', []));
        if ($materialCount < 1) {
            $materialCount = 8;
        }

        if (($scene['version'] ?? null) !== 1) {
            $errors['scene'][] = 'Unsupported scene version.';
        }

        $palette = $scene['palette'] ?? null;
        if (! is_array($palette) || count($palette) < 1 || count($palette) > $limits['palette']) {
            $errors['scene.palette'][] = 'Invalid palette.';
            $palette = [];
        } else {
            foreach ($palette as $i => $hex) {
                if (! is_string($hex) || ! preg_match('/^#[0-9A-Fa-f]{6}$/', $hex)) {
                    $errors['scene.palette'][] = "Palette entry {$i} must be #RRGGBB.";
                    break;
                }
            }
        }

        $paletteLen = is_array($palette) ? count($palette) : 0;

        $layers = $scene['layers'] ?? null;
        if (! is_array($layers) || count($layers) < 1 || count($layers) > $limits['layers']) {
            $errors['scene.layers'][] = 'Invalid layers.';
            $layers = [];
        }

        $voxelCount = 0;
        $minX = PHP_INT_MAX;
        $minY = PHP_INT_MAX;
        $minZ = PHP_INT_MAX;
        $maxX = PHP_INT_MIN;
        $maxY = PHP_INT_MIN;
        $maxZ = PHP_INT_MIN;
        $seenKeys = [];

        foreach ($layers as $index => $layer) {
            if (! is_array($layer)) {
                $errors['scene.layers'][] = "Layer {$index} is invalid.";

                continue;
            }

            $voxels = $layer['voxels'] ?? [];
            if (! is_array($voxels)) {
                $errors['scene.layers'][] = "Layer {$index} voxels are invalid.";

                continue;
            }

            foreach ($voxels as $key => $voxel) {
                if (! is_string($key) || ! preg_match('/^(-?\d+),(-?\d+),(-?\d+)$/', $key, $m)) {
                    $errors['scene.voxels'][] = 'Invalid voxel key.';
                    break 2;
                }

                $x = (int) $m[1];
                $y = (int) $m[2];
                $z = (int) $m[3];

                if ($x < $coordMin || $x > $coordMax || $z < $coordMin || $z > $coordMax || $y < $yMin || $y > $yMax) {
                    $errors['scene.voxels'][] = 'Voxel outside allowed bounds.';
                    break 2;
                }

                if (! is_array($voxel) || ! array_key_exists('c', $voxel)) {
                    $errors['scene.voxels'][] = 'Invalid voxel data.';
                    break 2;
                }

                $c = (int) $voxel['c'];
                $mat = (int) ($voxel['m'] ?? 0);
                if ($c < 0 || $c >= $paletteLen) {
                    $errors['scene.voxels'][] = 'Voxel color index out of range.';
                    break 2;
                }
                if ($mat < 0 || $mat >= $materialCount) {
                    $errors['scene.voxels'][] = 'Voxel material index out of range.';
                    break 2;
                }

                // Unique occupancy across layers for stats (top-most later wins for count of unique cells)
                $seenKeys[$key] = true;
                $voxelCount++;

                $minX = min($minX, $x);
                $minY = min($minY, $y);
                $minZ = min($minZ, $z);
                $maxX = max($maxX, $x);
                $maxY = max($maxY, $y);
                $maxZ = max($maxZ, $z);
            }
        }

        if ($voxelCount > $limits['voxels']) {
            $errors['scene'][] = 'Model exceeds voxel limit.';
        }

        $encoded = json_encode($scene);
        if ($encoded === false || strlen($encoded) > $limits['scene_bytes']) {
            $errors['scene'][] = 'Scene payload is too large.';
        }

        $uniqueCount = count($seenKeys);
        $dimensions = $uniqueCount === 0
            ? ['x' => 0, 'y' => 0, 'z' => 0]
            : [
                'x' => $maxX - $minX + 1,
                'y' => $maxY - $minY + 1,
                'z' => $maxZ - $minZ + 1,
            ];

        return [
            'ok' => $errors === [],
            'errors' => $errors,
            'voxel_count' => $voxelCount,
            'unique_voxel_count' => $uniqueCount,
            'dimensions' => $dimensions,
            'palette_count' => $paletteLen,
            'material_count' => is_array($scene['materials'] ?? null) ? count($scene['materials']) : 0,
        ];
    }
}
