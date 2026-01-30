import { useState, useEffect } from 'react';
import { FaChartBar, FaDownload, FaCalendar } from 'react-icons/fa';
import { reportsAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import Badge from '../../components/common/Badge';

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState('sales');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
      const data = {
        name: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report - ${new Date().toLocaleDateString()}`,
        type: reportType,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      };
      await reportsAPI.generate(data);
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

  const reportTypes = [
    { value: 'sales', label: 'Sales Report', description: 'Overview of sales performance' },
    { value: 'inventory', label: 'Inventory Report', description: 'Stock levels and product status' },
    { value: 'customers', label: 'Customers Report', description: 'Customer acquisition and activity' },
    { value: 'orders', label: 'Orders Report', description: 'Order statistics and trends' },
    { value: 'deliveries', label: 'Deliveries Report', description: 'Delivery performance metrics' },
    { value: 'revenue', label: 'Revenue Report', description: 'Revenue breakdown and analysis' },
    { value: 'products', label: 'Products Report', description: 'Product performance and ratings' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
      </div>

      {/* Report Generator */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Generate New Report</h2>
        
        <div className="grid md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            >
              {reportTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
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
              Generate
            </Button>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          {reportTypes.find(t => t.value === reportType)?.description}
        </p>
      </div>

      {/* Report Types Grid */}
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {reportTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setReportType(type.value)}
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

      {/* Generated Reports */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Generated Reports</h2>
        </div>
        
        {loading ? (
          <Loading />
        ) : reports.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {reports.map((report) => (
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
                  {report.file_path && (
                    <Button variant="outline" size="sm">
                      <FaDownload />
                      Download
                    </Button>
                  )}
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
    </div>
  );
};

export default Reports;
