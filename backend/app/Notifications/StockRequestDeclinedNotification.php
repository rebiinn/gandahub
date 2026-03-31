<?php

namespace App\Notifications;

use App\Models\StockRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class StockRequestDeclinedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public StockRequest $stockRequest
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $product = $this->stockRequest->product;
        $store = $this->stockRequest->store;

        return [
            'type' => 'stock_request_declined',
            'message' => sprintf(
                '%s declined your stock request for %s%s',
                $store ? $store->name : 'Supplier',
                $product ? $product->name : 'a product',
                $this->stockRequest->supplier_notes ? ': ' . $this->stockRequest->supplier_notes : ''
            ),
            'stock_request_id' => $this->stockRequest->id,
            'product_id' => $this->stockRequest->product_id,
            'product_name' => $product?->name,
            'store_name' => $store?->name,
            'supplier_notes' => $this->stockRequest->supplier_notes,
            'link' => '/admin/inventory',
        ];
    }
}

