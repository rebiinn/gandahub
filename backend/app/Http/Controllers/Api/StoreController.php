<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class StoreController extends Controller
{
    /**
     * Get all stores (Admin) or own store (Supplier).
     */
    public function index(Request $request)
    {
        $user = auth()->user();

        if ($user->isAdmin()) {
            $query = Store::with('user');
            if ($request->has('active')) {
                $query->where('is_active', $request->boolean('active'));
            }
            if ($request->has('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('slug', 'like', "%{$search}%");
                });
            }
            $perPage = min($request->get('per_page', 10), 50);
            $stores = $query->orderBy('name')->paginate($perPage);
            return $this->paginatedResponse($stores);
        }

        if ($user->isSupplier()) {
            $store = Store::with('user')->where('user_id', $user->id)->first();
            if (!$store) {
                return $this->errorResponse('Store not found. Contact admin to set up your store.', 404);
            }
            return $this->successResponse($store);
        }

        return $this->errorResponse('Unauthorized', 403);
    }

    /**
     * Create a new store (Admin only). Can create supplier user or link to existing.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:stores',
            'description' => 'nullable|string',
            'address' => 'nullable|string|max:500',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
            'user_id' => 'nullable|exists:users,id',
            'create_supplier' => 'boolean',
            'supplier_email' => 'required_if:create_supplier,true|email',
            'supplier_first_name' => 'required_if:create_supplier,true|string|max:255',
            'supplier_last_name' => 'required_if:create_supplier,true|string|max:255',
            'supplier_password' => 'required_if:create_supplier,true|string|min:8',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $userId = $request->user_id;

        if ($request->boolean('create_supplier')) {
            $existing = User::where('email', $request->supplier_email)->first();
            if ($existing) {
                if ($existing->role !== 'supplier' && $existing->role !== 'customer') {
                    return $this->errorResponse('User with this email already has role: ' . $existing->role, 422);
                }
                $existing->update([
                    'role' => 'supplier',
                    'first_name' => $request->supplier_first_name,
                    'last_name' => $request->supplier_last_name,
                    'password' => Hash::make($request->supplier_password),
                ]);
                $userId = $existing->id;
            } else {
                $user = User::create([
                    'first_name' => $request->supplier_first_name,
                    'last_name' => $request->supplier_last_name,
                    'email' => $request->supplier_email,
                    'password' => Hash::make($request->supplier_password),
                    'role' => 'supplier',
                ]);
                $userId = $user->id;
            }
        }

        if (!$userId) {
            return $this->errorResponse('Either user_id or create_supplier with supplier details is required', 422);
        }

        $existingStore = Store::where('user_id', $userId)->first();
        if ($existingStore) {
            return $this->errorResponse('User already has a store', 422);
        }

        $data = [
            'user_id' => $userId,
            'name' => $request->name,
            'slug' => $request->slug ?: Str::slug($request->name),
            'description' => $request->description,
            'address' => $request->address,
            'phone' => $request->phone,
            'is_active' => $request->boolean('is_active', true),
        ];

        $store = Store::create($data);
        $store->load('user');

        return $this->successResponse($store, 'Store created successfully', 201);
    }

    /**
     * Get a single store.
     */
    public function show($id)
    {
        $user = auth()->user();
        $store = Store::with('user')->find($id);

        if (!$store) {
            return $this->errorResponse('Store not found', 404);
        }

        if (!$user->isAdmin() && $store->user_id !== $user->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        return $this->successResponse($store);
    }

    /**
     * Update store (Admin or own store).
     */
    public function update(Request $request, $id)
    {
        $user = auth()->user();
        $store = Store::find($id);

        if (!$store) {
            return $this->errorResponse('Store not found', 404);
        }

        if (!$user->isAdmin() && $store->user_id !== $user->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:255|unique:stores,slug,' . $id,
            'description' => 'nullable|string',
            'logo' => 'nullable|string',
            'address' => 'nullable|string|max:500',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $allowed = ['name', 'slug', 'description', 'logo', 'address', 'phone', 'is_active'];
        $store->update($request->only($allowed));

        return $this->successResponse($store->fresh('user'), 'Store updated successfully');
    }

    /**
     * Delete store (Admin only).
     */
    public function destroy($id)
    {
        $store = Store::find($id);

        if (!$store) {
            return $this->errorResponse('Store not found', 404);
        }

        $store->delete();
        return $this->successResponse(null, 'Store deleted successfully');
    }

    /**
     * List stores for dropdown (Admin product form). Active stores only.
     */
    public function listForSelect()
    {
        $stores = Store::active()->orderBy('name')->get(['id', 'name', 'slug']);
        return $this->successResponse($stores);
    }

    /**
     * Public store page by slug (for customers).
     * Returns basic store info plus active products for that store.
     */
    public function publicShowBySlug(string $slug)
    {
        $store = Store::active()
            ->where('slug', $slug)
            ->with(['user', 'products' => function ($q) {
                $q->active();
            }])
            ->first();

        if (!$store) {
            return $this->errorResponse('Store not found', 404);
        }

        return $this->successResponse($store);
    }
}
