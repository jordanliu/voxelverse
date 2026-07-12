<?php

use App\Http\Controllers\GalleryController;
use App\Http\Controllers\ModerationController;
use App\Http\Controllers\ModelPageController;
use App\Http\Controllers\PageController;
use Illuminate\Support\Facades\Route;

Route::permanentRedirect('/', '/gallery');
Route::get('/gallery', [GalleryController::class, 'index'])->name('gallery');
Route::get('/editor/{publicId?}', [PageController::class, 'editor'])->name('editor');
Route::get('/m/{publicId}', [ModelPageController::class, 'show'])->name('models.show');
Route::get('/privacy', [PageController::class, 'privacy'])->name('privacy');

Route::get('/moderation', [ModerationController::class, 'index'])->name('moderation.index');
Route::post('/moderation/{publicId}/hide', [ModerationController::class, 'hide'])->name('moderation.hide');
Route::post('/moderation/{publicId}/restore', [ModerationController::class, 'restore'])->name('moderation.restore');
Route::delete('/moderation/{publicId}', [ModerationController::class, 'destroy'])->name('moderation.destroy');
Route::post('/moderation/reports/{report}/resolve', [ModerationController::class, 'resolve'])->name('moderation.resolve');
