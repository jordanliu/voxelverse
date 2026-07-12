<?php

namespace App\Http\Controllers;

use Illuminate\View\View;

class PageController extends Controller
{
    public function editor(?string $publicId = null): View
    {
        return view('editor', [
            'publicId' => $publicId,
        ]);
    }

    public function privacy(): View
    {
        return view('privacy');
    }
}
