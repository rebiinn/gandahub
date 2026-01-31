<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    /**
     * Upload an image file.
     * Supports both local storage and Cloudinary (for production).
     */
    public function uploadImage(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:5120', // Max 5MB
            'folder' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        try {
            $file = $request->file('image');
            $folder = $request->input('folder', 'products');

            // Check if Cloudinary is configured (for production)
            if ($this->isCloudinaryConfigured()) {
                $result = $this->uploadToCloudinary($file, $folder);
                return $this->successResponse($result, 'Image uploaded successfully');
            }
            
            // Fallback to local storage (for development)
            $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs($folder, $filename, 'public');
            $url = url('storage/' . $path);

            return $this->successResponse([
                'url' => $url,
                'path' => $path,
                'filename' => $filename,
            ], 'Image uploaded successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to upload image: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Check if Cloudinary is configured.
     */
    private function isCloudinaryConfigured(): bool
    {
        return !empty(env('CLOUDINARY_CLOUD_NAME')) 
            && !empty(env('CLOUDINARY_API_KEY')) 
            && !empty(env('CLOUDINARY_API_SECRET'));
    }

    /**
     * Upload image to Cloudinary.
     */
    private function uploadToCloudinary($file, string $folder): array
    {
        $cloudName = env('CLOUDINARY_CLOUD_NAME');
        $apiKey = env('CLOUDINARY_API_KEY');
        $apiSecret = env('CLOUDINARY_API_SECRET');
        
        $timestamp = time();
        $params = [
            'folder' => 'gandahub/' . $folder,
            'timestamp' => $timestamp,
        ];
        
        // Generate signature
        ksort($params);
        $signatureString = http_build_query($params) . $apiSecret;
        $signature = sha1($signatureString);
        
        $response = Http::attach(
            'file', file_get_contents($file->getRealPath()), $file->getClientOriginalName()
        )->post("https://api.cloudinary.com/v1_1/{$cloudName}/image/upload", [
            'api_key' => $apiKey,
            'timestamp' => $timestamp,
            'signature' => $signature,
            'folder' => 'gandahub/' . $folder,
        ]);
        
        if ($response->successful()) {
            $data = $response->json();
            return [
                'url' => $data['secure_url'],
                'path' => $data['public_id'],
                'filename' => $data['original_filename'] . '.' . $data['format'],
            ];
        }
        
        throw new \Exception('Cloudinary upload failed: ' . $response->body());
    }

    /**
     * Upload multiple images.
     */
    public function uploadMultiple(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'images' => 'required|array|max:10',
            'images.*' => 'image|mimes:jpeg,png,jpg,gif,webp|max:5120',
            'folder' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        try {
            $folder = $request->input('folder', 'products');
            $uploadedFiles = [];

            foreach ($request->file('images') as $file) {
                $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
                $path = $file->storeAs($folder, $filename, 'public');
                
                $uploadedFiles[] = [
                    'url' => url('storage/' . $path),
                    'path' => $path,
                    'filename' => $filename,
                ];
            }

            return $this->successResponse($uploadedFiles, 'Images uploaded successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to upload images: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Delete an uploaded file.
     */
    public function delete(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'path' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        try {
            $path = $request->input('path');
            
            if (Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);
                return $this->successResponse(null, 'File deleted successfully');
            }

            return $this->errorResponse('File not found', 404);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to delete file: ' . $e->getMessage(), 500);
        }
    }
}
