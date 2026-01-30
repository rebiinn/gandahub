import { useState } from 'react';
import { FaSearch, FaBox, FaTruck, FaCheckCircle } from 'react-icons/fa';
import { ordersAPI, deliveriesAPI } from '../services/api';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';

const OrderTracking = () => {
  const [trackingInput, setTrackingInput] = useState('');
  const [trackingType, setTrackingType] = useState('order');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!trackingInput.trim()) return;

    try {
      setLoading(true);
      setError('');
      setResult(null);

      let response;
      if (trackingType === 'order') {
        response = await ordersAPI.track(trackingInput);
      } else {
        response = await deliveriesAPI.track(trackingInput);
      }

      setResult(response.data.data);
    } catch (error) {
      setError('Tracking information not found. Please check your tracking number.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
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
      in_transit: 'primary',
      out_for_delivery: 'primary',
      delivered: 'success',
      cancelled: 'danger',
      failed: 'danger',
    };
    return <Badge variant={variants[status] || 'default'} size="lg">{status?.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-display font-bold text-gray-800 mb-4">
            Track Your Order
          </h1>
          <p className="text-gray-600">
            Enter your order number or tracking number to see the current status
          </p>
        </div>

        {/* Tracking Form */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <form onSubmit={handleTrack}>
            {/* Tracking Type Toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-4">
              <button
                type="button"
                onClick={() => setTrackingType('order')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  trackingType === 'order'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Order Number
              </button>
              <button
                type="button"
                onClick={() => setTrackingType('delivery')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  trackingType === 'delivery'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Tracking Number
              </button>
            </div>

            {/* Input */}
            <div className="flex gap-3">
              <div className="relative flex-grow">
                <input
                  type="text"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder={trackingType === 'order' ? 'Enter order number (e.g., GHC-ABC12345)' : 'Enter tracking number (e.g., GHC-TRK-ABC123)'}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
                />
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <Button type="submit" variant="primary" loading={loading}>
                Track
              </Button>
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-8 text-center">
            {error}
          </div>
        )}

        {/* Tracking Result */}
        {result && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-500 mb-1">
                {trackingType === 'order' ? 'Order Number' : 'Tracking Number'}
              </p>
              <p className="text-xl font-bold text-gray-800">
                {result.order_number || result.tracking_number}
              </p>
            </div>

            {/* Status */}
            <div className="text-center mb-8">
              <p className="text-sm text-gray-500 mb-2">Current Status</p>
              {getStatusBadge(result.status)}
            </div>

            {/* Timeline */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-800 mb-4">Delivery Updates</h3>
              <div className="space-y-4">
                {result.delivered_at && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <FaCheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Delivered</p>
                      <p className="text-sm text-gray-500">{formatDate(result.delivered_at)}</p>
                    </div>
                  </div>
                )}
                {result.shipped_at && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <FaTruck className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Shipped</p>
                      <p className="text-sm text-gray-500">{formatDate(result.shipped_at)}</p>
                    </div>
                  </div>
                )}
                {result.picked_up_at && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <FaBox className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Picked Up</p>
                      <p className="text-sm text-gray-500">{formatDate(result.picked_up_at)}</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaBox className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">Order Placed</p>
                    <p className="text-sm text-gray-500">Your order is being processed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            {result.current_location && (
              <div className="border-t mt-6 pt-6">
                <p className="text-sm text-gray-500">Current Location</p>
                <p className="font-medium text-gray-800">{result.current_location}</p>
              </div>
            )}

            {result.estimated_delivery && (
              <div className="border-t mt-6 pt-6">
                <p className="text-sm text-gray-500">Estimated Delivery</p>
                <p className="font-medium text-gray-800">{formatDate(result.estimated_delivery)}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTracking;
