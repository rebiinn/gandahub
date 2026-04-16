import { useEffect, useState } from 'react';
import { deliveriesAPI, logisticsAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';

/**
 * Supplier logistics tracker:
 * - Seller can monitor where parcel is now.
 * - Logistics partner handles station intake configuration.
 */
export default function SupplierLogistics() {
  const [tab, setTab] = useState('all'); // all | intake | progress
  const [catalog, setCatalog] = useState(null);

  const [deliveries, setDeliveries] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });

  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await logisticsAPI.supplierGetCatalog();
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
      };
      if (tab === 'intake') params.logistics_intake_pending = true;
      if (tab === 'progress') params.logistics_after_intake = true;
      const response = await deliveriesAPI.supplierGetAll(params);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const openDetail = async (id) => {
    try {
      const response = await deliveriesAPI.supplierGetOne(id);
      setSelectedDelivery(response.data.data);
      setShowModal(true);
    } catch {
      toast.error('Failed to load delivery');
    }
  };

  const regionLabel = (key) =>
    catalog?.regions?.find((r) => r.key === key)?.label || key || '—';

  const getEffectiveStatus = (delivery) => {
    const orderStatus = String(delivery?.order?.status || '').toLowerCase();
    if (orderStatus === 'cancelled' || orderStatus === 'refunded') return orderStatus;
    return String(delivery?.status || '').toLowerCase();
  };

  const getCurrentLocationText = (delivery) => {
    const status = getEffectiveStatus(delivery);
    if (status === 'cancelled' || status === 'refunded') return 'Order cancelled';
    if (delivery?.status === 'delivered') return 'Delivered to customer';
    if (delivery?.current_location) return delivery.current_location;
    if (delivery?.station_arrived_at) {
      const region = regionLabel(delivery.logistics_region);
      return [
        delivery.logistics_provider,
        delivery.logistics_station_name,
        delivery.logistics_station_city || region,
      ].filter(Boolean).join(' - ');
    }
    if (delivery?.order?.status === 'shipped') return 'In transit to logistics hub';
    return 'Awaiting shipment from seller';
  };

  const getLatestUpdate = (delivery) => {
    const candidates = [
      delivery?.delivered_at,
      delivery?.picked_up_at,
      delivery?.auto_assigned_at,
      delivery?.station_arrived_at,
      delivery?.updated_at,
      delivery?.created_at,
    ].filter(Boolean);
    if (candidates.length === 0) return '—';
    const latest = candidates
      .map((dt) => new Date(dt))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return latest.toLocaleString('en-PH');
  };

  const buildTimeline = (delivery) => {
    const items = [
      {
        key: 'placed',
        label: 'Order placed',
        date: delivery?.order?.created_at,
        detail: delivery?.order?.order_number ? `Order ${delivery.order.order_number}` : null,
      },
      {
        key: 'shipped',
        label: 'Seller marked order as shipped',
        date: delivery?.order?.shipped_at,
      },
      {
        key: 'station',
        label: 'Arrived at logistics station',
        date: delivery?.station_arrived_at,
        detail: [
          delivery?.logistics_provider,
          delivery?.logistics_station_name,
          delivery?.logistics_station_city,
        ].filter(Boolean).join(' - '),
      },
      {
        key: 'assigned',
        label: 'Rider assigned',
        date: delivery?.auto_assigned_at,
        detail: delivery?.rider ? `${delivery.rider.first_name} ${delivery.rider.last_name}` : null,
      },
      {
        key: 'pickup',
        label: 'Picked up by rider',
        date: delivery?.picked_up_at,
      },
      {
        key: 'delivered',
        label: 'Delivered',
        date: delivery?.delivered_at,
      },
    ];

    const orderStatus = String(delivery?.order?.status || '').toLowerCase();
    if (orderStatus === 'cancelled' || orderStatus === 'refunded') {
      items.push({
        key: 'cancelled',
        label: orderStatus === 'refunded' ? 'Order refunded' : 'Order cancelled',
        date: delivery?.updated_at || delivery?.order?.updated_at,
      });
    }

    return items;
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
      returned: 'danger',
      cancelled: 'danger',
      refunded: 'danger',
    };
    return <Badge variant={variants[status] || 'default'}>{status?.replace(/_/g, ' ')}</Badge>;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Logistics Tracker</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track where each parcel is now, including station intake, rider assignment, and delivery updates.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'all' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          All shipments
        </button>
        <button
          type="button"
          onClick={() => setTab('intake')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'intake' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          Awaiting hub intake
        </button>
        <button
          type="button"
          onClick={() => setTab('progress')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'progress' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latest update</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
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
                        {getCurrentLocationText(d)}
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
                      <td className="px-6 py-4 text-xs text-gray-600">{getLatestUpdate(d)}</td>
                      <td className="px-6 py-4">{getStatusBadge(getEffectiveStatus(d))}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => openDetail(d.id)}
                          className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg"
                          aria-label="View"
                        >
                          Track
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
          <Pagination
            currentPage={meta.current_page}
            totalPages={meta.last_page}
            onPageChange={fetchList}
          />
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
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase">Current location</p>
                <p className="text-sm font-medium text-gray-800 mt-1">{getCurrentLocationText(selectedDelivery)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase">Status</p>
                <div className="mt-1">{getStatusBadge(getEffectiveStatus(selectedDelivery))}</div>
              </div>
            </div>
            <div className="text-sm text-gray-600 bg-white border rounded-lg p-3">
              <p>
                <span className="font-medium text-gray-800">Ship to:</span>{' '}
                {selectedDelivery.order?.shipping_address}, {selectedDelivery.order?.shipping_city}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-3">Tracking timeline</h4>
              <div className="space-y-3">
                {buildTimeline(selectedDelivery).map((item) => {
                  const done = Boolean(item.date);
                  return (
                    <div key={item.key} className="flex items-start gap-3">
                      <div className={`mt-1 w-2.5 h-2.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <div>
                        <p className={`text-sm font-medium ${done ? 'text-gray-800' : 'text-gray-500'}`}>{item.label}</p>
                        <p className="text-xs text-gray-500">
                          {item.date ? new Date(item.date).toLocaleString('en-PH') : 'Not yet'}
                        </p>
                        {item.detail && <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

