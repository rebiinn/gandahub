import { useState, useEffect } from 'react';
import { FaSave, FaSync, FaDatabase, FaServer } from 'react-icons/fa';
import { settingsAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Loading from '../../components/common/Loading';

const Settings = () => {
  const [, setSettings] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchSettings();
    fetchSystemInfo();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getAll();
      const settingsData = response.data.data || [];
      setSettings(settingsData);
      
      // Convert to form data
      const data = {};
      settingsData.forEach(s => {
        data[s.key] = s.value;
      });
      setFormData(data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const response = await settingsAPI.getSystemInfo();
      setSystemInfo(response.data.data);
    } catch (error) {
      console.error('Failed to fetch system info:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const normalized = { ...formData };
      const rawRate = Number(normalized.marketplace_commission_rate);
      if (Number.isFinite(rawRate)) {
        const clamped = Math.max(0, Math.min(rawRate, 1));
        normalized.marketplace_commission_rate = clamped.toString();
      }

      const settingsArray = Object.entries(normalized).map(([key, value]) => ({
        key,
        value,
      }));
      await settingsAPI.bulkUpdate(settingsArray);
      toast.success('Settings saved successfully');
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to save settings';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleClearAllData = async () => {
    const typed = window.prompt(
      'This will permanently delete products, orders, deliveries, and user data. Type RESET ALL DATA to continue.'
    );

    if (typed === null) return;

    const confirmation = typed.trim();
    if (confirmation !== 'RESET ALL DATA') {
      toast.error('Reset cancelled. Confirmation text did not match.');
      return;
    }

    const finalConfirm = window.confirm(
      'Final confirmation: this action cannot be undone. Proceed with full data reset?'
    );

    if (!finalConfirm) return;

    try {
      await settingsAPI.clearAllData(confirmation);
      toast.success('All data has been reset. Reloading dashboard...');
      setTimeout(() => {
        window.location.href = '/admin';
      }, 1000);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to reset all data';
      toast.error(message);
    }
  };

  const handleBackup = async () => {
    try {
      await settingsAPI.backup();
      toast.success('Backup created successfully');
    } catch (error) {
      toast.error('Failed to create backup');
    }
  };

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'payment', label: 'Payment' },
    { id: 'shipping', label: 'Shipping' },
    { id: 'email', label: 'Email' },
    { id: 'system', label: 'System' },
  ];

  const defaultSettings = {
    general: [
      { key: 'site_name', label: 'Site Name', type: 'text', default: 'Ganda Hub Cosmetics' },
      { key: 'site_tagline', label: 'Tagline', type: 'text', default: 'Beauty & Skincare' },
      { key: 'contact_email', label: 'Contact Email', type: 'email', default: '' },
      { key: 'contact_phone', label: 'Contact Phone', type: 'text', default: '' },
      { key: 'address', label: 'Business Address', type: 'textarea', default: '' },
    ],
    payment: [
      { key: 'currency', label: 'Currency', type: 'text', default: 'PHP' },
      { key: 'marketplace_commission_rate', label: 'Marketplace Commission Rate (decimal)', type: 'number', default: '0.05' },
      { key: 'enable_cod', label: 'Enable Cash on Delivery', type: 'checkbox', default: 'true' },
      { key: 'enable_gcash', label: 'Enable GCash', type: 'checkbox', default: 'true' },
    ],
    shipping: [
      { key: 'free_shipping_threshold', label: 'Free Shipping Threshold (PHP)', type: 'number', default: '1500' },
      { key: 'default_shipping_fee', label: 'Default Shipping Fee (PHP)', type: 'number', default: '150' },
    ],
    email: [
      { key: 'mail_from_name', label: 'From Name', type: 'text', default: 'Ganda Hub Cosmetics' },
      { key: 'mail_from_address', label: 'From Email', type: 'email', default: '' },
      { key: 'order_notification_email', label: 'Order Notification Email', type: 'email', default: '' },
    ],
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">System Settings</h1>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          <FaSave />
          Save Changes
        </Button>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Tabs */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          {activeTab !== 'system' ? (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-6 capitalize">
                {activeTab} Settings
              </h2>
              
              <div className="space-y-4">
                {defaultSettings[activeTab]?.map((setting) => (
                  <div key={setting.key}>
                    {setting.type === 'checkbox' ? (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData[setting.key] === 'true' || formData[setting.key] === true}
                          onChange={(e) => setFormData({
                            ...formData,
                            [setting.key]: e.target.checked ? 'true' : 'false'
                          })}
                          className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                        />
                        <span className="font-medium text-gray-700">{setting.label}</span>
                      </label>
                    ) : setting.type === 'textarea' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {setting.label}
                        </label>
                        <textarea
                          value={formData[setting.key] || setting.default}
                          onChange={(e) => setFormData({ ...formData, [setting.key]: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
                        />
                      </div>
                    ) : (
                      <Input
                        label={setting.label}
                        type={setting.type}
                        value={formData[setting.key] || setting.default}
                        onChange={(e) => setFormData({ ...formData, [setting.key]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* System Info */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FaServer className="text-primary-500" />
                  System Information
                </h2>
                
                {systemInfo && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500">PHP Version</p>
                      <p className="font-medium text-gray-800">{systemInfo.php_version}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500">Laravel Version</p>
                      <p className="font-medium text-gray-800">{systemInfo.laravel_version}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500">Environment</p>
                      <p className="font-medium text-gray-800">{systemInfo.environment}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500">Server Time</p>
                      <p className="font-medium text-gray-800">{systemInfo.server_time}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Maintenance */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Maintenance</h2>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <FaSync className="text-red-500" />
                      <h3 className="font-medium text-gray-800">Clear All Data</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      Permanently reset platform data (products, users, orders, deliveries, and related records).
                      The current admin account is kept for access.
                    </p>
                    <Button variant="danger" size="sm" onClick={handleClearAllData}>
                      Clear All Data
                    </Button>
                  </div>
                  
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <FaDatabase className="text-green-500" />
                      <h3 className="font-medium text-gray-800">Database Backup</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      Create a backup of the database
                    </p>
                    <Button variant="outline" size="sm" onClick={handleBackup}>
                      Create Backup
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
