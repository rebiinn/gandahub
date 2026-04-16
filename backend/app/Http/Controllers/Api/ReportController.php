<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Report;
use App\Models\Review;
use App\Models\StockRequest;
use App\Models\Store;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ReportController extends Controller
{
    protected function marketplaceCommissionRate(): float
    {
        $settingValue = SystemSetting::get('marketplace_commission_rate', null);
        $rate = $settingValue !== null
            ? (float) $settingValue
            : (float) config('marketplace.commission_rate', 0.05);
        return max(0.0, min($rate, 1.0));
    }

    /**
     * Get all reports.
     */
    public function index(Request $request)
    {
        $query = Report::with('generatedBy');

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $perPage = min($request->get('per_page', 10), 50);
        $reports = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return $this->paginatedResponse($reports);
    }

    /**
     * Get a single report.
     */
    public function show($id)
    {
        $report = Report::with('generatedBy')->find($id);

        if (!$report) {
            return $this->errorResponse('Report not found', 404);
        }

        return $this->successResponse($report);
    }

    /**
     * Generate a new report.
     */
    public function generate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'type' => 'required|in:sales,inventory,customers,orders,deliveries,revenue,products,custom',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date|after_or_equal:date_from',
            'parameters' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors());
        }

        $report = Report::create([
            'generated_by' => auth()->id(),
            'name' => $request->name,
            'type' => $request->type,
            'date_from' => $request->date_from,
            'date_to' => $request->date_to,
            'parameters' => $request->parameters,
            'status' => Report::STATUS_PROCESSING,
        ]);

        // Generate report data based on type
        $data = $this->generateReportData($report);

        $report->markAsCompleted($data);

        return $this->successResponse($report, 'Report generated successfully', 201);
    }

    /**
     * Generate report data based on type.
     */
    protected function generateReportData(Report $report): array
    {
        $dateFrom = $report->date_from ?? now()->subMonth();
        $dateTo = $report->date_to ?? now();

        return match ($report->type) {
            'sales' => $this->generateSalesReport($dateFrom, $dateTo),
            'inventory' => $this->generateInventoryReport(),
            'customers' => $this->generateCustomersReport($dateFrom, $dateTo),
            'orders' => $this->generateOrdersReport($dateFrom, $dateTo),
            'deliveries' => $this->generateDeliveriesReport($dateFrom, $dateTo),
            'revenue' => $this->generateRevenueReport($dateFrom, $dateTo),
            'products' => $this->generateProductsReport($dateFrom, $dateTo),
            default => [],
        };
    }

    /**
     * Sales report data.
     */
    protected function generateSalesReport($dateFrom, $dateTo): array
    {
        $orders = Order::whereBetween('orders.created_at', [$dateFrom, $dateTo])
            ->where('orders.status', 'delivered');

        return [
            'total_orders' => $orders->count(),
            'total_revenue' => $orders->sum('orders.total'),
            'average_order_value' => $orders->avg('orders.total'),
            'total_items_sold' => Order::query()
                ->whereBetween('orders.created_at', [$dateFrom, $dateTo])
                ->where('orders.status', 'delivered')
                ->join('order_items', 'orders.id', '=', 'order_items.order_id')
                ->sum('order_items.quantity'),
            'daily_sales' => Order::whereBetween('orders.created_at', [$dateFrom, $dateTo])
                ->where('orders.status', 'delivered')
                ->select(DB::raw('DATE(orders.created_at) as date'), DB::raw('SUM(orders.total) as total'))
                ->groupBy('date')
                ->orderBy('date')
                ->get(),
        ];
    }

    /**
     * Inventory report data.
     */
    protected function generateInventoryReport(): array
    {
        return [
            'total_products' => Product::count(),
            'active_products' => Product::active()->count(),
            'out_of_stock' => Product::where('stock_quantity', 0)->count(),
            'low_stock' => Product::whereColumn('stock_quantity', '<=', 'low_stock_threshold')
                ->where('stock_quantity', '>', 0)->count(),
            'total_stock_value' => Product::selectRaw('SUM(price * stock_quantity) as value')->value('value'),
            'low_stock_products' => Product::whereColumn('stock_quantity', '<=', 'low_stock_threshold')
                ->select('id', 'name', 'sku', 'stock_quantity', 'low_stock_threshold')
                ->get(),
            'by_category' => Product::select('category_id', DB::raw('COUNT(*) as count'), DB::raw('SUM(stock_quantity) as total_stock'))
                ->groupBy('category_id')
                ->with('category:id,name')
                ->get(),
        ];
    }

    /**
     * Customers report data.
     */
    protected function generateCustomersReport($dateFrom, $dateTo): array
    {
        return [
            'total_customers' => User::where('role', 'customer')->count(),
            'new_customers' => User::where('role', 'customer')
                ->whereBetween('created_at', [$dateFrom, $dateTo])->count(),
            'active_customers' => User::where('role', 'customer')
                ->whereHas('orders', function ($q) use ($dateFrom, $dateTo) {
                    $q->whereBetween('created_at', [$dateFrom, $dateTo]);
                })->count(),
            'top_customers' => User::where('role', 'customer')
                ->withSum(['orders' => function ($q) use ($dateFrom, $dateTo) {
                    $q->whereBetween('created_at', [$dateFrom, $dateTo])
                        ->where('status', 'delivered');
                }], 'total')
                ->orderByDesc('orders_sum_total')
                ->limit(10)
                ->get(['id', 'first_name', 'last_name', 'email']),
        ];
    }

    /**
     * Orders report data.
     */
    protected function generateOrdersReport($dateFrom, $dateTo): array
    {
        $orders = Order::whereBetween('created_at', [$dateFrom, $dateTo]);

        return [
            'total_orders' => $orders->count(),
            'by_status' => Order::whereBetween('created_at', [$dateFrom, $dateTo])
                ->select('status', DB::raw('COUNT(*) as count'))
                ->groupBy('status')
                ->get(),
            'average_processing_time' => Order::whereBetween('created_at', [$dateFrom, $dateTo])
                ->whereNotNull('delivered_at')
                ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, delivered_at)) as avg_hours')
                ->value('avg_hours'),
            'cancellation_rate' => $orders->where('status', 'cancelled')->count() / max($orders->count(), 1) * 100,
        ];
    }

    /**
     * Deliveries report data.
     */
    protected function generateDeliveriesReport($dateFrom, $dateTo): array
    {
        return [
            'total_deliveries' => Delivery::whereBetween('created_at', [$dateFrom, $dateTo])->count(),
            'completed' => Delivery::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', 'delivered')->count(),
            'failed' => Delivery::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', 'failed')->count(),
            'by_rider' => Delivery::whereBetween('created_at', [$dateFrom, $dateTo])
                ->select('rider_id', DB::raw('COUNT(*) as total'), 
                    DB::raw('SUM(CASE WHEN status = "delivered" THEN 1 ELSE 0 END) as completed'))
                ->groupBy('rider_id')
                ->with('rider:id,first_name,last_name')
                ->get(),
            'average_delivery_time' => Delivery::whereBetween('created_at', [$dateFrom, $dateTo])
                ->whereNotNull('delivered_at')
                ->whereNotNull('picked_up_at')
                ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, picked_up_at, delivered_at)) as avg_hours')
                ->value('avg_hours'),
        ];
    }

    /**
     * Revenue report data.
     */
    protected function generateRevenueReport($dateFrom, $dateTo): array
    {
        return [
            'gross_revenue' => Order::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', 'delivered')->sum('subtotal'),
            'net_revenue' => Order::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', 'delivered')->sum('total'),
            'total_tax' => Order::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', 'delivered')->sum('tax'),
            'total_shipping' => Order::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', 'delivered')->sum('shipping_fee'),
            'total_discounts' => Order::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', 'delivered')->sum('discount'),
            'refunds' => Payment::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', 'refunded')->sum('amount'),
            'by_payment_method' => Payment::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', 'completed')
                ->select('payment_method', DB::raw('SUM(amount) as total'))
                ->groupBy('payment_method')
                ->get(),
        ];
    }

    /**
     * Products report data.
     */
    protected function generateProductsReport($dateFrom, $dateTo): array
    {
        return [
            'best_sellers' => Product::withSum(['orderItems' => function ($q) use ($dateFrom, $dateTo) {
                    $q->whereHas('order', function ($oq) use ($dateFrom, $dateTo) {
                        $oq->whereBetween('created_at', [$dateFrom, $dateTo])
                            ->where('status', 'delivered');
                    });
                }], 'quantity')
                ->orderByDesc('order_items_sum_quantity')
                ->limit(10)
                ->get(['id', 'name', 'sku', 'price']),
            'top_rated' => Product::where('review_count', '>', 0)
                ->orderByDesc('average_rating')
                ->limit(10)
                ->get(['id', 'name', 'average_rating', 'review_count']),
            'by_category' => Product::select('category_id')
                ->selectRaw('COUNT(*) as product_count')
                ->selectRaw('SUM(stock_quantity) as total_stock')
                ->groupBy('category_id')
                ->with('category:id,name')
                ->get(),
        ];
    }

    /**
     * Delete a report.
     */
    public function destroy($id)
    {
        $report = Report::find($id);

        if (!$report) {
            return $this->errorResponse('Report not found', 404);
        }

        $report->delete();

        return $this->successResponse(null, 'Report deleted');
    }

    /**
     * Get dashboard statistics.
     */
    public function dashboard()
    {
        $today = now()->startOfDay();
        $thisMonth = now()->startOfMonth();
        $commissionRate = $this->marketplaceCommissionRate();
        $pendingDeliveryAssignments = Delivery::query()
            ->whereNull('rider_id')
            ->whereNotNull('station_arrived_at')
            ->whereIn('status', [Delivery::STATUS_IN_TRANSIT, Delivery::STATUS_ASSIGNED])
            ->whereHas('order', function ($q) {
                $q->whereNotIn('status', [
                    Order::STATUS_CANCELLED,
                    Order::STATUS_REFUNDED,
                    Order::STATUS_DELIVERED,
                ]);
            })
            ->count();

        $todayGmv = (float) Order::whereDate('created_at', $today)
            ->where('status', 'delivered')
            ->sum('total');
        $monthGmv = (float) Order::where('created_at', '>=', $thisMonth)
            ->where('status', 'delivered')
            ->sum('total');
        $totalGmv = (float) Order::where('status', 'delivered')->sum('total');

        $todayProfit = round($todayGmv * $commissionRate, 2);
        $monthProfit = round($monthGmv * $commissionRate, 2);
        $totalProfit = round($totalGmv * $commissionRate, 2);

        return $this->successResponse([
            'commission_rate' => $commissionRate,
            'today' => [
                'orders' => Order::whereDate('created_at', $today)->count(),
                'revenue' => $todayGmv,
                'platform_gmv' => $todayGmv,
                'platform_profit' => $todayProfit,
                'new_customers' => User::where('role', 'customer')
                    ->whereDate('created_at', $today)->count(),
            ],
            'this_month' => [
                'orders' => Order::where('created_at', '>=', $thisMonth)->count(),
                'revenue' => $monthGmv,
                'platform_gmv' => $monthGmv,
                'platform_profit' => $monthProfit,
                'new_customers' => User::where('role', 'customer')
                    ->where('created_at', '>=', $thisMonth)->count(),
            ],
            'totals' => [
                'products' => Product::count(),
                'customers' => User::where('role', 'customer')->count(),
                'orders' => Order::count(),
                'revenue' => $totalGmv,
                'platform_gmv' => $totalGmv,
                'platform_profit' => $totalProfit,
            ],
            'pending' => [
                'orders' => Order::where('status', 'pending')->count(),
                'deliveries' => $pendingDeliveryAssignments,
                'reviews' => \App\Models\Review::where('is_approved', false)->count(),
            ],
            'low_stock_products' => Product::whereColumn('stock_quantity', '<=', 'low_stock_threshold')
                ->count(),
        ]);
    }

    /**
     * Dashboard statistics for the authenticated supplier (scoped to their store).
     */
    public function supplierDashboard()
    {
        $user = auth()->user();
        if (!$user || !$user->isSupplier()) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $store = Store::where('user_id', $user->id)->first();
        if (!$store) {
            $commissionRate = $this->marketplaceCommissionRate();
            return $this->successResponse([
                'commission_rate' => $commissionRate,
                'today' => [
                    'orders' => 0,
                    'revenue' => 0,
                    'gross_sales' => 0,
                    'platform_fee' => 0,
                    'net_payout' => 0,
                    'pending_stock_requests' => 0,
                ],
                'this_month' => [
                    'orders' => 0,
                    'revenue' => 0,
                    'gross_sales' => 0,
                    'platform_fee' => 0,
                    'net_payout' => 0,
                ],
                'totals' => [
                    'products' => 0,
                    'customers' => 0,
                    'orders' => 0,
                    'revenue' => 0,
                    'gross_sales' => 0,
                    'platform_fee' => 0,
                    'net_payout' => 0,
                ],
                'pending' => [
                    'orders' => 0,
                    'stock_requests' => 0,
                    'reviews' => 0,
                ],
                'low_stock_products' => 0,
            ]);
        }

        $storeId = $store->id;
        $today = now()->startOfDay();
        $thisMonth = now()->startOfMonth();
        $commissionRate = $this->marketplaceCommissionRate();

        $scopeSupplierOrders = function ($q) use ($storeId) {
            $q->whereHas('items.product', function ($p) use ($storeId) {
                $p->where('store_id', $storeId);
            });
        };

        $itemRevenueForOrders = function ($orderConstraint) use ($storeId) {
            return OrderItem::query()
                ->whereHas('product', function ($q) use ($storeId) {
                    $q->where('store_id', $storeId);
                })
                ->whereHas('order', $orderConstraint);
        };

        $todayRevenue = (clone $itemRevenueForOrders(function ($q) use ($today) {
            $q->where('status', Order::STATUS_DELIVERED)
                ->whereDate('created_at', $today);
        }))->sum('total_price');

        $monthRevenue = (clone $itemRevenueForOrders(function ($q) use ($thisMonth) {
            $q->where('status', Order::STATUS_DELIVERED)
                ->where('created_at', '>=', $thisMonth);
        }))->sum('total_price');

        $totalRevenue = OrderItem::query()
            ->whereHas('product', function ($q) use ($storeId) {
                $q->where('store_id', $storeId);
            })
            ->whereHas('order', function ($q) {
                $q->where('status', Order::STATUS_DELIVERED);
            })
            ->sum('total_price');

        $todayFee = round(((float) $todayRevenue) * $commissionRate, 2);
        $monthFee = round(((float) $monthRevenue) * $commissionRate, 2);
        $totalFee = round(((float) $totalRevenue) * $commissionRate, 2);

        $todayNetPayout = round(((float) $todayRevenue) - $todayFee, 2);
        $monthNetPayout = round(((float) $monthRevenue) - $monthFee, 2);
        $totalNetPayout = round(((float) $totalRevenue) - $totalFee, 2);

        $ordersToday = Order::query()
            ->whereDate('created_at', $today)
            ->where($scopeSupplierOrders)
            ->count();

        $ordersThisMonth = Order::query()
            ->where('created_at', '>=', $thisMonth)
            ->where($scopeSupplierOrders)
            ->count();

        $ordersTotal = Order::query()
            ->where($scopeSupplierOrders)
            ->count();

        $customerCount = (int) DB::table('orders')
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('products.store_id', $storeId)
            ->whereNull('orders.deleted_at')
            ->whereNull('products.deleted_at')
            ->selectRaw('COUNT(DISTINCT orders.user_id) as aggregate')
            ->value('aggregate');

        $productCount = Product::where('store_id', $storeId)->count();

        $pendingStockRequests = StockRequest::where('store_id', $storeId)
            ->where('status', StockRequest::STATUS_PENDING)
            ->count();

        $pendingReviews = Review::query()
            ->where('is_approved', false)
            ->whereHas('product', function ($q) use ($storeId) {
                $q->where('store_id', $storeId);
            })
            ->count();

        $lowStock = Product::where('store_id', $storeId)
            ->whereColumn('stock_quantity', '<=', 'low_stock_threshold')
            ->count();

        return $this->successResponse([
            'commission_rate' => $commissionRate,
            'today' => [
                'orders' => $ordersToday,
                'revenue' => $todayRevenue,
                'gross_sales' => $todayRevenue,
                'platform_fee' => $todayFee,
                'net_payout' => $todayNetPayout,
                'pending_stock_requests' => $pendingStockRequests,
            ],
            'this_month' => [
                'orders' => $ordersThisMonth,
                'revenue' => $monthRevenue,
                'gross_sales' => $monthRevenue,
                'platform_fee' => $monthFee,
                'net_payout' => $monthNetPayout,
            ],
            'totals' => [
                'products' => $productCount,
                'customers' => $customerCount,
                'orders' => $ordersTotal,
                'revenue' => $totalRevenue,
                'gross_sales' => $totalRevenue,
                'platform_fee' => $totalFee,
                'net_payout' => $totalNetPayout,
            ],
            'pending' => [
                'orders' => Order::where('status', Order::STATUS_PENDING)
                    ->where($scopeSupplierOrders)
                    ->count(),
                'stock_requests' => $pendingStockRequests,
                'reviews' => $pendingReviews,
            ],
            'low_stock_products' => $lowStock,
        ]);
    }
}
