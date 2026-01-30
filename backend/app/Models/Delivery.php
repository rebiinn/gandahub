<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Delivery extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'order_id',
        'rider_id',
        'tracking_number',
        'status',
        'current_location',
        'current_lat',
        'current_lng',
        'estimated_delivery',
        'picked_up_at',
        'delivered_at',
        'delivery_notes',
        'recipient_name',
        'proof_of_delivery',
        'delivery_attempts',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'current_lat' => 'decimal:8',
        'current_lng' => 'decimal:8',
        'estimated_delivery' => 'datetime',
        'picked_up_at' => 'datetime',
        'delivered_at' => 'datetime',
        'delivery_attempts' => 'integer',
    ];

    /**
     * Delivery statuses.
     */
    const STATUS_PENDING = 'pending';
    const STATUS_ASSIGNED = 'assigned';
    const STATUS_PICKED_UP = 'picked_up';
    const STATUS_IN_TRANSIT = 'in_transit';
    const STATUS_OUT_FOR_DELIVERY = 'out_for_delivery';
    const STATUS_DELIVERED = 'delivered';
    const STATUS_FAILED = 'failed';
    const STATUS_RETURNED = 'returned';

    /**
     * Boot the model.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($delivery) {
            if (empty($delivery->tracking_number)) {
                $delivery->tracking_number = 'GHC-TRK-' . strtoupper(Str::random(10));
            }
        });
    }

    /**
     * Get the order.
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Get the rider.
     */
    public function rider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rider_id');
    }

    /**
     * Assign to rider.
     */
    public function assignToRider(int $riderId): void
    {
        $this->update([
            'rider_id' => $riderId,
            'status' => self::STATUS_ASSIGNED,
        ]);
    }

    /**
     * Update delivery status.
     */
    public function updateDeliveryStatus(string $status, ?string $location = null): void
    {
        $data = ['status' => $status];

        if ($location) {
            $data['current_location'] = $location;
        }

        if ($status === self::STATUS_PICKED_UP) {
            $data['picked_up_at'] = now();
        }

        if ($status === self::STATUS_DELIVERED) {
            $data['delivered_at'] = now();
        }

        if ($status === self::STATUS_FAILED) {
            $data['delivery_attempts'] = $this->delivery_attempts + 1;
        }

        $this->update($data);
    }

    /**
     * Update location.
     */
    public function updateLocation(float $lat, float $lng, ?string $location = null): void
    {
        $this->update([
            'current_lat' => $lat,
            'current_lng' => $lng,
            'current_location' => $location,
        ]);
    }

    /**
     * Check if delivery is completed.
     */
    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_DELIVERED;
    }

    /**
     * Get all statuses.
     */
    public static function getStatuses(): array
    {
        return [
            self::STATUS_PENDING => 'Pending',
            self::STATUS_ASSIGNED => 'Assigned to Rider',
            self::STATUS_PICKED_UP => 'Picked Up',
            self::STATUS_IN_TRANSIT => 'In Transit',
            self::STATUS_OUT_FOR_DELIVERY => 'Out for Delivery',
            self::STATUS_DELIVERED => 'Delivered',
            self::STATUS_FAILED => 'Delivery Failed',
            self::STATUS_RETURNED => 'Returned',
        ];
    }
}
