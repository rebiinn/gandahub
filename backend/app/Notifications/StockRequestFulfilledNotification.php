<?php

namespace App\Notifications;

use App\Models\StockRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StockRequestFulfilledNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public StockRequest $stockRequest
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Get the array representation of the notification for the database.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $product = $this->stockRequest->product;
        $store = $this->stockRequest->store;
        return [
            'type' => 'stock_request_fulfilled',
            'message' => sprintf(
                '%s has fulfilled your stock request: %d units of %s have been added to inventory.',
                $store ? $store->name : 'Supplier',
                $this->stockRequest->quantity_fulfilled,
                $product ? $product->name : 'product'
            ),
            'stock_request_id' => $this->stockRequest->id,
            'product_id' => $this->stockRequest->product_id,
            'product_name' => $product?->name,
            'store_name' => $store?->name,
            'quantity_fulfilled' => $this->stockRequest->quantity_fulfilled,
            'link' => '/admin/inventory',
        ];
    }
}
