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
use App\Models\User;
use App\Services\XenditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

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

        // Broader search for admin/supplier operations screens.
        $search = trim((string) $request->get('search', ''));
        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('order_number', 'like', $like)
                    ->orWhere('shipping_email', 'like', $like)
                    ->orWhere('shipping_first_name', 'like', $like)
                    ->orWhere('shipping_last_name', 'like', $like)
                    ->orWhereRaw("CONCAT(shipping_first_name, ' ', shipping_last_name) like ?", [$like])
                    ->orWhereHas('user', function ($uq) use ($like) {
                        $uq->where('email', 'like', $like)
                            ->orWhere('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhereRaw("CONCAT(first_name, ' ', last_name) like ?", [$like]);
                    })
                    ->orWhereHas('payment', function ($pq) use ($like) {
                        $pq->where('payment_method', 'like', $like)
                            ->orWhere('status', 'like', $like);
                    });
            });
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

        if ($user->isAdmin()) {
            // Admin oversight: can view any order.
        } elseif ($user->isSupplier()) {
            $store = Store::where('user_id', $user->id)->first();
            if (! $store) {
                return $this->errorResponse('Supplier store not found', 404);
            }
            $isSupplierOrder = $order->items->contains(function ($item) use ($store) {
                return $item->product && (int) $item->product->store_id === (int) $store->id;
            });
            if (! $isSupplierOrder) {
                return $this->errorResponse('Unauthorized', 403);
            }
        } elseif ($order->user_id !== $user->id) {
            // Customers can only view their own orders.
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
            'payment_method' => 'required|in:gcash,cod',
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
                // Keep supplier stock aligned for approved marketplace listing flow.
                $item->product->decrement('supplier_stock_quantity', $item->quantity);
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

            // Clear cart only for COD (pay on delivery). For GCash, keep cart until payment completes.
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
     * Create order and process payment in one step (GCash).
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
            'payment_method' => 'required|in:gcash',
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
            $xendit = app(XenditService::class);
            if (!$xendit->isConfigured()) {
                DB::rollBack();
                return $this->errorResponse('Xendit is not configured yet. Please contact admin.', 422);
            }

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
                // Keep supplier stock aligned for approved marketplace listing flow.
                $item->product->decrement('supplier_stock_quantity', $item->quantity);
            }

            $payment = Payment::create([
                'order_id' => $order->id,
                'payment_method' => $request->payment_method,
                'amount' => $cart->total,
                'status' => Payment::STATUS_PROCESSING,
                'payment_details' => [],
            ]);

            Delivery::create([
                'order_id' => $order->id,
                'status' => Delivery::STATUS_PENDING,
            ]);

            $xenditInvoice = $xendit->createInvoice([
                'external_id'  => 'order-' . $order->order_number,
                'amount'       => (float) $cart->total,
                'description'  => 'Payment for order ' . $order->order_number,
                'customer'     => [
                    'given_names'   => trim($request->shipping_first_name . ' ' . $request->shipping_last_name),
                    'email'         => (string) $request->shipping_email,
                    'mobile_number' => (string) ($request->shipping_phone ?? ''),
                ],
                'success_redirect_url' => (string) config('services.xendit.success_redirect_url'),
                'failure_redirect_url' => (string) config('services.xendit.failure_redirect_url'),
                'metadata' => [
                    'order_id'     => (string) $order->id,
                    'payment_id'   => (string) $payment->id,
                    'user_id'      => (string) $user->id,
                    'order_number' => (string) $order->order_number,
                ],
            ]);

            $xenditInvoiceId = (string) data_get($xenditInvoice, 'id', '');
            $checkoutUrl     = (string) data_get($xenditInvoice, 'invoice_url', '');
            $externalId      = (string) data_get($xenditInvoice, 'external_id', '');
            $expiresAt       = data_get($xenditInvoice, 'expiry_date');

            if ($xenditInvoiceId === '' || $checkoutUrl === '') {
                throw new \RuntimeException('Xendit did not return a valid invoice URL.');
            }

            $payment->update([
                'payment_details' => [
                    'provider'          => 'xendit',
                    'flow'              => 'invoice',
                    'xendit_invoice_id' => $xenditInvoiceId,
                    'external_id'       => $externalId,
                    'checkout_url'      => $checkoutUrl,
                    'expires_at'        => $expiresAt,
                ],
                'transaction_id' => $xenditInvoiceId,
            ]);

            DB::commit();

            return $this->successResponse([
                'order_id'          => $order->id,
                'order_number'      => $order->order_number,
                'xendit_invoice_id' => $xenditInvoiceId,
                'checkout_url'      => $checkoutUrl,
                'expires_at'        => $expiresAt,
            ], 'Invoice created. Redirecting to payment page.', 201);
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
     * Admin order status updates are disabled (oversight-only admin role).
     */
    public function updateStatus(Request $request, $id)
    {
        return $this->errorResponse(
            'Admins can monitor orders but cannot manage order transactions. Suppliers must update fulfillment status.',
            403
        );
    }

    /**
     * Update order status for supplier-owned orders.
     */
    public function supplierUpdateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:confirmed,processing,shipped,cancelled',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $user = auth()->user();
        $store = Store::where('user_id', $user->id)->first();
        if (! $store) {
            return $this->errorResponse('Supplier store not found', 404);
        }

        $order = Order::with(['items.product', 'delivery', 'payment', 'user'])->find($id);
        if (! $order) {
            return $this->errorResponse('Order not found', 404);
        }

        $isSupplierOrder = $order->items->contains(function ($item) use ($store) {
            return $item->product && (int) $item->product->store_id === (int) $store->id;
        });
        if (! $isSupplierOrder) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $targetStatus = $request->status;
        if (! $this->isSupplierStatusTransitionAllowed($order->status, $targetStatus)) {
            return $this->errorResponse('Invalid supplier status transition for this order state', 422);
        }

        $order->updateStatus($targetStatus);

        if ($targetStatus === Order::STATUS_SHIPPED) {
            $delivery = $order->delivery;
            if ($delivery) {
                $delivery->updateDeliveryStatus(Delivery::STATUS_IN_TRANSIT);
            }
        }

        if ($targetStatus === Order::STATUS_CANCELLED) {
            foreach ($order->items as $item) {
                $item->product->increaseStock($item->quantity);
                $item->product->increment('supplier_stock_quantity', $item->quantity);
            }
            if ($order->delivery && !in_array($order->delivery->status, [Delivery::STATUS_DELIVERED, Delivery::STATUS_FAILED, Delivery::STATUS_RETURNED], true)) {
                $order->delivery->updateDeliveryStatus(Delivery::STATUS_FAILED, 'Order cancelled by seller');
            }
            $this->settleCancellationPayment($order, 'seller_cancelled_order', 'Refunded after seller cancellation');
        }

        return $this->successResponse($order->fresh(['items', 'payment', 'delivery']), 'Order status updated');
    }

    /**
     * Customer cancellation request (seller approval required).
     */
    public function cancel(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'required|in:delivery_too_slow,found_cheaper,wrong_address,changed_mind,ordered_by_mistake,other',
            'details' => 'nullable|string|max:500',
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $user = auth()->user();
        $order = Order::with(['items.product.store', 'payment'])->find($id);

        if (!$order) {
            return $this->errorResponse('Order not found', 404);
        }

        if ($order->user_id !== $user->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        if ($order->status !== Order::STATUS_PENDING) {
            return $this->errorResponse(
                'Cancellation is only available before the seller confirms your order.',
                400
            );
        }

        if ($order->status === Order::STATUS_CANCEL_REQUESTED) {
            return $this->errorResponse('Cancellation request already sent. Waiting for seller approval.', 422);
        }

        $details = trim((string) $request->input('details', ''));
        $reasonCode = (string) $request->input('reason');
        $reasonMap = [
            'delivery_too_slow' => 'Delivery is taking too long',
            'found_cheaper' => 'Found a cheaper alternative',
            'wrong_address' => 'Wrong shipping address selected',
            'changed_mind' => 'Changed my mind',
            'ordered_by_mistake' => 'Ordered by mistake',
            'other' => 'Other reason',
        ];
        $reasonLabel = $reasonMap[$reasonCode] ?? 'Other reason';

        $order->update([
            'status' => Order::STATUS_CANCEL_REQUESTED,
            'cancellation_previous_status' => $order->status,
            'cancellation_reason' => $reasonLabel . ($details !== '' ? ' - ' . $details : ''),
            'cancellation_requested_at' => now(),
            'cancellation_reviewed_at' => null,
            'cancellation_review_note' => null,
            'cancellation_reviewed_by' => null,
        ]);

        // Notify each store involved using existing customer<->store conversation.
        $storeIds = $order->items->map(fn ($item) => $item->product?->store_id)->filter()->unique();
        foreach ($storeIds as $storeId) {
            $conversation = Conversation::firstOrCreate(
                ['user_id' => $order->user_id, 'store_id' => $storeId],
                ['order_id' => $order->id]
            );
            Message::create([
                'conversation_id' => $conversation->id,
                'sender_type' => Message::SENDER_CUSTOMER,
                'sender_id' => $order->user_id,
                'body' => "Cancellation request for order {$order->order_number}. Reason: {$reasonLabel}" . ($details !== '' ? " ({$details})" : '') . ". Please review and approve/reject.",
            ]);
        }

        return $this->successResponse(
            $order->fresh(['items', 'payment', 'delivery']),
            'Cancellation request sent to seller. Order will be refunded after seller approval.'
        );
    }

    public function supplierApproveCancelRequest(Request $request, $id)
    {
        $user = auth()->user();
        $store = Store::where('user_id', $user->id)->first();
        if (! $store) {
            return $this->errorResponse('Supplier store not found', 404);
        }

        $order = Order::with(['items.product', 'payment', 'delivery', 'user'])->find($id);
        if (! $order) {
            return $this->errorResponse('Order not found', 404);
        }

        $isSupplierOrder = $order->items->contains(function ($item) use ($store) {
            return $item->product && (int) $item->product->store_id === (int) $store->id;
        });
        if (! $isSupplierOrder) {
            return $this->errorResponse('Unauthorized', 403);
        }

        if ($order->status !== Order::STATUS_CANCEL_REQUESTED) {
            return $this->errorResponse('No pending cancellation request for this order', 422);
        }

        DB::beginTransaction();
        try {
            foreach ($order->items as $item) {
                $item->product->increaseStock($item->quantity);
                $item->product->increment('supplier_stock_quantity', $item->quantity);
            }

            if ($order->delivery) {
                $order->delivery->updateDeliveryStatus(Delivery::STATUS_FAILED, 'Cancelled by seller approval');
            }

            $this->settleCancellationPayment(
                $order,
                'seller_approved_cancellation',
                'Refunded after seller-approved cancellation request'
            );
            $finalPaymentStatus = $order->payment?->fresh()?->status ?? $order->payment?->status;

            $order->update([
                'status' => Order::STATUS_CANCELLED,
                'cancellation_reviewed_at' => now(),
                'cancellation_reviewed_by' => $user->id,
                'cancellation_review_note' => 'Approved by seller',
            ]);

            // Notify customer in conversation.
            $conversation = Conversation::firstOrCreate(
                ['user_id' => $order->user_id, 'store_id' => $store->id],
                ['order_id' => $order->id]
            );
            Message::create([
                'conversation_id' => $conversation->id,
                'sender_type' => Message::SENDER_STORE,
                'sender_id' => $store->id,
                'body' => "Your cancellation request for order {$order->order_number} has been approved. " .
                    ($finalPaymentStatus === Payment::STATUS_REFUNDED ? 'Your payment was refunded.' : 'No refund was needed.'),
            ]);

            DB::commit();
            return $this->successResponse(
                $order->fresh(['items', 'payment', 'delivery']),
                'Cancellation approved and refund processed.'
            );
        } catch (\Throwable $e) {
            DB::rollBack();
            return $this->errorResponse('Failed to approve cancellation: ' . $e->getMessage(), 500);
        }
    }

    public function supplierRejectCancelRequest(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'note' => 'nullable|string|max:500',
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $user = auth()->user();
        $store = Store::where('user_id', $user->id)->first();
        if (! $store) {
            return $this->errorResponse('Supplier store not found', 404);
        }

        $order = Order::with(['items.product', 'payment', 'delivery'])->find($id);
        if (! $order) {
            return $this->errorResponse('Order not found', 404);
        }

        $isSupplierOrder = $order->items->contains(function ($item) use ($store) {
            return $item->product && (int) $item->product->store_id === (int) $store->id;
        });
        if (! $isSupplierOrder) {
            return $this->errorResponse('Unauthorized', 403);
        }

        if ($order->status !== Order::STATUS_CANCEL_REQUESTED) {
            return $this->errorResponse('No pending cancellation request for this order', 422);
        }

        $restoreStatus = in_array((string) $order->cancellation_previous_status, [
            Order::STATUS_PENDING,
            Order::STATUS_CONFIRMED,
            Order::STATUS_PROCESSING,
        ], true) ? $order->cancellation_previous_status : Order::STATUS_PROCESSING;

        $note = trim((string) $request->input('note', ''));
        $order->update([
            'status' => $restoreStatus,
            'cancellation_reviewed_at' => now(),
            'cancellation_reviewed_by' => $user->id,
            'cancellation_review_note' => $note !== '' ? $note : 'Cancellation request rejected by seller',
        ]);

        $conversation = Conversation::firstOrCreate(
            ['user_id' => $order->user_id, 'store_id' => $store->id],
            ['order_id' => $order->id]
        );
        Message::create([
            'conversation_id' => $conversation->id,
            'sender_type' => Message::SENDER_STORE,
            'sender_id' => $store->id,
            'body' => "Your cancellation request for order {$order->order_number} was rejected." .
                ($note !== '' ? " Note from seller: {$note}" : ''),
        ]);

        return $this->successResponse(
            $order->fresh(['items', 'payment', 'delivery']),
            'Cancellation request rejected.'
        );
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

    /**
     * Normalize payment outcomes when an order is cancelled.
     * - Paid payments should become refunded.
     * - Unpaid payments should become cancelled.
     */
    protected function settleCancellationPayment(Order $order, string $refundReason, string $refundNote): void
    {
        $payment = $order->payment;
        if (! $payment || $payment->status === Payment::STATUS_REFUNDED) {
            return;
        }

        $method = strtolower((string) $payment->payment_method);
        $isPaid = $payment->status === Payment::STATUS_COMPLETED || ! is_null($payment->paid_at);

        if (! $isPaid) {
            $payment->update([
                'status' => Payment::STATUS_CANCELLED,
                'paid_at' => null,
            ]);
            return;
        }

        if ($method === Payment::METHOD_GCASH) {
            $customer = User::where('id', $order->user_id)->lockForUpdate()->first();
            if ($customer) {
                $balance = (float) $customer->gcash_balance;
                $refundAmount = (float) $payment->amount;
                $customer->update([
                    'gcash_balance' => round($balance + $refundAmount, 2),
                ]);
            }
        }

        $payment->update([
            'status' => Payment::STATUS_REFUNDED,
            'notes' => $refundNote,
            'payment_details' => array_merge($payment->payment_details ?? [], [
                'refund_reason' => $refundReason,
                'refund_amount' => (float) $payment->amount,
                'refund_at' => now()->toDateTimeString(),
            ]),
        ]);
    }

    protected function isSupplierStatusTransitionAllowed(string $currentStatus, string $targetStatus): bool
    {
        return match ($targetStatus) {
            Order::STATUS_CONFIRMED => $currentStatus === Order::STATUS_PENDING,
            Order::STATUS_PROCESSING => in_array($currentStatus, [Order::STATUS_PENDING, Order::STATUS_CONFIRMED], true),
            Order::STATUS_SHIPPED => $currentStatus === Order::STATUS_PROCESSING,
            Order::STATUS_CANCELLED => in_array($currentStatus, [Order::STATUS_PENDING, Order::STATUS_CONFIRMED, Order::STATUS_PROCESSING], true),
            default => false,
        };
    }
}
