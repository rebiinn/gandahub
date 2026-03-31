import { useState, useEffect } from 'react';
import { FaCheck, FaTimes, FaBox } from 'react-icons/fa';
import { stockRequestsAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import { toAbsoluteImageUrl, PLACEHOLDER_PRODUCT } from '../../utils/imageUrl';
import Modal from '../../components/common/Modal';

const StockRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [fulfilling, setFulfilling] = useState(null);
  const [declineRequest, setDeclineRequest] = useState(null);
  const [declineReason, setDeclineReason] = useState('');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await stockRequestsAPI.getAll({ status: filter });
      setRequests(res.data.data || []);
    } catch (error) {
      console.error('Failed to load requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const handleFulfill = async (req) => {
    try {
      setFulfilling(req.id);
      await stockRequestsAPI.fulfill(req.id, { quantity_fulfilled: req.quantity_requested });
      toast.success('Stock released. Inventory updated.');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fulfill');
    } finally {
      setFulfilling(null);
    }
  };

  const handleDecline = (req) => {
    setDeclineRequest(req);
    setDeclineReason('');
  };

  const submitDecline = async () => {
    if (!declineRequest) return;
    try {
      setFulfilling(declineRequest.id);
      await stockRequestsAPI.decline(declineRequest.id, {
        reason: declineReason || undefined,
      });
      toast.success('Request declined');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to decline');
    } finally {
      setFulfilling(null);
      setDeclineRequest(null);
      setDeclineReason('');
    }
  };

  if (loading && requests.length === 0) return <Loading />;

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Stock Requests</h1>
      <p className="text-gray-600 mb-4">
        Ganda Hub Admin requests stock from your catalog. Approve to add the quantity to their warehouse; they can then release items to the shop.
      </p>

      <div className="flex gap-2 mb-6">
        {[
          { value: 'pending', label: 'Pending' },
          { value: 'fulfilled', label: 'Approved' },
          { value: 'declined', label: 'Rejected' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === value ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {requests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FaBox className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No {filter} requests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  {filter === 'pending' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={toAbsoluteImageUrl(req.product?.thumbnail)}
                          alt={req.product?.name}
                          className="w-10 h-10 object-cover rounded-lg"
                          onError={(e) => {
                            if (e.target.src !== PLACEHOLDER_PRODUCT) e.target.src = PLACEHOLDER_PRODUCT;
                          }}
                        />
                        <div>
                          <p className="font-medium text-gray-800">{req.product?.name}</p>
                          <p className="text-sm text-gray-500">{req.product?.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">{req.quantity_requested}</td>
                    <td className="px-6 py-4 text-gray-600">
                      Ganda Hub Cosmetics
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        req.status === 'fulfilled' ? 'bg-green-100 text-green-800' :
                        req.status === 'declined' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {req.status === 'fulfilled' ? 'Approved' : req.status === 'declined' ? 'Rejected' : 'Pending'}
                        {req.status === 'fulfilled' && req.quantity_fulfilled != null && ` (${req.quantity_fulfilled})`}
                      </span>
                    </td>
                    {filter === 'pending' && (
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleFulfill(req)}
                            disabled={fulfilling === req.id}
                          >
                            <FaCheck /> Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDecline(req)}
                            disabled={fulfilling === req.id}
                          >
                            <FaTimes /> Reject
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!declineRequest}
        onClose={() => {
          setDeclineRequest(null);
          setDeclineReason('');
        }}
        title="Reject stock request"
      >
        {declineRequest && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              You are declining the request for{' '}
              <span className="font-medium">{declineRequest.product?.name}</span>{' '}
              ({declineRequest.quantity_requested} units).
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Message to admin (optional)
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500"
                placeholder="e.g. Sorry, we're out of stock right now."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeclineRequest(null);
                  setDeclineReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={submitDecline}
                disabled={fulfilling === declineRequest.id}
              >
                <FaTimes /> Confirm Reject
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StockRequests;
