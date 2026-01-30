<?php

use Illuminate\Support\Facades\Route;

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
