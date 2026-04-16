<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SellerApplication;
use App\Models\Store;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class SellerApplicationController extends Controller
{
    private const STAFF_EMAIL_DOMAIN = 'gandahub.com';

    private function normalizeStaffEmail(?string $value): string
    {
        $raw = strtolower(trim((string) $value));
        if ($raw === '') {
            return '';
        }
        $localPart = strstr($raw, '@', true);
        if ($localPart === false) {
            $localPart = $raw;
        }

        return $localPart . '@' . self::STAFF_EMAIL_DOMAIN;
    }

    private function uniqueStoreSlug(string $storeName): string
    {
        $base = Str::slug($storeName);
        if ($base === '') {
            $base = 'store';
        }

        $slug = $base;
        $counter = 2;
        while (Store::where('slug', $slug)->exists()) {
            $slug = $base . '-' . $counter;
            $counter++;
        }

        return $slug;
    }

    public function store(Request $request)
    {
        $request->merge([
            'email' => $this->normalizeStaffEmail($request->input('email')),
        ]);

        $validator = Validator::make($request->all(), [
            'store_name' => 'required|string|max:255',
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'phone' => 'required|string|max:20',
            'address' => 'required|string|max:1000',
            'city' => 'required|string|max:255',
            'state' => 'nullable|string|max:255',
            'zip_code' => 'nullable|string|max:20',
            'message' => 'nullable|string|max:1000',
            'document_path' => 'nullable|string|max:500',
            'document_name' => 'nullable|string|max:255',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $email = (string) $request->input('email');
        if (User::where('email', $email)->exists()) {
            return $this->errorResponse('This email is already registered. Please log in instead.', 422);
        }

        $existingPending = SellerApplication::where('email', $email)
            ->where('status', SellerApplication::STATUS_PENDING)
            ->exists();
        if ($existingPending) {
            return $this->errorResponse('You already have a pending seller application.', 422);
        }

        $application = SellerApplication::create([
            'store_name' => $request->store_name,
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'email' => $email,
            'phone' => $request->phone,
            'address' => $request->address,
            'city' => $request->city,
            'state' => $request->state,
            'zip_code' => $request->zip_code,
            'message' => $request->message,
            'document_path' => $request->input('document_path'),
            'document_name' => $request->input('document_name'),
            'password_hash' => Hash::make($request->password),
            'status' => SellerApplication::STATUS_PENDING,
        ]);

        return $this->successResponse(
            $application,
            'Seller application submitted. Admin will review your request.'
        );
    }

    public function index(Request $request)
    {
        $query = SellerApplication::query()->with([
            'reviewer:id,first_name,last_name',
            'approvedUser:id,email',
            'approvedStore:id,name,slug',
        ]);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('store_name', 'like', "%{$search}%")
                    ->orWhere('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $perPage = min((int) $request->get('per_page', 10), 50);
        $applications = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return $this->paginatedResponse($applications);
    }

    public function approve(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'review_note' => 'nullable|string|max:1000',
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $application = SellerApplication::find($id);
        if (!$application) {
            return $this->errorResponse('Seller application not found', 404);
        }
        if ($application->status !== SellerApplication::STATUS_PENDING) {
            return $this->errorResponse('This application was already reviewed', 422);
        }

        if (User::where('email', $application->email)->exists()) {
            return $this->errorResponse('Cannot approve because the email is already registered.', 422);
        }

        DB::beginTransaction();
        try {
            $user = User::create([
                'first_name' => $application->first_name,
                'last_name' => $application->last_name,
                'email' => $application->email,
                'password' => $application->password_hash,
                'phone' => $application->phone,
                'address' => $application->address,
                'city' => $application->city,
                'state' => $application->state,
                'zip_code' => $application->zip_code,
                'role' => 'supplier',
                'is_active' => true,
            ]);

            $store = Store::create([
                'user_id' => $user->id,
                'name' => $application->store_name,
                'slug' => $this->uniqueStoreSlug($application->store_name),
                'description' => $application->message,
                'address' => $application->address,
                'phone' => $application->phone,
                'is_active' => true,
            ]);

            $application->update([
                'status' => SellerApplication::STATUS_APPROVED,
                'review_note' => $request->input('review_note'),
                'reviewed_at' => now(),
                'reviewed_by' => auth()->id(),
                'approved_user_id' => $user->id,
                'approved_store_id' => $store->id,
            ]);

            DB::commit();

            return $this->successResponse(
                $application->fresh(['approvedUser:id,email,role,is_active', 'approvedStore:id,name,slug']),
                'Seller application approved. Supplier account and store created.'
            );
        } catch (\Throwable $e) {
            DB::rollBack();
            return $this->errorResponse('Failed to approve application: ' . $e->getMessage(), 500);
        }
    }

    public function reject(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'review_note' => 'nullable|string|max:1000',
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $application = SellerApplication::find($id);
        if (!$application) {
            return $this->errorResponse('Seller application not found', 404);
        }
        if ($application->status !== SellerApplication::STATUS_PENDING) {
            return $this->errorResponse('This application was already reviewed', 422);
        }

        $application->update([
            'status' => SellerApplication::STATUS_REJECTED,
            'review_note' => $request->input('review_note'),
            'reviewed_at' => now(),
            'reviewed_by' => auth()->id(),
        ]);

        return $this->successResponse($application, 'Seller application rejected.');
    }
}

