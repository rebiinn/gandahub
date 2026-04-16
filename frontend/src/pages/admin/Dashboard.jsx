import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FaShoppingCart, 
  FaUsers, 
  FaMoneyBillWave, 
  FaBox,
  FaTruck,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSync,
  FaClock,
  FaClipboardList,
  FaChartLine
} from 'react-icons/fa';
import { reportsAPI } from '../../services/api';
import Loading from '../../components/common/Loading';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await reportsAPI.getDashboard();
      setStats(response.data.data);
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount) => {
    const num = Number(amount) || 0;
    const formatted = new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
    return `₱ ${formatted}`;
  };

  const formatCount = (value) => Number(value || 0).toLocaleString('en-PH');

  if (loading) {
    return <Loading />;
  }

  const statCards = [
    {
      title: 'Platform GMV',
      value: formatPrice(stats?.totals?.platform_gmv ?? stats?.totals?.revenue),
      hint: `Today: ${formatPrice(stats?.today?.platform_gmv ?? stats?.today?.revenue)}`,
      icon: FaMoneyBillWave,
      color: 'bg-green-500',
      link: '/admin/reports',
    },
    {
      title: 'Total Orders',
      value: formatCount(stats?.totals?.orders),
      hint: `This month: ${formatCount(stats?.this_month?.orders)}`,
      icon: FaShoppingCart,
      color: 'bg-blue-500',
      link: '/admin/orders',
    },
    {
      title: 'Total Products',
      value: formatCount(stats?.totals?.products),
      hint: `${formatCount(stats?.low_stock_products)} low stock`,
      icon: FaBox,
      color: 'bg-purple-500',
      link: '/admin/products',
    },
    {
      title: 'Total Customers',
      value: formatCount(stats?.totals?.customers),
      hint: `New today: ${formatCount(stats?.today?.new_customers)}`,
      icon: FaUsers,
      color: 'bg-orange-500',
      link: '/admin/users',
    },
  ];

  const quickStats = [
    { label: "Today's Orders", value: formatCount(stats?.today?.orders) },
    { label: "Today's GMV", value: formatPrice(stats?.today?.platform_gmv ?? stats?.today?.revenue) },
    { label: "Today's Platform Profit", value: formatPrice(stats?.today?.platform_profit) },
    { label: 'New Customers Today', value: formatCount(stats?.today?.new_customers) },
    { label: 'This Month Orders', value: formatCount(stats?.this_month?.orders) },
    { label: 'This Month GMV', value: formatPrice(stats?.this_month?.platform_gmv ?? stats?.this_month?.revenue) },
    { label: 'This Month Platform Profit', value: formatPrice(stats?.this_month?.platform_profit) },
    {
      label: 'Commission Rate',
      value: `${Math.round((Number(stats?.commission_rate) || 0) * 100)}%`,
    },
  ];

  const operationsCards = [
    {
      title: 'Pending Orders',
      value: formatCount(stats?.pending?.orders),
      icon: FaClipboardList,
      tone: 'text-amber-700 bg-amber-50 border-amber-100',
      link: '/admin/orders',
    },
    {
      title: 'Pending Deliveries',
      value: formatCount(stats?.pending?.deliveries),
      icon: FaTruck,
      tone: 'text-blue-700 bg-blue-50 border-blue-100',
      link: '/admin/logistics',
    },
    {
      title: 'Pending Reviews',
      value: formatCount(stats?.pending?.reviews),
      icon: FaClock,
      tone: 'text-purple-700 bg-purple-50 border-purple-100',
      link: '/admin/reports',
    },
    {
      title: 'Low Stock Products',
      value: formatCount(stats?.low_stock_products),
      icon: FaExclamationTriangle,
      tone: 'text-red-700 bg-red-50 border-red-100',
      link: '/admin/inventory',
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
            <p className="text-gray-600 text-sm">Marketplace overview and operational health at a glance.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <FaClock className="w-3.5 h-3.5" />
            Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString('en-PH') : '—'}
            <button
              type="button"
              onClick={fetchDashboardStats}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600"
            >
              <FaSync className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Link
              key={index}
              to={stat.link}
              className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <FaChartLine className="text-gray-300 w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800">{stat.value}</h3>
              <p className="text-gray-600 text-sm">{stat.title}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.hint}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {operationsCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              to={item.link}
              className={`rounded-xl border p-4 transition-colors hover:brightness-95 ${item.tone}`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{item.title}</p>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold">{item.value}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {/* Quick Stats */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Quick Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {quickStats.map((item, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-600">{item.label}</p>
                <p className="text-xl font-bold text-gray-800">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Alerts</h2>
          <div className="space-y-2">
            {(!stats?.pending?.orders && !stats?.pending?.deliveries && !stats?.low_stock_products) ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
                <FaCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800">All good</p>
                  <p className="text-sm text-green-600">No pending orders, deliveries, or low stock to act on.</p>
                </div>
              </div>
            ) : null}
            {stats?.pending?.orders > 0 && (
              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                <FaShoppingCart className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Pending Orders</p>
                  <p className="text-sm text-yellow-600">{stats.pending.orders} orders awaiting action</p>
                </div>
              </div>
            )}
            {stats?.pending?.deliveries > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <FaTruck className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800">Pending Deliveries</p>
                  <p className="text-sm text-blue-600">{stats.pending.deliveries} deliveries to assign</p>
                </div>
              </div>
            )}
            {stats?.low_stock_products > 0 && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <FaExclamationTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">Low Stock Alert</p>
                  <p className="text-sm text-red-600">{stats.low_stock_products} products low on stock</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          to="/admin/products"
          className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow text-center"
        >
          <FaBox className="w-8 h-8 text-primary-500 mx-auto mb-2" />
          <p className="font-medium text-gray-800">Manage Products</p>
        </Link>
        <Link
          to="/admin/orders"
          className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow text-center"
        >
          <FaShoppingCart className="w-6 h-6 text-blue-500 mx-auto mb-1" />
          <p className="font-medium text-gray-800">View Orders</p>
        </Link>
        <Link
          to="/admin/inventory"
          className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow text-center"
        >
          <FaExclamationTriangle className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
          <p className="font-medium text-gray-800">Inventory</p>
        </Link>
        <Link
          to="/admin/reports"
          className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow text-center"
        >
          <FaMoneyBillWave className="w-6 h-6 text-green-500 mx-auto mb-1" />
          <p className="font-medium text-gray-800">Reports</p>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
