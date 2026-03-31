import { useState, useEffect } from 'react';
import { newsletterAPI } from '../../services/api';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';

const AdminNewsletter = () => {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async (page = 1) => {
    try {
      setLoading(true);
      const response = await newsletterAPI.getSubscribers({ page, per_page: 20 });
      const payload = response?.data?.data;
      if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
        setSubscribers(payload.data);
        setMeta({
          current_page: payload.current_page ?? 1,
          last_page: payload.last_page ?? 1,
          total: payload.total ?? 0,
        });
      } else {
        setSubscribers(Array.isArray(payload) ? payload : []);
        setMeta(response?.data?.meta || { current_page: 1, last_page: 1, total: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch subscribers:', error);
      setSubscribers([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Newsletter Subscribers</h1>
        <p className="mt-1 text-gray-600">
          Emails collected from the site footer and home page. Use this list to send deals, beauty tips, and new arrivals when you’re ready (e.g. via Mailchimp or your email tool).
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscribed at</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subscribers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                        No subscribers yet. They’ll appear here when someone subscribes from the site.
                      </td>
                    </tr>
                  ) : (
                    subscribers.map((sub, i) => (
                      <tr key={sub.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {(meta.current_page - 1) * 20 + i + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sub.subscribed_at
                            ? new Date(sub.subscribed_at).toLocaleString()
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {meta.last_page > 1 && (
              <div className="px-4 py-3 border-t border-gray-200">
                <Pagination
                  currentPage={meta.current_page}
                  totalPages={meta.last_page}
                  onPageChange={fetchSubscribers}
                />
              </div>
            )}
          </>
        )}
      </div>

      {!loading && meta.total > 0 && (
        <p className="mt-2 text-sm text-gray-500">
          Total: {meta.total} subscriber{meta.total !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

export default AdminNewsletter;
