import { useEffect, useState, useCallback } from 'react';
import { FaEye } from 'react-icons/fa';
import { deliveriesAPI, logisticsAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import LogisticsHandoffPanel from '../../components/logistics/LogisticsHandoffPanel';

const Deliveries = () => {
  const [tab, setTab] = useState('all');
  const [catalog, setCatalog] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const res = await logisticsAPI.logisticsGetCatalog();
        setCatalog(res.data.data || null);
      } catch {
        toast.error('Failed to load logistics catalog');
      }
    };
    loadCatalog();
  }, []);

  const fetchList = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, per_page: 15 };
      if (tab === 'intake') params.logistics_intake_pending = true;
      if (tab === 'progress') params.logistics_after_intake = true;
      const response = await deliveriesAPI.logisticsGetAll(params);
      setDeliveries(response.data.data || []);
      setMeta(response.data.meta || { current_page: 1, last_page: 1 });
    } catch (error) {
      console.error(error);
      toast.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchList(1);
  }, [fetchList]);

  const openDetail = async (id) => {
    try {
      const response = await deliveriesAPI.logisticsGetOne(id);
      setSelectedDelivery(response.data.data);
      setShowModal(true);
    } catch {
      toast.error('Failed to load delivery details');
    }
  };

  const regionLabel = (key) => catalog?.regions?.find((r) => r.key === key)?.label || key || '—';
  const badgeVariant = (status) => {
    if (status === 'cancelled' || status === 'refunded') return 'danger';
    if (status === 'delivered') return 'success';
    if (status === 'failed' || status === 'returned') return 'danger';
    if (status === 'pending') return 'warning';
    return 'info';
  };
  const getEffectiveStatus = (delivery) => {
    const orderStatus = delivery?.order?.status;
    if (orderStatus === 'cancelled' || orderStatus === 'refunded') {
      return orderStatus;
    }
    return delivery?.status;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Deliveries</h1>
        <p className="text-sm text-gray-600 mt-1">
          Track hub intake and active last-mile deliveries managed by logistics operations.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab('intake')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'intake' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          Awaiting hub intake
        </button>
        <button
          type="button"
          onClick={() => setTab('progress')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'progress' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          At hub / out for delivery
        </button>
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'all' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          All
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tracking</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer / City</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region / Provider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                      No deliveries found.
                    </td>
                  </tr>
                ) : (
                  deliveries.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-800">{d.tracking_number}</td>
                      <td className="px-6 py-4 text-gray-600">{d.order?.order_number || '-'}</td>
                      <td className="px-6 py-4">
                        <p className="text-gray-800">
                          {d.order?.user ? `${d.order.user.first_name} ${d.order.user.last_name}` : '-'}
                        </p>
                        <p className="text-sm text-gray-500">{d.order?.shipping_city || '-'}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <p>{regionLabel(d.logistics_region)}</p>
                        <p className="text-gray-500">{d.logistics_provider || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        {d.rider ? (
                          <span className="text-gray-800">{d.rider.first_name} {d.rider.last_name}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={badgeVariant(getEffectiveStatus(d))}>
                          {getEffectiveStatus(d)?.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => openDetail(d.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          aria-label="View"
                        >
                          <FaEye />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 border-t">
          <Pagination currentPage={meta.current_page} totalPages={meta.last_page} onPageChange={fetchList} />
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedDelivery ? `Delivery ${selectedDelivery.tracking_number}` : 'Delivery'}
        size="lg"
      >
        {selectedDelivery && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p>
                <span className="font-medium text-gray-800">Ship to:</span>{' '}
                {selectedDelivery.order?.shipping_address}, {selectedDelivery.order?.shipping_city}
              </p>
            </div>
            <LogisticsHandoffPanel
              catalog={catalog}
              delivery={selectedDelivery}
              onSuccess={(updated) => {
                setSelectedDelivery(updated);
                fetchList(meta.current_page);
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Deliveries;

