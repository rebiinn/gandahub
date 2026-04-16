<?php

return [
    // Platform commission rate (5% default). Used for admin platform profit
    // and supplier net payout dashboard analytics.
    'commission_rate' => (float) env('MARKETPLACE_COMMISSION_RATE', 0.05),
];

