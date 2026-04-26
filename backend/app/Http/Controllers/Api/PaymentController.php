<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    /**
     * Get all payments (Admin only).
     */
    public function index(Request $request)
    {
        $query = Payment::with('order.user');

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('payment_method')) {
            $query->where('payment_method', $request->payment_method);
        }

        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $perPage = min($request->get('per_page', 10), 50);
        $payments = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return $this->paginatedResponse($payments);
    }

    /**
     * Get payment details.
     */
    public function show($id)
    {
        $payment = Payment::with('order.user')->find($id);

        if (!$payment) {
            return $this->errorResponse('Payment not found', 404);
        }

        $user = auth()->user();
        if (!$user->isAdmin() && $payment->order->user_id !== $user->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        return $this->successResponse($payment);
    }

    /**
     * Process payment (Mock payment gateway).
     */
    public function process(Request $request, $orderId)
    {
        $order = Order::find($orderId);

        if (!$order) {
            return $this->errorResponse('Order not found', 404);
        }

        $user = auth()->user();
        if ($order->user_id !== $user->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $payment = $order->payment;

        if (!$payment) {
            return $this->errorResponse('Payment record not found', 404);
        }

        if ($payment->status === Payment::STATUS_COMPLETED) {
            return $this->errorResponse('Payment already completed', 400);
        }

        // Payment processing - only GCash is supported for online payment
        $validator = Validator::make($request->all(), [
            'payment_method' => 'required|in:gcash',
            'gcash_number' => 'required_if:payment_method,gcash|string|regex:/^09\d{9}$/',
            'gcash_name' => 'required_if:payment_method,gcash|string|min:2',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        if ($request->payment_method !== 'gcash') {
            return $this->errorResponse('Unsupported payment method', 422);
        }

        DB::beginTransaction();
        try {
            $customer = User::where('id', $user->id)->lockForUpdate()->first();
            if (!$customer) {
                DB::rollBack();
                return $this->errorResponse('User not found', 404);
            }

            $currentBalance = (float) $customer->gcash_balance;
            $paymentAmount = (float) $payment->amount;
            if ($currentBalance < $paymentAmount) {
                DB::rollBack();
                return $this->errorResponse('Insufficient GCash balance', 422);
            }

            $customer->update([
                'gcash_balance' => round($currentBalance - $paymentAmount, 2),
                'gcash_number' => $request->gcash_number,
            ]);

            $transactionId = 'TXN-' . strtoupper(Str::random(12));
            $payment->markAsCompleted($transactionId);
            $payment->update([
                'payment_details' => [
                    'gcash_number' => $request->gcash_number,
                    'gcash_name' => $request->gcash_name,
                    'balance_before' => number_format($currentBalance, 2, '.', ''),
                    'balance_after' => number_format((float) $customer->gcash_balance, 2, '.', ''),
                ],
            ]);

            // Keep order pending after payment; supplier confirms and processes fulfillment.

            // Clear cart now that payment is complete (cart was kept when order was created for non-COD)
            $userCart = Cart::where('user_id', $user->id)->first();
            if ($userCart) {
                $userCart->clear();
            }

            DB::commit();
            return $this->successResponse([
                'payment' => $payment->fresh(),
                'transaction_id' => $transactionId,
            ], 'Payment processed successfully');
        } catch (\Throwable $e) {
            DB::rollBack();
            $payment->markAsFailed('Payment declined');
            return $this->errorResponse('Payment failed', 400);
        }
    }

    /**
     * Admin payment status updates are disabled (oversight-only admin role).
     */
    public function updateStatus(Request $request, $id)
    {
        return $this->errorResponse(
            'Admins can monitor payments but cannot alter payment transactions.',
            403
        );
    }

    /**
     * Get available payment methods.
     */
    public function methods()
    {
        return $this->successResponse([
            'methods' => Payment::getPaymentMethods(),
        ]);
    }

    /**
     * Xendit webhook endpoint.
     * Authentication: compare `x-callback-token` header against XENDIT_WEBHOOK_TOKEN env var.
     *
     * Xendit invoice.paid payload shape:
     * { "event": "invoice.paid", "data": { "id": "inv_...", "external_id": "order-ORD-...",
     *   "status": "PAID", "amount": 100, "payment_method": "GCASH", "metadata": {...} } }
     */
    public function xenditWebhook(Request $request)
    {
        $payload      = $request->all();
        $webhookToken = (string) config('services.xendit.webhook_token', '');

        // Verify the x-callback-token header when a webhook token is configured.
        if ($webhookToken !== '') {
            $receivedToken = (string) $request->header('x-callback-token', '');
            if (!hash_equals($webhookToken, $receivedToken)) {
                Log::warning('Rejected Xendit webhook due to invalid x-callback-token');
                return $this->errorResponse('Invalid webhook token', 401);
            }
        }

        $invoiceId  = (string) data_get($payload, 'id', '');
        $externalId = (string) data_get($payload, 'external_id', '');
        $status     = strtoupper((string) data_get($payload, 'status', ''));
        $metadata   = (array)  data_get($payload, 'metadata', []);
        $paymentMethod = (string) data_get($payload, 'payment_method', '');

        // Resolve local payment record — try multiple lookup strategies.
        $payment = null;

        if ($invoiceId !== '') {
            $payment = Payment::where('payment_details->xendit_invoice_id', $invoiceId)
                ->orWhere('transaction_id', $invoiceId)
                ->first();
        }

        if (!$payment && $externalId !== '') {
            $payment = Payment::where('payment_details->external_id', $externalId)->first();
        }

        if (!$payment) {
            $metaPaymentId = Arr::get($metadata, 'payment_id');
            $metaOrderId   = Arr::get($metadata, 'order_id');
            if (!empty($metaPaymentId)) {
                $payment = Payment::find($metaPaymentId);
            } elseif (!empty($metaOrderId)) {
                $payment = Payment::where('order_id', $metaOrderId)->latest('id')->first();
            }
        }

        if (!$payment) {
            Log::warning('Xendit webhook received but could not map to a local payment', [
                'invoice_id'  => $invoiceId,
                'external_id' => $externalId,
                'status'      => $status,
            ]);
            return $this->successResponse(['received' => true], 'Ignored');
        }

        $order = $payment->order;
        if (!$order) {
            return $this->successResponse(['received' => true], 'Ignored');
        }

        $isPaidEvent    = ($status === 'PAID'    || $status === 'SETTLED');
        $isExpiredEvent = ($status === 'EXPIRED' || $status === 'FAILED');

        if ($isPaidEvent) {
            $orderCancelled = in_array((string) $order->status, [Order::STATUS_CANCELLED], true);
            if ($orderCancelled) {
                if ($payment->status !== Payment::STATUS_REFUNDED) {
                    $method = strtolower((string) $payment->payment_method);
                    if ($method === Payment::METHOD_GCASH) {
                        $customer = User::where('id', $order->user_id)->lockForUpdate()->first();
                        if ($customer) {
                            $currentBalance = (float) $customer->gcash_balance;
                            $refundAmount   = (float) $payment->amount;
                            $customer->update(['gcash_balance' => round($currentBalance + $refundAmount, 2)]);
                        }
                    }
                    $payment->update([
                        'status' => Payment::STATUS_REFUNDED,
                        'notes'  => 'Auto-refunded: payment confirmation arrived after order cancellation',
                        'payment_details' => array_merge($payment->payment_details ?? [], [
                            'provider'          => 'xendit',
                            'xendit_invoice_id' => $invoiceId ?: data_get($payment->payment_details, 'xendit_invoice_id'),
                            'refund_reason'     => 'payment_paid_after_order_cancelled',
                            'refund_amount'     => (float) $payment->amount,
                            'refund_at'         => now()->toDateTimeString(),
                            'last_webhook_event' => $status,
                        ]),
                    ]);
                }
                return $this->successResponse(['received' => true]);
            }

            if ($payment->status !== Payment::STATUS_COMPLETED) {
                $payment->markAsCompleted($invoiceId ?: $externalId);
                $payment->update([
                    'payment_details' => array_merge($payment->payment_details ?? [], [
                        'provider'          => 'xendit',
                        'xendit_invoice_id' => $invoiceId,
                        'payment_method'    => $paymentMethod,
                        'last_webhook_event' => $status,
                    ]),
                ]);
            }

            // Keep order pending after payment; supplier confirms and processes fulfillment.

            $userCart = Cart::where('user_id', $order->user_id)->first();
            if ($userCart) {
                $userCart->clear();
                Log::info('Cart cleared via Xendit webhook for user: ' . $order->user_id);
            }
        } elseif ($isExpiredEvent) {
            if ($payment->status !== Payment::STATUS_FAILED) {
                $payment->markAsFailed('Xendit reported ' . $status);
                $payment->update([
                    'payment_details' => array_merge($payment->payment_details ?? [], [
                        'provider'          => 'xendit',
                        'last_webhook_event' => $status,
                    ]),
                ]);
            }
        }

        return $this->successResponse(['received' => true]);
    }


    /**
     * Admin refunds are disabled (oversight-only admin role).
     */
    public function refund(Request $request, $id)
    {
        return $this->errorResponse(
            'Admins can monitor payments but cannot process refunds.',
            403
        );
    }
}
