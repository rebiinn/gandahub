<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'generated_by',
        'name',
        'type',
        'parameters',
        'data',
        'date_from',
        'date_to',
        'file_path',
        'status',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'parameters' => 'array',
        'data' => 'array',
        'date_from' => 'date',
        'date_to' => 'date',
    ];

    /**
     * Report types.
     */
    const TYPE_SALES = 'sales';
    const TYPE_INVENTORY = 'inventory';
    const TYPE_CUSTOMERS = 'customers';
    const TYPE_ORDERS = 'orders';
    const TYPE_DELIVERIES = 'deliveries';
    const TYPE_REVENUE = 'revenue';
    const TYPE_PRODUCTS = 'products';
    const TYPE_CUSTOM = 'custom';

    /**
     * Report statuses.
     */
    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';

    /**
     * Get the user who generated the report.
     */
    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    /**
     * Mark report as processing.
     */
    public function markAsProcessing(): void
    {
        $this->update(['status' => self::STATUS_PROCESSING]);
    }

    /**
     * Mark report as completed.
     */
    public function markAsCompleted(?array $data = null, ?string $filePath = null): void
    {
        $this->update([
            'status' => self::STATUS_COMPLETED,
            'data' => $data,
            'file_path' => $filePath,
        ]);
    }

    /**
     * Mark report as failed.
     */
    public function markAsFailed(): void
    {
        $this->update(['status' => self::STATUS_FAILED]);
    }

    /**
     * Get all report types.
     */
    public static function getTypes(): array
    {
        return [
            self::TYPE_SALES => 'Sales Report',
            self::TYPE_INVENTORY => 'Inventory Report',
            self::TYPE_CUSTOMERS => 'Customers Report',
            self::TYPE_ORDERS => 'Orders Report',
            self::TYPE_DELIVERIES => 'Deliveries Report',
            self::TYPE_REVENUE => 'Revenue Report',
            self::TYPE_PRODUCTS => 'Products Report',
            self::TYPE_CUSTOM => 'Custom Report',
        ];
    }
}
