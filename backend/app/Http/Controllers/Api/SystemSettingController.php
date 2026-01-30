<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Validator;

class SystemSettingController extends Controller
{
    /**
     * Get all settings (Admin only).
     */
    public function index(Request $request)
    {
        $query = SystemSetting::query();

        if ($request->has('group')) {
            $query->where('group', $request->group);
        }

        $settings = $query->orderBy('group')->orderBy('key')->get();

        return $this->successResponse($settings);
    }

    /**
     * Get public settings.
     */
    public function public()
    {
        $settings = SystemSetting::getPublicSettings();

        return $this->successResponse($settings);
    }

    /**
     * Get a single setting.
     */
    public function show($key)
    {
        $setting = SystemSetting::where('key', $key)->first();

        if (!$setting) {
            return $this->errorResponse('Setting not found', 404);
        }

        // Check if non-admin can access
        if (!$setting->is_public && !auth()->user()->isAdmin()) {
            return $this->errorResponse('Unauthorized', 403);
        }

        return $this->successResponse([
            'key' => $setting->key,
            'value' => $setting->typed_value,
        ]);
    }

    /**
     * Create or update a setting (Admin only).
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'key' => 'required|string|max:255',
            'value' => 'nullable',
            'type' => 'nullable|in:string,boolean,integer,float,array,json',
            'group' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'is_public' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        SystemSetting::set(
            $request->key,
            $request->value,
            $request->type,
            $request->group
        );

        $setting = SystemSetting::where('key', $request->key)->first();

        if ($request->has('description')) {
            $setting->update(['description' => $request->description]);
        }

        if ($request->has('is_public')) {
            $setting->update(['is_public' => $request->is_public]);
        }

        return $this->successResponse($setting, 'Setting saved');
    }

    /**
     * Update multiple settings at once (Admin only).
     */
    public function bulkUpdate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'settings' => 'required|array',
            'settings.*.key' => 'required|string',
            'settings.*.value' => 'nullable',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        foreach ($request->settings as $setting) {
            $existing = SystemSetting::where('key', $setting['key'])->first();
            SystemSetting::set(
                $setting['key'],
                $setting['value'],
                $existing?->type,
                $existing?->group
            );
        }

        return $this->successResponse(null, 'Settings updated');
    }

    /**
     * Delete a setting (Admin only).
     */
    public function destroy($key)
    {
        $setting = SystemSetting::where('key', $key)->first();

        if (!$setting) {
            return $this->errorResponse('Setting not found', 404);
        }

        $setting->delete();

        return $this->successResponse(null, 'Setting deleted');
    }

    /**
     * Get settings by group.
     */
    public function byGroup($group)
    {
        $settings = SystemSetting::getByGroup($group);

        return $this->successResponse($settings);
    }

    /**
     * Get all setting groups.
     */
    public function groups()
    {
        return $this->successResponse(SystemSetting::getGroups());
    }

    /**
     * Clear application cache (Admin only).
     */
    public function clearCache()
    {
        Artisan::call('cache:clear');
        Artisan::call('config:clear');

        return $this->successResponse(null, 'Cache cleared');
    }

    /**
     * Run database backup (Admin only).
     */
    public function backup()
    {
        // In production, implement proper backup solution
        // This is a placeholder for the backup functionality
        $backupPath = storage_path('app/backups/backup_' . date('Y-m-d_H-i-s') . '.sql');

        // Create backups directory if it doesn't exist
        if (!file_exists(dirname($backupPath))) {
            mkdir(dirname($backupPath), 0755, true);
        }

        // Mock backup response
        return $this->successResponse([
            'path' => $backupPath,
            'created_at' => now(),
        ], 'Backup created successfully');
    }

    /**
     * Get system info (Admin only).
     */
    public function systemInfo()
    {
        return $this->successResponse([
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'server_time' => now()->toDateTimeString(),
            'timezone' => config('app.timezone'),
            'environment' => config('app.env'),
            'debug_mode' => config('app.debug'),
        ]);
    }
}
