<?php

namespace App\Support;

class LogisticsCatalog
{
    /**
     * @return array{providers: array, regions: array<string, string>, branches: array}
     */
    public static function definition(): array
    {
        return config('logistics', []);
    }

    /**
     * Payload for API / dropdowns (regions as { key, label }).
     */
    public static function forApi(): array
    {
        $def = self::definition();
        $regions = [];
        foreach ($def['region_keys'] ?? [] as $key) {
            $regions[] = [
                'key' => $key,
                'label' => $def['regions'][$key] ?? ucfirst($key),
            ];
        }

        return [
            'providers' => $def['providers'] ?? [],
            'regions' => $regions,
            'branches' => $def['branches'] ?? [],
        ];
    }

    /**
     * @return array{id: string, name: string, city: string, address: string}|null
     */
    public static function findBranch(string $region, string $provider, string $branchId): ?array
    {
        $def = self::definition();
        $branches = $def['branches'][$region][$provider] ?? null;
        if (! is_array($branches)) {
            return null;
        }
        foreach ($branches as $row) {
            if (($row['id'] ?? '') === $branchId) {
                return $row;
            }
        }

        return null;
    }
}
