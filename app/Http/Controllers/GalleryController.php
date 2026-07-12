<?php

namespace App\Http\Controllers;

use App\Models\Publication;
use Illuminate\Http\Request;
use Illuminate\View\View;

class GalleryController extends Controller
{
    public function index(Request $request): View
    {
        $sort = $request->string('sort', 'trending')->toString();
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
            'newest' => $query->orderByDesc('created_at'),
            default => $query->orderByDesc('trending_score')->orderByDesc('created_at'),
        };

        $models = $query->paginate(24)->withQueryString();

        return view('gallery', [
            'models' => $models,
            'sort' => $sort,
            'q' => $q,
            'tag' => $tag,
        ]);
    }
}
