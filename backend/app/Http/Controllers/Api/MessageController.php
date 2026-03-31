<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class MessageController extends Controller
{
    /**
     * Get conversations for supplier (their store's conversations) or customer (their conversations).
     */
    public function index(Request $request)
    {
        $user = auth()->user();

        if ($user->isSupplier()) {
            $store = Store::where('user_id', $user->id)->first();
            if (!$store) {
                return $this->successResponse([]);
            }
            $conversations = Conversation::with(['user', 'messages' => fn($q) => $q->latest()->limit(1)])
                ->where('store_id', $store->id)
                ->orderBy('updated_at', 'desc')
                ->paginate(15);
            return $this->paginatedResponse($conversations);
        }

        if ($user->isCustomer()) {
            $conversations = Conversation::with(['store', 'messages' => fn($q) => $q->latest()->limit(1)])
                ->where('user_id', $user->id)
                ->orderBy('updated_at', 'desc')
                ->paginate(15);
            return $this->paginatedResponse($conversations);
        }

        return $this->errorResponse('Unauthorized', 403);
    }

    /**
     * Get or create conversation with a store (customer) or get conversation by id (supplier).
     */
    public function getOrCreate(Request $request)
    {
        $user = auth()->user();

        if ($user->isCustomer()) {
            $validator = Validator::make($request->all(), [
                'store_id' => 'required|exists:stores,id',
            ]);
            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, $validator->errors());
            }
            $conversation = Conversation::firstOrCreate(
                ['user_id' => $user->id, 'store_id' => $request->store_id],
                ['order_id' => $request->order_id]
            );
            $conversation->load(['store', 'messages']);
            return $this->successResponse($conversation);
        }

        if ($user->isSupplier()) {
            $store = Store::where('user_id', $user->id)->first();
            if (!$store) {
                return $this->errorResponse('Store not found', 404);
            }
            $validator = Validator::make($request->all(), [
                'conversation_id' => 'required|exists:conversations,id',
            ]);
            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, $validator->errors());
            }
            $conversation = Conversation::with(['user', 'messages'])
                ->where('id', $request->conversation_id)
                ->where('store_id', $store->id)
                ->first();
            if (!$conversation) {
                return $this->errorResponse('Conversation not found', 404);
            }
            return $this->successResponse($conversation);
        }

        return $this->errorResponse('Unauthorized', 403);
    }

    /**
     * Send a message. Customer sends to store, supplier sends to customer.
     */
    public function store(Request $request)
    {
        $user = auth()->user();
        $validator = Validator::make($request->all(), [
            'conversation_id' => 'required|exists:conversations,id',
            'body' => 'required|string|max:5000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $conversation = Conversation::find($request->conversation_id);

        if ($user->isCustomer()) {
            if ($conversation->user_id !== $user->id) {
                return $this->errorResponse('Unauthorized', 403);
            }
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'sender_type' => Message::SENDER_CUSTOMER,
                'sender_id' => $user->id,
                'body' => $request->body,
            ]);
        } elseif ($user->isSupplier()) {
            $store = Store::where('user_id', $user->id)->first();
            if (!$store || $conversation->store_id !== $store->id) {
                return $this->errorResponse('Unauthorized', 403);
            }
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'sender_type' => Message::SENDER_STORE,
                'sender_id' => $store->id,
                'body' => $request->body,
            ]);
        } else {
            return $this->errorResponse('Unauthorized', 403);
        }

        $conversation->touch();
        $message->load('conversation');

        return $this->successResponse($message, 'Message sent', 201);
    }

    /**
     * Get messages for a conversation.
     */
    public function messages($conversationId)
    {
        $user = auth()->user();
        $conversation = Conversation::with('messages')->find($conversationId);

        if (!$conversation) {
            return $this->errorResponse('Conversation not found', 404);
        }

        if ($user->isCustomer()) {
            if ($conversation->user_id !== $user->id) {
                return $this->errorResponse('Unauthorized', 403);
            }
        } elseif ($user->isSupplier()) {
            $store = Store::where('user_id', $user->id)->first();
            if (!$store || $conversation->store_id !== $store->id) {
                return $this->errorResponse('Unauthorized', 403);
            }
        } else {
            return $this->errorResponse('Unauthorized', 403);
        }

        return $this->successResponse($conversation->messages);
    }
}
