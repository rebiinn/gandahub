<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class XenditService
{
    protected string $baseUrl = 'https://api.xendit.co';
    protected string $secretKey;

    public function __construct()
    {
        $this->secretKey = (string) config('services.xendit.secret_key', '');
    }

    public function isConfigured(): bool
    {
        return $this->secretKey !== '';
    }

    /**
     * Create a Xendit Invoice (hosted checkout page).
     * The returned invoice_url can be used to redirect the customer to pay via GCash, cards, etc.
     *
     * @param  array  $payload {
     *   external_id: string,
     *   amount: float,
     *   description: string,
     *   customer: { given_names, email, mobile_number },
     *   success_redirect_url: string,
     *   failure_redirect_url: string,
     *   metadata: array,
     * }
     * @return array { id, invoice_url, external_id, status, expiry_date }
     */
    public function createInvoice(array $payload): array
    {
        if (!$this->isConfigured()) {
            throw new RuntimeException('Xendit is not configured. Missing XENDIT_SECRET_KEY.');
        }

        $body = [
            'external_id'  => (string) ($payload['external_id'] ?? ''),
            'amount'       => (float)  ($payload['amount']      ?? 0),
            'description'  => (string) ($payload['description'] ?? 'Order payment'),
            'currency'     => 'PHP',
        ];

        if (!empty($payload['customer'])) {
            $body['customer'] = $payload['customer'];
        }

        if (!empty($payload['success_redirect_url'])) {
            $body['success_redirect_url'] = $payload['success_redirect_url'];
        }

        if (!empty($payload['failure_redirect_url'])) {
            $body['failure_redirect_url'] = $payload['failure_redirect_url'];
        }

        if (!empty($payload['metadata'])) {
            $body['metadata'] = $payload['metadata'];
        }

        $response = $this->requestXendit('post', '/v2/invoices', $body);

        $invoiceId  = (string) data_get($response, 'id', '');
        $invoiceUrl = (string) data_get($response, 'invoice_url', '');

        if ($invoiceId === '' || $invoiceUrl === '') {
            throw new RuntimeException('Xendit did not return a valid invoice. Response: ' . json_encode($response));
        }

        return [
            'id'          => $invoiceId,
            'invoice_url' => $invoiceUrl,
            'external_id' => (string) data_get($response, 'external_id', ''),
            'status'      => (string) data_get($response, 'status', ''),
            'expiry_date' => data_get($response, 'expiry_date'),
        ];
    }

    /**
     * Shared HTTP request helper for Xendit API.
     * Xendit uses HTTP Basic Auth: secret key as username, empty password.
     */
    protected function requestXendit(string $method, string $path, array $body): array
    {
        try {
            $response = Http::withBasicAuth($this->secretKey, '')
                ->acceptJson()
                ->timeout(30)
                ->connectTimeout(15)
                ->retry(2, 300, null, false)
                ->withOptions([
                    'curl' => defined('CURLOPT_IPRESOLVE') && defined('CURL_IPRESOLVE_V4')
                        ? [
                            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
                            CURLOPT_PROXY     => '',
                            CURLOPT_NOPROXY   => '*',
                        ]
                        : [
                            CURLOPT_PROXY   => '',
                            CURLOPT_NOPROXY => '*',
                        ],
                ])
                ->{$method}($this->baseUrl . $path, $body);
        } catch (\Throwable $e) {
            $errorMessage = $e->getMessage();
            Log::error('Xendit request failed before response', ['error' => $errorMessage]);
            if (str_contains($errorMessage, 'cURL error 60')) {
                throw new RuntimeException('SSL certificate validation failed while connecting to Xendit. For local development, set XENDIT_VERIFY_SSL=false.');
            }
            throw new RuntimeException('Unable to connect to Xendit. Please check internet/firewall settings and try again.');
        }

        if (!$response->successful()) {
            Log::error('Xendit request failed', [
                'path'   => $path,
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);
            throw new RuntimeException('Xendit API error: ' . $response->body());
        }

        return (array) $response->json();
    }
}
