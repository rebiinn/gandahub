import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FaEye, FaMoneyBillWave, FaCheckCircle, FaClock, FaUndoAlt, FaSearch, FaSync } from 'react-icons/fa';
import { paymentsAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const statusFilterRef = useRef(statusFilter);
  const methodFilterRef = useRef(methodFilter);

  useEffect(() => {
    statusFilterRef.current = statusFilter;
    methodFilterRef.current = methodFilter;
  }, [statusFilter, methodFilter]);

  const fetchPayments = useCallback(async (page = 1, statusOverride, methodOverride) => {
    try {
      setLoading(true);
      const params = { page };
      const status = statusOverride !== undefined ? statusOverride : statusFilterRef.current;
      const method = methodOverride !== undefined ? methodOverride : methodFilterRef.current;
      if (status) params.status = status;
      if (method) params.payment_method = method;
      const response = await paymentsAPI.getAll(params);
      setPayments(response.data.data || []);
      setMeta(response.data.meta || { current_page: 1, last_page: 1 });
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch payments:', error);
      toast.error('Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const viewPayment = async (id) => {
    try {
      const response = await paymentsAPI.getOne(id);
      setSelectedPayment(response.data.data);
      setShowModal(true);
    } catch (error) {
      toast.error('Failed to fetch payment details');
    }
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
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
      processing: 'warning',
      completed: 'success',
      failed: 'danger',
      refunded: 'info',
      cancelled: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{status?.replace('_', ' ')}</Badge>;
  };

  const getMethodBadge = (method) => {
    const key = String(method || '').toLowerCase();
    const variants = {
      cod: 'warning',
      gcash: 'primary',
    };
    return <Badge variant={variants[key] || 'default'}>{key.replace(/_/g, ' ')}</Badge>;
  };

  const statuses = ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'];
  const methods = ['cod', 'gcash'];

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      if (!searchTerm.trim()) return true;
      const haystack = [
        payment.order?.order_number,
        payment.order?.user?.first_name,
        payment.order?.user?.last_name,
        payment.transaction_id,
        payment.payment_method,
        payment.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchTerm.trim().toLowerCase());
    });
  }, [payments, searchTerm]);

  const summary = useMemo(() => {
    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const completedAmount = payments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const refundedAmount = payments
      .filter((p) => p.status === 'refunded')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const processingCount = payments.filter((p) => p.status === 'processing').length;
    return {
      totalAmount,
      completedAmount,
      refundedAmount,
      processingCount,
    };
  }, [payments]);

  const clearFilters = () => {
    setStatusFilter('');
    setMethodFilter('');
    setSearchTerm('');
    fetchPayments(1, '', '');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Payments</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaMoneyBillWave />
            Total (page)
          </div>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatPrice(summary.totalAmount)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaCheckCircle />
            Completed amount
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatPrice(summary.completedAmount)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaUndoAlt />
            Refunded amount
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatPrice(summary.refundedAmount)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaClock />
            Processing count
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-1">{summary.processingCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="relative min-w-[260px] flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search order, customer, transaction..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              const val = e.target.value;
              setStatusFilter(val);
              fetchPayments(1, val, methodFilter);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          >
            <option value="">All Statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={methodFilter}
            onChange={(e) => {
              const val = e.target.value;
              setMethodFilter(val);
              fetchPayments(1, statusFilter, val);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          >
            <option value="">All Methods</option>
            {methods.map((m) => (
              <option key={m} value={m}>{m.replace('_', ' ')}</option>
            ))}
          </select>
          <Button variant="outline" onClick={() => fetchPayments(meta.current_page)}>
            <FaSync />
            Refresh
          </Button>
          <Button variant="outline" onClick={clearFilters}>
            Clear
          </Button>
          <p className="text-xs text-gray-500 flex items-center ml-auto">
            Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString('en-PH') : '—'}
          </p>
        </div>
      </div>

      {/* Payments Table */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                      No payments match your current filters/search.
                    </td>
                  </tr>
                ) : filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {payment.order?.order_number}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {payment.order?.user
                        ? `${payment.order.user.first_name} ${payment.order.user.last_name}`
                        : '-'}
                    </td>
                    <td className="px-6 py-4">{getMethodBadge(payment.payment_method)}</td>
                    <td className="px-6 py-4 font-medium">{formatPrice(payment.amount)}</td>
                    <td className="px-6 py-4">{getStatusBadge(payment.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(payment.paid_at)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => viewPayment(payment.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
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

        <div className="p-4 border-t">
          <Pagination
            currentPage={meta.current_page}
            totalPages={meta.last_page}
            onPageChange={fetchPayments}
          />
        </div>
      </div>

      {/* Payment Details Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Payment #${selectedPayment?.id}`}
        size="md"
      >
        {selectedPayment && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                <FaMoneyBillWave className="text-primary-600" />
                Payment Details
              </h4>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Order:</span> <span className="font-medium">{selectedPayment.order?.order_number}</span></p>
                <p><span className="text-gray-500">Customer:</span> {selectedPayment.order?.user?.first_name} {selectedPayment.order?.user?.last_name}</p>
                <p><span className="text-gray-500">Method:</span> <span className="capitalize">{selectedPayment.payment_method?.replace('_', ' ')}</span></p>
                <p><span className="text-gray-500">Status:</span> {getStatusBadge(selectedPayment.status)}</p>
                <p><span className="text-gray-500">Amount:</span> <span className="font-semibold">{formatPrice(selectedPayment.amount)}</span></p>
                <p><span className="text-gray-500">Transaction ID:</span> {selectedPayment.transaction_id || '-'}</p>
                <p><span className="text-gray-500">Paid At:</span> {formatDate(selectedPayment.paid_at)}</p>
              </div>
            </div>

            <p className="text-sm text-gray-500">Monitoring only - payment transactions are system/customer/supplier driven.</p>

            {selectedPayment.notes && (
              <div>
                <p className="text-sm text-gray-500">Notes</p>
                <p className="text-gray-800">{selectedPayment.notes}</p>
              </div>
            )}
            {selectedPayment.payment_details && Object.keys(selectedPayment.payment_details).length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Provider details</p>
                <pre className="text-xs text-gray-700 bg-gray-50 border rounded-lg p-3 overflow-auto max-h-56">
                  {JSON.stringify(selectedPayment.payment_details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Payments;
