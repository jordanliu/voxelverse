<?php

namespace Tests\Feature;

use App\Models\Publication;
use App\Services\EditCredentialService;
use App\Services\RankingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PublicationFlowTest extends TestCase
{
    use RefreshDatabase;

    private function sampleScene(int $voxels = 1): array
    {
        $map = [];
        for ($i = 0; $i < $voxels; $i++) {
            $map["{$i},0,0"] = ['c' => 0, 'm' => 0];
        }

        return [
            'version' => 1,
            'meta' => ['title' => 'Test'],
            'palette' => ['#F4C7B0', '#FFFFFF'],
            'materials' => ['soft-clay'],
            'environment' => 'soft-studio',
            'layers' => [
                [
                    'id' => 'layer-1',
                    'name' => 'Layer 1',
                    'visible' => true,
                    'locked' => false,
                    'voxels' => $map,
                ],
            ],
        ];
    }

    private function tinyPngDataUrl(): string
    {
        $png = base64_encode(hex2bin(
            '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082'
        ));

        return 'data:image/png;base64,'.$png;
    }

    public function test_home_and_editor_pages_load(): void
    {
        $this->get('/')->assertOk();
        $this->get('/editor')->assertOk();
        $this->get('/privacy')->assertOk();
    }

    public function test_publish_open_rate_update_and_delete_flow(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $payload = [
            'title' => 'Soft Cottage',
            'description' => 'A tiny home',
            'display_name' => 'Maker',
            'tags' => ['cute', 'house'],
            'visibility' => 'public',
            'allow_remix' => true,
            'scene' => $this->sampleScene(3),
            'thumbnail' => $this->tinyPngDataUrl(),
            'voxel_count' => 3,
            'dimensions' => ['x' => 3, 'y' => 1, 'z' => 1],
            'palette_count' => 2,
            'material_count' => 1,
            'device_id' => 'device-owner-1',
        ];

        $create = $this->postJson('/api/models', $payload);
        $create->assertCreated()
            ->assertJsonStructure(['public_id', 'public_url', 'edit_key']);

        $publicId = $create->json('public_id');
        $editKey = $create->json('edit_key');

        $this->get('/m/'.$publicId)->assertOk();
        $this->getJson('/api/models/'.$publicId)->assertOk()
            ->assertJsonPath('title', 'Soft Cottage')
            ->assertJsonMissingPath('edit_key_hash');

        $this->getJson('/api/models/'.$publicId.'/scene')
            ->assertOk()
            ->assertJsonPath('scene.version', 1);

        // Unlisted excluded from gallery
        $unlisted = $this->postJson('/api/models', [
            ...$payload,
            'title' => 'Secret',
            'visibility' => 'unlisted',
        ])->assertCreated();

        $this->getJson('/api/models?sort=newest')
            ->assertOk()
            ->assertJsonFragment(['title' => 'Soft Cottage'])
            ->assertJsonMissing(['title' => 'Secret']);

        // Rating
        $this->postJson('/api/models/'.$publicId.'/ratings', [
            'score' => 5,
            'device_id' => 'device-voter-1',
        ])->assertOk()->assertJsonPath('rating_count', 1);

        $this->postJson('/api/models/'.$publicId.'/ratings', [
            'score' => 4,
            'device_id' => 'device-voter-1',
        ])->assertOk()->assertJsonPath('rating_count', 1)
            ->assertJsonPath('your_score', 4);

        // Owner cannot rate own model with edit key
        $this->postJson('/api/models/'.$publicId.'/ratings', [
            'score' => 5,
            'device_id' => 'device-owner-1',
            'edit_key' => $editKey,
        ])->assertStatus(422);

        // Invalid edit key rejected
        $this->putJson('/api/models/'.$publicId, [
            ...$payload,
            'title' => 'Hacked',
            'edit_key' => 'wrong-key',
        ])->assertForbidden();

        // Valid update
        $this->putJson('/api/models/'.$publicId, [
            ...$payload,
            'title' => 'Soft Cottage Updated',
            'edit_key' => $editKey,
        ])->assertOk()->assertJsonPath('title', 'Soft Cottage Updated');

        // Remix attribution
        $remix = $this->postJson('/api/models', [
            ...$payload,
            'title' => 'Cottage Remix',
            'source_public_id' => $publicId,
        ])->assertCreated();

        $this->getJson('/api/models/'.$remix->json('public_id'))
            ->assertOk()
            ->assertJsonPath('source_public_id', $publicId);

        // Report
        $this->postJson('/api/models/'.$publicId.'/reports', [
            'reason' => 'spam',
            'details' => 'test',
            'device_id' => 'device-reporter-1',
        ])->assertCreated();

        // Delete owned
        $this->deleteJson('/api/models/'.$publicId, [
            'edit_key' => $editKey,
        ])->assertOk();

        $this->getJson('/api/models/'.$publicId)->assertNotFound();
    }

    public function test_invalid_scene_is_rejected(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $this->postJson('/api/models', [
            'title' => 'Bad',
            'visibility' => 'public',
            'scene' => ['version' => 99],
            'thumbnail' => $this->tinyPngDataUrl(),
        ])->assertStatus(422);
    }

    public function test_server_recomputes_voxel_stats_not_client_values(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $create = $this->postJson('/api/models', [
            'title' => 'Stats Check',
            'visibility' => 'public',
            'scene' => $this->sampleScene(3),
            'thumbnail' => $this->tinyPngDataUrl(),
            'voxel_count' => 99999,
            'dimensions' => ['x' => 1, 'y' => 1, 'z' => 1],
            'palette_count' => 1,
            'material_count' => 99,
            'device_id' => 'device-stats',
        ])->assertCreated();

        $publicId = $create->json('public_id');
        $this->getJson('/api/models/'.$publicId)
            ->assertOk()
            ->assertJsonPath('voxel_count', 3)
            ->assertJsonPath('dimensions.x', 3)
            ->assertJsonPath('dimensions.y', 1)
            ->assertJsonPath('dimensions.z', 1);
    }

    public function test_gallery_page_loads(): void
    {
        $this->get('/gallery')->assertOk();
        $this->get('/gallery?sort=newest')->assertOk();
    }

    public function test_bayesian_ranking_prefers_confidence(): void
    {
        $ranking = new RankingService;
        $oneFive = $ranking->bayesianScore(5, 1);
        $manyFours = $ranking->bayesianScore(40, 10);
        $this->assertGreaterThan($oneFive, $manyFours);
    }

    public function test_edit_credential_hash_round_trip(): void
    {
        $service = new EditCredentialService;
        $key = $service->generate();
        $hash = $service->hash($key);
        $this->assertTrue($service->verify($key, $hash));
        $this->assertFalse($service->verify('nope', $hash));
    }
}
