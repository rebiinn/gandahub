<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DeliveryController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\SystemSettingController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes for Ganda Hub Cosmetics
|--------------------------------------------------------------------------
*/

// Public routes
Route::prefix('v1')->group(function () {
    
    // Authentication
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    // Public product routes
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/featured', [ProductController::class, 'featured']);
    Route::get('/products/on-sale', [ProductController::class, 'onSale']);
    Route::get('/products/new-arrivals', [ProductController::class, 'newArrivals']);
    Route::get('/products/brands', [ProductController::class, 'brands']);
    Route::get('/products/{id}', [ProductController::class, 'show']);
    Route::get('/products/slug/{slug}', [ProductController::class, 'showBySlug']);

    // Public category routes
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/categories/{id}', [CategoryController::class, 'show']);

    // Public reviews
    Route::get('/products/{productId}/reviews', [ReviewController::class, 'index']);

    // Order tracking (public)
    Route::get('/orders/track/{orderNumber}', [OrderController::class, 'track']);
    Route::get('/deliveries/track/{trackingNumber}', [DeliveryController::class, 'track']);

    // Public settings
    Route::get('/settings/public', [SystemSettingController::class, 'public']);

    // Payment methods
    Route::get('/payments/methods', [PaymentController::class, 'methods']);

    // Protected routes
    Route::middleware('jwt.auth')->group(function () {
        
        // Auth
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/refresh', [AuthController::class, 'refresh']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::put('/change-password', [AuthController::class, 'changePassword']);

        // Cart
        Route::get('/cart', [CartController::class, 'index']);
        Route::post('/cart/items', [CartController::class, 'addItem']);
        Route::put('/cart/items/{itemId}', [CartController::class, 'updateItem']);
        Route::delete('/cart/items/{itemId}', [CartController::class, 'removeItem']);
        Route::delete('/cart', [CartController::class, 'clear']);
        Route::post('/cart/coupon', [CartController::class, 'applyCoupon']);
        Route::delete('/cart/coupon', [CartController::class, 'removeCoupon']);

        // Orders (Customer)
        Route::get('/orders', [OrderController::class, 'index']);
        Route::post('/orders', [OrderController::class, 'store']);
        Route::get('/orders/{id}', [OrderController::class, 'show']);
        Route::post('/orders/{id}/cancel', [OrderController::class, 'cancel']);

        // Payments
        Route::get('/payments/{id}', [PaymentController::class, 'show']);
        Route::post('/payments/process/{orderId}', [PaymentController::class, 'process']);

        // Reviews
        Route::post('/reviews', [ReviewController::class, 'store']);
        Route::put('/reviews/{id}', [ReviewController::class, 'update']);
        Route::delete('/reviews/{id}', [ReviewController::class, 'destroy']);
        Route::post('/reviews/{id}/helpful', [ReviewController::class, 'markHelpful']);

        // Admin routes
        Route::middleware('role:admin')->prefix('admin')->group(function () {
            
            // File uploads
            Route::post('/upload/image', [UploadController::class, 'uploadImage']);
            Route::post('/upload/images', [UploadController::class, 'uploadMultiple']);
            Route::delete('/upload', [UploadController::class, 'delete']);

            // Users management
            Route::get('/users', [UserController::class, 'index']);
            Route::post('/users', [UserController::class, 'store']);
            Route::get('/users/{id}', [UserController::class, 'show']);
            Route::put('/users/{id}', [UserController::class, 'update']);
            Route::delete('/users/{id}', [UserController::class, 'destroy']);
            Route::post('/users/{id}/toggle-status', [UserController::class, 'toggleStatus']);
            Route::get('/users-riders', [UserController::class, 'riders']);
            Route::get('/users-customers', [UserController::class, 'customers']);

            // Categories management
            Route::post('/categories', [CategoryController::class, 'store']);
            Route::put('/categories/{id}', [CategoryController::class, 'update']);
            Route::delete('/categories/{id}', [CategoryController::class, 'destroy']);

            // Products management
            Route::post('/products', [ProductController::class, 'store']);
            Route::put('/products/{id}', [ProductController::class, 'update']);
            Route::delete('/products/{id}', [ProductController::class, 'destroy']);
            Route::put('/products/{id}/stock', [ProductController::class, 'updateStock']);

            // Orders management
            Route::put('/orders/{id}/status', [OrderController::class, 'updateStatus']);

            // Payments management
            Route::get('/payments', [PaymentController::class, 'index']);
            Route::put('/payments/{id}/status', [PaymentController::class, 'updateStatus']);
            Route::post('/payments/{id}/refund', [PaymentController::class, 'refund']);

            // Deliveries management
            Route::get('/deliveries', [DeliveryController::class, 'index']);
            Route::get('/deliveries/{id}', [DeliveryController::class, 'show']);
            Route::post('/deliveries/{id}/assign', [DeliveryController::class, 'assignRider']);
            Route::put('/deliveries/{id}/status', [DeliveryController::class, 'updateStatus']);
            Route::get('/deliveries-riders', [DeliveryController::class, 'availableRiders']);

            // Reviews management
            Route::get('/reviews/pending', [ReviewController::class, 'pending']);
            Route::post('/reviews/{id}/approve', [ReviewController::class, 'approve']);
            Route::post('/reviews/{id}/reject', [ReviewController::class, 'reject']);

            // Reports
            Route::get('/reports', [ReportController::class, 'index']);
            Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
            Route::post('/reports', [ReportController::class, 'generate']);
            Route::get('/reports/{id}', [ReportController::class, 'show']);
            Route::delete('/reports/{id}', [ReportController::class, 'destroy']);

            // System settings
            Route::get('/settings', [SystemSettingController::class, 'index']);
            Route::get('/settings/groups', [SystemSettingController::class, 'groups']);
            Route::get('/settings/group/{group}', [SystemSettingController::class, 'byGroup']);
            Route::get('/settings/{key}', [SystemSettingController::class, 'show']);
            Route::post('/settings', [SystemSettingController::class, 'store']);
            Route::put('/settings/bulk', [SystemSettingController::class, 'bulkUpdate']);
            Route::delete('/settings/{key}', [SystemSettingController::class, 'destroy']);
            Route::post('/settings/clear-cache', [SystemSettingController::class, 'clearCache']);
            Route::post('/settings/backup', [SystemSettingController::class, 'backup']);
            Route::get('/settings/system-info', [SystemSettingController::class, 'systemInfo']);
        });

        // Rider routes
        Route::middleware('role:rider,admin')->prefix('rider')->group(function () {
            Route::get('/deliveries', [DeliveryController::class, 'index']);
            Route::get('/deliveries/{id}', [DeliveryController::class, 'show']);
            Route::put('/deliveries/{id}/status', [DeliveryController::class, 'updateStatus']);
            Route::put('/deliveries/{id}/location', [DeliveryController::class, 'updateLocation']);
            Route::post('/deliveries/{id}/complete', [DeliveryController::class, 'complete']);
            Route::get('/stats', [DeliveryController::class, 'riderStats']);
            Route::get('/stats/{riderId}', [DeliveryController::class, 'riderStats']);
        });
    });
});
