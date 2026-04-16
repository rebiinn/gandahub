import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FaEye, FaSearch, FaFilter, FaSync, FaShoppingBag, FaCheckCircle, FaBan, FaMoneyBillWave } from 'react-icons/fa';
import { ordersAPI } from '../../services/api';
import { formatShadeOptionLabel } from '../../utils/productShades';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    date_from: '',
    date_to: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchOrders = useCallback(async (page = 1, activeFilters = filtersRef.current) => {
    try {
      setLoading(true);
      const params = { page, ...activeFilters };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const response = await ordersAPI.getAll(params);
      setOrders(response.data.data || []);
      setMeta(response.data.meta || { current_page: 1, last_page: 1 });
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const viewOrder = async (id) => {
    try {
      const response = await ordersAPI.getOne(id);
      setSelectedOrder(response.data.data);
      setShowModal(true);
    } catch (error) {
      toast.error('Failed to fetch order details');
    }
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(amount || 0));
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'warning',
      confirmed: 'info',
      processing: 'info',
      shipped: 'primary',
      out_for_delivery: 'primary',
      delivered: 'success',
      cancelled: 'danger',
      refunded: 'danger',
    };
    return <Badge variant={variants[status] || 'default'}>{status?.replace(/_/g, ' ')}</Badge>;
  };

  const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'];

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!searchTerm.trim()) return true;
      const haystack = [
        order.order_number,
        order.shipping_first_name,
        order.shipping_last_name,
        order.shipping_email,
        order.status,
        order.payment?.payment_method,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchTerm.trim().toLowerCase());
    });
  }, [orders, searchTerm]);

  const summary = useMemo(() => {
    const totalValue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const deliveredCount = orders.filter((order) => order.status === 'delivered').length;
    const cancelledOrRefundedCount = orders.filter((order) => ['cancelled', 'refunded'].includes(order.status)).length;
    return {
      totalCount: orders.length,
      totalValue,
      deliveredCount,
      cancelledOrRefundedCount,
    };
  }, [orders]);

  const clearFilters = () => {
    const reset = { search: '', status: '', date_from: '', date_to: '' };
    setFilters(reset);
    setSearchTerm('');
    fetchOrders(1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaShoppingBag />
            Total (page)
          </div>
          <p className="text-2xl font-bold text-gray-800 mt-1">{summary.totalCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaMoneyBillWave />
            Gross value (page)
          </div>
          <p className="text-2xl font-bold text-primary-600 mt-1">{formatPrice(summary.totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaCheckCircle />
            Delivered
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">{summary.deliveredCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaBan />
            Cancelled / Refunded
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">{summary.cancelledOrRefundedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <form onSubmit={(e) => { e.preventDefault(); fetchOrders(); }} className="flex flex-wrap gap-4">
          <div className="relative min-w-[260px] flex-grow">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Quick search on this page..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="relative min-w-[260px] flex-grow">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Server search: order #, customer, email, payment..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          >
            <option value="">All Statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            title="From date"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            title="To date"
          />
          <Button type="submit" variant="primary">
            <FaFilter />
            Filter
          </Button>
          <Button type="button" variant="outline" onClick={() => fetchOrders(meta.current_page)}>
            <FaSync />
            Refresh
          </Button>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear
          </Button>
          <p className="text-xs text-gray-500 flex items-center ml-auto">
            Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString('en-PH') : '—'}
          </p>
        </form>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                      No orders match your current filters/search.
                    </td>
                  </tr>
                ) : filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{order.order_number}</p>
                      <p className="text-sm text-gray-500">{order.items?.length || 0} items</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-800">{order.shipping_first_name} {order.shipping_last_name}</p>
                      <p className="text-sm text-gray-500">{order.shipping_email}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-6 py-4 flex items-center gap-1">
                      <button
                        onClick={() => viewOrder(order.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="View details"
                      >
                        <FaEye />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 border-t">
          <Pagination
            currentPage={meta.current_page}
            totalPages={meta.last_page}
            onPageChange={fetchOrders}
          />
        </div>
      </div>

      {/* Order Details Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Order ${selectedOrder?.order_number}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Status */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Current Status</p>
                {getStatusBadge(selectedOrder.status)}
              </div>
              <p className="text-sm text-gray-500">Monitoring only - supplier-managed fulfillment</p>
            </div>

            {/* Customer Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Customer</h4>
                <p className="text-gray-600">{selectedOrder.user?.first_name} {selectedOrder.user?.last_name}</p>
                <p className="text-gray-600">{selectedOrder.user?.email}</p>
                <p className="text-gray-600">{selectedOrder.shipping_phone || '-'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Shipping Address</h4>
                <p className="text-gray-600">{selectedOrder.shipping_address}</p>
                <p className="text-gray-600">{selectedOrder.shipping_city}, {selectedOrder.shipping_zip_code}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Payment Snapshot</h4>
                <p className="text-gray-600 capitalize">
                  Method: {selectedOrder.payment?.payment_method?.replace(/_/g, ' ') || '-'}
                </p>
                <p className="text-gray-600">
                  Status: {selectedOrder.payment?.status || '-'}
                </p>
                <p className="text-gray-600">
                  Paid at: {selectedOrder.payment?.paid_at ? formatDate(selectedOrder.payment.paid_at) : '-'}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Delivery Snapshot</h4>
                <p className="text-gray-600 capitalize">
                  Delivery status: {selectedOrder.delivery?.status?.replace(/_/g, ' ') || '-'}
                </p>
                <p className="text-gray-600">
                  Rider: {selectedOrder.delivery?.rider?.first_name
                    ? `${selectedOrder.delivery.rider.first_name} ${selectedOrder.delivery.rider.last_name || ''}`.trim()
                    : '-'}
                </p>
                <p className="text-gray-600">
                  Tracking: {selectedOrder.delivery?.tracking_number || '-'}
                </p>
              </div>
            </div>

            {(selectedOrder.cancel_reason || selectedOrder.cancel_details || selectedOrder.cancelled_at) && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <h4 className="font-medium text-red-700 mb-2">Cancellation Context</h4>
                <p className="text-sm text-red-700">
                  Reason: {selectedOrder.cancel_reason || '-'}
                </p>
                {selectedOrder.cancel_details && (
                  <p className="text-sm text-red-700 mt-1">
                    Details: {selectedOrder.cancel_details}
                  </p>
                )}
                {selectedOrder.cancelled_at && (
                  <p className="text-sm text-red-700 mt-1">
                    Cancelled at: {formatDate(selectedOrder.cancelled_at)}
                  </p>
                )}
              </div>
            )}

            {/* Items */}
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Order Items</h4>
              <div className="space-y-2">
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800">{item.product_name}</p>
                      {formatShadeOptionLabel(item.options) && (
                        <p className="text-sm text-primary-600 font-medium">{formatShadeOptionLabel(item.options)}</p>
                      )}
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium">{formatPrice(item.total_price)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatPrice(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span>{formatPrice(selectedOrder.tax)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Shipping</span>
                <span>{formatPrice(selectedOrder.shipping_fee)}</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatPrice(selectedOrder.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                <span>Total</span>
                <span className="text-primary-600">{formatPrice(selectedOrder.total)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Orders;
