<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class CustomerOrderStatusNotification extends Notification
{
    use Queueable;

    public function __construct(
        public int $orderId,
        public string $orderNumber,
        public string $message,
        public string $link,
        public string $status
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'message' => $this->message,
            'link' => $this->link,
            'order_id' => $this->orderId,
            'order_number' => $this->orderNumber,
            'status' => $this->status,
        ];
    }
}
