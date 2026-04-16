import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { riderApplicationsAPI } from '../../services/api';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';

const DriverApplications = () => {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });

  const fetchApplications = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const response = await riderApplicationsAPI.logisticsGetAll({
        status: statusFilter,
        page,
        per_page: 15,
      });
      setApplications(response.data?.data || []);
      setMeta(response.data?.meta || { current_page: 1, last_page: 1 });
    } catch (error) {
      console.error(error);
      toast.error('Failed to load driver applications');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchApplications(1);
  }, [fetchApplications]);

  const approve = async (id) => {
    try {
      await riderApplicationsAPI.logisticsApprove(id, {});
      toast.success('Driver application approved.');
      fetchApplications(meta.current_page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve application');
    }
  };

  const reject = async (id) => {
    const review_note = window.prompt('Optional reason for rejection:', '') || '';
    try {
      await riderApplicationsAPI.logisticsReject(id, { review_note });
      toast.success('Driver application rejected.');
      fetchApplications(meta.current_page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject application');
    }
  };

  const badgeVariant = (status) => {
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'danger';
    return 'warning';
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Driver Applications</h1>
        <p className="text-sm text-gray-600 mt-1">Review rider applications, verify documents, and approve onboarding.</p>
      </div>

      <div className="flex gap-2 mb-4">
        {['pending', 'approved', 'rejected'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
              statusFilter === status ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <Loading />
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">No applications found.</td>
                  </tr>
                ) : (
                  applications.map((application) => (
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
                        <Badge variant={badgeVariant(application.status)}>{application.status}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        {application.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="primary" onClick={() => approve(application.id)}>Approve</Button>
                            <Button size="sm" variant="danger" onClick={() => reject(application.id)}>Reject</Button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 border-t">
          <Pagination currentPage={meta.current_page} totalPages={meta.last_page} onPageChange={fetchApplications} />
        </div>
      </div>
    </div>
  );
};

export default DriverApplications;

