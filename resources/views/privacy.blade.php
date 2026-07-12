@extends('layouts.app')

@section('title', 'Privacy · Voxelverse')
@section('meta_description', 'How Voxelverse handles local storage, anonymous identifiers, publishing, ratings, and moderation.')

@section('body')
<div class="mx-auto max-w-2xl px-4 py-10 md:px-6">
    <a href="{{ route('gallery') }}" class="vv-btn mb-6">← Gallery</a>
    <article class="vv-panel p-6 md:p-8">
        <h1 class="text-2xl font-semibold tracking-tight">Privacy notice</h1>
        <div class="mt-4 space-y-4 text-sm leading-relaxed text-[var(--color-studio-ink)]">
            <p>Voxelverse is designed to avoid unnecessary personal data. You can create, publish, rate, and remix without creating an account.</p>
            <h2 class="text-base font-semibold tracking-tight">Local storage</h2>
            <p>Drafts, publication ownership keys, and a random device identifier are stored in your browser (IndexedDB / localStorage). Clearing site data removes local access to drafts and anonymous ownership records.</p>
            <h2 class="text-base font-semibold tracking-tight">Anonymous device identifiers</h2>
            <p>A random device ID is used so you can update your rating and so we can apply abuse limits. The server stores only a non-reversible hash derived from that ID for ratings and reports - not the raw ID as a permanent public identity.</p>
            <h2 class="text-base font-semibold tracking-tight">Publishing</h2>
            <p>Published models include the content you submit (title, description, optional display name, tags, scene data, and thumbnail). A private edit credential is generated on publish. The server stores only a secure hash of that credential. Anyone with the private edit link can edit or delete the model.</p>
            <h2 class="text-base font-semibold tracking-tight">Ratings & reports</h2>
            <p>Ratings store score aggregates and hashed voter keys. Reports store a reason, optional details, and a hashed reporter key for moderation.</p>
            <h2 class="text-base font-semibold tracking-tight">Deletion</h2>
            <p>You can delete a publication with the private edit key / edit link. Hidden models may also be removed by moderation.</p>
            <h2 class="text-base font-semibold tracking-tight">Tracking</h2>
            <p>Voxelverse does not add third-party tracking by default. Network signals may be used temporarily for rate limiting and abuse prevention.</p>
        </div>
    </article>
</div>
@endsection
