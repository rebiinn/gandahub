import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaEye, FaUserPlus } from 'react-icons/fa';
import { deliveriesAPI, logisticsAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LogisticsHandoffPanel from '../../components/logistics/LogisticsHandoffPanel';

/**
 * Dedicated logistics workflow: regional hub (Luzon / Visayas / Mindanao), local carriers, branch dropdowns,
 * station intake, customer notification, and rider assignment.
 */
const Logistics = () => {
  const [tab, setTab] = useState('intake');
  const [catalog, setCatalog] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [riders, setRiders] = useState([]);
  const [selectedRider, setSelectedRider] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await logisticsAPI.getCatalog();
        if (!cancelled) setCatalog(res.data.data || null);
      } catch {
        if (!cancelled) toast.error('Failed to load logistics catalog');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchList = async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page,
        per_page: 15,
        ...(tab === 'intake'
          ? { logistics_intake_pending: true }
          : { logistics_after_intake: true }),
      };
      const response = await deliveriesAPI.getAll(params);
      setDeliveries(response.data.data || []);
      setMeta(response.data.meta || { current_page: 1, last_page: 1 });
    } catch (e) {
      console.error(e);
      toast.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(1);
  }, [tab]);

  const openDetail = async (id) => {
    try {
      const response = await deliveriesAPI.getOne(id);
      setSelectedDelivery(response.data.data);
      setShowModal(true);
    } catch {
      toast.error('Failed to load delivery');
    }
  };

  const fetchRiders = async () => {
    try {
      const response = await deliveriesAPI.getAvailableRiders();
      setRiders(response.data.data || []);
    } catch {
      toast.error('Failed to load riders');
    }
  };

  const openAssign = (id) => {
    setAssigningId(id);
    setSelectedRider('');
    setShowAssignModal(true);
    fetchRiders();
  };

  const assignRider = async () => {
    if (!selectedRider || !assigningId) return;
    try {
      await deliveriesAPI.assignRider(assigningId, selectedRider);
      toast.success('Rider assigned — customer notified if this is a new assignment');
      setShowAssignModal(false);
      fetchList(meta.current_page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Assign failed');
    }
  };

  const regionLabel = (key) => catalog?.regions?.find((r) => r.key === key)?.label || key || '—';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Logistics</h1>
          <p className="text-sm text-gray-600 mt-1">
            Local hubs: Luzon, Visayas, Mindanao — carriers: LBC, J&amp;T, Ninja Van, 2GO. Receive parcels at a branch,
            notify the customer, then assign riders for last-mile delivery.
          </p>
        </div>
        <Link to="/admin/deliveries" className="text-sm font-medium text-primary-600 hover:text-primary-700">
          ← All deliveries
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
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
                      No deliveries in this queue.
                    </td>
                  </tr>
                ) : (
                  deliveries.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-800">{d.tracking_number}</td>
                      <td className="px-6 py-4 text-gray-600">{d.order?.order_number}</td>
                      <td className="px-6 py-4">
                        <p className="text-gray-800">
                          {d.order?.user?.first_name} {d.order?.user?.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{d.order?.shipping_city}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <p>{regionLabel(d.logistics_region)}</p>
                        <p className="text-gray-500">{d.logistics_provider || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        {d.rider ? (
                          <span className="text-gray-800">
                            {d.rider.first_name} {d.rider.last_name}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openAssign(d.id)}
                            className="text-primary-600 hover:text-primary-700 flex items-center gap-1 text-sm"
                          >
                            <FaUserPlus /> Assign
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={d.status === 'pending' ? 'warning' : 'info'}>{d.status?.replace(/_/g, ' ')}</Badge>
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

      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign rider">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Rider</label>
          <select
            value={selectedRider}
            onChange={(e) => setSelectedRider(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          >
            <option value="">Select rider…</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.first_name} {r.last_name} — {r.phone}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={assignRider}>
              Assign
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Logistics;
