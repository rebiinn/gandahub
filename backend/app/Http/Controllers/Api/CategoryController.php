<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    /**
     * Get all categories.
     */
    public function index(Request $request)
    {
        $query = Category::with('children', 'parent');

        // Filter by active status
        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        // Filter root categories only
        if ($request->boolean('root_only')) {
            $query->root();
        }

        // Search
        if ($request->has('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }

        $categories = $query->orderBy('sort_order')->get();

        return $this->successResponse($categories);
    }

    /**
     * Get a single category.
     */
    public function show($id)
    {
        $category = Category::with('children', 'parent', 'products')->find($id);

        if (!$category) {
            return $this->errorResponse('Category not found', 404);
        }

        return $this->successResponse($category);
    }

    /**
     * Create a new category (Admin only).
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:categories',
            'description' => 'nullable|string',
            'image' => 'nullable|string',
            'parent_id' => 'nullable|exists:categories,id',
            'sort_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $data = $request->all();
        if (empty($data['slug'])) {
            $data['slug'] = Str::slug($data['name']);
        }

        $category = Category::create($data);

        return $this->successResponse($category, 'Category created successfully', 201);
    }

    /**
     * Update a category (Admin only).
     */
    public function update(Request $request, $id)
    {
        $category = Category::find($id);

        if (!$category) {
            return $this->errorResponse('Category not found', 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:255|unique:categories,slug,' . $id,
            'description' => 'nullable|string',
            'image' => 'nullable|string',
            'parent_id' => 'nullable|exists:categories,id',
            'sort_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        // Prevent setting parent to self or descendant
        if ($request->has('parent_id') && $request->parent_id == $id) {
            return $this->errorResponse('Category cannot be its own parent', 400);
        }

        $category->update($request->all());

        return $this->successResponse($category, 'Category updated successfully');
    }

    /**
     * Delete a category (Admin only).
     */
    public function destroy($id)
    {
        $category = Category::find($id);

        if (!$category) {
            return $this->errorResponse('Category not found', 404);
        }

        // Check if category has products
        if ($category->products()->count() > 0) {
            return $this->errorResponse('Cannot delete category with products', 400);
        }

        $category->delete();

        return $this->successResponse(null, 'Category deleted successfully');
    }
}
