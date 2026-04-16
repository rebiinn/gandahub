<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    /**
     * Get all products with filters.
     */
    public function index(Request $request)
    {
        $query = Product::with(['category', 'store']);

        // Filter by active status (default to active for public)
        if ($request->has('active')) {
            if ($request->active !== '' && $request->active !== null) {
                $query->where('is_active', $request->boolean('active'));
            }
        } else {
            $isAdmin = false;
            $isSupplier = false;
            $supplierStoreId = null;
            try {
                $user = auth()->user();
                $isAdmin = $user && $user->isAdmin();
                $isSupplier = $user && $user->isSupplier();
                if ($isSupplier) {
                    $store = Store::where('user_id', $user->id)->first();
                    if ($store) {
                        $supplierStoreId = $store->id;
                    }
                }
            } catch (\Throwable $e) {
                // Invalid/expired JWT or no token - treat as public
            }
            if ($isSupplier && $supplierStoreId) {
                // Suppliers browsing the main shop should only see their own products
                $query->where('store_id', $supplierStoreId);
            } elseif (!$isAdmin && !$isSupplier) {
                $query->active();
            }
        }

        // Filter by category
        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // Filter by store (admin/supplier)
        if ($request->has('store_id')) {
            $query->where('store_id', $request->store_id);
        }

        // Filter by brand
        if ($request->has('brand')) {
            $query->where('brand', $request->brand);
        }

        // Filter by price range
        if ($request->has('min_price')) {
            $query->where('price', '>=', $request->min_price);
        }
        if ($request->has('max_price')) {
            $query->where('price', '<=', $request->max_price);
        }

        // Filter featured products
        if ($request->boolean('featured')) {
            $query->featured();
        }

        // Filter products on sale
        if ($request->boolean('on_sale')) {
            $query->onSale();
        }

        // Filter in stock
        if ($request->boolean('in_stock')) {
            $query->inStock();
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('brand', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $allowedSorts = ['name', 'price', 'created_at', 'average_rating', 'stock_quantity'];
        
        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        // Pagination
        $perPage = min($request->get('per_page', 12), 50);
        $products = $query->paginate($perPage);

        return $this->paginatedResponse($products);
    }

    /**
     * Get a single product.
     */
    public function show($id)
    {
        $product = Product::with(['category', 'store', 'reviews' => function ($q) {
            $q->approved()->with('user')->latest()->limit(10);
        }])->find($id);

        if (!$product) {
            return $this->errorResponse('Product not found', 404);
        }

        return $this->successResponse($product);
    }

    /**
     * Get product by slug.
     */
    public function showBySlug($slug)
    {
        $product = Product::with(['category', 'store', 'reviews' => function ($q) {
            $q->approved()->with('user')->latest()->limit(10);
        }])->where('slug', $slug)->first();

        if (!$product) {
            return $this->errorResponse('Product not found', 404);
        }

        return $this->successResponse($product);
    }

    /**
     * Create a new product (Admin only).
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'category_id' => 'required|exists:categories,id',
            'store_id' => 'nullable|exists:stores,id',
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:products',
            'sku' => 'nullable|string|max:255|unique:products',
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:500',
            'price' => 'required|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0|lt:price',
            'is_on_sale' => 'boolean',
            'stock_quantity' => 'required|integer|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'brand' => 'nullable|string|max:255',
            'weight' => 'nullable|string|max:50',
            'dimensions' => 'nullable|string|max:100',
            'images' => 'nullable|array',
            'thumbnail' => 'nullable|string',
            'attributes' => 'nullable|array',
            'is_featured' => 'boolean',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $data = $request->only([
            'category_id', 'store_id', 'name', 'slug', 'sku', 'description', 'short_description',
            'price', 'sale_price', 'stock_quantity', 'low_stock_threshold', 'brand',
            'weight', 'dimensions', 'images', 'thumbnail', 'attributes',
            'is_featured', 'is_on_sale', 'is_active',
        ]);

        // Convert empty strings to null for optional fields
        foreach (['store_id', 'sale_price', 'description', 'short_description', 'brand', 'thumbnail'] as $key) {
            if (isset($data[$key]) && $data[$key] === '') {
                $data[$key] = null;
            }
        }
        if (array_key_exists('is_on_sale', $data) && !$request->boolean('is_on_sale')) {
            $data['sale_price'] = null;
        }

        if (empty($data['slug'])) {
            $baseSlug = Str::slug($data['name']);
            $data['slug'] = Product::withTrashed()->where('slug', $baseSlug)->exists()
                ? $baseSlug . '-' . strtolower(Str::random(6))
                : $baseSlug;
        }
        if (empty($data['sku'])) {
            $data['sku'] = strtoupper(Str::random(8));
        }

        try {
            $product = Product::create($data);
        } catch (\Exception $e) {
            \Log::error('Product create failed', ['error' => $e->getMessage(), 'data' => $data]);
            return $this->errorResponse('Could not create product: ' . $e->getMessage(), 500);
        }

        return $this->successResponse($product, 'Product created successfully', 201);
    }

    /**
     * Update a product (Admin only).
     */
    public function update(Request $request, $id)
    {
        $product = Product::find($id);

        if (!$product) {
            return $this->errorResponse('Product not found', 404);
        }

        $validator = Validator::make($request->all(), [
            'category_id' => 'sometimes|exists:categories,id',
            'store_id' => 'nullable|exists:stores,id',
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:255|unique:products,slug,' . $id,
            'sku' => 'sometimes|string|max:255|unique:products,sku,' . $id,
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:500',
            'price' => 'sometimes|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'is_on_sale' => 'boolean',
            'stock_quantity' => 'sometimes|integer|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'brand' => 'nullable|string|max:255',
            'weight' => 'nullable|string|max:50',
            'dimensions' => 'nullable|string|max:100',
            'images' => 'nullable|array',
            'thumbnail' => 'nullable|string',
            'attributes' => 'nullable|array',
            'is_featured' => 'boolean',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $allowed = [
            'category_id', 'store_id', 'name', 'slug', 'sku', 'description', 'short_description',
            'price', 'sale_price', 'stock_quantity', 'low_stock_threshold', 'brand',
            'weight', 'dimensions', 'images', 'thumbnail', 'attributes',
            'is_featured', 'is_on_sale', 'is_active',
        ];
        $payload = $request->only($allowed);
        if (array_key_exists('is_on_sale', $payload) && !$request->boolean('is_on_sale')) {
            $payload['sale_price'] = null;
        }
        $product->update($payload);

        return $this->successResponse($product->fresh('category'), 'Product updated successfully');
    }

    /**
     * Delete a product (Admin only).
     */
    public function destroy($id)
    {
        $product = Product::find($id);

        if (!$product) {
            return $this->errorResponse('Product not found', 404);
        }

        $product->delete();

        return $this->successResponse(null, 'Product deleted successfully');
    }

    /**
     * Get featured products.
     */
    public function featured()
    {
        $query = Product::active()->featured()->with('category');

        // If a supplier is browsing, only show their own products
        try {
            $user = auth()->user();
            if ($user && $user->isSupplier()) {
                $store = Store::where('user_id', $user->id)->first();
                if ($store) {
                    $query->where('store_id', $store->id);
                }
            }
        } catch (\Throwable $e) {
            // ignore and fall back to global list
        }

        $products = $query->limit(8)->get();
        return $this->successResponse($products);
    }

    /**
     * Get products on sale.
     */
    public function onSale()
    {
        $query = Product::active()->onSale()->with('category');

        // If a supplier is browsing, only show their own products
        try {
            $user = auth()->user();
            if ($user && $user->isSupplier()) {
                $store = Store::where('user_id', $user->id)->first();
                if ($store) {
                    $query->where('store_id', $store->id);
                }
            }
        } catch (\Throwable $e) {
            // ignore and fall back to global list
        }

        $products = $query->limit(12)->get();
        return $this->successResponse($products);
    }

    /**
     * Get new arrivals.
     */
    public function newArrivals()
    {
        $query = Product::active()->with('category')
            ->orderBy('created_at', 'desc');

        // If a supplier is browsing, only show their own products
        try {
            $user = auth()->user();
            if ($user && $user->isSupplier()) {
                $store = Store::where('user_id', $user->id)->first();
                if ($store) {
                    $query->where('store_id', $store->id);
                }
            }
        } catch (\Throwable $e) {
            // ignore and fall back to global list
        }

        $products = $query->limit(8)->get();
        return $this->successResponse($products);
    }

    /**
     * Get all brands.
     */
    public function brands()
    {
        $brands = Product::active()
            ->whereNotNull('brand')
            ->distinct()
            ->pluck('brand');
        return $this->successResponse($brands);
    }

    /**
     * Update stock (Admin only). Adjusts admin/shop inventory stock_quantity.
     */
    public function updateStock(Request $request, $id)
    {
        $product = Product::find($id);

        if (!$product) {
            return $this->errorResponse('Product not found', 404);
        }

        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer',
            'operation' => 'required|in:set,add,subtract',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $quantity = $request->quantity;

        switch ($request->operation) {
            case 'add':
                $product->increaseStock($quantity);
                break;
            case 'subtract':
                if (!$product->decreaseStock($quantity)) {
                    return $this->errorResponse('Insufficient stock', 400);
                }
                break;
            case 'set':
                $product->update(['stock_quantity' => $quantity]);
                break;
        }

        return $this->successResponse($product->fresh(), 'Stock updated successfully');
    }

    /**
     * Release stock from warehouse (inventory_stock) to shop (stock_quantity). Admin only.
     */
    public function releaseStock(Request $request, $id)
    {
        $product = Product::find($id);
        if (!$product) {
            return $this->errorResponse('Product not found', 404);
        }
        $validator = Validator::make($request->all(), ['quantity' => 'required|integer|min:1']);
        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }
        $quantity = $request->quantity;
        $warehouse = (int) $product->inventory_stock;
        if ($quantity > $warehouse) {
            return $this->errorResponse("Cannot release more than warehouse stock ({$warehouse})", 400);
        }
        $product->decrement('inventory_stock', $quantity);
        $product->increment('stock_quantity', $quantity);
        return $this->successResponse($product->fresh(), 'Stock released to shop successfully');
    }

    /**
     * Adjust warehouse stock (inventory_stock). Admin only.
     */
    public function updateWarehouseStock(Request $request, $id)
    {
        $product = Product::find($id);
        if (!$product) {
            return $this->errorResponse('Product not found', 404);
        }
        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer',
            'operation' => 'required|in:set,add,subtract',
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }
        $quantity = $request->quantity;
        $current = (int) $product->inventory_stock;
        switch ($request->operation) {
            case 'add':
                $product->increment('inventory_stock', $quantity);
                break;
            case 'subtract':
                if ($quantity > $current) {
                    return $this->errorResponse('Insufficient warehouse stock', 400);
                }
                $product->decrement('inventory_stock', $quantity);
                break;
            case 'set':
                $product->update(['inventory_stock' => max(0, $quantity)]);
                break;
        }
        return $this->successResponse($product->fresh(), 'Warehouse stock updated successfully');
    }

    /**
     * Get supplier's store (for product management).
     */
    private function getSupplierStore(): ?Store
    {
        $user = auth()->user();
        if (!$user || !$user->isSupplier()) {
            return null;
        }
        return Store::where('user_id', $user->id)->first();
    }

    /**
     * Create a new product (Supplier only). Store is set to supplier's store.
     */
    public function supplierStore(Request $request)
    {
        $store = $this->getSupplierStore();
        if (!$store) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $validator = Validator::make($request->all(), [
            'category_id' => 'required|exists:categories,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:500',
            'price' => 'required|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0|lt:price',
            'is_on_sale' => 'boolean',
            'is_featured' => 'boolean',
            'supply_price' => 'nullable|numeric|min:0',
            'stock_quantity' => 'required|integer|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'brand' => 'nullable|string|max:255',
            'thumbnail' => 'nullable|string',
            'attributes' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $data = $request->only([
            'category_id', 'name', 'description', 'short_description',
            'price', 'sale_price', 'supply_price', 'low_stock_threshold',
            'brand', 'thumbnail', 'attributes', 'is_on_sale', 'is_featured',
        ]);
        $supplierStock = (int) $request->input('stock_quantity', 0);
        $data['store_id'] = $store->id;
        $baseSlug = Str::slug($data['name']);
        $data['slug'] = Product::withTrashed()->where('slug', $baseSlug)->exists()
            ? $baseSlug . '-' . strtolower(Str::random(6))
            : $baseSlug;
        $data['sku'] = strtoupper(Str::random(8));
        $data['is_featured'] = $request->boolean('is_featured', false);
        $data['is_on_sale'] = $request->boolean('is_on_sale', false);
        if (!$data['is_on_sale']) {
            $data['sale_price'] = null;
        }
        $data['is_active'] = false; // Only admin can add to shop via "Add to Shop"
        $data['stock_quantity'] = 0; // admin inventory starts at 0
        $data['supplier_stock_quantity'] = $supplierStock;
        $product = Product::create($data);

        return $this->successResponse($product->load(['category', 'store']), 'Product created successfully', 201);
    }

    /**
     * Admin: list supplier products waiting for listing approval.
     */
    public function pendingApprovals(Request $request)
    {
        $query = Product::with(['category', 'store'])
            ->where('is_active', false)
            ->whereNotNull('store_id');

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('brand', 'like', "%{$search}%");
            });
        }

        $perPage = min($request->get('per_page', 12), 50);
        $products = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return $this->paginatedResponse($products);
    }

    /**
     * Admin: approve supplier product listing so it appears in shop.
     */
    public function approveSupplierProduct($id)
    {
        $product = Product::with('store')->find($id);
        if (!$product) {
            return $this->errorResponse('Product not found', 404);
        }

        if (!$product->store_id) {
            return $this->errorResponse('Only supplier products can be approved through this flow', 422);
        }

        $supplierStock = max(0, (int) $product->supplier_stock_quantity);
        $product->update([
            'is_active' => true,
            'stock_quantity' => $supplierStock,
        ]);

        return $this->successResponse(
            $product->fresh(['category', 'store']),
            'Product approved and now visible in shop'
        );
    }

    /**
     * Update a product (Supplier only). Only products belonging to supplier's store.
     */
    public function supplierUpdate(Request $request, $id)
    {
        $store = $this->getSupplierStore();
        if (!$store) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $product = Product::where('id', $id)->where('store_id', $store->id)->first();
        if (!$product) {
            return $this->errorResponse('Product not found', 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:500',
            'price' => 'sometimes|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'is_on_sale' => 'boolean',
            'is_featured' => 'boolean',
            'supply_price' => 'nullable|numeric|min:0',
            'stock_quantity' => 'sometimes|integer|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'brand' => 'nullable|string|max:255',
            'thumbnail' => 'nullable|string',
            'attributes' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $allowed = [
            'name', 'description', 'short_description', 'price', 'sale_price', 'supply_price',
            'low_stock_threshold', 'brand', 'thumbnail', 'attributes', 'is_on_sale', 'is_featured',
        ];
        $data = $request->only($allowed);
        if (array_key_exists('is_on_sale', $data) && !$request->boolean('is_on_sale')) {
            $data['sale_price'] = null;
        }
        if ($request->has('stock_quantity')) {
            $newSupplierStock = (int) $request->stock_quantity;
            $data['supplier_stock_quantity'] = $newSupplierStock;
            // Keep shop stock aligned with supplier stock once listing is approved.
            if ($product->is_active) {
                $data['stock_quantity'] = max(0, $newSupplierStock);
            }
        }
        $product->update($data);
        // is_active is controlled by admin only – suppliers cannot change visibility

        return $this->successResponse($product->fresh(['category', 'store']), 'Product updated successfully');
    }

    /**
     * Update stock (Supplier only). Only for products belonging to supplier's store.
     */
    public function supplierUpdateStock(Request $request, $id)
    {
        $store = $this->getSupplierStore();
        if (!$store) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $product = Product::where('id', $id)->where('store_id', $store->id)->first();
        if (!$product) {
            return $this->errorResponse('Product not found', 404);
        }

        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer',
            'operation' => 'required|in:set,add,subtract',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $quantity = (int) $request->quantity;

        $newSupplierStock = $product->supplier_stock_quantity;

        switch ($request->operation) {
            case 'add':
                $newSupplierStock += $quantity;
                break;
            case 'subtract':
                if ($product->supplier_stock_quantity < $quantity) {
                    return $this->errorResponse('Insufficient supplier stock', 400);
                }
                $newSupplierStock -= $quantity;
                break;
            case 'set':
                if ($quantity < 0) {
                    return $this->errorResponse('Quantity cannot be negative', 400);
                }
                $newSupplierStock = $quantity;
                break;
        }

        $payload = ['supplier_stock_quantity' => $newSupplierStock];
        // Keep shop stock aligned with supplier stock once listing is approved.
        if ($product->is_active) {
            $payload['stock_quantity'] = max(0, $newSupplierStock);
        }
        $product->update($payload);

        return $this->successResponse($product->fresh(), 'Supplier stock updated successfully');
    }

    /**
     * Delete a product (Supplier only). Only for products in supplier's store.
     */
    public function supplierDestroy($id)
    {
        $store = $this->getSupplierStore();
        if (!$store) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $product = Product::where('id', $id)->where('store_id', $store->id)->first();
        if (!$product) {
            return $this->errorResponse('Product not found', 404);
        }

        $product->delete();

        return $this->successResponse(null, 'Product deleted successfully');
    }
}
