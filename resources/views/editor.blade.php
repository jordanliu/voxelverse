@extends('layouts.app')

@section('title', 'Voxelverse')
@section('meta_description', 'Make something blocky. Make it yours. Build and share original voxel creations in Voxelverse.')

@push('head')
    @vite(['resources/js/editor/main.js'])
@endpush

@section('body')
<div
    id="vv-editor"
    class="vv-editor-shell"
    data-public-id="{{ $publicId ?? '' }}"
    data-api-base="/api"
>
    {{-- Full-bleed stage --}}
    <div class="vv-stage" id="vv-viewport">
        <canvas id="vv-canvas" tabindex="0" aria-label="Voxel editor viewport"></canvas>
        <div id="vv-loading" class="vv-loading" role="status" aria-live="polite">
            <span class="vv-spinner" aria-hidden="true"></span>
            <span>Preparing your studio</span>
        </div>
        <div id="vv-webgl-fallback" class="vv-fallback" hidden role="alert">
            <div class="vv-sheet vv-sheet-sm">
                <h2 class="vv-display">Can’t start the editor</h2>
                <p class="vv-body mt-2">WebGL or local storage failed. Try a recent browser with hardware acceleration on.</p>
                <p class="vv-caption mt-3" data-error-detail></p>
            </div>
        </div>
    </div>

    {{-- Floating top chrome --}}
    <header class="vv-float vv-float-top" role="banner">
        <div class="vv-bar">
            <a href="{{ route('gallery') }}" class="vv-btn vv-btn-ghost vv-btn-icon" aria-label="Open gallery" title="Gallery">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="currentColor" stroke-width="1.6"/><path d="M4 15l4.2-3.2a1.5 1.5 0 0 1 1.9.1L14 15l1.4-1.2a1.5 1.5 0 0 1 1.9.1L20 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </a>
            <div class="vv-bar-divider" aria-hidden="true"></div>
            <input
                id="vv-title"
                class="vv-title-field"
                value="Untitled"
                maxlength="80"
                aria-label="Project name"
                spellcheck="false"
            >
            <div class="vv-bar-spacer"></div>
            <button type="button" id="vv-undo" class="vv-btn vv-btn-ghost vv-btn-icon" aria-label="Undo" title="Undo (⌘Z)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 14L4 9l5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M4 9h10.5a5.5 5.5 0 1 1 0 11H12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <button type="button" id="vv-redo" class="vv-btn vv-btn-ghost vv-btn-icon" aria-label="Redo" title="Redo (⌘⇧Z)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M15 14l5-5-5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M20 9H9.5a5.5 5.5 0 1 0 0 11H12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="vv-export-wrap">
                <button
                    type="button"
                    id="vv-export"
                    class="vv-btn vv-btn-ghost vv-btn-icon"
                    aria-label="Menu"
                    aria-haspopup="menu"
                    aria-expanded="false"
                    title="Menu"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="5.5" r="1.5" fill="currentColor"/>
                        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                        <circle cx="12" cy="18.5" r="1.5" fill="currentColor"/>
                    </svg>
                </button>
                <div id="vv-export-menu" class="vv-menu vv-desktop-only" role="menu" hidden>
                    <a class="vv-menu-item" role="menuitem" href="{{ route('editor') }}?new=1">Start new</a>
                    <button type="button" class="vv-menu-item" role="menuitem" data-export="png">Export PNG</button>
                    <button type="button" class="vv-menu-item" role="menuitem" data-export="json">Export JSON</button>
                    <button type="button" class="vv-menu-item" role="menuitem" data-export="obj">Export OBJ</button>
                    <button type="button" class="vv-menu-item" role="menuitem" data-import="json">Import JSON</button>
                </div>
            </div>
            <input id="vv-import-json" type="file" accept="application/json,.json" hidden>
            <button type="button" id="vv-publish" class="vv-btn vv-btn-fill">Publish</button>
        </div>
    </header>

    <aside id="vv-mobile-desktop-banner" class="vv-mobile-desktop-banner" role="status" aria-label="Desktop experience notice" hidden>
        <div>
            <p class="vv-eyebrow">Desktop works best</p>
            <p class="vv-mobile-desktop-banner-copy">For a better experience, open the editor on desktop.</p>
        </div>
        <button type="button" id="vv-dismiss-desktop-banner" class="vv-btn vv-btn-ghost vv-btn-icon" aria-label="Dismiss desktop experience notice" title="Dismiss">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
        </button>
    </aside>

    {{-- Floating tool rail --}}
    <aside class="vv-float vv-float-left" aria-label="Tools">
        <div class="vv-rail" role="toolbar">
            <button type="button" class="vv-tool" data-tool="navigate" data-tip="Navigate" data-kbd="H · Space" aria-label="Navigate camera" aria-pressed="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 12h8M12 8v8M5 9l-2 3 2 3M19 9l2 3-2 3M9 5l3-2 3 2M9 19l3 2 3-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <div class="vv-rail-sep" aria-hidden="true"></div>
            <button type="button" class="vv-tool is-active" data-tool="add" data-tip="Add voxel" data-kbd="1" aria-label="Add voxel" aria-pressed="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="vv-tool" data-tool="erase" data-tip="Erase" data-kbd="2" aria-label="Erase voxel" aria-pressed="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="vv-tool" data-tool="paint" data-tip="Paint" data-kbd="3" aria-label="Paint voxel" aria-pressed="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="6.5" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>
            </button>
            <button type="button" class="vv-tool" data-tool="eyedropper" data-tip="Eyedropper" data-kbd="4" aria-label="Eyedropper" aria-pressed="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.5 5.5l4 4M8 20l-3.5.5L5 17l8.8-8.8a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8 20Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            </button>
            <div class="vv-rail-sep" aria-hidden="true"></div>
            <button type="button" class="vv-tool" data-tool="line" data-tip="Line" data-kbd="L" aria-label="Line" aria-pressed="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18L18 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="vv-tool" data-tool="box" data-tip="Box fill" data-kbd="B" aria-label="Box fill" aria-pressed="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/></svg>
            </button>
            <button type="button" class="vv-tool" data-tool="boxErase" data-tip="Box erase" data-kbd="⇧B" aria-label="Box erase" aria-pressed="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 12h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="vv-tool" data-tool="flood" data-tip="Flood fill" data-kbd="F" aria-label="Flood fill" aria-pressed="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
            </button>
        </div>
    </aside>

    {{-- Mobile action dock: help + settings --}}
    <div class="vv-mobile-dock" aria-label="Editor actions">
        <button type="button" id="vv-open-help-mobile" class="vv-mobile-fab vv-mobile-fab-help" aria-label="Controls & shortcuts" aria-controls="vv-help-drawer" aria-expanded="false">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="8.25" stroke="currentColor" stroke-width="1.6"/>
                <path d="M12 10.5v5.5M12 8.25v.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
        </button>
        <button type="button" id="vv-open-inspector-mobile" class="vv-mobile-fab" aria-label="Settings" aria-controls="vv-inspector-drawer" aria-expanded="false">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
            </svg>
        </button>
    </div>

    {{-- Inspector: desktop panel / mobile bottom drawer --}}
    <div id="vv-inspector-drawer" class="vv-drawer vv-inspector-drawer" role="dialog" aria-modal="false" aria-labelledby="vv-inspector-title">
        <div class="vv-drawer-scrim" data-drawer-scrim></div>
        <div class="vv-drawer-sheet vv-inspector-sheet" data-drawer-sheet tabindex="-1">
            <div class="vv-drawer-handle" data-drawer-handle aria-hidden="true"></div>
            <div class="vv-drawer-header vv-mobile-only">
                <h2 id="vv-inspector-title" class="vv-display" style="font-size:1.05rem">Settings</h2>
                <button type="button" class="vv-btn vv-btn-ghost vv-btn-icon" id="vv-close-inspector" aria-label="Close settings">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
                </button>
            </div>
            <div class="vv-drawer-body vv-inspector-card">
            <section class="vv-block">
                <h2 class="vv-eyebrow" title="Controls how many voxels each edit affects, including optional mirror symmetry.">Brush</h2>
                <div class="vv-row-between">
                    <label class="vv-body" for="vv-brush-size" title="Larger brushes affect more voxels at once.">Brush size</label>
                    <span id="vv-brush-size-label" class="vv-caption">1</span>
                </div>
                <input id="vv-brush-size" type="range" min="1" max="8" value="1" class="vv-slider" aria-valuemin="1" aria-valuemax="8" aria-valuenow="1">
                <p class="vv-caption mt-3" style="margin-bottom:0.4rem" title="Mirror edits across the selected axis. Turn on more than one axis for combined symmetry.">Mirror symmetry</p>
                <div class="vv-seg" role="group" aria-label="Mirror symmetry">
                    <button type="button" class="vv-seg-btn" data-sym="x" aria-pressed="false" title="Mirror across YZ plane (X)">X</button>
                    <button type="button" class="vv-seg-btn" data-sym="y" aria-pressed="false" title="Mirror across XZ plane (Y)">Y</button>
                    <button type="button" class="vv-seg-btn" data-sym="z" aria-pressed="false" title="Mirror across XY plane (Z)">Z</button>
                </div>
            </section>

            <section class="vv-block">
                <div class="vv-row-between">
                    <h2 class="vv-eyebrow" title="Choose and manage the colors used to create or paint voxels.">Palette</h2>
                    <button type="button" id="vv-add-color" class="vv-btn vv-btn-ghost vv-btn-xs">Add</button>
                </div>
                <div id="vv-palette" class="vv-swatches" role="listbox" aria-label="Color palette"></div>
                <div class="vv-color-row">
                    <input id="vv-color-hex" class="vv-field" value="#F4C7B0" maxlength="7" aria-label="Hex color" title="Enter a color as a hex value, such as #F4C7B0." spellcheck="false">
                    <input id="vv-color-picker" type="color" value="#F4C7B0" aria-label="Color picker" title="Choose a custom color." class="vv-color-native">
                </div>
            </section>

            <section class="vv-block">
                <h2 class="vv-eyebrow" title="Controls the surface finish and appearance of voxels.">Material</h2>
                <select id="vv-material" class="vv-field" aria-label="Material preset" title="Choose the surface finish for new or painted voxels."></select>
                <button type="button" id="vv-apply-material" class="vv-btn vv-btn-ghost vv-btn-xs vv-material-apply" title="Apply this material to every voxel in the active layer.">Apply to layer</button>
            </section>

            <section class="vv-block">
                <h2 class="vv-eyebrow" title="Changes the scene lighting and overall mood without changing the model.">Lighting</h2>
                <select id="vv-lighting" class="vv-field" aria-label="Lighting preset" title="Choose a lighting preset for the scene."></select>
                <button type="button" class="vv-advanced-toggle" id="vv-light-advanced-toggle" aria-expanded="false" aria-controls="vv-light-advanced" title="Adjust individual light intensities and exposure.">
                    Advanced
                    <span class="vv-help-chevron" aria-hidden="true">▸</span>
                </button>
                <div id="vv-light-advanced" class="vv-advanced" hidden>
                    <div class="vv-slider-row">
                        <label class="vv-caption" for="vv-light-ambient" title="Base light applied evenly across the scene.">Ambient</label>
                        <span class="vv-caption" id="vv-light-ambient-val">0.42</span>
                    </div>
                    <input id="vv-light-ambient" type="range" min="0" max="1.5" step="0.01" value="0.42" class="vv-slider">
                    <div class="vv-slider-row">
                        <label class="vv-caption" for="vv-light-key" title="Main directional light that defines form and shadows.">Key</label>
                        <span class="vv-caption" id="vv-light-key-val">1.35</span>
                    </div>
                    <input id="vv-light-key" type="range" min="0" max="3" step="0.01" value="1.35" class="vv-slider">
                    <div class="vv-slider-row">
                        <label class="vv-caption" for="vv-light-fill" title="Softens shadows by adding light from the opposite side.">Fill</label>
                        <span class="vv-caption" id="vv-light-fill-val">0.45</span>
                    </div>
                    <input id="vv-light-fill" type="range" min="0" max="2" step="0.01" value="0.45" class="vv-slider">
                    <div class="vv-slider-row">
                        <label class="vv-caption" for="vv-light-rim" title="Adds a highlight around the edge of the model.">Rim</label>
                        <span class="vv-caption" id="vv-light-rim-val">0.55</span>
                    </div>
                    <input id="vv-light-rim" type="range" min="0" max="2" step="0.01" value="0.55" class="vv-slider">
                    <div class="vv-slider-row">
                        <label class="vv-caption" for="vv-light-exposure" title="Brightens or darkens the entire rendered scene.">Exposure</label>
                        <span class="vv-caption" id="vv-light-exposure-val">1.05</span>
                    </div>
                    <input id="vv-light-exposure" type="range" min="0.4" max="2" step="0.01" value="1.05" class="vv-slider">
                    <div class="vv-color-row vv-scene-row">
                        <label class="vv-body" for="vv-light-key-color" title="Sets the color of the main directional light.">Key color</label>
                        <input id="vv-light-key-color" type="color" value="#FFF1E0" class="vv-color-native" aria-label="Key light color">
                    </div>
                    <button type="button" class="vv-btn vv-btn-ghost vv-btn-xs" id="vv-light-reset" style="margin-top:0.55rem;width:100%">Reset to preset</button>
                </div>
            </section>

            <section class="vv-block">
                <h2 class="vv-eyebrow" title="Controls the background, ground, and editing grid around your model.">Scene</h2>
                <div class="vv-color-row vv-scene-row">
                    <label class="vv-body" for="vv-ground-color" title="The color of the whole scene. The editable grid uses this color as its surface.">Scene color</label>
                    <input id="vv-ground-color" type="color" value="#F5EFE6" aria-label="Scene color" class="vv-color-native">
                </div>
                <div class="vv-color-row vv-scene-row">
                    <label class="vv-body" for="vv-grid-color" title="The color of the lines on the editing grid. This only changes the grid's appearance.">Grid color</label>
                    <input id="vv-grid-color" type="color" value="#F7F3EC" aria-label="Grid line color" class="vv-color-native">
                </div>
                <div class="vv-toggle-row">
                    <span class="vv-body" id="vv-grid-label" title="Shows or hides the editing grid. The grid is only a visual guide and does not change your model.">Show grid</span>
                    <button
                        type="button"
                        class="vv-switch is-on"
                        id="vv-toggle-grid"
                        role="switch"
                        aria-checked="true"
                        aria-labelledby="vv-grid-label"
                    >
                        <span class="vv-switch-knob" aria-hidden="true"></span>
                    </button>
                </div>
            </section>

            <section class="vv-block">
                <h2 class="vv-eyebrow" title="Changes the camera angle, framing, and projection used to view your model.">Camera</h2>
                <div class="vv-chip-wrap">
                    <button type="button" class="vv-chip" data-view="iso" title="Show an isometric view (0)">Iso</button>
                    <button type="button" class="vv-chip" data-view="front" title="View the front of the model">Front</button>
                    <button type="button" class="vv-chip" data-view="back" title="View the back of the model">Back</button>
                    <button type="button" class="vv-chip" data-view="left" title="View the left side of the model">Left</button>
                    <button type="button" class="vv-chip" data-view="right" title="View the right side of the model">Right</button>
                    <button type="button" class="vv-chip" data-view="top" title="View the top of the model">Top</button>
                    <button type="button" class="vv-chip" id="vv-focus" title="Center and frame the whole model">Focus</button>
                    <button type="button" class="vv-chip" id="vv-toggle-proj" aria-pressed="false" title="Toggle between orthographic and perspective projection">Ortho</button>
                </div>
            </section>

            <section class="vv-block">
                <div class="vv-row-between">
                    <h2 class="vv-eyebrow" title="Separate parts of your model into independently editable groups.">Layers</h2>
                    <button type="button" id="vv-add-layer" class="vv-btn vv-btn-ghost vv-btn-xs">Add</button>
                </div>
                <ul id="vv-layers" class="vv-layer-list" aria-label="Layers"></ul>
            </section>

            </div>
        </div>
    </div>

    <div id="vv-delete-layer-dialog" class="vv-modal" role="dialog" aria-modal="true" aria-labelledby="vv-delete-layer-title" hidden>
        <button type="button" class="vv-modal-scrim" data-delete-layer-cancel aria-label="Close delete layer dialog"></button>
        <div class="vv-modal-card" role="document">
            <p class="vv-eyebrow">Delete layer</p>
            <h2 id="vv-delete-layer-title" class="vv-display vv-modal-title">Delete this layer?</h2>
            <p class="vv-body vv-modal-copy">This will remove the layer and all of its voxels. This action can’t be undone.</p>
            <div class="vv-modal-actions">
                <button type="button" class="vv-btn vv-btn-ghost" data-delete-layer-cancel>Cancel</button>
                <button type="button" class="vv-btn vv-btn-danger" id="vv-delete-layer-confirm">Delete layer</button>
            </div>
        </div>
    </div>

    {{-- Floating status --}}
    <footer class="vv-float vv-float-bottom" role="status">
        <div class="vv-status-bar">
            <span id="vv-coords">-</span>
            <span class="vv-dot-sep" aria-hidden="true"></span>
            <span id="vv-voxel-count">0 voxels</span>
            <span class="vv-dot-sep vv-status-desktop" aria-hidden="true"></span>
            <span id="vv-layer-status" class="vv-status-desktop">Layer 1</span>
        </div>
    </footer>

    {{-- Save state - bottom right, muted --}}
    <div class="vv-float vv-float-save" aria-live="polite">
        <span id="vv-save-status" class="vv-save-badge">
            <span class="vv-status-dot" data-state="saved"></span>
            <span class="vv-status-text">Saved</span>
        </span>
    </div>

    {{-- Controls / shortcuts drawer (Vaul-style) --}}
    <div id="vv-help-drawer" class="vv-drawer vv-desktop-dialog" role="dialog" aria-modal="true" aria-labelledby="vv-help-title" hidden>
        <div class="vv-drawer-scrim" data-drawer-scrim></div>
        <div class="vv-drawer-sheet vv-drawer-sheet-help" data-drawer-sheet tabindex="-1">
            <div class="vv-drawer-handle" data-drawer-handle aria-hidden="true"></div>
            <div class="vv-drawer-header">
                <h2 id="vv-help-title" class="vv-display" style="font-size:1.1rem">Controls</h2>
                <button type="button" class="vv-btn vv-btn-ghost vv-btn-icon" id="vv-close-help" aria-label="Close controls">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
                </button>
            </div>
            <div class="vv-drawer-body">
                <div class="vv-help-sections" id="vv-nav-hint">
                    <section class="vv-help-section">
                        <h3 class="vv-eyebrow">Camera</h3>
                        <ul class="vv-help-list">
                            <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</li>
                            <li><kbd>Q</kbd><kbd>E</kbd> Rotate view</li>
                            <li><kbd>Shift</kbd> Faster move</li>
                            <li>Right-drag Pan</li>
                            <li>Scroll Zoom</li>
                            <li><kbd>Alt</kbd>+drag Orbit</li>
                            <li><kbd>Space</kbd> / <kbd>H</kbd> Navigate mode</li>
                            <li><kbd>0</kbd> Isometric view</li>
                        </ul>
                    </section>
                    <section class="vv-help-section">
                        <h3 class="vv-eyebrow">Tools</h3>
                        <ul class="vv-help-list">
                            <li><kbd>1</kbd> Add · <kbd>2</kbd> Erase</li>
                            <li><kbd>3</kbd> Paint · <kbd>4</kbd> Eyedropper</li>
                            <li><kbd>L</kbd> Line · <kbd>B</kbd> Box fill</li>
                            <li><kbd>⇧</kbd><kbd>B</kbd> Box erase · <kbd>F</kbd> Flood</li>
                            <li><kbd>[</kbd> <kbd>]</kbd> Brush size</li>
                            <li>Tap once to place (Add)</li>
                        </ul>
                    </section>
                    <section class="vv-help-section">
                        <h3 class="vv-eyebrow">Scene</h3>
                        <ul class="vv-help-list">
                            <li><kbd>X</kbd><kbd>Y</kbd><kbd>Z</kbd> Mirror symmetry</li>
                            <li><kbd>G</kbd> Toggle grid</li>
                            <li><kbd>⌘</kbd><kbd>Z</kbd> Undo · <kbd>⌘</kbd><kbd>⇧</kbd><kbd>Z</kbd> Redo</li>
                            <li><kbd>⌘</kbd><kbd>S</kbd> Save draft</li>
                            <li><kbd>P</kbd> Publish</li>
                            <li><kbd>Esc</kbd> Cancel / close</li>
                        </ul>
                    </section>
                    <section class="vv-help-section vv-help-section-touch">
                        <h3 class="vv-eyebrow">Touch</h3>
                        <ul class="vv-help-list">
                            <li>One finger - place / edit</li>
                            <li>Two fingers - pan &amp; zoom</li>
                            <li>Settings (gear) - brush, palette, lighting</li>
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    </div>

    {{-- Publish drawer --}}
    <div id="vv-publish-dialog" class="vv-drawer vv-publish-dialog" role="dialog" aria-modal="true" aria-labelledby="vv-publish-title" hidden>
        <div class="vv-drawer-scrim" data-drawer-scrim></div>
        <div class="vv-drawer-sheet vv-drawer-sheet-form" data-drawer-sheet tabindex="-1">
            <div class="vv-drawer-handle" data-drawer-handle aria-hidden="true"></div>
            <div class="vv-drawer-body">
                <h2 id="vv-publish-title" class="vv-display">Publish</h2>
                <p class="vv-body mt-1">Share a public link. Keep the private edit link safe - it can’t be recovered.</p>
                <form id="vv-publish-form" class="vv-form">
                    <div class="vv-field-group">
                        <label class="vv-eyebrow" for="vv-pub-title">Title</label>
                        <input id="vv-pub-title" name="title" class="vv-field" maxlength="80" required autocomplete="off">
                    </div>
                    <div class="vv-field-group">
                        <label class="vv-eyebrow" for="vv-pub-desc">Description</label>
                        <textarea id="vv-pub-desc" name="description" class="vv-field vv-textarea" rows="3" maxlength="500" placeholder="Optional"></textarea>
                    </div>
                    <div class="vv-field-group">
                        <label class="vv-eyebrow" for="vv-pub-name">Display name</label>
                        <input id="vv-pub-name" name="display_name" class="vv-field" maxlength="40" placeholder="Optional" autocomplete="nickname">
                    </div>
                    <div class="vv-field-group">
                        <label class="vv-eyebrow" for="vv-pub-tags">Tags</label>
                        <input id="vv-pub-tags" name="tags" class="vv-field" placeholder="cute, animal, diorama">
                    </div>
                    <div class="vv-choice-row">
                        <label class="vv-choice"><input type="radio" name="visibility" value="public" checked> Public</label>
                        <label class="vv-choice"><input type="radio" name="visibility" value="unlisted"> Unlisted</label>
                        <label class="vv-choice"><input type="checkbox" name="allow_remix" checked> Allow remix</label>
                    </div>
                    <p id="vv-publish-error" class="vv-error" hidden role="alert"></p>
                    <div class="vv-sheet-actions">
                        <button type="button" id="vv-publish-cancel" class="vv-btn vv-btn-ghost">Cancel</button>
                        <button type="submit" id="vv-publish-submit" class="vv-btn vv-btn-fill">Publish</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    {{-- Recovery drawer --}}
    <div id="vv-recovery-dialog" class="vv-drawer vv-desktop-dialog" role="dialog" aria-modal="true" aria-labelledby="vv-recovery-title" hidden>
        <div class="vv-drawer-scrim" data-drawer-scrim></div>
        <div class="vv-drawer-sheet vv-drawer-sheet-form" data-drawer-sheet tabindex="-1">
            <div class="vv-drawer-handle" data-drawer-handle aria-hidden="true"></div>
            <div class="vv-drawer-body">
                <h2 id="vv-recovery-title" class="vv-display">Published</h2>
                <p id="vv-recovery-msg" class="vv-body mt-1">
                    Ownership lives in this browser or the private edit link. Clearing site data removes local access.
                </p>
                <div class="vv-form">
                    <div class="vv-field-group">
                        <label class="vv-eyebrow" for="vv-public-link">Public link</label>
                        <div class="vv-input-icon-wrap">
                            <input id="vv-public-link" class="vv-field" readonly style="padding-right:2.5rem">
                            <button type="button" class="vv-btn vv-btn-ghost vv-btn-icon vv-copy-btn" data-copy="vv-public-link" aria-label="Copy public link">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="vv-copy-icon"><rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" stroke-width="1.6"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke="currentColor" stroke-width="1.6"/></svg>
                            </button>
                        </div>
                    </div>
                    <div class="vv-field-group">
                        <label class="vv-eyebrow" for="vv-edit-link">Private edit link</label>
                        <div class="vv-input-icon-wrap">
                            <input id="vv-edit-link" class="vv-field" readonly style="padding-right:2.5rem">
                            <button type="button" class="vv-btn vv-btn-ghost vv-btn-icon vv-copy-btn" data-copy="vv-edit-link" aria-label="Copy private edit link">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="vv-copy-icon"><rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" stroke-width="1.6"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke="currentColor" stroke-width="1.6"/></svg>
                            </button>
                        </div>
                        <p id="vv-private-warning" class="vv-private-warning">Anyone with the private link can edit.</p>
                    </div>
                </div>
                <div class="vv-sheet-actions">
                    <div class="vv-secondary-actions">
                        <button type="button" id="vv-download-recovery" class="vv-text-link">Download recovery</button>
                        <a href="{{ route('editor') }}?new=1" class="vv-text-link">Start new</a>
                    </div>
                    <div class="vv-primary-actions">
                        <button type="button" id="vv-recovery-close" class="vv-btn vv-btn-ghost">Done</button>
                        <a id="vv-open-public" class="vv-btn vv-btn-fill" href="#" target="_blank" rel="noopener">View</a>
                    </div>
                </div>
            </div>
        </div>
    </div>

    {{-- Export menu drawer --}}
    <div id="vv-export-drawer" class="vv-drawer vv-desktop-dialog" role="dialog" aria-modal="true" aria-labelledby="vv-export-title" hidden>
        <div class="vv-drawer-scrim" data-drawer-scrim></div>
        <div class="vv-drawer-sheet vv-drawer-sheet-export" data-drawer-sheet tabindex="-1">
            <div class="vv-drawer-handle" data-drawer-handle aria-hidden="true"></div>
            <div class="vv-drawer-header">
                <h2 id="vv-export-title" class="vv-display" style="font-size:1.05rem">Menu</h2>
                <button type="button" class="vv-btn vv-btn-ghost vv-btn-icon" id="vv-close-export" aria-label="Close menu">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
                </button>
            </div>
            <div class="vv-drawer-body">
                <a class="vv-menu-item" role="menuitem" href="{{ route('editor') }}?new=1">Start new</a>
                <button type="button" class="vv-menu-item" role="menuitem" data-export="png">Export PNG</button>
                <button type="button" class="vv-menu-item" role="menuitem" data-export="json">Export JSON</button>
                <button type="button" class="vv-menu-item" role="menuitem" data-export="obj">Export OBJ</button>
                <button type="button" class="vv-menu-item" role="menuitem" data-import="json">Import JSON</button>
            </div>
        </div>
    </div>
</div>
@endsection
