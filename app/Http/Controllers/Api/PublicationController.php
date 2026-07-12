<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePublicationRequest;
use App\Models\Publication;
use App\Services\EditCredentialService;
use App\Services\RankingService;
use App\Services\SceneValidator;
use App\Services\ThumbnailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PublicationController extends Controller
{
    public function __construct(
        private EditCredentialService $credentials,
        private SceneValidator $scenes,
        private ThumbnailService $thumbnails,
        private RankingService $ranking,
    ) {}

    public function store(StorePublicationRequest $request): JsonResponse
    {
        return $this->persist($request, null);
    }

    public function update(StorePublicationRequest $request, string $publicId): JsonResponse
    {
        $publication = Publication::query()->where('public_id', $publicId)->first();
        if (! $publication) {
            throw new NotFoundHttpException('Model not found.');
        }

        $editKey = (string) $request->input('edit_key', '');
        if ($editKey === '' || ! $this->credentials->verify($editKey, $publication->edit_key_hash)) {
            throw new AccessDeniedHttpException('Invalid edit key.');
        }

        return $this->persist($request, $publication, $editKey);
    }

    public function show(string $publicId): JsonResponse
    {
        $publication = Publication::query()->where('public_id', $publicId)->first();
        if (! $publication || $publication->visibility === 'hidden') {
            throw new NotFoundHttpException('Model not found.');
        }

        return response()->json($publication->toPublicArray());
    }

    public function scene(string $publicId): JsonResponse
    {
        $publication = Publication::query()->where('public_id', $publicId)->first();
        if (! $publication || $publication->visibility === 'hidden') {
            throw new NotFoundHttpException('Model not found.');
        }

        if (! Storage::disk('local')->exists($publication->scene_path)) {
            throw new NotFoundHttpException('Scene missing.');
        }

        $raw = Storage::disk('local')->get($publication->scene_path);
        $scene = json_decode($raw, true);
        if (! is_array($scene)) {
            throw new NotFoundHttpException('Scene corrupt.');
        }

        return response()->json([
            'title' => $publication->title,
            'allow_remix' => $publication->allow_remix,
            'scene' => $scene,
        ]);
    }

    public function destroy(Request $request, string $publicId): JsonResponse
    {
        $publication = Publication::query()->where('public_id', $publicId)->first();
        if (! $publication) {
            throw new NotFoundHttpException('Model not found.');
        }

        $editKey = (string) $request->input('edit_key', $request->header('X-Edit-Key', ''));
        if ($editKey === '' || ! $this->credentials->verify($editKey, $publication->edit_key_hash)) {
            throw new AccessDeniedHttpException('Invalid edit key.');
        }

        if ($publication->scene_path) {
            Storage::disk('local')->delete($publication->scene_path);
        }
        if ($publication->thumbnail_path) {
            Storage::disk('public')->delete($publication->thumbnail_path);
        }

        $publication->delete();

        return response()->json(['ok' => true]);
    }

    public function view(string $publicId): JsonResponse
    {
        $publication = Publication::query()->where('public_id', $publicId)->first();
        if (! $publication || $publication->visibility === 'hidden') {
            throw new NotFoundHttpException('Model not found.');
        }

        $publication->increment('view_count');
        $publication->increment('recent_views');
        $this->ranking->refresh($publication->fresh());

        return response()->json(['ok' => true]);
    }

    private function persist(StorePublicationRequest $request, ?Publication $publication, ?string $existingEditKey = null): JsonResponse
    {
        $data = $request->validated();
        $validation = $this->scenes->validate($data['scene']);
        if (! $validation['ok']) {
            return response()->json([
                'message' => 'Invalid scene.',
                'errors' => $validation['errors'],
            ], 422);
        }

        $isNew = $publication === null;
        $publicId = $isNew ? (string) Str::uuid() : $publication->public_id;
        $editKey = $isNew ? $this->credentials->generate() : $existingEditKey;

        $scenePath = "scenes/{$publicId}.json";
        Storage::disk('local')->put($scenePath, json_encode($data['scene'], JSON_THROW_ON_ERROR));

        $thumbnailPath = $publication?->thumbnail_path;
        if (! empty($data['thumbnail'])) {
            try {
                $thumbnailPath = $this->thumbnails->storeFromDataUrl($data['thumbnail'], $publicId);
            } catch (\Throwable $e) {
                if ($isNew) {
                    return response()->json(['message' => $e->getMessage()], 422);
                }
            }
        }

        // Never trust client-supplied stats - recompute from validated scene
        $dims = $validation['dimensions'] ?? ['x' => 0, 'y' => 0, 'z' => 0];
        $payload = [
            'title' => strip_tags($data['title']),
            'description' => isset($data['description']) ? strip_tags($data['description']) : null,
            'display_name' => isset($data['display_name']) ? strip_tags($data['display_name']) : null,
            'tags' => collect($data['tags'] ?? [])->map(fn ($t) => strip_tags($t))->values()->all(),
            'visibility' => $data['visibility'],
            'allow_remix' => $data['allow_remix'] ?? true,
            'scene_path' => $scenePath,
            'thumbnail_path' => $thumbnailPath,
            'width' => (int) ($dims['x'] ?? 0),
            'height' => (int) ($dims['y'] ?? 0),
            'depth' => (int) ($dims['z'] ?? 0),
            'voxel_count' => (int) ($validation['voxel_count'] ?? 0),
            'palette_count' => (int) ($validation['palette_count'] ?? count($data['scene']['palette'] ?? [])),
            'material_count' => (int) ($validation['material_count'] ?? count($data['scene']['materials'] ?? [])),
            'source_public_id' => $data['source_public_id'] ?? $publication?->source_public_id,
        ];

        if ($isNew) {
            $publication = Publication::query()->create([
                ...$payload,
                'public_id' => $publicId,
                'edit_key_hash' => $this->credentials->hash($editKey),
            ]);
            $this->ranking->refresh($publication);
        } else {
            $publication->fill($payload);
            $publication->save();
            $this->ranking->refresh($publication);
        }

        return response()->json([
            'public_id' => $publication->public_id,
            'public_url' => $publication->publicUrl(),
            'edit_key' => $isNew ? $editKey : null,
            'title' => $publication->title,
        ], $isNew ? 201 : 200);
    }
}
