<?php

return [

    'limits' => [
        'title' => 80,
        'description' => 500,
        'display_name' => 40,
        'tags' => 5,
        'tag_length' => 24,
        'layers' => 32,
        'palette' => 256,
        'voxels' => 250_000,
        'scene_bytes' => 8_000_000,
        'thumbnail_bytes' => 2_000_000,
        // Match client grid footprint (32³ build volume)
        'coord_min' => -16,
        'coord_max' => 15,
        'y_min' => 0,
        'y_max' => 31,
        // Client tool safety caps
        'max_stroke_cells' => 20_000,
        'max_box_volume' => 32 * 32 * 32,
    ],

    'materials' => [
        'wood' => ['label' => 'Wood', 'roughness' => 0.74, 'metalness' => 0.0, 'emissive' => 0.0],
        'stone' => ['label' => 'Stone', 'roughness' => 0.96, 'metalness' => 0.0, 'emissive' => 0.0],
        'brushed-metal' => ['label' => 'Brushed Metal', 'roughness' => 0.3, 'metalness' => 0.7, 'emissive' => 0.0],
        'glass' => ['label' => 'Glass', 'roughness' => 0.06, 'metalness' => 0.0, 'emissive' => 0.0],
        'rubber' => ['label' => 'Rubber', 'roughness' => 0.98, 'metalness' => 0.0, 'emissive' => 0.0],
        'neon' => ['label' => 'Neon', 'roughness' => 0.32, 'metalness' => 0.0, 'emissive' => 0.9],
        'ceramic' => ['label' => 'Ceramic', 'roughness' => 0.14, 'metalness' => 0.02, 'emissive' => 0.0],
        'fabric' => ['label' => 'Fabric', 'roughness' => 0.98, 'metalness' => 0.0, 'emissive' => 0.0],
        'ice' => ['label' => 'Ice', 'roughness' => 0.12, 'metalness' => 0.0, 'emissive' => 0.0],
        'gold' => ['label' => 'Gold', 'roughness' => 0.24, 'metalness' => 0.78, 'emissive' => 0.0],
        'clay' => ['label' => 'Clay', 'roughness' => 0.92, 'metalness' => 0.0, 'emissive' => 0.0],
    ],

    'lighting' => [
        'soft-studio' => ['label' => 'Soft Studio'],
        'golden-hour' => ['label' => 'Golden Hour'],
        'cool-moonlight' => ['label' => 'Cool Moonlight'],
        'neutral-product' => ['label' => 'Neutral Product'],
    ],

    'default_palette' => [
        '#F4C7B0', '#E8A0BF', '#BA90C6', '#C0DBEA',
        '#A8D8B9', '#FFE6A7', '#FFB4A2', '#B8C0FF',
        '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF',
        '#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFFFFC',
        '#6D6875', '#4A4E69', '#22223B', '#FFFFFF',
    ],

    'moderation_token' => env('VOXELVERSE_MODERATION_TOKEN'),

    'bayesian' => [
        'prior_mean' => 3.5,
        'prior_weight' => 5,
    ],

    'rate_limits' => [
        'publish' => '10,1',
        'rating' => '30,1',
        'report' => '10,1',
    ],

];
