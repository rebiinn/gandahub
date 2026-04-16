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
     * PayMongo webhook endpoint.
     */
    public function paymongoWebhook(Request $request)
    {
        $rawPayload = (string) $request->getContent();
        $payload = $request->all();
        $webhookSecret = (string) config('services.paymongo.webhook_secret', '');
        if ($webhookSecret !== '') {
            $signatureHeader = (string) $request->header('Paymongo-Signature', '');
            if (!$this->isValidPayMongoSignature($signatureHeader, $rawPayload, $webhookSecret)) {
                Log::warning('Rejected PayMongo webhook due to invalid signature');
                return $this->errorResponse('Invalid webhook signature', 401);
            }
        }

        $eventType = (string) data_get($payload, 'data.attributes.type', '');
        $resourceData = data_get($payload, 'data.attributes.data', []);
        $providerPaymentId = (string) data_get($resourceData, 'id', '');
        $paymentIntentId = (string) (
            data_get($resourceData, 'attributes.payment_intent_id')
            ?: data_get($resourceData, 'attributes.source.attributes.payment_intent_id')
            ?: data_get($resourceData, 'attributes.source.payment_intent_id')
        );
        $providerCodeId = (string) (
            data_get($resourceData, 'attributes.source.provider.code_id')
            ?: data_get($resourceData, 'attributes.source.attributes.provider.code_id')
        );

        // Best-effort extraction across PayMongo event payload variants.
        $checkoutSessionId = (string) (
            data_get($resourceData, 'id')
            ?: data_get($resourceData, 'attributes.checkout_session_id')
            ?: data_get($resourceData, 'attributes.source.id')
            ?: data_get($resourceData, 'attributes.payment_intent_id')
            ?: data_get($resourceData, 'attributes.metadata.checkout_session_id')
            ?: data_get($resourceData, 'attributes.metadata.checkoutSessionId')
        );

        $payment = null;
        if ($paymentIntentId !== '') {
            $payment = Payment::where('payment_details->payment_intent_id', $paymentIntentId)
                ->orWhere('transaction_id', $paymentIntentId)
                ->first();
        }
        if (!$payment && $providerCodeId !== '') {
            $payment = Payment::where('payment_details->qr_code_id', $providerCodeId)->first();
        }
        if (!$payment && $providerPaymentId !== '') {
            $payment = Payment::where('payment_details->provider_payment_id', $providerPaymentId)->first();
        }

        if (!$payment && $checkoutSessionId === '') {
            // Fallback: map webhook by local payment id or order id in metadata.
            $metadata = (array) data_get($resourceData, 'attributes.metadata', []);
            $metaPaymentId = Arr::get($metadata, 'payment_id');
            $metaOrderId = Arr::get($metadata, 'order_id');

            if (!empty($metaPaymentId)) {
                $payment = Payment::find($metaPaymentId);
            } elseif (!empty($metaOrderId)) {
                $payment = Payment::where('order_id', $metaOrderId)->latest('id')->first();
            }

            if (!$payment) {
                Log::warning('PayMongo webhook received without mappable checkout session id', ['payload' => $payload]);
                return $this->successResponse(['received' => true], 'Ignored');
            }
        } elseif (!$payment) {
            $payment = Payment::where('payment_details->checkout_session_id', $checkoutSessionId)
                ->orWhere('payment_details->payment_intent_id', $checkoutSessionId)
                ->orWhere('payment_details->qr_code_id', $checkoutSessionId)
                ->orWhere('payment_details->provider_payment_id', $checkoutSessionId)
                ->orWhere('transaction_id', $checkoutSessionId)
                ->first();
        }

        if (!$payment) {
            Log::warning('PayMongo webhook session not mapped to local payment', ['checkout_session_id' => $checkoutSessionId]);
            return $this->successResponse(['received' => true], 'Ignored');
        }

        $order = $payment->order;
        if (!$order) {
            return $this->successResponse(['received' => true], 'Ignored');
        }

        $normalizedType = strtolower($eventType);
        $isPaidEvent = str_contains($normalizedType, 'paid');
        $isFailedEvent = str_contains($normalizedType, 'failed') || str_contains($normalizedType, 'expired');

        if ($isPaidEvent) {
            $orderCancelled = in_array((string) $order->status, [Order::STATUS_CANCELLED], true);
            if ($orderCancelled) {
                if ($payment->status !== Payment::STATUS_REFUNDED) {
                    $method = strtolower((string) $payment->payment_method);
                    if ($method === Payment::METHOD_GCASH) {
                        $customer = User::where('id', $order->user_id)->lockForUpdate()->first();
                        if ($customer) {
                            $currentBalance = (float) $customer->gcash_balance;
                            $refundAmount = (float) $payment->amount;
                            $customer->update([
                                'gcash_balance' => round($currentBalance + $refundAmount, 2),
                            ]);
                        }
                    }
                    $payment->update([
                        'status' => Payment::STATUS_REFUNDED,
                        'notes' => 'Auto-refunded: payment confirmation arrived after order cancellation',
                        'payment_details' => array_merge($payment->payment_details ?? [], [
                            'provider' => 'paymongo',
                            'provider_payment_id' => $providerPaymentId ?: data_get($payment->payment_details, 'provider_payment_id'),
                            'payment_intent_id' => $paymentIntentId ?: data_get($payment->payment_details, 'payment_intent_id'),
                            'qr_code_id' => $providerCodeId ?: data_get($payment->payment_details, 'qr_code_id'),
                            'refund_reason' => 'payment_paid_after_order_cancelled',
                            'refund_amount' => (float) $payment->amount,
                            'refund_at' => now()->toDateTimeString(),
                            'last_webhook_event' => $eventType,
                        ]),
                    ]);
                }
                return $this->successResponse(['received' => true]);
            }

            if ($payment->status !== Payment::STATUS_COMPLETED) {
                $resolvedProviderPaymentId = (string) (
                    data_get($resourceData, 'attributes.payments.0.id')
                    ?: $providerPaymentId
                    ?: $paymentIntentId
                    ?: $checkoutSessionId
                );
                $payment->markAsCompleted($resolvedProviderPaymentId);
                $payment->update([
                    'payment_details' => array_merge($payment->payment_details ?? [], [
                        'provider' => 'paymongo',
                        'provider_payment_id' => $resolvedProviderPaymentId,
                        'payment_intent_id' => $paymentIntentId ?: data_get($payment->payment_details, 'payment_intent_id'),
                        'qr_code_id' => $providerCodeId ?: data_get($payment->payment_details, 'qr_code_id'),
                        'last_webhook_event' => $eventType,
                    ]),
                ]);
            }

            // Keep order pending after payment; supplier confirms and processes fulfillment.

            $userCart = Cart::where('user_id', $order->user_id)->first();
            if ($userCart) {
                $userCart->clear();
            }
        } elseif ($isFailedEvent) {
            if ($payment->status !== Payment::STATUS_FAILED) {
                $payment->markAsFailed('PayMongo reported ' . $eventType);
                $payment->update([
                    'payment_details' => array_merge($payment->payment_details ?? [], [
                        'provider' => 'paymongo',
                        'last_webhook_event' => $eventType,
                    ]),
                ]);
            }
        }

        return $this->successResponse(['received' => true]);
    }

    protected function isValidPayMongoSignature(string $signatureHeader, string $payload, string $secret): bool
    {
        if ($signatureHeader === '' || $payload === '' || $secret === '') {
            return false;
        }

        $parts = [];
        foreach (explode(',', $signatureHeader) as $segment) {
            [$key, $value] = array_pad(explode('=', trim($segment), 2), 2, null);
            if ($key && $value) {
                $parts[$key] = $value;
            }
        }

        $timestamp = $parts['t'] ?? '';
        $signature = $parts['v1'] ?? ($parts['te'] ?? '');
        if ($timestamp === '' || $signature === '') {
            return false;
        }

        $signedPayload = $timestamp . '.' . $payload;
        $expected = hash_hmac('sha256', $signedPayload, $secret);

        return hash_equals($expected, $signature);
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
