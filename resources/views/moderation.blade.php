<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Moderation · Voxelverse</title>
    @fonts
    @vite(['resources/css/app.css'])
</head>
<body class="min-h-full p-6">
    <h1 class="mb-4 text-2xl font-semibold tracking-tight">Moderation</h1>
    <p class="mb-6 text-sm text-[var(--color-studio-muted)]">Internal report queue. Token required.</p>

    @if($reports->isEmpty())
        <div class="vv-panel p-6">No open reports.</div>
    @else
        <div class="space-y-3">
            @foreach($reports as $report)
                <div class="vv-panel p-4">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p class="font-medium tracking-tight">
                                {{ $report->publication?->title ?? 'Deleted model' }}
                                <span class="text-sm font-normal text-[var(--color-studio-muted)]">({{ $report->reason }})</span>
                            </p>
                            <p class="mt-1 text-sm text-[var(--color-studio-muted)]">{{ $report->details }}</p>
                            @if($report->publication)
                                <a class="mt-2 inline-block text-sm underline" href="{{ route('models.show', $report->publication->public_id) }}" target="_blank">Open model</a>
                            @endif
                        </div>
                        <div class="flex flex-wrap gap-2">
                            @if($report->publication)
                                <form method="post" action="{{ route('moderation.hide', $report->publication->public_id) }}">
                                    @csrf
                                    <input type="hidden" name="token" value="{{ $token }}">
                                    <button class="vv-btn" type="submit">Hide</button>
                                </form>
                                <form method="post" action="{{ route('moderation.restore', $report->publication->public_id) }}">
                                    @csrf
                                    <input type="hidden" name="token" value="{{ $token }}">
                                    <button class="vv-btn" type="submit">Restore</button>
                                </form>
                                <form method="post" action="{{ route('moderation.destroy', $report->publication->public_id) }}">
                                    @csrf
                                    @method('DELETE')
                                    <input type="hidden" name="token" value="{{ $token }}">
                                    <button class="vv-btn" type="submit">Delete</button>
                                </form>
                            @endif
                            <form method="post" action="{{ route('moderation.resolve', $report) }}">
                                @csrf
                                <input type="hidden" name="token" value="{{ $token }}">
                                <button class="vv-btn vv-btn-primary" type="submit">Resolve</button>
                            </form>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    @endif
</body>
</html>
