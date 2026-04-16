<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RiderApplication;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class RiderApplicationController extends Controller
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

    public function store(Request $request)
    {
        $request->merge([
            'email' => $this->normalizeStaffEmail($request->input('email')),
        ]);

        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'phone' => 'required|string|max:20',
            'address' => 'required|string|max:1000',
            'city' => 'required|string|max:255',
            'state' => 'nullable|string|max:255',
            'zip_code' => 'nullable|string|max:20',
            'message' => 'nullable|string|max:1000',
            'document_path' => 'required|string|max:500',
            'document_name' => 'required|string|max:255',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $email = (string) $request->input('email');
        if (User::where('email', $email)->exists()) {
            return $this->errorResponse('This email is already registered. Please log in instead.', 422);
        }

        $existingPending = RiderApplication::where('email', $email)
            ->where('status', RiderApplication::STATUS_PENDING)
            ->exists();
        if ($existingPending) {
            return $this->errorResponse('You already have a pending driver application.', 422);
        }

        $application = RiderApplication::create([
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
            'status' => RiderApplication::STATUS_PENDING,
        ]);

        return $this->successResponse(
            $application,
            'Driver application submitted. Admin will review your request.'
        );
    }

    public function index(Request $request)
    {
        $query = RiderApplication::query()->with(['reviewer:id,first_name,last_name', 'approvedUser:id,email']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
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

        $application = RiderApplication::find($id);
        if (!$application) {
            return $this->errorResponse('Driver application not found', 404);
        }
        if ($application->status !== RiderApplication::STATUS_PENDING) {
            return $this->errorResponse('This application was already reviewed', 422);
        }

        $existingUser = User::withTrashed()->where('email', $application->email)->first();
        if ($existingUser && !$existingUser->trashed()) {
            return $this->errorResponse(
                'Cannot approve this application because the email already exists in the system.',
                422
            );
        }

        DB::beginTransaction();
        try {
            if ($existingUser && $existingUser->trashed()) {
                $existingUser->restore();
                $existingUser->update([
                    'first_name' => $application->first_name,
                    'last_name' => $application->last_name,
                    'password' => $application->password_hash,
                    'phone' => $application->phone,
                    'address' => $application->address,
                    'city' => $application->city,
                    'state' => $application->state,
                    'zip_code' => $application->zip_code,
                    'role' => 'rider',
                    'is_active' => true,
                ]);
                $user = $existingUser->fresh();
            } else {
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
                    'role' => 'rider',
                    'is_active' => true,
                ]);
            }

            $application->update([
                'status' => RiderApplication::STATUS_APPROVED,
                'review_note' => $request->input('review_note'),
                'reviewed_at' => now(),
                'reviewed_by' => auth()->id(),
                'approved_user_id' => $user->id,
            ]);

            DB::commit();

            return $this->successResponse(
                $application->fresh(['approvedUser:id,email,role,is_active']),
                'Driver application approved. Rider account created.'
            );
        } catch (QueryException $e) {
            DB::rollBack();
            if ((int) $e->getCode() === 23000) {
                return $this->errorResponse(
                    'Cannot approve this application because the rider email already exists.',
                    422
                );
            }
            return $this->errorResponse('Failed to approve application: ' . $e->getMessage(), 500);
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

        $application = RiderApplication::find($id);
        if (!$application) {
            return $this->errorResponse('Driver application not found', 404);
        }
        if ($application->status !== RiderApplication::STATUS_PENDING) {
            return $this->errorResponse('This application was already reviewed', 422);
        }

        $application->update([
            'status' => RiderApplication::STATUS_REJECTED,
            'review_note' => $request->input('review_note'),
            'reviewed_at' => now(),
            'reviewed_by' => auth()->id(),
        ]);

        return $this->successResponse($application, 'Driver application rejected.');
    }
}

