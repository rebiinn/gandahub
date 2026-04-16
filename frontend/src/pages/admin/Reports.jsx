import { useState, useEffect, useMemo } from 'react';
import { FaChartBar, FaCalendar, FaEye, FaTrash } from 'react-icons/fa';
import { reportsAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState('sales');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('sales');
  const [search, setSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const reportTypes = [
    { value: 'sales', label: 'Sales Report', description: 'Overview of sales performance' },
    { value: 'inventory', label: 'Inventory Report', description: 'Stock levels and product status' },
    { value: 'customers', label: 'Customers Report', description: 'Customer acquisition and activity' },
    { value: 'orders', label: 'Orders Report', description: 'Order statistics and trends' },
    { value: 'deliveries', label: 'Deliveries Report', description: 'Delivery performance metrics' },
    { value: 'revenue', label: 'Revenue Report', description: 'Revenue breakdown and analysis' },
    { value: 'products', label: 'Products Report', description: 'Product performance and ratings' },
  ];

  const selectedTypeMeta = reportTypes.find((t) => t.value === reportType);

  useEffect(() => {
    // Keep list focused on the currently selected report card/type.
    setTypeFilter(reportType);
  }, [reportType]);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await reportsAPI.getAll();
      setReports(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setGenerating(true);
      const typeLabel = selectedTypeMeta?.label ?? reportType;
      const data = {
        name: `${typeLabel} - ${new Date().toLocaleDateString()}`,
        type: reportType,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      };
      await reportsAPI.generate(data);
      setTypeFilter(reportType);
      toast.success('Report generated successfully');
      fetchReports();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to generate report';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
      const matchesType = typeFilter === 'all' || report.type === typeFilter;
      const haystack = `${report.name} ${report.type}`.toLowerCase();
      const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [reports, statusFilter, typeFilter, search]);

  const latestCompletedReport = useMemo(
    () => reports.find((r) => r.status === 'completed' && r.data),
    [reports]
  );

  const totalReports = reports.length;
  const completedReports = reports.filter((r) => r.status === 'completed').length;
  const failedReports = reports.filter((r) => r.status === 'failed').length;

  const humanize = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const openReport = async (id) => {
    try {
      const res = await reportsAPI.getOne(id);
      setSelectedReport(res.data?.data || null);
      setShowReportModal(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to open report');
    }
  };

  const deleteReport = async (id) => {
    if (!window.confirm('Delete this report? This cannot be undone.')) return;
    try {
      setDeletingId(id);
      await reportsAPI.delete(id);
      toast.success('Report deleted');
      setReports((prev) => prev.filter((r) => r.id !== id));
      if (selectedReport?.id === id) {
        setSelectedReport(null);
        setShowReportModal(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete report');
    } finally {
      setDeletingId(null);
    }
  };

  const renderSummary = (report) => {
    const data = report?.data || {};
    const scalarEntries = Object.entries(data).filter(([, value]) => !Array.isArray(value) && value !== null && typeof value !== 'object');
    if (scalarEntries.length === 0) return null;
    return (
      <div className="grid md:grid-cols-3 gap-3">
        {scalarEntries.slice(0, 9).map(([key, value]) => (
          <div key={key} className="p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500">{humanize(key)}</p>
            <p className="text-lg font-semibold text-gray-800">{String(value)}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderArraySection = (title, rows, columns) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return (
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b bg-gray-50">
          <h4 className="font-medium text-gray-800">{title}</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-2 text-left text-xs uppercase text-gray-500">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.slice(0, 10).map((row, idx) => (
                <tr key={idx}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2 text-gray-700">{row[col.key] ?? '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Total Reports</p>
          <p className="text-2xl font-bold text-gray-800">{totalReports}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-green-600">{completedReports}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Failed</p>
          <p className="text-2xl font-bold text-red-600">{failedReports}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Latest Completed</p>
          <p className="text-sm font-medium text-gray-800 truncate">{latestCompletedReport?.name || '—'}</p>
          <p className="text-xs text-gray-500">{latestCompletedReport ? formatDate(latestCompletedReport.created_at) : ''}</p>
        </div>
      </div>

      {/* Report Types Grid — tap a card to choose what to generate */}
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {reportTypes.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => {
              setReportType(type.value);
              setTypeFilter(type.value);
            }}
            className={`p-4 rounded-xl text-left transition-all ${
              reportType === type.value
                ? 'bg-primary-500 text-white shadow-lg'
                : 'bg-white text-gray-800 shadow-sm hover:shadow-md'
            }`}
          >
            <FaChartBar className={`w-8 h-8 mb-2 ${reportType === type.value ? 'text-white' : 'text-primary-500'}`} />
            <h3 className="font-semibold">{type.label}</h3>
            <p className={`text-sm ${reportType === type.value ? 'text-primary-100' : 'text-gray-500'}`}>
              {type.description}
            </p>
          </button>
        ))}
      </div>

      {/* Report Generator — dates + generate for the selected card above */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Generate selected report</h2>
        <p className="text-sm text-gray-600 mb-4">
          <span className="font-medium text-gray-800">{selectedTypeMeta?.label}</span>
          {' — '}
          {selectedTypeMeta?.description}
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Optional. Inventory ignores dates.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="flex items-end">
            <Button variant="primary" onClick={generateReport} loading={generating} fullWidth>
              <FaChartBar />
              Generate {selectedTypeMeta?.label ?? 'report'}
            </Button>
          </div>
        </div>
      </div>

      {/* Generated Reports */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Generated Reports</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Full history: each run is kept until you delete it, so you will see Sales, Inventory, Revenue, and others together
            unless you filter. Selecting a report card above filters this list to that type; use &quot;All types&quot; to see every run.
          </p>
          <div className="grid md:grid-cols-3 gap-3 mt-3">
            <input
              type="text"
              placeholder="Search by report name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All types</option>
              {reportTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
        
        {loading ? (
          <Loading />
        ) : filteredReports.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredReports.map((report) => (
              <div key={report.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <FaChartBar className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{report.name}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <FaCalendar className="w-3 h-3" />
                      <span>{formatDate(report.created_at)}</span>
                      <span>•</span>
                      <Badge variant={report.status === 'completed' ? 'success' : 'warning'}>
                        {report.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openReport(report.id)}>
                    <FaEye />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => deleteReport(report.id)}
                    disabled={deletingId === report.id}
                  >
                    <FaTrash />
                    {deletingId === report.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No reports generated yet. Generate your first report above.
          </div>
        )}
      </div>

      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title={selectedReport?.name || 'Report Details'}
        size="xl"
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span>Type: <strong>{humanize(selectedReport.type)}</strong></span>
              <span>•</span>
              <span>Generated: <strong>{formatDate(selectedReport.created_at)}</strong></span>
              <span>•</span>
              <Badge variant={selectedReport.status === 'completed' ? 'success' : 'warning'}>{selectedReport.status}</Badge>
            </div>

            {renderSummary(selectedReport)}

            {renderArraySection('Daily Sales', selectedReport?.data?.daily_sales, [
              { key: 'date', label: 'Date' },
              { key: 'total', label: 'Total' },
            ])}
            {renderArraySection('Order Status Breakdown', selectedReport?.data?.by_status, [
              { key: 'status', label: 'Status' },
              { key: 'count', label: 'Count' },
            ])}
            {renderArraySection('Payment Method Breakdown', selectedReport?.data?.by_payment_method, [
              { key: 'payment_method', label: 'Method' },
              { key: 'total', label: 'Total' },
            ])}
            {renderArraySection('Best Sellers', selectedReport?.data?.best_sellers, [
              { key: 'name', label: 'Product' },
              { key: 'sku', label: 'SKU' },
              { key: 'order_items_sum_quantity', label: 'Qty Sold' },
            ])}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Reports;
