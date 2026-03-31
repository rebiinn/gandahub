<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\LogisticsCatalog;

class LogisticsController extends Controller
{
    /**
     * Carriers, island groups (Luzon / Visayas / Mindanao), and branch list for dropdowns.
     */
    public function catalog()
    {
        return $this->successResponse(LogisticsCatalog::forApi());
    }
}
