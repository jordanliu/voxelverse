<?php

namespace App\Http\Controllers;

use App\Models\Publication;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ModelPageController extends Controller
{
    public function show(string $publicId): View
    {
        $publication = Publication::query()->where('public_id', $publicId)->first();
        if (! $publication || $publication->visibility === 'hidden') {
            throw new NotFoundHttpException('Model not found.');
        }

        return view('model', [
            'model' => $publication,
        ]);
    }
}
