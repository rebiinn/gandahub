import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaTruck,
  FaWarehouse,
  FaMotorcycle,
  FaCheckCircle,
  FaUsers,
  FaUserClock,
} from 'react-icons/fa';
import { logisticsAPI } from '../../services/api';
import Loading from '../../components/common/Loading';
import Badge from '../../components/common/Badge';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await logisticsAPI.getDashboard();
        setData(response.data?.data || null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Loading />;

  const cards = data?.cards || {};
  const stats = [
    { title: 'Total Deliveries', value: cards.total_deliveries || 0, icon: FaTruck, color: 'bg-blue-500' },
    { title: 'Awaiting Hub Intake', value: cards.awaiting_hub_intake || 0, icon: FaWarehouse, color: 'bg-amber-500' },
    { title: 'In Progress', value: cards.at_hub_or_in_progress || 0, icon: FaMotorcycle, color: 'bg-purple-500' },
    { title: 'Delivered Today', value: cards.delivered_today || 0, icon: FaCheckCircle, color: 'bg-green-500' },
    { title: 'Active Riders', value: cards.active_riders || 0, icon: FaUsers, color: 'bg-cyan-500' },
    { title: 'Pending Driver Applicants', value: cards.pending_driver_applications || 0, icon: FaUserClock, color: 'bg-pink-500' },
  ];

  const statusBreakdown = data?.status_breakdown || {};

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Logistics Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Live overview of deliveries, rider pool, and driver applications.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <Icon className="text-white w-5 h-5" />
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Delivery Status Breakdown</h2>
          <div className="space-y-2">
            {Object.entries(statusBreakdown).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{key.replace(/_/g, ' ')}</span>
                <span className="font-semibold text-gray-800">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Recent Driver Applications</h2>
            <Link to="/logistics/applications" className="text-sm text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {(data?.recent_driver_applications || []).length === 0 ? (
              <p className="text-sm text-gray-500">No recent applications.</p>
            ) : (
              data.recent_driver_applications.map((app) => (
                <div key={app.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{app.first_name} {app.last_name}</p>
                    <p className="text-xs text-gray-500">{app.email}</p>
                  </div>
                  <Badge variant={app.status === 'pending' ? 'warning' : app.status === 'approved' ? 'success' : 'danger'}>
                    {app.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Recent Deliveries</h2>
          <Link to="/logistics/deliveries" className="text-sm text-primary-600 hover:text-primary-700">
            Manage deliveries
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Tracking</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Order</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(data?.recent_deliveries || []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500" colSpan={4}>No deliveries yet.</td>
                </tr>
              ) : (
                data.recent_deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{delivery.tracking_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{delivery.order?.order_number || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {delivery.order?.user ? `${delivery.order.user.first_name} ${delivery.order.user.last_name}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={delivery.status === 'delivered' ? 'success' : 'info'}>
                        {delivery.status?.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

