<?php

namespace App\Notifications;

use App\Models\Delivery;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ParcelAtLogisticsStationNotification extends Notification implements ShouldQueue
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
        $provider = $this->delivery->logistics_provider ?? 'Logistics partner';
        $branch = $this->delivery->logistics_station_name ?? 'station';

        $message = "Your parcel for order {$orderNum} has arrived at {$provider} ({$branch}). ";
        if ($rider) {
            $message .= 'Our rider '.$rider->full_name.' has been assigned for last-mile delivery to your address.';
        } else {
            $message .= 'A rider will be assigned shortly for delivery to your address.';
        }

        return [
            'type' => 'parcel_at_logistics',
            'message' => $message,
            'order_id' => $order?->id,
            'order_number' => $orderNum,
            'delivery_id' => $this->delivery->id,
            'tracking_number' => $this->delivery->tracking_number,
            'logistics_provider' => $this->delivery->logistics_provider,
            'logistics_region' => $this->delivery->logistics_region,
            'link' => $order ? '/orders/'.$order->id : '/orders',
        ];
    }
}
