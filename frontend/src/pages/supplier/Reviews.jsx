import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { reviewsAPI } from '../../services/api';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';
import Button from '../../components/common/Button';

const SupplierReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [actionId, setActionId] = useState(null);

  const fetchPending = async (page = 1) => {
    try {
      setLoading(true);
      const res = await reviewsAPI.getSupplierPending({ page, per_page: 15 });
      setReviews(res.data.data || []);
      setMeta(res.data.meta || { current_page: 1, last_page: 1, total: 0 });
    } catch (e) {
      console.error(e);
      toast.error('Failed to load pending reviews');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id) => {
    try {
      setActionId(id);
      await reviewsAPI.supplierApprove(id);
      toast.success('Review approved — it will show on your product page');
      await fetchPending(meta.current_page);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not approve');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Remove this review?')) return;
    try {
      setActionId(id);
      await reviewsAPI.supplierReject(id);
      toast.success('Review removed');
      await fetchPending(meta.current_page);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not remove review');
    } finally {
      setActionId(null);
    }
  };

  const productHref = (product) => {
    if (!product?.slug) return '/products';
    return `/products/${product.slug}`;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customer reviews</h1>
        <p className="mt-1 text-gray-600">
          Approve reviews for your products so they appear on your storefront. Until then, customers only see their own
          submission as &quot;pending approval&quot;.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <Loading />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reviews.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                        No pending reviews for your store right now.
                      </td>
                    </tr>
                  ) : (
                    reviews.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-sm">
                          {r.product ? (
                            <Link
                              to={productHref(r.product)}
                              className="text-emerald-600 hover:underline font-medium"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {r.product.name}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {r.user
                            ? `${r.user.first_name || ''} ${r.user.last_name || ''}`.trim() || r.user.email
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">{r.rating} / 5</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={r.comment}>
                          {r.comment || r.title || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Button
                            type="button"
                            variant="primary"
                            className="mr-2 !py-1 !px-3 text-sm"
                            loading={actionId === r.id}
                            onClick={() => handleApprove(r.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            className="!py-1 !px-3 text-sm"
                            disabled={actionId === r.id}
                            onClick={() => handleReject(r.id)}
                          >
                            Reject
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {reviews.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100">
                <Pagination
                  currentPage={meta.current_page}
                  totalPages={meta.last_page}
                  onPageChange={(p) => fetchPending(p)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SupplierReviews;
