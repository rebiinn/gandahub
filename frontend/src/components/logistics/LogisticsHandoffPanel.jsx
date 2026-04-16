import { useState, useEffect, useCallback } from 'react';
import { deliveriesAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Button from '../common/Button';

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/city|province|,|philippines/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const REGION_HINTS = {
  luzon: ['manila', 'quezon', 'makati', 'baguio', 'bulacan', 'pampanga', 'batangas', 'laguna', 'cavite', 'bicol', 'ilocos', 'pangasinan', 'nueva ecija'],
  visayas: ['cebu', 'iloilo', 'bacolod', 'tacloban', 'leyte', 'bohol', 'dumaguete', 'ormoc', 'negros', 'aklan', 'antique', 'capiz', 'samar'],
  mindanao: ['davao', 'cagayan de oro', 'zamboanga', 'general santos', 'butuan', 'surigao', 'cotabato', 'bukidnon', 'misamis', 'agusan', 'sultan kudarat'],
};

const inferRegion = (city, state, address) => {
  const haystack = normalize(`${city} ${state} ${address}`);
  if (!haystack) return '';
  for (const [key, hints] of Object.entries(REGION_HINTS)) {
    if (hints.some((hint) => haystack.includes(hint))) return key;
  }
  return '';
};

/**
 * Regional logistics dropdowns (Luzon / Visayas / Mindanao) and local carriers + branch list.
 */
export default function LogisticsHandoffPanel({
  catalog,
  delivery,
  onSuccess,
  readOnly = false,
  readOnlyMessage = 'Monitoring only (logistics action required)',
}) {
  const [regionKey, setRegionKey] = useState('');
  const [provider, setProvider] = useState('');
  const [branchId, setBranchId] = useState('');
  const [autoSuggestionLabel, setAutoSuggestionLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!delivery) return;
    setRegionKey(delivery.logistics_region || '');
    setProvider(delivery.logistics_provider || '');
    setBranchId(delivery.logistics_branch_id || '');
  }, [delivery]);

  const branchOptions =
    catalog?.branches?.[regionKey]?.[provider] || [];

  const locked = Boolean(delivery?.station_arrived_at);
  const orderStatus = String(delivery?.order?.status || '').toLowerCase();
  const orderClosed = ['cancelled', 'refunded'].includes(orderStatus);
  const orderNotShipped = orderStatus !== 'shipped';

  const suggestNearestBranch = useCallback(() => {
    const branchesByRegion = catalog?.branches || {};
    const shippingCity = normalize(delivery?.order?.shipping_city);
    const shippingState = normalize(delivery?.order?.shipping_state);
    const shippingAddress = normalize(delivery?.order?.shipping_address);
    const inferredRegion = inferRegion(shippingCity, shippingState, shippingAddress);

    let best = null;
    let bestScore = -1;
    Object.entries(branchesByRegion).forEach(([reg, providers]) => {
      Object.entries(providers || {}).forEach(([prov, branches]) => {
        (branches || []).forEach((branch) => {
          const branchCity = normalize(branch.city);
          let score = 0;

          if (shippingCity && branchCity && shippingCity === branchCity) score += 12;
          else if (shippingCity && branchCity && (shippingCity.includes(branchCity) || branchCity.includes(shippingCity))) score += 8;

          if (shippingState && branchCity && shippingState.includes(branchCity)) score += 4;
          if (inferredRegion && inferredRegion === reg) score += 3;

          if (score > bestScore) {
            best = { regionKey: reg, provider: prov, branchId: branch.id, label: `${branch.name} (${reg})` };
            bestScore = score;
          }
        });
      });
    });

    if (bestScore <= 0 && inferredRegion && branchesByRegion[inferredRegion]) {
      const fallbackProvider = Object.keys(branchesByRegion[inferredRegion])[0];
      const fallbackBranch = branchesByRegion[inferredRegion]?.[fallbackProvider]?.[0];
      if (fallbackProvider && fallbackBranch) {
        return {
          regionKey: inferredRegion,
          provider: fallbackProvider,
          branchId: fallbackBranch.id,
          label: `${fallbackBranch.name} (${inferredRegion})`,
        };
      }
    }

    return best;
  }, [catalog, delivery]);

  useEffect(() => {
    if (!catalog || !delivery || readOnly || locked || delivery?.logistics_branch_id) return;
    const suggestion = suggestNearestBranch();
    if (!suggestion) return;
    setRegionKey(suggestion.regionKey);
    setProvider(suggestion.provider);
    setBranchId(suggestion.branchId);
    setAutoSuggestionLabel(suggestion.label);
  }, [catalog, delivery, readOnly, locked, suggestNearestBranch]);

  const handleSubmit = async () => {
    if (!delivery?.id) return;
    if (!regionKey || !provider || !branchId) {
      toast.error('Please select region, logistics provider, and branch');
      return;
    }

    try {
      setSubmitting(true);
      const response = await deliveriesAPI.logisticsArriveAtStation(delivery.id, {
        logistics_region: regionKey,
        logistics_provider: provider,
        branch_id: branchId,
      });
      const updated = response.data?.data ?? null;
      onSuccess?.(updated);
      toast.success(response.data?.message || 'Parcel received at station');
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to process station handoff';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!catalog) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-500">
        Loading logistics options…
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
      <h4 className="font-medium text-gray-800 mb-2">Logistics station handoff</h4>
      {delivery?.station_arrived_at && (
        <div className="text-xs bg-white border border-gray-200 rounded-lg p-3 text-gray-700">
          <p className="font-medium text-gray-800">Checked in at hub</p>
          <p>
            {delivery.logistics_provider} — {delivery.logistics_station_name}
          </p>
          <p className="text-gray-500">
            Region: {catalog?.regions?.find((r) => r.key === delivery.logistics_region)?.label || delivery.logistics_region || '—'}
          </p>
        </div>
      )}
      <p className="text-xs text-gray-600 mb-2">
        Parcel is received at a local hub (Luzon, Visayas, or Mindanao). The customer is notified, then a rider
        is auto-assigned when possible.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Assigned location (island group)</label>
          <select
            value={regionKey}
            onChange={(e) => {
              setRegionKey(e.target.value);
              setBranchId('');
            }}
            disabled={locked || readOnly}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
          >
            <option value="">Select region…</option>
            {(catalog.regions || []).map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Logistics provider</label>
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setBranchId('');
            }}
            disabled={locked || readOnly}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
          >
            <option value="">Select provider…</option>
            {(catalog.providers || []).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Branch / station</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={locked || readOnly || !regionKey || !provider || branchOptions.length === 0}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
          >
            <option value="">
              {!regionKey || !provider ? 'Choose region and provider first' : 'Select branch…'}
            </option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!locked && !readOnly && autoSuggestionLabel && (
        <p className="text-xs text-emerald-700">
          Auto-selected nearest branch: <span className="font-medium">{autoSuggestionLabel}</span>
        </p>
      )}
      {!readOnly && orderNotShipped && !orderClosed && (
        <p className="text-xs text-amber-700">
          Station intake is available only after seller marks this order as shipped.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-600">
          <p>
            Arrived at station:{' '}
            <span className="font-medium text-gray-800">
              {delivery?.station_arrived_at
                ? new Date(delivery.station_arrived_at).toLocaleString('en-PH')
                : '—'}
            </span>
          </p>
          <p>
            Auto-assigned rider:{' '}
            <span className="font-medium text-gray-800">
              {delivery?.auto_assigned_at
                ? new Date(delivery.auto_assigned_at).toLocaleString('en-PH')
                : '—'}
            </span>
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={
            readOnly ||
            submitting ||
            orderClosed ||
            orderNotShipped ||
            delivery?.status === 'delivered' ||
            Boolean(delivery?.station_arrived_at)
          }
        >
          {readOnly
            ? readOnlyMessage
            : orderClosed
            ? 'Order already cancelled'
            : orderNotShipped
            ? 'Waiting for seller to mark shipped'
            : delivery?.station_arrived_at
            ? 'Already checked in at hub'
            : submitting
              ? 'Processing…'
              : 'Receive at station & notify customer'}
        </Button>
      </div>
    </div>
  );
}
