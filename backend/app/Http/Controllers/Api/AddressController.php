<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserAddress;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class AddressController extends Controller
{
    /**
     * List authenticated user's saved addresses.
     */
    public function index()
    {
        $addresses = Auth::user()->addresses()->orderBy('is_default', 'desc')->orderBy('updated_at', 'desc')->get();
        return $this->successResponse($addresses);
    }

    /**
     * Store a new address.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'label' => 'nullable|string|in:home,work,other|max:50',
            'address' => 'required|string|max:255',
            'city' => 'required|string|max:255',
            'state' => 'nullable|string|max:255',
            'zip_code' => 'required|string|max:20',
            'country' => 'nullable|string|max:255',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'is_default' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        $user = Auth::user();
        $data = $validator->validated();
        $data['label'] = $data['label'] ?? 'home';
        $data['country'] = $data['country'] ?? 'Philippines';

        if (!empty($data['is_default'])) {
            $user->addresses()->update(['is_default' => false]);
        }

        $address = $user->addresses()->create($data);
        return $this->successResponse($address, 'Address saved.', 201);
    }

    /**
     * Update an address.
     */
    public function update(Request $request, $id)
    {
        $address = Auth::user()->addresses()->find($id);
        if (!$address) {
            return $this->errorResponse('Address not found.', 404);
        }

        $validator = Validator::make($request->all(), [
            'label' => 'nullable|string|in:home,work,other|max:50',
            'address' => 'sometimes|required|string|max:255',
            'city' => 'sometimes|required|string|max:255',
            'state' => 'nullable|string|max:255',
            'zip_code' => 'sometimes|required|string|max:20',
            'country' => 'nullable|string|max:255',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'is_default' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        $data = $validator->validated();
        if (!empty($data['is_default'])) {
            Auth::user()->addresses()->where('id', '!=', $id)->update(['is_default' => false]);
        }

        $address->update($data);
        return $this->successResponse($address->fresh(), 'Address updated.');
    }

    /**
     * Delete an address.
     */
    public function destroy($id)
    {
        $address = Auth::user()->addresses()->find($id);
        if (!$address) {
            return $this->errorResponse('Address not found.', 404);
        }
        $address->delete();
        return $this->successResponse(null, 'Address removed.');
    }

    /**
     * Set address as default.
     */
    public function setDefault($id)
    {
        $address = Auth::user()->addresses()->find($id);
        if (!$address) {
            return $this->errorResponse('Address not found.', 404);
        }
        Auth::user()->addresses()->update(['is_default' => false]);
        $address->update(['is_default' => true]);
        return $this->successResponse($address->fresh(), 'Default address updated.');
    }
}
