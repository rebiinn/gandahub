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
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        $validator = Validator::make($request->all(), [
            'image' => [
                'required',
                'file',
                'max:5120', // 5MB
                function ($attribute, $value, $fail) use ($allowedExtensions) {
                    if (!$value->isValid()) {
                        $fail('The file upload failed.');
                        return;
                    }
                    $ext = strtolower($value->getClientOriginalExtension());
                    if (!in_array($ext, $allowedExtensions)) {
                        $fail('The image must be JPEG, PNG, GIF, or WebP.');
                    }
                },
            ],
            'folder' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        try {
            $file = $request->file('image');
            $folder = $request->input('folder', 'products');

            $cloudName = config('cloudinary.cloud_name') ?: getenv('CLOUDINARY_CLOUD_NAME');
            $apiKey = config('cloudinary.api_key') ?: getenv('CLOUDINARY_API_KEY');
            $apiSecret = config('cloudinary.api_secret') ?: getenv('CLOUDINARY_API_SECRET');

            // Try Cloudinary only when all three credentials are set
            if (!empty($cloudName) && !empty($apiKey) && !empty($apiSecret)) {
                try {
                    $result = $this->uploadToCloudinary($file, $folder);
                    return $this->successResponse($result, 'Image uploaded successfully');
                } catch (\Exception $e) {
                    \Log::warning('Cloudinary upload failed, falling back to local storage', ['error' => $e->getMessage()]);
                    // Fall through to local storage
                }
            }

            // Local storage without using Storage/Flysystem (avoids finfo MIME detection when fileinfo ext is missing)
            $filename = Str::uuid() . '.' . strtolower($file->getClientOriginalExtension());
            $dir = storage_path('app/public/' . $folder);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            $fullPath = $dir . '/' . $filename;
            if (!move_uploaded_file($file->getRealPath(), $fullPath)) {
                throw new \Exception('Failed to save file to disk.');
            }
            $path = $folder . '/' . $filename;
            $url = url('storage/' . $path);

            return $this->successResponse([
                'url' => $url,
                'path' => $path,
                'filename' => $filename,
                'note' => 'Using local storage.',
            ], 'Image uploaded successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Upload failed: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Check if Cloudinary is configured.
     */
    private function isCloudinaryConfigured(): bool
    {
        return !empty(config('cloudinary.cloud_name')) 
            && !empty(config('cloudinary.api_key')) 
            && !empty(config('cloudinary.api_secret'));
    }

    /**
     * Upload image to Cloudinary.
     */
    private function uploadToCloudinary($file, string $folder): array
    {
        $cloudName = config('cloudinary.cloud_name') ?: getenv('CLOUDINARY_CLOUD_NAME');
        $apiKey = config('cloudinary.api_key') ?: getenv('CLOUDINARY_API_KEY');
        $apiSecret = config('cloudinary.api_secret') ?: getenv('CLOUDINARY_API_SECRET');
        
        $timestamp = time();
        $uploadFolder = 'gandahub/' . $folder;
        
        // Generate signature - Cloudinary format: folder=x&timestamp=y + secret
        $signatureString = "folder={$uploadFolder}&timestamp={$timestamp}{$apiSecret}";
        $signature = sha1($signatureString);
        
        $response = Http::attach(
            'file', file_get_contents($file->getRealPath()), $file->getClientOriginalName()
        )->post("https://api.cloudinary.com/v1_1/{$cloudName}/image/upload", [
            'api_key' => $apiKey,
            'timestamp' => $timestamp,
            'signature' => $signature,
            'folder' => $uploadFolder,
        ]);
        
        if ($response->successful()) {
            $data = $response->json();
            return [
                'url' => $data['secure_url'],
                'path' => $data['public_id'],
                'filename' => ($data['original_filename'] ?? 'image') . '.' . ($data['format'] ?? 'png'),
            ];
        }
        
        // Log the error for debugging
        \Log::error('Cloudinary upload failed', [
            'response' => $response->body(),
            'status' => $response->status(),
        ]);
        
        throw new \Exception('Cloudinary upload failed: ' . $response->body());
    }

    /**
     * Upload multiple images.
     */
    public function uploadMultiple(Request $request)
    {
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        $validator = Validator::make($request->all(), [
            'images' => 'required|array|max:10',
            'images.*' => [
                'file',
                'max:5120',
                function ($attribute, $value, $fail) use ($allowedExtensions) {
                    if (!$value->isValid()) {
                        $fail('The file upload failed.');
                        return;
                    }
                    $ext = strtolower($value->getClientOriginalExtension());
                    if (!in_array($ext, $allowedExtensions)) {
                        $fail('Each image must be JPEG, PNG, GIF, or WebP.');
                    }
                },
            ],
            'folder' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        try {
            $folder = $request->input('folder', 'products');
            $dir = storage_path('app/public/' . $folder);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            $uploadedFiles = [];

            foreach ($request->file('images') as $file) {
                $filename = Str::uuid() . '.' . strtolower($file->getClientOriginalExtension());
                $fullPath = $dir . '/' . $filename;
                if (!move_uploaded_file($file->getRealPath(), $fullPath)) {
                    throw new \Exception('Failed to save file: ' . $file->getClientOriginalName());
                }
                $path = $folder . '/' . $filename;
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
     * Upload a supporting application document (resume/ID/etc).
     */
    public function uploadApplicationDocument(Request $request)
    {
        $allowedExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'];
        $validator = Validator::make($request->all(), [
            'document' => [
                'required',
                'file',
                'max:10240', // 10MB
                function ($attribute, $value, $fail) use ($allowedExtensions) {
                    if (!$value->isValid()) {
                        $fail('The file upload failed.');
                        return;
                    }
                    $ext = strtolower($value->getClientOriginalExtension());
                    if (!in_array($ext, $allowedExtensions, true)) {
                        $fail('Document must be PDF, DOC, DOCX, JPG, PNG, or WEBP.');
                    }
                },
            ],
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        try {
            $file = $request->file('document');
            $folder = 'applications/documents';
            $filename = Str::uuid() . '.' . strtolower($file->getClientOriginalExtension());
            $dir = storage_path('app/public/' . $folder);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            $fullPath = $dir . '/' . $filename;
            if (!move_uploaded_file($file->getRealPath(), $fullPath)) {
                throw new \Exception('Failed to save file to disk.');
            }
            $path = $folder . '/' . $filename;

            return $this->successResponse([
                'url' => url('storage/' . $path),
                'path' => $path,
                'filename' => $file->getClientOriginalName(),
            ], 'Document uploaded successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Upload failed: ' . $e->getMessage(), 500);
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
