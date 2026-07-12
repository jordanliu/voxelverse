<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Voxelverse')</title>
    <meta name="description" content="@yield('meta_description', 'Make something blocky. Make it yours. Build and share original voxel creations in Voxelverse.')">
    <link rel="icon" type="image/png" href="{{ asset('favicon.png') }}">
    @hasSection('og')
        @yield('og')
    @else
        <meta property="og:title" content="@yield('title', 'Voxelverse')">
        <meta property="og:description" content="@yield('meta_description', 'Make something blocky. Make it yours. Build and share original voxel creations in Voxelverse.')">
        <meta property="og:type" content="website">
        <meta property="og:image" content="{{ asset('og.png') }}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:image" content="{{ asset('og.png') }}">
    @endif
    @fonts
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @stack('head')
</head>
<body class="min-h-full antialiased">
    @yield('body')
    @stack('scripts')
</body>
</html>
