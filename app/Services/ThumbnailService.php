<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class ThumbnailService
{
    public function storeFromDataUrl(string $dataUrl, string $publicId): string
    {
        if (! preg_match('#^data:image/(png|jpeg);base64,#', $dataUrl, $matches)) {
            throw new RuntimeException('Invalid thumbnail format.');
        }

        $binary = base64_decode(Str::after($dataUrl, 'base64,'), true);
        if ($binary === false) {
            throw new RuntimeException('Invalid thumbnail data.');
        }

        $max = (int) config('voxelverse.limits.thumbnail_bytes', 2_000_000);
        if (strlen($binary) > $max) {
            throw new RuntimeException('Thumbnail too large.');
        }

        $ext = $matches[1] === 'jpeg' ? 'jpg' : 'png';
        $path = "thumbnails/{$publicId}.{$ext}";
        Storage::disk('public')->put($path, $binary);

        return $path;
    }
}
