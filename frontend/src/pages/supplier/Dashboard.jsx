import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FaBox,
  FaShoppingCart,
  FaEnvelope,
  FaTruck,
  FaMoneyBillWave,
  FaUsers,
  FaExclamationTriangle,
  FaCheckCircle,
  FaArrowUp,
  FaArrowDown,
  FaClipboardList,
  FaWarehouse,
} from 'react-icons/fa';
import { ordersAPI, stockRequestsAPI, reportsAPI } from '../../services/api';
import Loading from '../../components/common/Loading';

const SupplierDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [ordersRes, requestsRes, statsRes] = await Promise.all([
          ordersAPI.getAll({ per_page: 5 }),
          stockRequestsAPI.getAll({ status: 'pending' }).catch(() => ({ data: { data: [] } })),
          reportsAPI.getSupplierDashboard().catch(() => ({ data: { data: null } })),
        ]);
        setOrders(ordersRes.data.data || []);
        const reqData = requestsRes?.data?.data;
        setPendingRequests(Array.isArray(reqData) ? reqData.length : 0);
        setStats(statsRes?.data?.data ?? null);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatPrice = (amount) => {
    const num = Number(amount) || 0;
    const formatted = new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
    return `₱ ${formatted}`;
  };

  if (loading) return <Loading />;

  const statCards = stats
    ? [
        {
          title: 'Net Payout',
          value: formatPrice(stats?.totals?.net_payout ?? stats?.totals?.revenue),
          change: '+12%',
          changeType: 'positive',
          icon: FaMoneyBillWave,
          color: 'bg-green-500',
          link: '/supplier/orders',
        },
        {
          title: 'Total Orders',
          value: stats?.totals?.orders || 0,
          change: '+8%',
          changeType: 'positive',
          icon: FaShoppingCart,
          color: 'bg-blue-500',
          link: '/supplier/orders',
        },
        {
          title: 'Total Products',
          value: stats?.totals?.products || 0,
          change: '+3%',
          changeType: 'positive',
          icon: FaBox,
          color: 'bg-purple-500',
          link: '/supplier/products',
        },
        {
          title: 'Customers',
          value: stats?.totals?.customers || 0,
          change: '+15%',
          changeType: 'positive',
          icon: FaUsers,
          color: 'bg-orange-500',
          link: '/supplier/orders',
        },
      ]
    : [];

  const quickStats = stats
    ? [
        { label: "Today's Orders", value: stats?.today?.orders || 0 },
        { label: "Today's Gross Sales", value: formatPrice(stats?.today?.gross_sales ?? stats?.today?.revenue) },
        { label: "Today's Net Payout", value: formatPrice(stats?.today?.net_payout) },
        { label: 'Pending stock requests', value: stats?.today?.pending_stock_requests ?? pendingRequests },
        { label: 'This Month Orders', value: stats?.this_month?.orders || 0 },
        { label: 'This Month Gross Sales', value: formatPrice(stats?.this_month?.gross_sales ?? stats?.this_month?.revenue) },
        { label: 'This Month Net Payout', value: formatPrice(stats?.this_month?.net_payout) },
        {
          label: 'Platform Fee Rate',
          value: `${Math.round((Number(stats?.commission_rate) || 0) * 100)}%`,
        },
      ]
    : [];

  const noAlerts =
    stats &&
    !stats?.pending?.orders &&
    !stats?.pending?.stock_requests &&
    !stats?.low_stock_products &&
    !stats?.pending?.reviews;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Supplier Dashboard</h1>
        <p className="text-gray-600 text-sm">
          Welcome back! Here&apos;s what&apos;s happening with your store.
        </p>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Link
                  key={index}
                  to={stat.link}
                  className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span
                      className={`flex items-center gap-1 text-sm ${
                        stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {stat.changeType === 'positive' ? <FaArrowUp /> : <FaArrowDown />}
                      {stat.change}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">{stat.value}</h3>
                  <p className="text-gray-600 text-sm">{stat.title}</p>
                </Link>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Quick Stats</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {quickStats.map((item, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">{item.label}</p>
                    <p className="text-xl font-bold text-gray-800">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Alerts</h2>
              <div className="space-y-2">
                {noAlerts ? (
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
                    <FaCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-800">All good</p>
                      <p className="text-sm text-green-600">
                        No pending orders, stock requests, low stock, or reviews to act on.
                      </p>
                    </div>
                  </div>
                ) : null}
                {stats?.pending?.orders > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                    <FaShoppingCart className="w-5 h-5 text-yellow-600" />
                    <div>
                      <p className="font-medium text-yellow-800">Pending Orders</p>
                      <p className="text-sm text-yellow-600">
                        {stats.pending.orders} orders awaiting action
                      </p>
                    </div>
                  </div>
                )}
                {stats?.pending?.stock_requests > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
                    <FaClipboardList className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="font-medium text-emerald-800">Stock Requests</p>
                      <p className="text-sm text-emerald-600">
                        {stats.pending.stock_requests} requests from admin
                      </p>
                    </div>
                  </div>
                )}
                {stats?.low_stock_products > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                    <FaExclamationTriangle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-800">Low Stock Alert</p>
                      <p className="text-sm text-red-600">
                        {stats.low_stock_products} products low on stock
                      </p>
                    </div>
                  </div>
                )}
                {stats?.pending?.reviews > 0 && (
                  <Link
                    to="/supplier/reviews"
                    className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100 hover:bg-purple-100 transition-colors"
                  >
                    <FaUsers className="w-5 h-5 text-purple-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-purple-800">Pending Reviews</p>
                      <p className="text-sm text-purple-600">
                        {stats.pending.reviews} reviews awaiting approval — open to approve
                      </p>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Link
          to="/supplier/products"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <FaBox className="w-10 h-10 text-emerald-600 mb-3" />
          <h3 className="font-semibold text-gray-800">My Products</h3>
          <p className="text-gray-500 text-sm mt-1">Add, edit, and manage your cosmetic products</p>
        </Link>
        <Link
          to="/supplier/inventory"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <FaWarehouse className="w-10 h-10 text-emerald-600 mb-3" />
          <h3 className="font-semibold text-gray-800">Inventory</h3>
          <p className="text-gray-500 text-sm mt-1">See in-shop signals & requests</p>
        </Link>
        <Link
          to="/supplier/stock-requests"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <FaTruck className="w-10 h-10 text-emerald-600 mb-3" />
          <h3 className="font-semibold text-gray-800">Stock Requests</h3>
          <p className="text-gray-500 text-sm mt-1">{pendingRequests} pending from admin</p>
        </Link>
        <Link
          to="/supplier/orders"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <FaShoppingCart className="w-10 h-10 text-emerald-600 mb-3" />
          <h3 className="font-semibold text-gray-800">Orders</h3>
          <p className="text-gray-500 text-sm mt-1">{orders.length} recent orders</p>
        </Link>
        <Link
          to="/supplier/messages"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <FaEnvelope className="w-10 h-10 text-emerald-600 mb-3" />
          <h3 className="font-semibold text-gray-800">Messages</h3>
          <p className="text-gray-500 text-sm mt-1">Chat with customers</p>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <h2 className="px-6 py-4 font-semibold text-gray-800 border-b">Recent Orders</h2>
        {orders.length === 0 ? (
          <p className="p-6 text-gray-500">No orders yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link to={`/supplier/orders`} className="text-emerald-600 hover:underline">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100">{order.status}</span>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      ₱{parseFloat(order.total || 0).toLocaleString('en-PH')}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierDashboard;
