<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class NewsletterController extends Controller
{
    /**
     * List newsletter subscribers (admin). Paginated.
     */
    public function index(Request $request)
    {
        $perPage = (int) $request->get('per_page', 20);
        $perPage = min(max($perPage, 5), 100);
        $subscribers = NewsletterSubscriber::orderBy('subscribed_at', 'desc')
            ->paginate($perPage);
        return $this->successResponse($subscribers);
    }

    /**
     * Subscribe an email to the newsletter (public).
     */
    public function subscribe(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Please enter a valid email address.', 422, $validator->errors());
        }

        $email = strtolower(trim($request->email));

        $existing = NewsletterSubscriber::where('email', $email)->first();
        if ($existing) {
            return $this->successResponse(
                ['email' => $email],
                'You are already subscribed! We\'ll keep you updated.'
            );
        }

        NewsletterSubscriber::create([
            'email' => $email,
        ]);

        return $this->successResponse(
            ['email' => $email],
            'You\'re on the list! We\'ll send exclusive deals and beauty tips when we have them.',
            201
        );
    }
}
