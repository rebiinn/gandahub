import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaTruck, FaCheckCircle, FaClock } from 'react-icons/fa';
import { deliveriesAPI } from '../../services/api';
import Loading from '../../components/common/Loading';
import Badge from '../../components/common/Badge';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [pendingDeliveries, setPendingDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, deliveriesRes] = await Promise.all([
        deliveriesAPI.riderStats(),
        deliveriesAPI.riderGetAll({ status: 'assigned' }),
      ]);
      setStats(statsRes.data.data);
      setPendingDeliveries(deliveriesRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'warning',
      assigned: 'info',
      picked_up: 'primary',
      in_transit: 'primary',
      out_for_delivery: 'primary',
      delivered: 'success',
      failed: 'danger',
    };
    return <Badge variant={variants[status] || 'default'}>{status?.replace(/_/g, ' ')}</Badge>;
  };

  if (loading) {
    return <Loading />;
  }

  const statCards = [
    {
      title: 'Total Deliveries',
      value: stats?.total_deliveries || 0,
      icon: FaTruck,
      color: 'bg-blue-500',
    },
    {
      title: 'Completed',
      value: stats?.completed || 0,
      icon: FaCheckCircle,
      color: 'bg-green-500',
    },
    {
      title: 'Pending',
      value: stats?.pending || 0,
      icon: FaClock,
      color: 'bg-yellow-500',
    },
    {
      title: 'Today',
      value: stats?.today || 0,
      icon: FaTruck,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Rider Dashboard</h1>
        <p className="text-gray-600">Welcome! Here&apos;s your delivery overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Deliveries */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Pending Deliveries</h2>
          <Link to="/rider/deliveries" className="text-blue-600 hover:text-blue-700 text-sm">
            View All
          </Link>
        </div>
        
        {pendingDeliveries.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {pendingDeliveries.slice(0, 5).map((delivery) => (
              <div key={delivery.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{delivery.tracking_number}</p>
                    <p className="text-sm text-gray-500">
                      Order: {delivery.order?.order_number}
                    </p>
                    <p className="text-sm text-gray-500">
                      {delivery.order?.shipping_city}
                    </p>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(delivery.status)}
                    <Link
                      to={`/rider/deliveries`}
                      className="block mt-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <FaCheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
            <p>No pending deliveries. Great job!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
