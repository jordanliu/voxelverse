<?php

namespace App\Http\Controllers;

use App\Models\Publication;
use App\Models\Report;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ModerationController extends Controller
{
    private function authorizeToken(Request $request): void
    {
        $token = (string) config('voxelverse.moderation_token');
        $provided = (string) $request->query('token', $request->input('token', ''));

        if ($token === '' || ! hash_equals($token, $provided)) {
            throw new AccessDeniedHttpException('Unauthorized.');
        }
    }

    public function index(Request $request): View
    {
        $this->authorizeToken($request);

        return view('moderation', [
            'reports' => Report::query()->with('publication')->where('status', 'open')->latest()->limit(100)->get(),
            'token' => $request->query('token'),
        ]);
    }

    public function hide(Request $request, string $publicId): RedirectResponse
    {
        $this->authorizeToken($request);
        $publication = $this->find($publicId);
        $publication->visibility = 'hidden';
        $publication->save();

        return back();
    }

    public function restore(Request $request, string $publicId): RedirectResponse
    {
        $this->authorizeToken($request);
        $publication = $this->find($publicId);
        $publication->visibility = 'public';
        $publication->save();

        return back();
    }

    public function destroy(Request $request, string $publicId): RedirectResponse
    {
        $this->authorizeToken($request);
        $publication = $this->find($publicId);
        $publication->delete();

        return back();
    }

    public function resolve(Request $request, Report $report): RedirectResponse
    {
        $this->authorizeToken($request);
        $report->status = 'resolved';
        $report->save();

        return back();
    }

    private function find(string $publicId): Publication
    {
        $publication = Publication::query()->where('public_id', $publicId)->first();
        if (! $publication) {
            throw new NotFoundHttpException('Model not found.');
        }

        return $publication;
    }
}
