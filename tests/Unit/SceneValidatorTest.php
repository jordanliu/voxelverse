<?php

namespace Tests\Unit;

use App\Services\SceneValidator;
use Tests\TestCase;

class SceneValidatorTest extends TestCase
{
    private function baseScene(array $voxels = ['0,0,0' => ['c' => 0, 'm' => 0]]): array
    {
        return [
            'version' => 1,
            'palette' => ['#F4C7B0', '#FFFFFF'],
            'materials' => ['soft-clay'],
            'environment' => 'soft-studio',
            'layers' => [
                [
                    'id' => 'layer-1',
                    'name' => 'Layer 1',
                    'visible' => true,
                    'locked' => false,
                    'voxels' => $voxels,
                ],
            ],
        ];
    }

    public function test_valid_scene_returns_stats(): void
    {
        $v = new SceneValidator;
        $result = $v->validate($this->baseScene([
            '0,0,0' => ['c' => 0, 'm' => 0],
            '2,0,1' => ['c' => 1, 'm' => 0],
        ]));

        $this->assertTrue($result['ok']);
        $this->assertSame(2, $result['voxel_count']);
        $this->assertSame(['x' => 3, 'y' => 1, 'z' => 2], $result['dimensions']);
        $this->assertSame(2, $result['palette_count']);
    }

    public function test_rejects_out_of_bounds_coordinates(): void
    {
        $v = new SceneValidator;
        $result = $v->validate($this->baseScene([
            '100,0,0' => ['c' => 0, 'm' => 0],
        ]));

        $this->assertFalse($result['ok']);
        $this->assertNotEmpty($result['errors']['scene.voxels'] ?? []);
    }

    public function test_rejects_invalid_palette_hex(): void
    {
        $v = new SceneValidator;
        $scene = $this->baseScene();
        $scene['palette'] = ['red'];
        $result = $v->validate($scene);

        $this->assertFalse($result['ok']);
    }

    public function test_rejects_color_index_out_of_range(): void
    {
        $v = new SceneValidator;
        $result = $v->validate($this->baseScene([
            '0,0,0' => ['c' => 99, 'm' => 0],
        ]));

        $this->assertFalse($result['ok']);
    }
}
