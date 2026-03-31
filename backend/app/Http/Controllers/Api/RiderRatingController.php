<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\RiderRating;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class RiderRatingController extends Controller
{
    /**
     * Rate the rider for a delivered order (customer only).
     */
    public function store(Request $request, $orderId)
    {
        $validator = Validator::make($request->all(), [
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $order = Order::with('delivery')->find($orderId);
        if (!$order) {
            return $this->errorResponse('Order not found', 404);
        }

        if ($order->user_id !== Auth::id()) {
            return $this->errorResponse('Unauthorized', 403);
        }

        if ($order->status !== 'delivered') {
            return $this->errorResponse('You can rate the rider only after receiving your order', 400);
        }

        $delivery = $order->delivery;
        if (!$delivery || !$delivery->rider_id) {
            return $this->errorResponse('No rider was assigned to this delivery', 400);
        }

        $existing = RiderRating::where('order_id', $orderId)->first();
        if ($existing) {
            $existing->update([
                'rating' => $request->rating,
                'comment' => $request->comment,
            ]);
            return $this->successResponse($existing->fresh(), 'Rating updated');
        }

        $rating = RiderRating::create([
            'order_id' => $order->id,
            'user_id' => Auth::id(),
            'rider_id' => $delivery->rider_id,
            'rating' => $request->rating,
            'comment' => $request->comment,
        ]);

        return $this->successResponse($rating, 'Thank you for rating your rider!', 201);
    }
}
