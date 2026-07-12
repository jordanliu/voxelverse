<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Publication;
use App\Models\Report;
use App\Services\EditCredentialService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ReportController extends Controller
{
    public function __construct(private EditCredentialService $credentials) {}

    public function store(Request $request, string $publicId): JsonResponse
    {
        $publication = Publication::query()->where('public_id', $publicId)->first();
        if (! $publication || $publication->visibility === 'hidden') {
            throw new NotFoundHttpException('Model not found.');
        }

        $data = $request->validate([
            'reason' => ['required', Rule::in(['spam', 'hateful', 'sexual', 'violence', 'copyright', 'other'])],
            'details' => ['nullable', 'string', 'max:500'],
            'device_id' => ['required', 'string', 'max:64'],
        ]);

        Report::query()->create([
            'publication_id' => $publication->id,
            'reason' => $data['reason'],
            'details' => isset($data['details']) ? strip_tags($data['details']) : null,
            'reporter_hash' => $this->credentials->reporterHash($data['device_id']),
            'status' => 'open',
        ]);

        return response()->json(['ok' => true], 201);
    }
}
