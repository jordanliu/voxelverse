<?php

namespace App\Services;

use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class EditCredentialService
{
    public function generate(): string
    {
        return Str::random(48);
    }

    public function hash(string $editKey): string
    {
        return Hash::make($editKey);
    }

    public function verify(string $editKey, string $hash): bool
    {
        return Hash::check($editKey, $hash);
    }

    public function voterHash(string $deviceId, string $publicId): string
    {
        $pepper = (string) config('app.key');

        return hash_hmac('sha256', $deviceId.'|'.$publicId, $pepper);
    }

    public function reporterHash(string $deviceId): string
    {
        $pepper = (string) config('app.key');

        return hash_hmac('sha256', 'report|'.$deviceId, $pepper);
    }
}
