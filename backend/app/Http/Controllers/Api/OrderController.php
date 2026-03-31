<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Conversation;
use App\Models\Delivery;
use App\Models\Message;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    /**
     * Get all orders (Admin) or user's orders (Customer).
     */
    public function index(Request $request)
    {
        $user = auth()->user();
        $query = Order::with(['items.product.store', 'payment', 'delivery', 'user']);

        if ($user->isAdmin()) {
            // Admin sees all orders
        } elseif ($user->isSupplier()) {
            $store = Store::where('user_id', $user->id)->first();
            if (!$store) {
                return $this->paginatedResponse(new \Illuminate\Pagination\LengthAwarePaginator([], 0, 10));
            }
            $query->whereHas('items.product', function ($q) use ($store) {
                $q->where('store_id', $store->id);
            });
        } else {
            $query->where('user_id', $user->id);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by date range
        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Search by order number
        if ($request->has('search')) {
            $query->where('order_number', 'like', "%{$request->search}%");
        }

        $perPage = min($request->get('per_page', 10), 50);
        $orders = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return $this->paginatedResponse($orders);
    }

    /**
     * Get a single order.
     */
    public function show($id)
    {
        $user = auth()->user();
        $order = Order::with(['items.product', 'payment', 'delivery.rider', 'user', 'riderRating'])->find($id);

        if (!$order) {
            return $this->errorResponse('Order not found', 404);
        }

        // Customers can only view their own orders
        if (!$user->isAdmin() && $order->user_id !== $user->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $data = $order->toArray();

        // For customer: append rider_rating and each item's user_review for "Rate rider" / "Rate product" UI
        if ($order->user_id === $user->id) {
            $data['rider_rating'] = $order->riderRating ? $order->riderRating->only(['id', 'rating', 'comment', 'created_at']) : null;
            if ($order->items && $order->items->isNotEmpty()) {
                $productIds = $order->items->pluck('product_id')->filter()->unique();
                $reviews = \App\Models\Review::where('user_id', $user->id)
                    ->whereIn('product_id', $productIds)
                    ->get()
                    ->keyBy('product_id');
                foreach ($data['items'] as $idx => $itemArr) {
                    $productId = $order->items[$idx]->product_id ?? null;
                    $data['items'][$idx]['user_review'] = $productId ? $reviews->get($productId)?->only(['id', 'rating', 'comment', 'title', 'is_approved']) : null;
                }
            }
        }

        return $this->successResponse($data);
    }

    /**
     * Create a new order from cart.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'shipping_first_name' => 'required|string|max:255',
            'shipping_last_name' => 'required|string|max:255',
            'shipping_email' => 'required|email',
            'shipping_phone' => 'required|string|max:20',
            'shipping_address' => 'required|string',
            'shipping_city' => 'required|string|max:255',
            'shipping_state' => 'nullable|string|max:255',
            'shipping_zip_code' => 'required|string|max:20',
            'shipping_country' => 'nullable|string|max:255',
            'billing_first_name' => 'nullable|string|max:255',
            'billing_last_name' => 'nullable|string|max:255',
            'billing_address' => 'nullable|string',
            'billing_city' => 'nullable|string|max:255',
            'billing_state' => 'nullable|string|max:255',
            'billing_zip_code' => 'nullable|string|max:20',
            'billing_country' => 'nullable|string|max:255',
            'payment_method' => 'required|in:credit_card,gcash,maya,cod,bank_transfer',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $user = auth()->user();
        $cart = Cart::where('user_id', $user->id)->with('items.product')->first();

        if (!$cart || $cart->items->isEmpty()) {
            return $this->errorResponse('Cart is empty', 400);
        }

        // Validate stock availability
        foreach ($cart->items as $item) {
            if ($item->product->stock_quantity < $item->quantity) {
                return $this->errorResponse(
                    "Insufficient stock for {$item->product->name}",
                    400
                );
            }
        }

        DB::beginTransaction();

        try {
            // Create order
            $order = Order::create([
                'user_id' => $user->id,
                'status' => Order::STATUS_PENDING,
                'subtotal' => $cart->subtotal,
                'tax' => $cart->tax,
                'shipping_fee' => $cart->shipping,
                'discount' => $cart->discount,
                'total' => $cart->total,
                'coupon_code' => $cart->coupon_code,
                'shipping_first_name' => $request->shipping_first_name,
                'shipping_last_name' => $request->shipping_last_name,
                'shipping_email' => $request->shipping_email,
                'shipping_phone' => $request->shipping_phone,
                'shipping_address' => $request->shipping_address,
                'shipping_city' => $request->shipping_city,
                'shipping_state' => $request->shipping_state,
                'shipping_zip_code' => $request->shipping_zip_code,
                'shipping_country' => $request->shipping_country ?? 'Philippines',
                'billing_first_name' => $request->billing_first_name,
                'billing_last_name' => $request->billing_last_name,
                'billing_address' => $request->billing_address,
                'billing_city' => $request->billing_city,
                'billing_state' => $request->billing_state,
                'billing_zip_code' => $request->billing_zip_code,
                'billing_country' => $request->billing_country,
                'notes' => $request->notes,
            ]);

            // Create order items and update stock
            foreach ($cart->items as $item) {
                $order->items()->create([
                    'product_id' => $item->product_id,
                    'product_name' => $item->product->name,
                    'product_sku' => $item->product->sku,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'total_price' => $item->total_price,
                    'options' => $item->options,
                ]);

                // Decrease stock
                $item->product->decreaseStock($item->quantity);
            }

            // Create payment record
            $payment = Payment::create([
                'order_id' => $order->id,
                'payment_method' => $request->payment_method,
                'amount' => $cart->total,
                'status' => $request->payment_method === 'cod' 
                    ? Payment::STATUS_PENDING 
                    : Payment::STATUS_PROCESSING,
            ]);

            // Create delivery record
            Delivery::create([
                'order_id' => $order->id,
                'status' => Delivery::STATUS_PENDING,
            ]);

            // Clear cart only for COD (pay on delivery). For GCash/Maya/Credit Card, keep cart until payment completes so user can go back and edit.
            if ($request->payment_method === 'cod') {
                $cart->clear();
            }

            DB::commit();

            $order->load(['items', 'payment', 'delivery']);
            $this->sendSupplierThankYouMessages($order);

            return $this->successResponse($order, 'Order placed successfully', 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Failed to create order: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Create order and process payment in one step (GCash, Maya, Credit Card).
     * Only creates the order when payment succeeds - no pending orders from abandoned checkouts.
     */
    public function storeWithPayment(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'shipping_first_name' => 'required|string|max:255',
            'shipping_last_name' => 'required|string|max:255',
            'shipping_email' => 'required|email',
            'shipping_phone' => 'required|string|max:20',
            'shipping_address' => 'required|string',
            'shipping_city' => 'required|string|max:255',
            'shipping_state' => 'nullable|string|max:255',
            'shipping_zip_code' => 'required|string|max:20',
            'shipping_country' => 'nullable|string|max:255',
            'billing_first_name' => 'nullable|string|max:255',
            'billing_last_name' => 'nullable|string|max:255',
            'billing_address' => 'nullable|string',
            'billing_city' => 'nullable|string|max:255',
            'billing_state' => 'nullable|string|max:255',
            'billing_zip_code' => 'nullable|string|max:20',
            'billing_country' => 'nullable|string|max:255',
            'payment_method' => 'required|in:credit_card,gcash,maya',
            'notes' => 'nullable|string',
            'card_number' => 'required_if:payment_method,credit_card|string|regex:/^\d{13,19}$/',
            'cardholder_name' => 'required_if:payment_method,credit_card|string|min:2',
            'card_expiry' => 'required_if:payment_method,credit_card|string|regex:/^(0[1-9]|1[0-2])\/\d{2}$/',
            'card_cvv' => 'required_if:payment_method,credit_card|string|regex:/^\d{3,4}$/',
            'gcash_number' => 'required_if:payment_method,gcash|string|regex:/^09\d{9}$/',
            'gcash_name' => 'required_if:payment_method,gcash|string|min:2',
            'maya_number' => 'required_if:payment_method,maya|string|regex:/^09\d{9}$/',
            'maya_name' => 'required_if:payment_method,maya|string|min:2',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        if ($request->payment_method === 'credit_card' && $request->card_expiry) {
            [$month, $year] = explode('/', $request->card_expiry);
            $expiryDate = \Carbon\Carbon::createFromDate(2000 + (int) $year, (int) $month, 1)->endOfMonth();
            if ($expiryDate->isPast()) {
                return $this->errorResponse('Card has expired', 422);
            }
        }

        $user = auth()->user();
        $cart = Cart::where('user_id', $user->id)->with('items.product')->first();

        if (!$cart || $cart->items->isEmpty()) {
            return $this->errorResponse('Cart is empty', 400);
        }

        foreach ($cart->items as $item) {
            if ($item->product->stock_quantity < $item->quantity) {
                return $this->errorResponse(
                    "Insufficient stock for {$item->product->name}",
                    400
                );
            }
        }

        DB::beginTransaction();

        try {
            $order = Order::create([
                'user_id' => $user->id,
                'status' => Order::STATUS_PENDING,
                'subtotal' => $cart->subtotal,
                'tax' => $cart->tax,
                'shipping_fee' => $cart->shipping,
                'discount' => $cart->discount,
                'total' => $cart->total,
                'coupon_code' => $cart->coupon_code,
                'shipping_first_name' => $request->shipping_first_name,
                'shipping_last_name' => $request->shipping_last_name,
                'shipping_email' => $request->shipping_email,
                'shipping_phone' => $request->shipping_phone,
                'shipping_address' => $request->shipping_address,
                'shipping_city' => $request->shipping_city,
                'shipping_state' => $request->shipping_state,
                'shipping_zip_code' => $request->shipping_zip_code,
                'shipping_country' => $request->shipping_country ?? 'Philippines',
                'billing_first_name' => $request->billing_first_name,
                'billing_last_name' => $request->billing_last_name,
                'billing_address' => $request->billing_address,
                'billing_city' => $request->billing_city,
                'billing_state' => $request->billing_state,
                'billing_zip_code' => $request->billing_zip_code,
                'billing_country' => $request->billing_country,
                'notes' => $request->notes,
            ]);

            foreach ($cart->items as $item) {
                $order->items()->create([
                    'product_id' => $item->product_id,
                    'product_name' => $item->product->name,
                    'product_sku' => $item->product->sku,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'total_price' => $item->total_price,
                    'options' => $item->options,
                ]);
                $item->product->decreaseStock($item->quantity);
            }

            $payment = Payment::create([
                'order_id' => $order->id,
                'payment_method' => $request->payment_method,
                'amount' => $cart->total,
                'status' => Payment::STATUS_PROCESSING,
            ]);

            Delivery::create([
                'order_id' => $order->id,
                'status' => Delivery::STATUS_PENDING,
            ]);

            $transactionId = 'TXN-' . strtoupper(Str::random(12));
            $payment->markAsCompleted($transactionId);
            $order->updateStatus(Order::STATUS_CONFIRMED);
            $cart->clear();

            DB::commit();

            $order->load(['items', 'payment', 'delivery']);
            $this->sendSupplierThankYouMessages($order);
            return $this->successResponse($order, 'Order placed and payment successful', 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Failed to place order: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Send auto thank-you message from each supplier whose product was purchased.
     */
    protected function sendSupplierThankYouMessages(Order $order): void
    {
        $storeIds = $order->items->map(function ($item) {
            return $item->product?->store_id;
        })->filter()->unique();

        foreach ($storeIds as $storeId) {
            $store = Store::find($storeId);
            if (!$store) {
                continue;
            }

            $conversation = Conversation::firstOrCreate(
                ['user_id' => $order->user_id, 'store_id' => $storeId],
                ['order_id' => $order->id]
            );

            // Friendly, store-branded thank-you message that clearly shows where the product came from
            $storeName = $store->name ?? 'our store';
            $messageBody = "Thank you for purchasing our product from {$storeName}! "
                . "If you have any questions about your order or our items, you can reply to this message.";

            Message::create([
                'conversation_id' => $conversation->id,
                'sender_type' => Message::SENDER_STORE,
                'sender_id' => $storeId,
                'body' => $messageBody,
            ]);
        }
    }

    /**
     * Update order status (Admin only).
     */
    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:pending,confirmed,processing,shipped,out_for_delivery,delivered,cancelled,refunded',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $order = Order::find($id);

        if (!$order) {
            return $this->errorResponse('Order not found', 404);
        }

        $order->updateStatus($request->status);

        // Update delivery status accordingly
        if (in_array($request->status, ['shipped', 'out_for_delivery', 'delivered'])) {
            $delivery = $order->delivery;
            if ($delivery) {
                $deliveryStatus = match($request->status) {
                    'shipped' => Delivery::STATUS_IN_TRANSIT,
                    'out_for_delivery' => Delivery::STATUS_OUT_FOR_DELIVERY,
                    'delivered' => Delivery::STATUS_DELIVERED,
                    default => $delivery->status,
                };
                $delivery->updateDeliveryStatus($deliveryStatus);
            }
        }

        // If cancelled, restore stock
        if ($request->status === 'cancelled') {
            foreach ($order->items as $item) {
                $item->product->increaseStock($item->quantity);
            }
        }

        return $this->successResponse($order->fresh(['items', 'payment', 'delivery']), 'Order status updated');
    }

    /**
     * Cancel order (Customer can cancel pending/confirmed orders).
     */
    public function cancel($id)
    {
        $user = auth()->user();
        $order = Order::find($id);

        if (!$order) {
            return $this->errorResponse('Order not found', 404);
        }

        if ($order->user_id !== $user->id && !$user->isAdmin()) {
            return $this->errorResponse('Unauthorized', 403);
        }

        if (!$order->canBeCancelled()) {
            return $this->errorResponse('Order cannot be cancelled at this stage', 400);
        }

        // Restore stock
        foreach ($order->items as $item) {
            $item->product->increaseStock($item->quantity);
        }

        $order->updateStatus(Order::STATUS_CANCELLED);

        // Update payment status
        if ($order->payment) {
            $order->payment->update(['status' => Payment::STATUS_CANCELLED]);
        }

        return $this->successResponse($order->fresh(['items', 'payment', 'delivery']), 'Order cancelled successfully');
    }

    /**
     * Track order by order number.
     */
    public function track($orderNumber)
    {
        $order = Order::with(['items', 'delivery'])
            ->where('order_number', $orderNumber)
            ->first();

        if (!$order) {
            return $this->errorResponse('Order not found', 404);
        }

        return $this->successResponse([
            'order_number' => $order->order_number,
            'status' => $order->status,
            'delivery' => $order->delivery,
            'shipped_at' => $order->shipped_at,
            'delivered_at' => $order->delivered_at,
        ]);
    }
}
