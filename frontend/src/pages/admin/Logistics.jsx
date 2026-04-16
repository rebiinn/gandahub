import { useState, useEffect, useMemo, useCallback } from 'react';
import { FaEye } from 'react-icons/fa';
import { deliveriesAPI, logisticsAPI, riderApplicationsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import LogisticsHandoffPanel from '../../components/logistics/LogisticsHandoffPanel';

/**
 * Dedicated logistics workflow: regional hub (Luzon / Visayas / Mindanao), local carriers, branch dropdowns,
 * station intake, customer notification, and rider assignment.
 */
const Logistics = () => {
  const { isLogistics } = useAuth();
  const [tab, setTab] = useState('all');
  const [catalog, setCatalog] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [riderApplications, setRiderApplications] = useState([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await (isLogistics ? logisticsAPI.logisticsGetCatalog() : logisticsAPI.getCatalog());
        if (!cancelled) setCatalog(res.data.data || null);
      } catch {
        if (!cancelled) toast.error('Failed to load logistics catalog');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLogistics]);

  const fetchRiderApplications = useCallback(async () => {
    try {
      setLoadingApplications(true);
      const response = await (isLogistics
        ? riderApplicationsAPI.logisticsGetAll({ status: 'pending', per_page: 20 })
        : riderApplicationsAPI.getAll({ status: 'pending', per_page: 20 }));
      setRiderApplications(response.data.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load rider applications');
    } finally {
      setLoadingApplications(false);
    }
  }, [isLogistics]);

  useEffect(() => {
    if (isLogistics) {
      fetchRiderApplications();
    }
  }, [isLogistics, fetchRiderApplications]);

  const fetchList = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page,
        per_page: 15,
      };
      if (tab === 'intake') params.logistics_intake_pending = true;
      if (tab === 'progress') params.logistics_after_intake = true;
      const response = await (isLogistics ? deliveriesAPI.logisticsGetAll(params) : deliveriesAPI.getAll(params));
      setDeliveries(response.data.data || []);
      setMeta(response.data.meta || { current_page: 1, last_page: 1 });
      setLastUpdatedAt(new Date().toISOString());
    } catch (e) {
      console.error(e);
      toast.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, [tab, isLogistics]);

  useEffect(() => {
    fetchList(1);
  }, [fetchList]);

  const openDetail = async (id) => {
    try {
      const response = await (isLogistics ? deliveriesAPI.logisticsGetOne(id) : deliveriesAPI.getOne(id));
      setSelectedDelivery(response.data.data);
      setShowModal(true);
    } catch {
      toast.error('Failed to load delivery');
    }
  };

  const regionLabel = useCallback((key) => catalog?.regions?.find((r) => r.key === key)?.label || key || '—', [catalog]);
  const getEffectiveStatus = (delivery) => {
    const orderStatus = String(delivery?.order?.status || '').toLowerCase();
    if (orderStatus === 'cancelled' || orderStatus === 'refunded') {
      return orderStatus;
    }
    return String(delivery?.status || '').toLowerCase();
  };
  const badgeVariant = (status) => {
    if (status === 'cancelled' || status === 'refunded' || status === 'failed' || status === 'returned') return 'danger';
    if (status === 'delivered') return 'success';
    if (status === 'pending') return 'warning';
    return 'info';
  };

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      const status = getEffectiveStatus(d);
      const matchStatus = statusFilter === 'all' || status === statusFilter;

      const haystack = [
        d.tracking_number,
        d.order?.order_number,
        d.order?.user?.first_name,
        d.order?.user?.last_name,
        d.order?.shipping_city,
        d.logistics_provider,
        regionLabel(d.logistics_region),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchSearch = !searchTerm.trim() || haystack.includes(searchTerm.trim().toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [deliveries, statusFilter, searchTerm, regionLabel]);

  const queueStats = useMemo(() => {
    const activeDeliveries = deliveries.filter((d) => {
      const status = getEffectiveStatus(d);
      return status !== 'cancelled' && status !== 'refunded' && status !== 'failed' && status !== 'returned';
    });
    return {
      total: deliveries.length,
      unassigned: activeDeliveries.filter((d) => !d.rider_id).length,
      atStation: activeDeliveries.filter((d) => Boolean(d.station_arrived_at)).length,
      outForDelivery: activeDeliveries.filter((d) => getEffectiveStatus(d) === 'out_for_delivery').length,
    };
  }, [deliveries]);

  const approveRiderApplication = async (id) => {
    try {
      await riderApplicationsAPI.logisticsApprove(id, {});
      toast.success('Driver application approved.');
      fetchRiderApplications();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve driver application');
    }
  };

  const rejectRiderApplication = async (id) => {
    const review_note = window.prompt('Optional reason for rejection:', '') || '';
    try {
      await riderApplicationsAPI.logisticsReject(id, { review_note });
      toast.success('Driver application rejected.');
      fetchRiderApplications();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject driver application');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Logistics</h1>
          <p className="text-sm text-gray-600 mt-1">
            Local hubs: Luzon, Visayas, Mindanao — carriers: LBC, J&amp;T, Ninja Van, 2GO. Receive parcels at a branch,
            notify the customer, then assign riders for last-mile delivery.
          </p>
          {!isLogistics && (
            <p className="text-xs text-amber-700 mt-2">
              Admin monitoring only - logistics handoff actions are supplier-managed.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'all' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          All deliveries
        </button>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl shadow-sm p-3">
          <p className="text-xs text-gray-500">Queue Total</p>
          <p className="text-xl font-bold text-gray-800">{queueStats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3">
          <p className="text-xs text-gray-500">Unassigned</p>
          <p className="text-xl font-bold text-amber-600">{queueStats.unassigned}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3">
          <p className="text-xs text-gray-500">Checked-in at hub</p>
          <p className="text-xl font-bold text-blue-600">{queueStats.atStation}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3">
          <p className="text-xs text-gray-500">Out for delivery</p>
          <p className="text-xl font-bold text-green-600">{queueStats.outForDelivery}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tracking, order, customer, city, provider..."
            className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          >
            <option value="all">All statuses</option>
            <option value="cancelled">cancelled</option>
            <option value="refunded">refunded</option>
            <option value="pending">pending</option>
            <option value="assigned">assigned</option>
            <option value="picked_up">picked up</option>
            <option value="in_transit">in transit</option>
            <option value="out_for_delivery">out for delivery</option>
            <option value="delivered">delivered</option>
            <option value="failed">failed</option>
            <option value="returned">returned</option>
          </select>
          <Button variant="outline" onClick={() => fetchList(meta.current_page)}>
            Refresh
          </Button>
          <p className="text-xs text-gray-500 md:ml-auto">
            Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString('en-PH') : '—'}
          </p>
        </div>
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
                {filteredDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                      {deliveries.length === 0
                        ? 'No deliveries in this queue.'
                        : 'No deliveries match your current search/filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredDeliveries.map((d) => (
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

      {isLogistics && (
      <div className="mt-8 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Driver Applications (Logistics Approval)</h2>
          <p className="text-sm text-gray-600">Only logistics workflow should review and approve rider applicants.</p>
        </div>
        {loadingApplications ? (
          <Loading />
        ) : riderApplications.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No pending driver applications.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applicant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {riderApplications.map((application) => (
                  <tr key={application.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{application.first_name} {application.last_name}</p>
                      <p className="text-sm text-gray-500">{application.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{application.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {[application.address, application.city, application.state, application.zip_code].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">{application.message || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      {application.document_url ? (
                        <a
                          href={application.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700 underline"
                        >
                          {application.document_name || 'View document'}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="primary" onClick={() => approveRiderApplication(application.id)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => rejectRiderApplication(application.id)}>
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

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
              readOnly
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

export default Logistics;
