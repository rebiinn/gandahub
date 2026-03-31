<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryReceipt;
use Illuminate\Http\Request;

class InventoryReceiptController extends Controller
{
    /**
     * List inventory receipts (Admin only). Tracks product, supplier, quantity, stocked date.
     */
    public function index(Request $request)
    {
        $query = InventoryReceipt::with(['product', 'store']);

        if ($request->has('product_id')) {
            $query->where('product_id', $request->product_id);
        }
        if ($request->has('store_id')) {
            $query->where('store_id', $request->store_id);
        }

        $perPage = min($request->get('per_page', 15), 50);
        $receipts = $query->orderBy('stocked_date', 'desc')->orderBy('id', 'desc')->paginate($perPage);

        return $this->paginatedResponse($receipts);
    }
}
