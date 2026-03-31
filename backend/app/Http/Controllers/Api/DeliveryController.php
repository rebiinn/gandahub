<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\User;
use App\Notifications\ParcelAtLogisticsStationNotification;
use App\Notifications\RiderAssignedForDeliveryNotification;
use App\Support\LogisticsCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class DeliveryController extends Controller
{
    /**
     * Get all deliveries (Admin/Rider).
     */
    public function index(Request $request)
    {
        $user = auth()->user();
        $query = Delivery::with(['order.user', 'rider']);

        // Riders only see their assigned deliveries
        if ($user->isRider()) {
            $query->where('rider_id', $user->id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('rider_id')) {
            $query->where('rider_id', $request->rider_id);
        }

        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->boolean('logistics_intake_pending')) {
            $query->whereNull('station_arrived_at')
                ->where('status', '!=', Delivery::STATUS_DELIVERED);
        }

        if ($request->boolean('logistics_after_intake')) {
            $query->whereNotNull('station_arrived_at')
                ->where('status', '!=', Delivery::STATUS_DELIVERED);
        }

        $perPage = min($request->get('per_page', 10), 50);
        $deliveries = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return $this->paginatedResponse($deliveries);
    }

    /**
     * Get delivery details.
     */
    public function show($id)
    {
        $user = auth()->user();
        $delivery = Delivery::with(['order.items', 'order.user', 'order.payment', 'rider'])->find($id);

        if (!$delivery) {
            return $this->errorResponse('Delivery not found', 404);
        }

        // Riders can only view their assigned deliveries
        if ($user->isRider() && $delivery->rider_id !== $user->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        return $this->successResponse($delivery);
    }

    /**
     * Mark delivery as arrived at logistics station and auto-assign a rider.
     */
    public function arriveAtStation(Request $request, $id)
    {
        $regionKeys = config('logistics.region_keys', []);
        $validator = Validator::make($request->all(), [
            'logistics_region' => ['required', 'string', Rule::in($regionKeys)],
            'logistics_provider' => ['required', 'string', Rule::in(config('logistics.providers', []))],
            'branch_id' => 'required|string|max:128',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $delivery = Delivery::with('order')->find($id);

        if (!$delivery) {
            return $this->errorResponse('Delivery not found', 404);
        }

        if ($delivery->station_arrived_at !== null) {
            return $this->errorResponse('This parcel was already checked in at a logistics hub', 422);
        }

        $region = $request->logistics_region;
        $provider = $request->logistics_provider;
        $branch = LogisticsCatalog::findBranch($region, $provider, $request->branch_id);

        if (! $branch) {
            return $this->errorResponse('Invalid branch for the selected region and logistics provider', 422);
        }

        $targetCity = trim((string) ($branch['city'] ?? ''));
        $targetState = trim((string) ($delivery->order?->shipping_state ?: ''));

        $stationName = $branch['name'] ?? $request->branch_id;
        $stationAddress = $branch['address'] ?? null;

        $delivery->update([
            'logistics_region' => $region,
            'logistics_provider' => $provider,
            'logistics_branch_id' => $branch['id'],
            'logistics_station_name' => $stationName,
            'logistics_station_address' => $stationAddress,
            'logistics_station_city' => $targetCity ?: null,
            'station_arrived_at' => now(),
            'status' => Delivery::STATUS_IN_TRANSIT,
            'current_location' => $this->formatStationLocation(
                $provider,
                $stationName,
                $targetCity
            ),
        ]);

        $assignedRider = $this->selectBestRiderForLocation($targetCity, $targetState);

        if ($assignedRider) {
            $delivery->update([
                'rider_id' => $assignedRider->id,
                'status' => Delivery::STATUS_ASSIGNED,
                'auto_assigned_at' => now(),
            ]);
        }

        $delivery = $delivery->fresh(['order.user', 'rider']);
        $this->notifyCustomerParcelAtLogistics($delivery);

        return $this->successResponse(
            $delivery,
            $assignedRider
                ? 'Parcel arrived at station and rider auto-assigned. Customer has been notified.'
                : 'Parcel arrived at station. No available rider for auto-assignment. Customer has been notified.'
        );
    }

    /**
     * Assign rider to delivery (Admin only).
     */
    public function assignRider(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'rider_id' => 'required|exists:users,id',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $delivery = Delivery::find($id);

        if (!$delivery) {
            return $this->errorResponse('Delivery not found', 404);
        }

        $rider = User::find($request->rider_id);

        if (!$rider->isRider()) {
            return $this->errorResponse('Selected user is not a rider', 400);
        }

        $hadRider = $delivery->rider_id !== null;
        $delivery->assignToRider($rider->id);
        $delivery = $delivery->fresh(['order.user', 'rider']);

        if (! $hadRider && $delivery->order?->user) {
            $this->safeNotify($delivery->order->user, new RiderAssignedForDeliveryNotification($delivery));
        }

        return $this->successResponse($delivery, 'Rider assigned successfully');
    }

    /**
     * Update delivery status (Rider/Admin).
     */
    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:pending,assigned,picked_up,in_transit,out_for_delivery,delivered,failed,returned',
            'location' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $user = auth()->user();
        $delivery = Delivery::find($id);

        if (!$delivery) {
            return $this->errorResponse('Delivery not found', 404);
        }

        // Riders can only update their assigned deliveries
        if ($user->isRider() && $delivery->rider_id !== $user->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $delivery->updateDeliveryStatus($request->status, $request->location);

        if ($request->notes) {
            $delivery->update(['delivery_notes' => $request->notes]);
        }

        // Sync with order status
        $order = $delivery->order;
        if ($request->status === Delivery::STATUS_DELIVERED) {
            $order->updateStatus(Order::STATUS_DELIVERED);
            $this->completeCodPaymentIfApplicable($order);
        } elseif ($request->status === Delivery::STATUS_OUT_FOR_DELIVERY) {
            $order->updateStatus(Order::STATUS_OUT_FOR_DELIVERY);
        }

        return $this->successResponse($delivery->fresh(['order', 'rider']), 'Delivery status updated');
    }

    /**
     * Update delivery location (Rider).
     */
    public function updateLocation(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'location' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $user = auth()->user();
        $delivery = Delivery::find($id);

        if (!$delivery) {
            return $this->errorResponse('Delivery not found', 404);
        }

        if ($user->isRider() && $delivery->rider_id !== $user->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $delivery->updateLocation(
            $request->latitude,
            $request->longitude,
            $request->location
        );

        return $this->successResponse($delivery, 'Location updated');
    }

    /**
     * Mark delivery as completed with proof.
     */
    public function complete(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'recipient_name' => 'required|string|max:255',
            'proof_of_delivery' => 'nullable|string', // Base64 image or file path
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $user = auth()->user();
        $delivery = Delivery::find($id);

        if (!$delivery) {
            return $this->errorResponse('Delivery not found', 404);
        }

        if ($user->isRider() && $delivery->rider_id !== $user->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $delivery->update([
            'status' => Delivery::STATUS_DELIVERED,
            'delivered_at' => now(),
            'recipient_name' => $request->recipient_name,
            'proof_of_delivery' => $request->proof_of_delivery,
            'delivery_notes' => $request->notes,
        ]);

        // Update order status (Order::updateStatus also auto-completes COD payment)
        $delivery->order->updateStatus(Order::STATUS_DELIVERED);

        return $this->successResponse($delivery->fresh(['order']), 'Delivery completed');
    }

    /**
     * Track delivery by tracking number.
     */
    public function track($trackingNumber)
    {
        $delivery = Delivery::with('order')
            ->where('tracking_number', $trackingNumber)
            ->first();

        if (!$delivery) {
            return $this->errorResponse('Delivery not found', 404);
        }

        return $this->successResponse([
            'tracking_number' => $delivery->tracking_number,
            'status' => $delivery->status,
            'status_label' => Delivery::getStatuses()[$delivery->status] ?? $delivery->status,
            'current_location' => $delivery->current_location,
            'estimated_delivery' => $delivery->estimated_delivery,
            'picked_up_at' => $delivery->picked_up_at,
            'delivered_at' => $delivery->delivered_at,
            'delivery_attempts' => $delivery->delivery_attempts,
        ]);
    }

    /**
     * Get available riders (Admin only).
     */
    public function availableRiders()
    {
        $riders = User::where('role', 'rider')
            ->where('is_active', true)
            ->get(['id', 'first_name', 'last_name', 'email', 'phone']);

        return $this->successResponse($riders);
    }

    /**
     * Get rider's delivery statistics.
     */
    public function riderStats($riderId = null)
    {
        $user = auth()->user();
        $riderId = $riderId ?? $user->id;

        if ($user->isRider() && $user->id != $riderId) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $stats = [
            'total_deliveries' => Delivery::where('rider_id', $riderId)->count(),
            'completed' => Delivery::where('rider_id', $riderId)
                ->where('status', Delivery::STATUS_DELIVERED)->count(),
            'pending' => Delivery::where('rider_id', $riderId)
                ->whereIn('status', [
                    Delivery::STATUS_ASSIGNED,
                    Delivery::STATUS_PICKED_UP,
                    Delivery::STATUS_IN_TRANSIT,
                    Delivery::STATUS_OUT_FOR_DELIVERY,
                ])->count(),
            'failed' => Delivery::where('rider_id', $riderId)
                ->where('status', Delivery::STATUS_FAILED)->count(),
            'today' => Delivery::where('rider_id', $riderId)
                ->whereDate('created_at', today())->count(),
        ];

        return $this->successResponse($stats);
    }

    protected function formatStationLocation(string $provider, string $stationName, ?string $city): string
    {
        $parts = [$provider, $stationName];
        if (!empty($city)) {
            $parts[] = $city;
        }

        return implode(' - ', $parts);
    }

    protected function selectBestRiderForLocation(?string $city, ?string $state): ?User
    {
        $normalizedCity = strtolower(trim((string) $city));
        $normalizedState = strtolower(trim((string) $state));
        $activeStatuses = [
            Delivery::STATUS_ASSIGNED,
            Delivery::STATUS_PICKED_UP,
            Delivery::STATUS_IN_TRANSIT,
            Delivery::STATUS_OUT_FOR_DELIVERY,
        ];

        $riders = User::query()
            ->where('role', 'rider')
            ->where('is_active', true)
            ->get();

        if ($riders->isEmpty()) {
            return null;
        }

        return $riders
            ->map(function (User $rider) use ($normalizedCity, $normalizedState, $activeStatuses) {
                $riderCity = strtolower(trim((string) $rider->city));
                $riderState = strtolower(trim((string) $rider->state));

                $locationScore = 0;
                if ($normalizedCity !== '' && $riderCity !== '' && $riderCity === $normalizedCity) {
                    $locationScore += 3;
                }
                if ($normalizedState !== '' && $riderState !== '' && $riderState === $normalizedState) {
                    $locationScore += 1;
                }

                $activeLoad = Delivery::query()
                    ->where('rider_id', $rider->id)
                    ->whereIn('status', $activeStatuses)
                    ->count();

                return [
                    'rider' => $rider,
                    'location_score' => $locationScore,
                    'active_load' => $activeLoad,
                ];
            })
            ->sort(function (array $a, array $b) {
                if ($a['location_score'] !== $b['location_score']) {
                    return $b['location_score'] <=> $a['location_score'];
                }

                if ($a['active_load'] !== $b['active_load']) {
                    return $a['active_load'] <=> $b['active_load'];
                }

                return $a['rider']->id <=> $b['rider']->id;
            })
            ->first()['rider'] ?? null;
    }

    protected function notifyCustomerParcelAtLogistics(Delivery $delivery): void
    {
        $user = $delivery->order?->user;
        if (! $user) {
            return;
        }
        $this->safeNotify($user, new ParcelAtLogisticsStationNotification($delivery));
    }

    protected function safeNotify(User $user, $notification): void
    {
        if (! Schema::hasTable('notifications')) {
            return;
        }
        try {
            $user->notify($notification);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('User notification failed', [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
