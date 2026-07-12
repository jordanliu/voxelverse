<?php

use App\Http\Controllers\Api\GalleryApiController;
use App\Http\Controllers\Api\PublicationController;
use App\Http\Controllers\Api\RatingController;
use App\Http\Controllers\Api\ReportController;
use Illuminate\Support\Facades\Route;

Route::get('/models', [GalleryApiController::class, 'index']);
Route::post('/models', [PublicationController::class, 'store'])->middleware('throttle:voxelverse-publish');
Route::get('/models/{publicId}', [PublicationController::class, 'show']);
Route::get('/models/{publicId}/scene', [PublicationController::class, 'scene']);
Route::put('/models/{publicId}', [PublicationController::class, 'update'])->middleware('throttle:voxelverse-publish');
Route::delete('/models/{publicId}', [PublicationController::class, 'destroy'])->middleware('throttle:voxelverse-publish');
Route::post('/models/{publicId}/ratings', [RatingController::class, 'store'])->middleware('throttle:voxelverse-rating');
Route::post('/models/{publicId}/reports', [ReportController::class, 'store'])->middleware('throttle:voxelverse-report');
Route::post('/models/{publicId}/views', [PublicationController::class, 'view'])->middleware('throttle:60,1');
