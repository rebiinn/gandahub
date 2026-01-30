<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class SystemSetting extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'key',
        'value',
        'type',
        'group',
        'description',
        'is_public',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'is_public' => 'boolean',
    ];

    /**
     * Setting groups.
     */
    const GROUP_GENERAL = 'general';
    const GROUP_PAYMENT = 'payment';
    const GROUP_SHIPPING = 'shipping';
    const GROUP_EMAIL = 'email';
    const GROUP_TAX = 'tax';
    const GROUP_APPEARANCE = 'appearance';

    /**
     * Get a setting value by key.
     */
    public static function get(string $key, $default = null)
    {
        $cacheKey = "setting_{$key}";

        return Cache::remember($cacheKey, 3600, function () use ($key, $default) {
            $setting = self::where('key', $key)->first();

            if (!$setting) {
                return $default;
            }

            return self::castValue($setting->value, $setting->type);
        });
    }

    /**
     * Set a setting value.
     */
    public static function set(string $key, $value, ?string $type = null, ?string $group = null): void
    {
        $setting = self::firstOrNew(['key' => $key]);

        if ($type === 'array' || $type === 'json') {
            $value = is_array($value) ? json_encode($value) : $value;
        }

        $setting->value = $value;

        if ($type) {
            $setting->type = $type;
        }

        if ($group) {
            $setting->group = $group;
        }

        $setting->save();

        // Clear cache
        Cache::forget("setting_{$key}");
    }

    /**
     * Cast value based on type.
     */
    protected static function castValue($value, string $type)
    {
        return match ($type) {
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'integer' => (int) $value,
            'float' => (float) $value,
            'array', 'json' => json_decode($value, true),
            default => $value,
        };
    }

    /**
     * Get the typed value.
     */
    public function getTypedValueAttribute()
    {
        return self::castValue($this->value, $this->type);
    }

    /**
     * Get all settings by group.
     */
    public static function getByGroup(string $group): array
    {
        return self::where('group', $group)
            ->get()
            ->mapWithKeys(function ($setting) {
                return [$setting->key => $setting->typed_value];
            })
            ->toArray();
    }

    /**
     * Get all public settings.
     */
    public static function getPublicSettings(): array
    {
        return self::where('is_public', true)
            ->get()
            ->mapWithKeys(function ($setting) {
                return [$setting->key => $setting->typed_value];
            })
            ->toArray();
    }

    /**
     * Get all groups.
     */
    public static function getGroups(): array
    {
        return [
            self::GROUP_GENERAL => 'General',
            self::GROUP_PAYMENT => 'Payment',
            self::GROUP_SHIPPING => 'Shipping',
            self::GROUP_EMAIL => 'Email',
            self::GROUP_TAX => 'Tax',
            self::GROUP_APPEARANCE => 'Appearance',
        ];
    }
}
