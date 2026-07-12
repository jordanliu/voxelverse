@extends('layouts.app')

@section('title', 'Voxelverse - Create & share voxel models')
@section('meta_description', 'Make something blocky. Make it yours. Build and share original voxel creations in Voxelverse.')

@push('head')
    @vite(['resources/js/gallery/main.js'])
@endpush

@section('body')
<div class="min-h-full">
    <header class="vv-chrome mx-auto mt-3 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-[1.15rem] px-4 py-3 md:px-6">
        <div class="flex items-center gap-3">
            <a href="{{ route('gallery') }}" aria-label="Voxelverse home" class="block shrink-0">
                <img src="{{ asset('logo.svg') }}" alt="Voxelverse" class="vv-logo" width="1140" height="380">
            </a>
            <span class="hidden text-sm text-[var(--color-studio-muted)] sm:inline">Soft voxels. Studio light. No signup.</span>
        </div>
        <div class="flex items-center gap-2">
            <a href="{{ route('editor') }}" class="vv-btn vv-btn-fill">Start creating</a>
        </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <section class="mb-8 max-w-2xl pt-4 md:pt-6">
            <h1 class="text-3xl font-semibold tracking-tight md:text-4xl" style="letter-spacing:-0.03em;line-height:1.1">
                Make a tiny world. Publish it in one click.
            </h1>
            <p class="mt-3 text-base leading-relaxed text-[var(--color-studio-muted)] md:text-lg">
                Build a tiny world in your browser, save your draft, and share it when it’s ready.
            </p>
            <div class="mt-5">
                <a href="{{ route('editor') }}" class="vv-btn vv-btn-fill vv-btn-cta">Open the editor</a>
            </div>
        </section>

        <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Gallery sort">
                @foreach (['trending' => 'Trending', 'newest' => 'Newest', 'top' => 'Top rated'] as $key => $label)
                    <a
                        href="{{ route('gallery', array_filter(['sort' => $key, 'q' => $q ?: null, 'tag' => $tag ?: null])) }}"
                        class="vv-chip {{ $sort === $key ? 'vv-chip-active' : '' }}"
                        @if($sort === $key) aria-current="page" @endif
                    >{{ $label }}</a>
                @endforeach
            </div>
            <form method="get" action="{{ route('gallery') }}" class="flex gap-2">
                <input type="hidden" name="sort" value="{{ $sort }}">
                @if($tag)<input type="hidden" name="tag" value="{{ $tag }}">@endif
                <input class="vv-input" type="search" name="q" value="{{ $q }}" placeholder="Search models" aria-label="Search models" style="min-width:12rem">
                <button class="vv-btn vv-btn-ghost" type="submit">Search</button>
            </form>
        </div>

        @if($tag)
            <p class="mb-4 text-sm text-[var(--color-studio-muted)]">
                Filtered by tag <strong>{{ $tag }}</strong>
                · <a class="underline" href="{{ route('gallery', array_filter(['sort' => $sort, 'q' => $q ?: null])) }}">Clear</a>
            </p>
        @endif

        @if($models->isEmpty())
            <div class="vv-panel p-10 text-center">
                <h2 class="text-lg font-semibold tracking-tight">No models yet</h2>
                <p class="mt-2 text-sm text-[var(--color-studio-muted)]">
                    @if($q || $tag)
                        Nothing matched your search. Try different words or clear filters.
                    @else
                        Be the first to publish something soft and delightful.
                    @endif
                </p>
                <a href="{{ route('editor') }}" class="vv-btn vv-btn-primary mt-4">Start creating</a>
            </div>
        @else
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                @foreach($models as $model)
                    <a href="{{ route('models.show', $model->public_id) }}" class="vv-card block">
                        <div class="vv-gallery-media aspect-square bg-[#efe6da]">
                            @if($model->thumbnailUrl())
                                <img
                                    src="{{ $model->thumbnailUrl() }}"
                                    alt=""
                                    loading="{{ $loop->index < 3 ? 'eager' : 'lazy' }}"
                                    decoding="async"
                                    @if($loop->index < 3) fetchpriority="high" @endif
                                    class="vv-gallery-image h-full w-full object-cover"
                                >
                            @else
                                <div class="flex h-full items-center justify-center text-sm text-[var(--color-studio-muted)]">No preview</div>
                            @endif
                        </div>
                        <div class="p-3.5">
                            <h2 class="truncate font-semibold tracking-tight">{{ $model->title }}</h2>
                            <p class="mt-0.5 truncate text-sm text-[var(--color-studio-muted)]">
                                {{ $model->display_name ?: 'Anonymous' }}
                            </p>
                            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-studio-muted)]">
                                <span>
                                    @if($model->averageRating())
                                        ★ {{ number_format($model->averageRating(), 1) }}
                                        <span class="opacity-70">({{ $model->rating_count }})</span>
                                    @else
                                        No ratings
                                    @endif
                                </span>
                                <span>·</span>
                                <span>{{ number_format($model->voxel_count) }} voxels</span>
                            </div>
                            @if($model->tags)
                                <div class="mt-2 flex flex-wrap gap-1">
                                    @foreach(array_slice($model->tags, 0, 3) as $t)
                                        <span class="vv-chip" style="padding:0.15rem 0.45rem;font-size:0.7rem">{{ $t }}</span>
                                    @endforeach
                                </div>
                            @endif
                        </div>
                    </a>
                @endforeach
            </div>

            <div class="mt-8">
                {{ $models->links() }}
            </div>
        @endif
    </main>

    <footer class="mx-auto max-w-6xl px-4 pb-10 text-right text-sm text-[var(--color-studio-muted)] md:px-6">
        <p class="inline-flex items-center gap-4">
            <svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.39v-1.52c-2.23.48-2.7-1.08-2.7-1.08-.36-.92-.88-1.17-.88-1.17-.72-.49.05-.48.05-.48.8.06 1.22.82 1.22.82.71 1.22 1.86.87 2.31.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.96 0-.88.31-1.6.82-2.17-.08-.2-.36-1.03.08-2.15 0 0 .67-.22 2.2.83A7.65 7.65 0 0 1 8 3.64c.68 0 1.36.09 2 .27 1.53-1.05 2.2-.83 2.2-.83.44 1.12.16 1.95.08 2.15.51.57.82 1.29.82 2.17 0 3.08-1.87 3.76-3.66 3.96.29.25.54.74.54 1.49v2.21c0 .22.14.47.55.39A8 8 0 0 0 8 0Z" />
            </svg>
            <span aria-hidden="true" class="h-4 border-l border-[var(--color-studio-muted)]"></span>
            <a href="https://x.com/jordanxliu" target="_blank" rel="noopener noreferrer" class="transition-colors hover:text-[var(--color-studio-ink)]">
                created by @jordanxliu
            </a>
        </p>
    </footer>
</div>
@endsection
