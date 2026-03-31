import { useState, useEffect } from 'react';
import { ordersAPI } from '../../services/api';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';

const SupplierOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });

  const fetchOrders = async (page = 1) => {
    try {
      setLoading(true);
      const res = await ordersAPI.getAll({ page, per_page: 10 });
      setOrders(res.data.data || []);
      setMeta(res.data.meta || { current_page: 1, last_page: 1 });
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const formatPrice = (amount) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

  if (loading && orders.length === 0) return <Loading />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Orders (Your Products)</h1>
      <p className="text-gray-600 mb-4">Orders that include products from your store</p>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {orders.length === 0 ? (
          <p className="p-8 text-gray-500 text-center">No orders yet</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{order.order_number}</td>
                      <td className="px-6 py-4">
                        {order.user ? `${order.user.first_name} ${order.user.last_name}` : '-'}
                        <br />
                        <span className="text-sm text-gray-500">{order.shipping_email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 capitalize">{order.status}</span>
                      </td>
                      <td className="px-6 py-4 font-medium">{formatPrice(order.total)}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t">
              <Pagination
                currentPage={meta.current_page}
                totalPages={meta.last_page}
                onPageChange={fetchOrders}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SupplierOrders;
