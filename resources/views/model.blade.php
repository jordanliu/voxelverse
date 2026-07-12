@extends('layouts.app')

@section('title', $model->title.' · Voxelverse')
@section('meta_description', \Illuminate\Support\Str::limit($model->description ?: ('A voxel model'.($model->display_name ? ' by '.$model->display_name : '').' on Voxelverse'), 160))

@section('og')
    <meta property="og:title" content="{{ $model->title }} · Voxelverse">
    <meta property="og:description" content="{{ \Illuminate\Support\Str::limit($model->description ?: 'A voxel model on Voxelverse', 160) }}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="{{ $model->publicUrl() }}">
    @if($model->thumbnailUrl())
        <meta property="og:image" content="{{ $model->thumbnailUrl() }}">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:image" content="{{ $model->thumbnailUrl() }}">
    @endif
@endsection

@push('head')
    @vite(['resources/js/viewer/main.js'])
@endpush

@section('body')
<div
    id="vv-viewer-page"
    class="min-h-full"
    data-public-id="{{ $model->public_id }}"
    data-api-base="/api"
    data-allow-remix="{{ $model->allow_remix ? '1' : '0' }}"
    data-thumbnail="{{ $model->thumbnailUrl() }}"
>
    <header class="vv-chrome mx-auto mt-3 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-[1.15rem] px-4 py-3 md:px-6">
        <div class="flex items-center gap-3">
            <a href="{{ route('gallery') }}" aria-label="Voxelverse home" class="block shrink-0">
                <img src="{{ asset('logo.svg') }}" alt="Voxelverse" class="vv-logo" width="1140" height="380">
            </a>
            <span class="hidden text-sm text-[var(--color-studio-muted)] sm:inline">Soft voxels. Studio light. No signup.</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <a href="{{ route('editor') }}" class="vv-btn vv-btn-fill">Start creating</a>
        </div>
    </header>

    <main class="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
        <section class="vv-viewport-wrap relative" style="min-height: 30rem; height: min(78vh, 48rem);">
            @if($model->thumbnailUrl())
                <img id="vv-thumb-fallback" src="{{ $model->thumbnailUrl() }}" alt="" class="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover">
            @endif
            <canvas
                id="vv-viewer-canvas"
                class="relative z-10 h-full w-full"
                style="touch-action: none; cursor: grab;"
                tabindex="0"
                aria-label="Interactive 3D model viewer. Drag to rotate, scroll to zoom, right-drag to pan."
            ></canvas>
            <div id="vv-viewer-hint" class="pointer-events-none absolute bottom-3 left-3 z-20 opacity-0 transition-opacity duration-300">
                <span class="vv-save-badge" style="pointer-events:none">Drag to orbit · Scroll to zoom · Right-drag to pan</span>
            </div>
            <div class="absolute top-3 right-3 z-20 flex gap-1.5">
                <button type="button" id="vv-auto-rotate" class="vv-btn vv-btn-ghost vv-btn-icon vv-btn-xs" aria-label="Auto-rotate" aria-pressed="false" title="Auto-rotate">
                    <svg class="vv-control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M20 11a8 8 0 1 0-2.34 5.66" />
                        <path d="M20 5v6h-6" />
                    </svg>
                </button>
                <button type="button" id="vv-viewer-reset" class="vv-btn vv-btn-ghost vv-btn-icon vv-btn-xs" aria-label="Reset camera" title="Reset camera">
                    <svg class="vv-control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3 12a9 9 0 1 0 3-6.7" />
                        <path d="M3 4v6h6" />
                    </svg>
                </button>
            </div>
            <div id="vv-viewer-fallback" class="hidden absolute inset-0 z-30 flex items-center justify-center p-6 text-center">
                <div class="vv-panel max-w-sm p-5">
                    <h2 class="font-semibold tracking-tight">3D preview unavailable</h2>
                    <p class="mt-2 text-sm text-[var(--color-studio-muted)]">You can still read the model details below.</p>
                    @if($model->thumbnailUrl())
                        <img src="{{ $model->thumbnailUrl() }}" alt="{{ $model->title }}" class="mt-4 mx-auto max-h-48 rounded-lg">
                    @endif
                </div>
            </div>
        </section>

        <section class="vv-panel vv-model-info p-5 md:p-7">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 class="text-2xl font-semibold tracking-tight" style="letter-spacing:-0.025em">{{ $model->title }}</h1>
                    <p class="mt-1 text-sm text-[var(--color-studio-muted)]">
                        {{ $model->display_name ?: 'Anonymous' }}
                        · {{ $model->created_at?->toFormattedDateString() }}
                    </p>
                </div>
                <div class="flex flex-col items-start gap-2 sm:items-end">
                    <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                        <button type="button" id="vv-share" class="vv-btn vv-btn-ghost">Copy link</button>
                        @if($model->allow_remix)
                            <a class="vv-btn vv-btn-ghost" href="{{ url('/editor') }}?remix={{ $model->public_id }}">Remix in editor</a>
                        @endif
                        <a id="vv-edit-owned" class="vv-btn hidden" href="{{ route('editor', $model->public_id) }}">Edit</a>
                        <button type="button" id="vv-report" class="vv-btn vv-btn-ghost" aria-haspopup="dialog">Report</button>
                    </div>
                    @if($model->tags)
                        <div class="flex flex-wrap gap-1.5 sm:justify-end">
                            @foreach($model->tags as $t)
                                <a class="vv-chip" href="{{ route('gallery', ['tag' => $t]) }}">{{ $t }}</a>
                            @endforeach
                        </div>
                    @endif
                </div>
            </div>

            @if($model->description)
                <p class="mt-4 text-sm leading-relaxed">{{ $model->description }}</p>
            @endif

            <dl class="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-[var(--vv-line)] pt-6 text-sm sm:grid-cols-4">
                <div>
                    <dt class="vv-label">Voxels</dt>
                    <dd>{{ number_format($model->voxel_count) }}</dd>
                </div>
                <div>
                    <dt class="vv-label">Size</dt>
                    <dd>{{ $model->width }}×{{ $model->height }}×{{ $model->depth }}</dd>
                </div>
                <div>
                    <dt class="vv-label">Palette</dt>
                    <dd>{{ $model->palette_count }} colors</dd>
                </div>
                <div>
                    <dt class="vv-label">Views</dt>
                    <dd id="vv-view-count">{{ number_format($model->view_count) }}</dd>
                </div>
            </dl>

            @if($model->source_public_id)
                <p class="mt-4 text-sm text-[var(--color-studio-muted)]">
                    Remix of
                    <a class="underline" href="{{ route('models.show', $model->source_public_id) }}">source model</a>
                    (not an endorsement by the original creator).
                </p>
            @endif

            <div class="mt-7 flex flex-wrap items-end justify-between gap-5 border-t border-[var(--vv-line)] pt-5">
                <div>
                    <h2 class="vv-section-title">Rating</h2>
                    <p class="mt-1 text-sm" id="vv-rating-summary">
                        @if($model->averageRating())
                            ★ {{ number_format($model->averageRating(), 1) }} average · {{ $model->rating_count }} ratings
                        @else
                            No ratings yet
                        @endif
                    </p>
                    <p id="vv-rating-msg" class="mt-2 hidden text-sm text-[var(--color-studio-muted)]" role="status"></p>
                </div>
                <div class="flex flex-col items-start gap-1.5 sm:items-end">
                    <span class="vv-caption">Rate this model</span>
                    <div id="vv-stars" class="flex gap-1" role="group" aria-label="Rate this model">
                        @for($i = 1; $i <= 5; $i++)
                            <button type="button" class="vv-btn vv-icon-btn vv-star" data-score="{{ $i }}" aria-label="{{ $i }} star{{ $i > 1 ? 's' : '' }}">★</button>
                        @endfor
                    </div>
                </div>
            </div>

        </section>
    </main>

    <div id="vv-report-dialog" class="vv-scrim" role="dialog" aria-modal="true" aria-labelledby="vv-report-title" aria-describedby="vv-report-copy" hidden>
        <section class="vv-sheet vv-report-sheet" tabindex="-1">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h2 id="vv-report-title" class="vv-display">Report this model</h2>
                    <p id="vv-report-copy" class="vv-body mt-1">Tell us what needs attention and we’ll review it.</p>
                </div>
                <button type="button" id="vv-report-close" class="vv-btn vv-btn-ghost vv-btn-icon" aria-label="Close report dialog" title="Close">
                    <svg class="vv-control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                        <path d="m6 6 12 12M18 6 6 18" />
                    </svg>
                </button>
            </div>

            <form id="vv-report-form" class="vv-form">
                <div class="vv-field-group">
                    <label class="vv-eyebrow" for="vv-report-reason">Reason</label>
                    <select id="vv-report-reason" name="reason" class="vv-field" required>
                        <option value="spam">Spam</option>
                        <option value="hateful">Hateful or abusive</option>
                        <option value="sexual">Sexual content</option>
                        <option value="violence">Violence</option>
                        <option value="copyright">Copyright</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="vv-field-group">
                    <label class="vv-eyebrow" for="vv-report-details">Details <span class="font-normal normal-case opacity-70">(optional)</span></label>
                    <textarea id="vv-report-details" name="details" class="vv-field vv-textarea" rows="4" maxlength="500" placeholder="Add any helpful context"></textarea>
                </div>
                <p id="vv-report-message" class="vv-report-message hidden" role="status"></p>
                <div class="vv-sheet-actions">
                    <button type="button" id="vv-report-cancel" class="vv-btn vv-btn-ghost">Cancel</button>
                    <button type="submit" id="vv-report-submit" class="vv-btn vv-btn-fill">Submit report</button>
                </div>
            </form>
        </section>
    </div>
</div>
@endsection
