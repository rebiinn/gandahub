import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams, useLocation } from 'react-router-dom';
import { FaArrowLeft, FaTruck, FaCheckCircle, FaBox, FaStar } from 'react-icons/fa';
import { ordersAPI, reviewsAPI } from '../services/api';
import { toAbsoluteImageUrl, PLACEHOLDER_PRODUCT } from '../utils/imageUrl';
import { formatShadeOptionLabel } from '../utils/productShades';
import Loading from '../components/common/Loading';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { toast } from 'react-toastify';

const CANCELLATION_REASONS = [
  { value: 'delivery_too_slow', label: 'Delivery is taking too long' },
  { value: 'found_cheaper', label: 'Found a cheaper alternative' },
  { value: 'wrong_address', label: 'Wrong shipping address selected' },
  { value: 'changed_mind', label: 'Changed my mind' },
  { value: 'ordered_by_mistake', label: 'Ordered by mistake' },
  { value: 'other', label: 'Other reason' },
];

const StarRating = ({ value, onChange, readonly = false, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange(star)}
          className={`${sizeClass} ${value >= star ? 'text-amber-400' : 'text-gray-300'} hover:opacity-80 transition`}
        >
          <FaStar className={value >= star ? 'fill-current' : ''} />
        </button>
      ))}
    </div>
  );
};

const OrderDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const paymentReturn = searchParams.get('payment');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshingPayment, setRefreshingPayment] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState(CANCELLATION_REASONS[0].value);
  const [cancelDetails, setCancelDetails] = useState('');
  const [riderRating, setRiderRating] = useState(0);
  const [riderComment, setRiderComment] = useState('');
  const [submittingRider, setSubmittingRider] = useState(false);
  const [productRatings, setProductRatings] = useState({});
  const [productComments, setProductComments] = useState({});
  const [submittingProduct, setSubmittingProduct] = useState(null);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ordersAPI.getOne(id);
      setOrder(response.data.data);
    } catch (error) {
      console.error('Failed to fetch order:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    if (order?.status && order.status !== 'pending') {
      setShowCancelForm(false);
    }
  }, [order?.status]);

  useEffect(() => {
    if (!order || order.status !== 'delivered') return;
    if (location.hash !== '#rate-products') return;
    const el = document.getElementById('rate-products');
    if (!el) return;
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [order, location.hash, order?.status]);

  useEffect(() => {
    if (paymentReturn !== 'success') return;
    let cancelled = false;
    let attempts = 0;
    let intervalId = null;
    setRefreshingPayment(true);

    const refreshPayment = async () => {
      try {
        const response = await ordersAPI.getOne(id);
        const currentOrder = response?.data?.data;
        if (!cancelled && currentOrder) {
          setOrder(currentOrder);
          const paymentStatus = String(currentOrder?.payment?.status || '').toLowerCase();
          if (paymentStatus === 'completed') {
            setRefreshingPayment(false);
            return true;
          }
        }
      } catch {
        // ignore and retry
      }
      return false;
    };

    (async () => {
      const done = await refreshPayment();
      if (done || cancelled) return;
      intervalId = setInterval(async () => {
        attempts += 1;
        const finished = await refreshPayment();
        if (finished || attempts >= 20) {
          if (intervalId) clearInterval(intervalId);
          if (!cancelled) setRefreshingPayment(false);
        }
      }, 3000);
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      setRefreshingPayment(false);
    };
  }, [id, paymentReturn]);

  const handleCancelOrder = async () => {
    try {
      if (!cancelReason) {
        toast.error('Please select a cancellation reason');
        return;
      }
      setCancelling(true);
      await ordersAPI.cancel(id, {
        reason: cancelReason,
        details: cancelDetails.trim() || null,
      });
      toast.success('Cancellation request sent to seller');
      setShowCancelForm(false);
      setCancelDetails('');
      fetchOrder();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to cancel order';
      toast.error(message);
    } finally {
      setCancelling(false);
    }
  };

  const handleRateRider = async (e) => {
    e.preventDefault();
    if (!riderRating) {
      toast.error('Please select a star rating');
      return;
    }
    setSubmittingRider(true);
    try {
      await ordersAPI.rateRider(id, { rating: riderRating, comment: riderComment.trim() || null });
      toast.success('Thank you for rating your rider!');
      setRiderRating(0);
      setRiderComment('');
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit rating');
    } finally {
      setSubmittingRider(false);
    }
  };

  const handleRateProduct = async (e, productId, productName) => {
    e.preventDefault();
    const rating = productRatings[productId];
    if (!rating) {
      toast.error('Please select a star rating for ' + productName);
      return;
    }
    setSubmittingProduct(productId);
    try {
      await reviewsAPI.create({
        product_id: productId,
        order_id: parseInt(id, 10),
        rating,
        comment: (productComments[productId] || '').trim() || null,
      });
      toast.success('Review submitted. It may appear after approval.');
      setProductRatings((prev) => ({ ...prev, [productId]: 0 }));
      setProductComments((prev) => ({ ...prev, [productId]: '' }));
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmittingProduct(null);
    }
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (date) => {
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
      out_for_delivery: 'primary',
      delivered: 'success',
      cancel_requested: 'warning',
      cancelled: 'danger',
      refunded: 'danger',
    };
    return <Badge variant={variants[status] || 'default'} size="lg">{status.replace(/_/g, ' ')}</Badge>;
  };

  const orderStatuses = [
    { key: 'pending', label: 'Order Placed', icon: FaBox },
    { key: 'confirmed', label: 'Confirmed', icon: FaCheckCircle },
    { key: 'processing', label: 'Processing', icon: FaBox },
    { key: 'shipped', label: 'Shipped', icon: FaTruck },
    { key: 'delivered', label: 'Delivered', icon: FaCheckCircle },
  ];

  const getCurrentStatusIndex = () => {
    if (['cancel_requested', 'cancelled', 'refunded'].includes(order?.status)) return -1;
    if (order?.status === 'out_for_delivery') {
      return orderStatuses.findIndex((s) => s.key === 'shipped');
    }
    return orderStatuses.findIndex((s) => s.key === order?.status);
  };

  if (loading) {
    return <Loading fullScreen />;
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Order Not Found</h2>
          <Link to="/orders" className="text-primary-600 hover:text-primary-700">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const currentStatusIndex = getCurrentStatusIndex();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-6"
        >
          <FaArrowLeft />
          Back to Orders
        </Link>

        {/* Order Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          {refreshingPayment && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Verifying your payment with the gateway. This will update automatically once confirmed.
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-gray-800">
                Order #{order.order_number}
              </h1>
              <p className="text-gray-600 mt-1">
                Placed on {formatDate(order.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {getStatusBadge(order.status)}
              {order.status === 'pending' && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowCancelForm((prev) => !prev)}
                  loading={cancelling}
                >
                  Request Cancellation
                </Button>
              )}
            </div>
          </div>

          {order.status === 'cancel_requested' && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Cancellation request sent. Seller approval is required before final cancellation and refund.
              {order.cancellation_reason ? ` Reason: ${order.cancellation_reason}` : ''}
            </div>
          )}

          {showCancelForm && order.status === 'pending' && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800 mb-2">
                Tell the seller why you want to cancel this order.
              </p>
              <div className="grid gap-3">
                <select
                  className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                >
                  {CANCELLATION_REASONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"
                  placeholder="Optional details for seller"
                  value={cancelDetails}
                  onChange={(e) => setCancelDetails(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" onClick={handleCancelOrder} loading={cancelling}>
                    Send Request
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowCancelForm(false)} disabled={cancelling}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Order Progress */}
          {currentStatusIndex >= 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between">
                {orderStatuses.map((status, index) => {
                  const Icon = status.icon;
                  const isCompleted = index <= currentStatusIndex;
                  const isCurrent = index === currentStatusIndex;
                  
                  return (
                    <div key={status.key} className="flex flex-col items-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isCompleted
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-200 text-gray-400'
                        } ${isCurrent ? 'ring-4 ring-primary-200' : ''}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className={`text-xs mt-2 text-center ${
                        isCompleted ? 'text-primary-600 font-medium' : 'text-gray-400'
                      }`}>
                        {status.label}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="relative mt-2">
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2" />
                <div
                  className="absolute top-1/2 left-0 h-1 bg-primary-500 -translate-y-1/2 transition-all"
                  style={{ width: `${(currentStatusIndex / (orderStatuses.length - 1)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Order Items</h2>
          <div className="divide-y divide-gray-100">
            {order.items?.map((item) => (
              <div key={item.id} className="py-4 flex gap-4">
                <img
                  src={toAbsoluteImageUrl(item.product?.thumbnail)}
                  alt={item.product_name}
                  className="w-20 h-20 object-cover rounded-lg"
                  onError={(e) => {
                    if (e.target.src !== PLACEHOLDER_PRODUCT && !e.target.dataset.failed) {
                      e.target.dataset.failed = '1';
                      e.target.src = PLACEHOLDER_PRODUCT;
                    }
                  }}
                />
                <div className="flex-grow">
                  <p className="font-medium text-gray-800">{item.product_name}</p>
                  <p className="text-sm text-gray-500">SKU: {item.product_sku}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-gray-600">
                      {formatPrice(item.unit_price)} x {item.quantity}
                    </p>
                    <p className="font-semibold text-primary-600">
                      {formatPrice(item.total_price)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rate your experience - only when delivered */}
        {order.status === 'delivered' && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Rate your experience</h2>

            {/* Rate rider */}
            {order.delivery?.rider && (
              <div className="mb-6 pb-6 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Rate your rider</h3>
                <p className="text-gray-600 text-sm mb-2">
                  {order.delivery.rider.first_name} {order.delivery.rider.last_name}
                </p>
                {order.rider_rating ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <StarRating value={order.rider_rating.rating} readonly size="sm" />
                    <span className="text-sm">You rated this rider</span>
                    {order.rider_rating.comment && (
                      <p className="text-sm text-gray-500 mt-1 w-full">{order.rider_rating.comment}</p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleRateRider} className="space-y-2">
                    <StarRating value={riderRating} onChange={setRiderRating} />
                    <textarea
                      placeholder="Optional: How was your delivery?"
                      value={riderComment}
                      onChange={(e) => setRiderComment(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <Button type="submit" variant="primary" size="sm" loading={submittingRider} disabled={!riderRating}>
                      Submit rider rating
                    </Button>
                  </form>
                )}
              </div>
            )}

            {/* Rate products — anchor #rate-products linked from post-delivery store messages */}
            <div id="rate-products" className="scroll-mt-28">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Rate your products</h3>
            <div className="space-y-4">
              {order.items?.map((item) => {
                const productId = item.product_id;
                const productName = item.product_name || item.product?.name || 'Product';
                const userReview = item.user_review;
                return (
                  <div key={item.id} className="flex flex-wrap gap-4 items-start p-4 bg-gray-50 rounded-lg">
                    <img
                      src={toAbsoluteImageUrl(item.product?.thumbnail)}
                      alt=""
                      className="w-14 h-14 object-cover rounded"
                      onError={(e) => { if (e.target.src !== PLACEHOLDER_PRODUCT) e.target.src = PLACEHOLDER_PRODUCT; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">{productName}</p>
                      {formatShadeOptionLabel(item.options) && (
                        <p className="text-xs text-primary-600 font-medium mt-0.5">
                          {formatShadeOptionLabel(item.options)}
                        </p>
                      )}
                      {userReview ? (
                        <div className="mt-2">
                          <StarRating value={userReview.rating} readonly size="sm" />
                          {userReview.comment && (
                            <p className="text-sm text-gray-600 mt-1">{userReview.comment}</p>
                          )}
                          {!userReview.is_approved && (
                            <p className="text-xs text-amber-600 mt-1">Your review is pending approval</p>
                          )}
                        </div>
                      ) : (
                        <form onSubmit={(e) => handleRateProduct(e, productId, productName)} className="mt-2 space-y-2">
                          <StarRating
                            value={productRatings[productId] || 0}
                            onChange={(v) => setProductRatings((prev) => ({ ...prev, [productId]: v }))}
                            size="sm"
                          />
                          <input
                            type="text"
                            placeholder="Optional: Add a comment"
                            value={productComments[productId] || ''}
                            onChange={(e) => setProductComments((prev) => ({ ...prev, [productId]: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                          />
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            loading={submittingProduct === productId}
                            disabled={!(productRatings[productId] >= 1)}
                          >
                            Submit review
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Shipping Address */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Shipping Address</h2>
            <p className="font-medium text-gray-800">
              {order.shipping_first_name} {order.shipping_last_name}
            </p>
            <p className="text-gray-600 mt-1">{order.shipping_address}</p>
            <p className="text-gray-600">
              {order.shipping_city}, {order.shipping_state} {order.shipping_zip_code}
            </p>
            <p className="text-gray-600">{order.shipping_country}</p>
            <p className="text-gray-600 mt-2">{order.shipping_phone}</p>
            <p className="text-gray-600">{order.shipping_email}</p>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Order Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium">{formatPrice(order.tax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span className="font-medium">{formatPrice(order.shipping_fee)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span className="font-medium">-{formatPrice(order.discount)}</span>
                </div>
              )}
              <hr className="my-3" />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span className="text-primary-600">{formatPrice(order.total)}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Payment Method:</span>{' '}
                {order.payment?.payment_method?.replace('_', ' ')}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">Payment Status:</span>{' '}
                <Badge variant={order.payment?.status === 'completed' ? 'success' : 'warning'}>
                  {order.payment?.status}
                </Badge>
              </p>
            </div>
          </div>
        </div>

        {/* Delivery Info */}
        {order.delivery && (
          <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Delivery Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Tracking Number</p>
                <p className="font-medium text-gray-800">{order.delivery.tracking_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant="primary">{order.delivery.status?.replace(/_/g, ' ')}</Badge>
              </div>
              {order.delivery.rider && (
                <div>
                  <p className="text-sm text-gray-500">Rider</p>
                  <p className="font-medium text-gray-800">
                    {order.delivery.rider.first_name} {order.delivery.rider.last_name}
                  </p>
                </div>
              )}
              {order.delivery.estimated_delivery && (
                <div>
                  <p className="text-sm text-gray-500">Estimated Delivery</p>
                  <p className="font-medium text-gray-800">
                    {formatDate(order.delivery.estimated_delivery)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetail;
