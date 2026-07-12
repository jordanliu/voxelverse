<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Publication;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GalleryApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $sort = $request->string('sort', 'newest')->toString();
        $q = trim($request->string('q')->toString());
        $tag = trim($request->string('tag')->toString());

        $query = Publication::query()->listed();

        if ($q !== '') {
            $query->where(function ($builder) use ($q) {
                $builder->where('title', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%")
                    ->orWhere('display_name', 'like', "%{$q}%");
            });
        }

        if ($tag !== '') {
            $query->whereJsonContains('tags', $tag);
        }

        $query = match ($sort) {
            'top' => $query->orderByDesc('rating_score')->orderByDesc('rating_count'),
            'trending' => $query->orderByDesc('trending_score')->orderByDesc('created_at'),
            default => $query->orderByDesc('created_at'),
        };

        $items = $query->paginate(24);

        return response()->json([
            'data' => collect($items->items())->map->toGalleryArray()->values(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'total' => $items->total(),
            ],
        ]);
    }
}
