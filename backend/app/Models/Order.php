<?php

namespace App\Models;

use App\Services\OrderCustomerNotifier;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Order extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_id',
        'order_number',
        'status',
        'subtotal',
        'tax',
        'shipping_fee',
        'discount',
        'total',
        'coupon_code',
        'shipping_first_name',
        'shipping_last_name',
        'shipping_email',
        'shipping_phone',
        'shipping_address',
        'shipping_city',
        'shipping_state',
        'shipping_zip_code',
        'shipping_country',
        'billing_first_name',
        'billing_last_name',
        'billing_address',
        'billing_city',
        'billing_state',
        'billing_zip_code',
        'billing_country',
        'notes',
        'cancellation_reason',
        'cancellation_previous_status',
        'cancellation_requested_at',
        'cancellation_reviewed_at',
        'cancellation_review_note',
        'cancellation_reviewed_by',
        'shipped_at',
        'delivered_at',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'subtotal' => 'decimal:2',
        'tax' => 'decimal:2',
        'shipping_fee' => 'decimal:2',
        'discount' => 'decimal:2',
        'total' => 'decimal:2',
        'cancellation_requested_at' => 'datetime',
        'cancellation_reviewed_at' => 'datetime',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    /**
     * Order statuses.
     */
    const STATUS_PENDING = 'pending';
    const STATUS_CONFIRMED = 'confirmed';
    const STATUS_PROCESSING = 'processing';
    const STATUS_CANCEL_REQUESTED = 'cancel_requested';
    const STATUS_SHIPPED = 'shipped';
    const STATUS_OUT_FOR_DELIVERY = 'out_for_delivery';
    const STATUS_DELIVERED = 'delivered';
    const STATUS_CANCELLED = 'cancelled';
    const STATUS_REFUNDED = 'refunded';

    /**
     * Boot the model.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($order) {
            if (empty($order->order_number)) {
                $order->order_number = 'GHC-' . strtoupper(Str::random(8));
            }
        });
    }

    /**
     * Get the customer.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get order items.
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Get payment.
     */
    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    /**
     * Get delivery.
     */
    public function delivery(): HasOne
    {
        return $this->hasOne(Delivery::class);
    }

    /**
     * Get reviews for this order.
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    /**
     * Get rider rating for this order (one per order).
     */
    public function riderRating(): HasOne
    {
        return $this->hasOne(RiderRating::class);
    }

    /**
     * Get shipping full name.
     */
    public function getShippingFullNameAttribute(): string
    {
        return "{$this->shipping_first_name} {$this->shipping_last_name}";
    }

    /**
     * Get full shipping address.
     */
    public function getFullShippingAddressAttribute(): string
    {
        return implode(', ', array_filter([
            $this->shipping_address,
            $this->shipping_city,
            $this->shipping_state,
            $this->shipping_zip_code,
            $this->shipping_country,
        ]));
    }

    /**
     * Check if order can be cancelled.
     * Only before the seller confirms (status must still be pending).
     */
    public function canBeCancelled(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    /**
     * Update order status.
     */
    public function updateStatus(string $status): void
    {
        if ($this->status === $status) {
            return;
        }

        $previousStatus = $this->status;

        $this->update(['status' => $status]);

        if ($status === self::STATUS_SHIPPED) {
            $this->update(['shipped_at' => now()]);
        }

        if ($status === self::STATUS_DELIVERED) {
            $this->update(['delivered_at' => now()]);
            $this->completeCodPaymentIfApplicable();
        }

        $this->refresh();
        OrderCustomerNotifier::notifyStatusChange($this, $previousStatus, $status);
    }

    /**
     * When order is delivered, mark Cash on Delivery payment as completed.
     */
    public function completeCodPaymentIfApplicable(): void
    {
        $payment = $this->payment;
        if (!$payment || $payment->status === \App\Models\Payment::STATUS_COMPLETED) {
            return;
        }
        $method = strtolower((string) $payment->payment_method);
        if ($method === 'cod' || $method === 'cash_on_delivery') {
            $payment->markAsCompleted();
        }
    }

    /**
     * Scope for pending orders.
     */
    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    /**
     * Scope for completed orders.
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', self::STATUS_DELIVERED);
    }
}
