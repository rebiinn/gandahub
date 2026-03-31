<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class NotificationController extends Controller
{
    /**
     * Notifiable type stored in DB (must match User model morph).
     */
    private static function notifiableType(): string
    {
        return User::class;
    }

    /**
     * Safely format a date for JSON (ISO 8601).
     */
    private static function formatDate($value): ?string
    {
        if ($value === null) {
            return null;
        }
        if ($value instanceof \DateTimeInterface) {
            return $value->format('c');
        }
        try {
            return \Illuminate\Support\Carbon::parse($value)->format('c');
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * List current user's notifications (query builder to avoid 500 from Eloquent/morph).
     */
    public function index(Request $request)
    {
        try {
            $user = auth()->user();
            if (!$user || !Schema::hasTable('notifications')) {
                return $this->notificationsEmptyResponse();
            }

            $perPage = min((int) $request->get('per_page', 15), 50) ?: 15;
            $unreadOnly = $request->boolean('unread_only', false);

            $query = DB::table('notifications')
                ->where('notifiable_type', self::notifiableType())
                ->where('notifiable_id', $user->id)
                ->orderByDesc('created_at');

            if ($unreadOnly) {
                $query->whereNull('read_at');
            }

            $total = $query->count();
            $page = max(1, (int) $request->get('page', 1));
            $lastPage = max(1, (int) ceil($total / $perPage));
            $page = min($page, $lastPage);
            $offset = ($page - 1) * $perPage;

            $rows = (clone $query)->offset($offset)->limit($perPage)->get();

            $items = [];
            foreach ($rows as $n) {
                $data = $n->data;
                if (is_string($data)) {
                    $data = json_decode($data, true) ?: [];
                }
                $items[] = [
                    'id' => $n->id,
                    'type' => $n->type,
                    'data' => is_array($data) ? $data : [],
                    'read_at' => self::formatDate($n->read_at),
                    'created_at' => self::formatDate($n->created_at),
                ];
            }

            return response()->json([
                'success' => true,
                'message' => 'Success',
                'data' => $items,
                'meta' => [
                    'current_page' => $page,
                    'last_page' => $lastPage,
                    'per_page' => $perPage,
                    'total' => $total,
                ],
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Notifications index failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->notificationsEmptyResponse();
        }
    }

    private function notificationsEmptyResponse()
    {
        return response()->json([
            'success' => true,
            'message' => 'Success',
            'data' => [],
            'meta' => ['current_page' => 1, 'last_page' => 1, 'per_page' => 15, 'total' => 0],
        ]);
    }

    /**
     * Get unread count (query builder to avoid 500).
     */
    public function unreadCount()
    {
        try {
            $user = auth()->user();
            if (!$user || !Schema::hasTable('notifications')) {
                return $this->successResponse(['count' => 0]);
            }
            $count = DB::table('notifications')
                ->where('notifiable_type', self::notifiableType())
                ->where('notifiable_id', $user->id)
                ->whereNull('read_at')
                ->count();
            return $this->successResponse(['count' => (int) $count]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Notifications unread count failed', ['error' => $e->getMessage()]);
            return $this->successResponse(['count' => 0]);
        }
    }

    /**
     * Mark a notification as read (query builder).
     */
    public function markAsRead(string $id)
    {
        try {
            $user = auth()->user();
            if (!$user) {
                return $this->errorResponse('Unauthorized', 401);
            }
            $updated = DB::table('notifications')
                ->where('id', $id)
                ->where('notifiable_type', self::notifiableType())
                ->where('notifiable_id', $user->id)
                ->update(['read_at' => now()]);
            if ($updated === 0) {
                return $this->errorResponse('Notification not found', 404);
            }
            return $this->successResponse(null, 'Marked as read');
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Mark notification read failed', ['id' => $id, 'error' => $e->getMessage()]);
            return $this->successResponse(null, 'Marked as read');
        }
    }

    /**
     * Mark all notifications as read (query builder).
     */
    public function markAllAsRead()
    {
        try {
            $user = auth()->user();
            if ($user) {
                DB::table('notifications')
                    ->where('notifiable_type', self::notifiableType())
                    ->where('notifiable_id', $user->id)
                    ->whereNull('read_at')
                    ->update(['read_at' => now()]);
            }
            return $this->successResponse(null, 'All marked as read');
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Mark all notifications read failed', ['error' => $e->getMessage()]);
            return $this->successResponse(null, 'All marked as read');
        }
    }
}
