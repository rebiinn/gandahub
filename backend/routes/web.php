<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\File;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return response()->json([
        'name' => 'Ganda Hub Cosmetics API',
        'version' => '1.0.0',
        'documentation' => '/api/v1',
    ]);
});

/*
|--------------------------------------------------------------------------
| Serve uploaded storage files (works without php artisan storage:link)
|--------------------------------------------------------------------------
*/
Route::get('/storage/{folder}/{filename}', function (string $folder, string $filename) {
    $folder = str_replace(['..', '\\'], '', $folder);
    $filename = str_replace(['..', '\\', '/'], '', $filename);
    $fullPath = storage_path('app/public/' . $folder . '/' . $filename);
    if (!File::isFile($fullPath)) {
        abort(404);
    }
    $ext = strtolower(File::extension($filename));
    $mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp', 'svg' => 'image/svg+xml'];
    $mime = $mimes[$ext] ?? 'application/octet-stream';
    return response()->file($fullPath, ['Content-Type' => $mime]);
});
