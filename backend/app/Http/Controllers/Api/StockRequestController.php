<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryReceipt;
use App\Models\Product;
use App\Models\StockRequest;
use App\Models\Store;
use App\Notifications\StockRequestFulfilledNotification;
use App\Notifications\StockRequestDeclinedNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;

class StockRequestController extends Controller
{
    /**
     * List stock requests. Admin: all. Supplier: their store's requests.
     */
    public function index(Request $request)
    {
        $user = auth()->user();
        $query = StockRequest::with(['product', 'store', 'requestedBy']);

        if ($user->isAdmin()) {
            if ($request->has('status')) {
                $query->where('status', $request->status);
            }
            if ($request->has('store_id')) {
                $query->where('store_id', $request->store_id);
            }
        } elseif ($user->isSupplier()) {
            $store = Store::where('user_id', $user->id)->first();
            if (!$store) {
                return $this->successResponse([]);
            }
            $query->where('store_id', $store->id);
            if ($request->has('status')) {
                $query->where('status', $request->status);
            }
        } else {
            return $this->errorResponse('Unauthorized', 403);
        }

        $perPage = min($request->get('per_page', 15), 50);
        $requests = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return $this->paginatedResponse($requests);
    }

    /**
     * Admin creates a stock request to supplier.
     */
    public function store(Request $request)
    {
        $user = auth()->user();
        if (!$user->isAdmin()) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $validator = Validator::make($request->all(), [
            'product_id' => 'required|exists:products,id',
            'store_id' => 'required|exists:stores,id',
            'quantity_requested' => 'required|integer|min:1',
            'notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $product = Product::with('store')->find($request->product_id);
        if (!$product) {
            return $this->errorResponse('Product not found', 404);
        }

        $stockRequest = StockRequest::create([
            'product_id' => $product->id,
            'store_id' => $request->store_id,
            'requested_by' => $user->id,
            'quantity_requested' => $request->quantity_requested,
            'notes' => $request->notes,
            'status' => StockRequest::STATUS_PENDING,
        ]);

        $stockRequest->load(['product', 'store', 'requestedBy']);

        return $this->successResponse($stockRequest, 'Stock request sent to supplier', 201);
    }

    /**
     * Supplier fulfills a stock request (releases product, adds to inventory).
     */
    public function fulfill(Request $request, $id)
    {
        $user = auth()->user();
        $store = Store::where('user_id', $user->id)->first();
        if (!$store || !$user->isSupplier()) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $stockRequest = StockRequest::with('product')
            ->where('id', $id)
            ->where('store_id', $store->id)
            ->where('status', StockRequest::STATUS_PENDING)
            ->first();

        if (!$stockRequest) {
            return $this->errorResponse('Request not found or already processed', 404);
        }

        $quantity = $request->input('quantity_fulfilled', $stockRequest->quantity_requested);
        if ($quantity < 1 || $quantity > $stockRequest->quantity_requested) {
            $quantity = $stockRequest->quantity_requested;
        }

        $product = $stockRequest->product;

        // Move stock from supplier to admin inventory
        if ($product->supplier_stock_quantity < $quantity) {
            return $this->errorResponse('Supplier does not have enough stock to fulfill this request', 400);
        }

        // Decrease supplier stock and ensure the product is visible in admin inventory
        $product->update([
            'supplier_stock_quantity' => $product->supplier_stock_quantity - $quantity,
            // Once the admin has warehouse stock for this product,
            // automatically make it active so it appears in the Inventory page.
            'is_active' => true,
        ]);
        // Add to admin warehouse (inventory_stock), not directly to shop
        $product->increment('inventory_stock', $quantity);

        $stockRequest->update([
            'status' => StockRequest::STATUS_FULFILLED,
            'quantity_fulfilled' => $quantity,
            'fulfilled_at' => now(),
        ]);

        // Create inventory record (product, supplier, quantity, stocked date)
        InventoryReceipt::create([
            'product_id' => $product->id,
            'store_id' => $stockRequest->store_id,
            'stock_request_id' => $stockRequest->id,
            'quantity' => $quantity,
            'stocked_date' => now()->toDateString(),
        ]);

        $stockRequest->load(['product', 'store', 'requestedBy']);

        // Notify the admin who requested the stock
        $admin = $stockRequest->requestedBy;
        if ($admin) {
            $admin->notify(new StockRequestFulfilledNotification($stockRequest));
        }

        return $this->successResponse($stockRequest, 'Stock released. Inventory updated.');
    }

    /**
     * Supplier declines a stock request.
     */
    public function decline(Request $request, $id)
    {
        $user = auth()->user();
        $store = Store::where('user_id', $user->id)->first();
        if (!$store || !$user->isSupplier()) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $stockRequest = StockRequest::where('id', $id)
            ->where('store_id', $store->id)
            ->where('status', StockRequest::STATUS_PENDING)
            ->first();

        if (!$stockRequest) {
            return $this->errorResponse('Request not found or already processed', 404);
        }

        $reason = $request->input('reason');

        $stockRequest->update([
            'status' => StockRequest::STATUS_DECLINED,
            'supplier_notes' => $reason,
        ]);

        $stockRequest->refresh();
        $stockRequest->load(['product', 'store', 'requestedBy']);

        // Notify the admin that their request was rejected (create record directly so it always appears)
        $admin = $stockRequest->requestedBy;
        if ($admin) {
            try {
                $notification = new StockRequestDeclinedNotification($stockRequest);
                $data = $notification->toArray($admin);
                $admin->notifications()->create([
                    'id' => Str::uuid()->toString(),
                    'type' => StockRequestDeclinedNotification::class,
                    'data' => $data,
                ]);
            } catch (\Throwable $e) {
                Log::warning('Failed to create stock request declined notification for admin', [
                    'stock_request_id' => $stockRequest->id,
                    'admin_id' => $admin->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $this->successResponse($stockRequest, 'Request declined');
    }

    /**
     * Supplier inventory view.
     *
     * Shows the supplier their available stock (supplier_stock_quantity) plus the admin-facing
     * low-stock signal (stock_quantity / inventory_stock) and any pending stock requests
     * already sent by admins.
     */
    public function supplierInventory(Request $request)
    {
        $user = auth()->user();
        $store = Store::where('user_id', $user->id)->first();

        if (!$store || !$user->isSupplier()) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $storeId = $store->id;
        $perPage = min($request->get('per_page', 15), 50);

        // Pending admin requests for each product (scoped to this supplier's store).
        $pendingSub = StockRequest::query()
            ->select('product_id')
            ->selectRaw('SUM(quantity_requested) as pending_quantity')
            ->where('store_id', $storeId)
            ->where('status', StockRequest::STATUS_PENDING)
            ->groupBy('product_id');

        $products = Product::query()
            ->where('store_id', $storeId)
            ->leftJoinSub($pendingSub, 'pending_requests', function ($join) {
                $join->on('pending_requests.product_id', '=', 'products.id');
            })
            ->select([
                'products.id',
                'products.name',
                'products.sku',
                'products.thumbnail',
                'products.price',
                'products.low_stock_threshold',
                'products.stock_quantity',       // in-shop (admin-facing)
                'products.inventory_stock',      // warehouse (admin-facing)
                'products.supplier_stock_quantity', // supplier available
                DB::raw('COALESCE(pending_requests.pending_quantity, 0) as pending_quantity'),
            ])
            ->orderBy('products.created_at', 'desc')
            ->paginate($perPage);

        return $this->paginatedResponse($products);
    }
}
