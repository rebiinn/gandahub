<?php

namespace App\Notifications;

use App\Models\Delivery;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class RiderAssignedForDeliveryNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Delivery $delivery
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $this->delivery->loadMissing(['order', 'rider']);
        $order = $this->delivery->order;
        $rider = $this->delivery->rider;
        $orderNum = $order?->order_number ?? '';
        $riderName = $rider?->full_name ?? 'A rider';

        return [
            'type' => 'rider_assigned',
            'message' => "{$riderName} has been assigned to deliver your order {$orderNum}.",
            'order_id' => $order?->id,
            'order_number' => $orderNum,
            'delivery_id' => $this->delivery->id,
            'rider_name' => $riderName,
            'link' => $order ? '/orders/'.$order->id : '/orders',
        ];
    }
}
