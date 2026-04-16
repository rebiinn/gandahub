<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class PayMongoService
{
    protected string $baseUrl;
    protected string $secretKey;
    protected bool $verifySsl;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) config('services.paymongo.base_url', 'https://api.paymongo.com/v1'), '/');
        $this->secretKey = (string) config('services.paymongo.secret_key', '');
        $verifySsl = config('services.paymongo.verify_ssl', true);
        $this->verifySsl = filter_var($verifySsl, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($this->verifySsl === null) {
            $this->verifySsl = true;
        }
    }

    public function isConfigured(): bool
    {
        return $this->secretKey !== '';
    }

    public function createCheckoutSession(array $payload): array
    {
        if (!$this->isConfigured()) {
            throw new RuntimeException('PayMongo is not configured. Missing PAYMONGO_SECRET_KEY.');
        }
        return $this->requestPayMongo('post', '/checkout_sessions', [
            'data' => [
                'attributes' => $payload,
            ],
        ], 'checkout session');
    }

    /**
     * Create a true QRPh payment and return QR image data.
     */
    public function createQrPhPayment(array $payload): array
    {
        if (!$this->isConfigured()) {
            throw new RuntimeException('PayMongo is not configured. Missing PAYMONGO_SECRET_KEY.');
        }

        $amount = (int) ($payload['amount'] ?? 0);
        $currency = (string) ($payload['currency'] ?? 'PHP');
        $description = (string) ($payload['description'] ?? 'Order payment');
        $metadata = (array) ($payload['metadata'] ?? []);
        $billing = (array) ($payload['billing'] ?? []);

        $intentResponse = $this->requestPayMongo('post', '/payment_intents', [
            'data' => [
                'attributes' => [
                    'amount' => $amount,
                    'currency' => strtoupper($currency),
                    'capture_type' => 'automatic',
                    'payment_method_allowed' => ['qrph'],
                    'description' => $description,
                    'metadata' => $metadata,
                ],
            ],
        ], 'payment intent');

        $paymentIntentId = (string) data_get($intentResponse, 'data.id', '');
        $clientKey = (string) data_get($intentResponse, 'data.attributes.client_key', '');
        if ($paymentIntentId === '' || $clientKey === '') {
            throw new RuntimeException('PayMongo did not return payment intent credentials for QRPh.');
        }

        $paymentMethodResponse = $this->requestPayMongo('post', '/payment_methods', [
            'data' => [
                'attributes' => [
                    'type' => 'qrph',
                    'billing' => [
                        'name' => (string) ($billing['name'] ?? 'Customer'),
                        'email' => (string) ($billing['email'] ?? ''),
                        'phone' => (string) ($billing['phone'] ?? ''),
                        'address' => (array) ($billing['address'] ?? []),
                    ],
                    'metadata' => $metadata,
                ],
            ],
        ], 'payment method');

        $paymentMethodId = (string) data_get($paymentMethodResponse, 'data.id', '');
        if ($paymentMethodId === '') {
            throw new RuntimeException('PayMongo did not return a QRPh payment method ID.');
        }

        $attachResponse = $this->requestPayMongo('post', '/payment_intents/' . $paymentIntentId . '/attach', [
            'data' => [
                'attributes' => [
                    'payment_method' => $paymentMethodId,
                    'client_key' => $clientKey,
                ],
            ],
        ], 'payment intent attach');

        $resource = data_get($attachResponse, 'data.attributes', []);
        $nextActionCode = (array) data_get($resource, 'next_action.code', []);
        $qrImageUrl = (string) data_get($nextActionCode, 'image_url', '');
        $qrCodeId = (string) data_get($nextActionCode, 'code_id', '');
        $nextActionType = (string) data_get($resource, 'next_action.type', '');

        if ($qrImageUrl === '') {
            throw new RuntimeException('PayMongo did not return QR image data.');
        }

        return [
            'payment_intent_id' => $paymentIntentId,
            'payment_method_id' => $paymentMethodId,
            'status' => (string) data_get($resource, 'status', ''),
            'next_action_type' => $nextActionType,
            'qr_image_url' => $qrImageUrl,
            'qr_code_id' => $qrCodeId,
            'expires_at' => data_get($nextActionCode, 'expires_at'),
        ];
    }

    protected function requestPayMongo(string $method, string $path, array $body, string $context): array
    {
        try {
            $http = Http::withBasicAuth($this->secretKey, '')
                ->acceptJson()
                ->timeout(30)
                ->connectTimeout(15)
                ->retry(2, 300, null, false)
                ->withOptions([
                    'verify' => $this->verifySsl,
                    // Windows/dev environments may fail on IPv6 resolution for some APIs.
                    // For PayMongo calls, force IPv4 to avoid "Connection refused" on AAAA routes.
                    'curl' => defined('CURLOPT_IPRESOLVE') && defined('CURL_IPRESOLVE_V4')
                        ? [
                            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
                            // Bypass machine-level proxy settings that can break direct API calls locally.
                            CURLOPT_PROXY => '',
                            CURLOPT_NOPROXY => '*',
                        ]
                        : [
                            CURLOPT_PROXY => '',
                            CURLOPT_NOPROXY => '*',
                        ],
                ]);

            $response = $http->{$method}($this->baseUrl . $path, $body);
        } catch (\Throwable $e) {
            $errorMessage = $e->getMessage();
            Log::error('PayMongo request failed before response', ['error' => $errorMessage]);
            if (str_contains($errorMessage, 'cURL error 60')) {
                throw new RuntimeException('SSL certificate validation failed while connecting to PayMongo. For local development, set PAYMONGO_VERIFY_SSL=false and restart backend.');
            }
            throw new RuntimeException('Unable to connect to PayMongo. Please check internet/firewall/proxy settings and try again.');
        }

        if (!$response->successful()) {
            Log::error('PayMongo ' . $context . ' failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new RuntimeException('Failed to create PayMongo ' . $context . ': ' . $response->body());
        }

        return (array) $response->json();
    }
}

