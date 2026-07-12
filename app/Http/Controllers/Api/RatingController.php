<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Publication;
use App\Models\Rating;
use App\Services\EditCredentialService;
use App\Services\RankingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class RatingController extends Controller
{
    public function __construct(
        private EditCredentialService $credentials,
        private RankingService $ranking,
    ) {}

    public function store(Request $request, string $publicId): JsonResponse
    {
        $publication = Publication::query()->where('public_id', $publicId)->first();
        if (! $publication || $publication->visibility === 'hidden') {
            throw new NotFoundHttpException('Model not found.');
        }

        $data = $request->validate([
            'score' => ['required', 'integer', 'min:1', 'max:5'],
            'device_id' => ['required', 'string', 'max:64'],
            'edit_key' => ['nullable', 'string', 'max:128'],
        ]);

        // Prevent owner rating their own model when edit key is presented
        if (! empty($data['edit_key']) && $this->credentials->verify($data['edit_key'], $publication->edit_key_hash)) {
            return response()->json(['message' => 'You cannot rate your own model.'], 422);
        }

        $voterHash = $this->credentials->voterHash($data['device_id'], $publicId);

        $existing = Rating::query()
            ->where('publication_id', $publication->id)
            ->where('voter_hash', $voterHash)
            ->first();

        $previous = $existing?->score ?? 0;

        if ($existing) {
            $existing->score = $data['score'];
            $existing->save();
            $publication->rating_sum = $publication->rating_sum - $previous + $data['score'];
        } else {
            Rating::query()->create([
                'publication_id' => $publication->id,
                'voter_hash' => $voterHash,
                'score' => $data['score'],
            ]);
            $publication->rating_sum += $data['score'];
            $publication->rating_count += 1;
            $publication->recent_ratings += 1;
        }

        $publication->save();
        $this->ranking->refresh($publication->fresh());
        $publication->refresh();

        return response()->json([
            'rating_average' => $publication->averageRating(),
            'rating_count' => $publication->rating_count,
            'your_score' => $data['score'],
        ]);
    }
}
