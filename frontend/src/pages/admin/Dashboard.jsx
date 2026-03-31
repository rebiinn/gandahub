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
  FaArrowUp,
  FaArrowDown
} from 'react-icons/fa';
import { reportsAPI } from '../../services/api';
import Loading from '../../components/common/Loading';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await reportsAPI.getDashboard();
      setStats(response.data.data);
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

  if (loading) {
    return <Loading />;
  }

  const statCards = [
    {
      title: 'Total Revenue',
      value: formatPrice(stats?.totals?.revenue),
      change: '+12%',
      changeType: 'positive',
      icon: FaMoneyBillWave,
      color: 'bg-green-500',
      link: '/admin/reports',
    },
    {
      title: 'Total Orders',
      value: stats?.totals?.orders || 0,
      change: '+8%',
      changeType: 'positive',
      icon: FaShoppingCart,
      color: 'bg-blue-500',
      link: '/admin/orders',
    },
    {
      title: 'Total Products',
      value: stats?.totals?.products || 0,
      change: '+3%',
      changeType: 'positive',
      icon: FaBox,
      color: 'bg-purple-500',
      link: '/admin/products',
    },
    {
      title: 'Total Customers',
      value: stats?.totals?.customers || 0,
      change: '+15%',
      changeType: 'positive',
      icon: FaUsers,
      color: 'bg-orange-500',
      link: '/admin/users',
    },
  ];

  const quickStats = [
    { label: "Today's Orders", value: stats?.today?.orders || 0 },
    { label: "Today's Revenue", value: formatPrice(stats?.today?.revenue) },
    { label: 'New Customers Today', value: stats?.today?.new_customers || 0 },
    { label: 'This Month Orders', value: stats?.this_month?.orders || 0 },
    { label: 'This Month Revenue', value: formatPrice(stats?.this_month?.revenue) },
  ];

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600 text-sm">Welcome back! Here&apos;s what&apos;s happening with your store.</p>
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
              <div className="flex items-center justify-between mb-2">
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className={`flex items-center gap-1 text-sm ${
                  stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                }`}>
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

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {/* Quick Stats */}
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

        {/* Alerts */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Alerts</h2>
          <div className="space-y-2">
            {(!stats?.pending?.orders && !stats?.pending?.deliveries && !stats?.low_stock_products && !stats?.pending?.reviews) ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
                <FaCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800">All good</p>
                  <p className="text-sm text-green-600">No pending orders, deliveries, low stock, or reviews to act on.</p>
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
            {stats?.pending?.reviews > 0 && (
              <Link
                to="/admin/reviews"
                className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100 hover:bg-purple-100 transition-colors"
              >
                <FaUsers className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-purple-800">Pending Reviews</p>
                  <p className="text-sm text-purple-600">{stats.pending.reviews} reviews awaiting approval — open to approve</p>
                </div>
              </Link>
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
          <p className="font-medium text-gray-800">Add Product</p>
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
