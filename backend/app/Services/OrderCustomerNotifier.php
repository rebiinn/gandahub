<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\Delivery;
use App\Models\Message;
use App\Models\Order;
use App\Models\Store;
use App\Models\User;
use App\Notifications\CustomerOrderStatusNotification;

class OrderCustomerNotifier
{
    /**
     * Notify the customer when the order status changes (in-app database notification).
     * Also sends a store message asking for product ratings when the order is delivered.
     */
    public static function notifyStatusChange(Order $order, string $previousStatus, string $newStatus): void
    {
        $notifyStatuses = [
            Order::STATUS_CONFIRMED,
            Order::STATUS_PROCESSING,
            Order::STATUS_SHIPPED,
            Order::STATUS_OUT_FOR_DELIVERY,
            Order::STATUS_DELIVERED,
        ];

        if (! in_array($newStatus, $notifyStatuses, true)) {
            return;
        }

        if ($previousStatus === $newStatus) {
            return;
        }

        $order->loadMissing(['user', 'items.product']);

        $customer = $order->user;
        if (! $customer instanceof User) {
            return;
        }

        $label = self::statusLabel($newStatus);
        $num = $order->order_number;
        $base = "Order {$num}: {$label}.";

        $message = match ($newStatus) {
            Order::STATUS_CONFIRMED => "{$base} The seller has confirmed your order.",
            Order::STATUS_PROCESSING => "{$base} Your items are being prepared.",
            Order::STATUS_SHIPPED => "{$base} Your package is on the way.",
            Order::STATUS_OUT_FOR_DELIVERY => "{$base} Your package is out for delivery.",
            Order::STATUS_DELIVERED => "{$base} Enjoy your purchase — we'd love your feedback on your items.",
            default => $base,
        };

        $link = '/orders/' . $order->id . ($newStatus === Order::STATUS_DELIVERED ? '#rate-products' : '');

        $customer->notify(new CustomerOrderStatusNotification(
            (int) $order->id,
            (string) $order->order_number,
            $message,
            $link,
            $newStatus
        ));

        if ($newStatus === Order::STATUS_DELIVERED) {
            self::sendRateReminderMessages($order);
        }
    }

    /**
     * Notify the customer when the rider updates delivery milestones (pickup, in transit, etc.).
     * Skips statuses that already trigger {@see notifyStatusChange} via Order::updateStatus
     * (out_for_delivery, delivered) to avoid duplicate notifications.
     */
    public static function notifyRiderDeliveryMilestone(
        Delivery $delivery,
        string $previousDeliveryStatus,
        string $newDeliveryStatus
    ): void {
        if ($newDeliveryStatus === $previousDeliveryStatus) {
            return;
        }

        if (in_array($newDeliveryStatus, [Delivery::STATUS_OUT_FOR_DELIVERY, Delivery::STATUS_DELIVERED], true)) {
            return;
        }

        $notifyStatuses = [
            Delivery::STATUS_ASSIGNED,
            Delivery::STATUS_PICKED_UP,
            Delivery::STATUS_IN_TRANSIT,
            Delivery::STATUS_FAILED,
            Delivery::STATUS_RETURNED,
        ];

        if (! in_array($newDeliveryStatus, $notifyStatuses, true)) {
            return;
        }

        $delivery->loadMissing(['order.user']);
        $order = $delivery->order;
        if (! $order instanceof Order) {
            return;
        }

        $customer = $order->user;
        if (! $customer instanceof User) {
            return;
        }

        $num = $order->order_number;
        $trk = $delivery->tracking_number;
        $trkBit = $trk ? " Tracking: {$trk}." : '';

        $message = match ($newDeliveryStatus) {
            Delivery::STATUS_ASSIGNED => "Order {$num}: A rider is assigned to your delivery.{$trkBit}",
            Delivery::STATUS_PICKED_UP => "Order {$num}: Your package has been picked up by the rider and is on the way.{$trkBit}",
            Delivery::STATUS_IN_TRANSIT => "Order {$num}: Your package is in transit.{$trkBit}",
            Delivery::STATUS_FAILED => "Order {$num}: There was an issue with your delivery. Our team or the seller may follow up with you.{$trkBit}",
            Delivery::STATUS_RETURNED => "Order {$num}: Your package was returned to the hub or seller.{$trkBit}",
            default => "Order {$num}: Delivery update ({$newDeliveryStatus}).{$trkBit}",
        };

        $link = '/orders/' . $order->id;
        $payloadStatus = 'delivery_' . $newDeliveryStatus;

        $customer->notify(new CustomerOrderStatusNotification(
            (int) $order->id,
            (string) $order->order_number,
            $message,
            $link,
            $payloadStatus
        ));
    }

    private static function statusLabel(string $status): string
    {
        return match ($status) {
            Order::STATUS_CONFIRMED => 'Confirmed',
            Order::STATUS_PROCESSING => 'Processing',
            Order::STATUS_SHIPPED => 'Shipped',
            Order::STATUS_OUT_FOR_DELIVERY => 'Out for delivery',
            Order::STATUS_DELIVERED => 'Delivered',
            default => ucfirst(str_replace('_', ' ', $status)),
        };
    }

    /**
     * Auto message from each seller store asking the customer to rate products (after delivery).
     */
    public static function sendRateReminderMessages(Order $order): void
    {
        $order->loadMissing(['items.product']);

        $storeIds = $order->items->map(fn ($item) => $item->product?->store_id)->filter()->unique();

        foreach ($storeIds as $storeId) {
            $store = Store::find($storeId);
            if (! $store) {
                continue;
            }

            $productNames = $order->items
                ->filter(fn ($item) => $item->product && (int) $item->product->store_id === (int) $storeId)
                ->map(fn ($item) => $item->product_name)
                ->filter()
                ->unique()
                ->values();

            $itemsList = $productNames->isEmpty()
                ? 'your items'
                : $productNames->take(3)->implode(', ') . ($productNames->count() > 3 ? ', and more' : '');

            $storeName = $store->name ?? 'our store';
            $rateUrl = rtrim((string) config('app.frontend_url'), '/') . '/orders/' . $order->id . '#rate-products';
            $body = "Your order {$order->order_number} from {$storeName} has been delivered. "
                . "How was {$itemsList}? Please take a moment to rate your purchase — it helps us and other shoppers."
                . "\n\nRate your products here: {$rateUrl}";

            $conversation = Conversation::firstOrCreate(
                ['user_id' => $order->user_id, 'store_id' => $storeId],
                ['order_id' => $order->id]
            );

            Message::create([
                'conversation_id' => $conversation->id,
                'sender_type' => Message::SENDER_STORE,
                'sender_id' => $storeId,
                'body' => $body,
            ]);
        }
    }
}
