import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FaPlus, FaEdit, FaTrash, FaStore, FaSearch, FaSync, FaCheckCircle, FaBan, FaUser } from 'react-icons/fa';
import { storesAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Loading from '../../components/common/Loading';

const STAFF_EMAIL_DOMAIN = 'gandahub.com';

const toStaffEmail = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const localPart = raw.includes('@') ? raw.split('@')[0] : raw;
  return `${localPart}@${STAFF_EMAIL_DOMAIN}`;
};

const toEmailId = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.includes('@') ? raw.split('@')[0] : raw;
};

const AdminStores = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name_asc');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const statusFilterRef = useRef(statusFilter);
  const serverSearchRef = useRef(serverSearch);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    is_active: true,
    create_supplier: true,
    supplier_email: '',
    supplier_first_name: '',
    supplier_last_name: '',
    supplier_password: '',
  });

  useEffect(() => {
    statusFilterRef.current = statusFilter;
    serverSearchRef.current = serverSearch;
  }, [statusFilter, serverSearch]);

  const fetchStores = useCallback(async (showLoading = true, overrides = {}) => {
    const activeStatus = overrides.statusFilter ?? statusFilterRef.current;
    const activeServerSearch = overrides.serverSearch ?? serverSearchRef.current;
    try {
      if (showLoading) setLoading(true);
      const params = { per_page: 50 };
      if (activeStatus === 'active') params.active = true;
      if (activeStatus === 'inactive') params.active = false;
      if (activeServerSearch.trim()) params.search = activeServerSearch.trim();
      const res = await storesAPI.getAll(params);
      setStores(res.data.data || []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch stores:', error);
      toast.error('Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const openModal = (store = null) => {
    if (store) {
      setEditingStore(store);
      setFormData({
        name: store.name || '',
        description: store.description || '',
        address: store.address || '',
        phone: store.phone || '',
        is_active: store.is_active !== false,
      });
    } else {
      setEditingStore(null);
      setFormData({
        name: '',
        description: '',
        address: '',
        phone: '',
        is_active: true,
        create_supplier: true,
        supplier_email: '',
        supplier_first_name: '',
        supplier_last_name: '',
        supplier_password: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStore) {
        await storesAPI.update(editingStore.id, {
          name: formData.name,
          description: formData.description,
          address: formData.address,
          phone: formData.phone,
          is_active: formData.is_active,
        });
        toast.success('Store updated');
      } else {
        await storesAPI.create({
          name: formData.name,
          description: formData.description,
          address: formData.address,
          phone: formData.phone,
          is_active: formData.is_active,
          create_supplier: formData.create_supplier,
          supplier_email: toStaffEmail(formData.supplier_email),
          supplier_first_name: formData.supplier_first_name,
          supplier_last_name: formData.supplier_last_name,
          supplier_password: formData.supplier_password,
        });
        toast.success('Store created');
      }
      closeModal();
      fetchStores(false);
    } catch (error) {
      const msg = error.response?.data?.message || 'Operation failed';
      toast.error(msg);
    } finally {
      closeModal();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this store? This cannot be undone.')) return;
    try {
      await storesAPI.delete(id);
      toast.success('Store deleted');
      fetchStores(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const filteredStores = useMemo(() => {
    const needle = quickSearch.trim().toLowerCase();
    let list = stores;

    if (needle) {
      list = list.filter((store) => {
        const ownerName = store.user ? `${store.user.first_name || ''} ${store.user.last_name || ''}`.trim() : '';
        const haystack = [
          store.name,
          store.slug,
          store.address,
          ownerName,
          store.user?.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      });
    }

    const next = [...list];
    next.sort((a, b) => {
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'status') {
        if (a.is_active === b.is_active) return (a.name || '').localeCompare(b.name || '');
        return a.is_active ? -1 : 1;
      }
      if (sortBy === 'owner') {
        const aOwner = a.user ? `${a.user.first_name || ''} ${a.user.last_name || ''}`.trim() : '';
        const bOwner = b.user ? `${b.user.first_name || ''} ${b.user.last_name || ''}`.trim() : '';
        return aOwner.localeCompare(bOwner);
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    return next;
  }, [stores, quickSearch, sortBy]);

  const summary = useMemo(() => {
    const activeCount = filteredStores.filter((s) => s.is_active).length;
    const inactiveCount = filteredStores.length - activeCount;
    const withOwnerCount = filteredStores.filter((s) => Boolean(s.user?.id)).length;
    const noOwnerCount = filteredStores.length - withOwnerCount;

    return {
      total: filteredStores.length,
      activeCount,
      inactiveCount,
      withOwnerCount,
      noOwnerCount,
    };
  }, [filteredStores]);

  const applyFilters = () => {
    fetchStores(false);
  };

  const clearFilters = () => {
    setQuickSearch('');
    setServerSearch('');
    setStatusFilter('all');
    setSortBy('name_asc');
    fetchStores(false, { statusFilter: 'all', serverSearch: '' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Stores (Markets)</h1>
        <Button variant="primary" onClick={() => openModal()}>
          <FaPlus />
          Add Store
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaStore />
            Total Stores
          </div>
          <p className="text-2xl font-bold text-gray-800 mt-1">{summary.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaCheckCircle />
            Active
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">{summary.activeCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaBan />
            Inactive
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">{summary.inactiveCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaUser />
            With Owner
          </div>
          <p className="text-2xl font-bold text-primary-600 mt-1">{summary.withOwnerCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaBan />
            No Owner Linked
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-1">{summary.noOwnerCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full lg:flex-[1_1_260px]">
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Quick search on loaded stores..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="relative w-full lg:flex-[1_1_260px]">
            <input
              type="text"
              value={serverSearch}
              onChange={(e) => setServerSearch(e.target.value)}
              placeholder="Server search by store name or slug..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto sm:min-w-[180px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full sm:w-auto sm:min-w-[180px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          >
            <option value="name_asc">Sort: Name (A-Z)</option>
            <option value="name_desc">Sort: Name (Z-A)</option>
            <option value="owner">Sort: Owner name</option>
            <option value="status">Sort: Active first</option>
          </select>
          <div className="w-full sm:w-auto flex flex-wrap items-center gap-2 sm:ml-auto">
            <Button type="button" variant="primary" onClick={applyFilters}>
              Apply
            </Button>
            <Button type="button" variant="outline" onClick={() => fetchStores(false)}>
              <FaSync />
              Refresh
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Showing {filteredStores.length} store(s). Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString('en-PH') : '—'}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <Loading />
        ) : filteredStores.length === 0 ? (
          <p className="p-8 text-gray-500 text-center">No stores match your current filters/search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FaStore className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-800">{store.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {store.user ? `${store.user.first_name} ${store.user.last_name}` : '-'}
                      <br />
                      <span className="text-sm text-gray-500">{store.user?.email}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${store.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {store.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openModal(store)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                          <FaEdit />
                        </button>
                        <button onClick={() => handleDelete(store.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editingStore ? 'Edit Store' : 'Add Store'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Store Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
          </div>
          <Input label="Address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          <Input label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="rounded" />
            <span>Active</span>
          </label>

          {!editingStore && (
            <>
              <hr className="my-4" />
              <h3 className="font-medium">Supplier Account</h3>
              <label className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={formData.create_supplier} onChange={(e) => setFormData({ ...formData, create_supplier: e.target.checked })} className="rounded" />
                <span>Create new supplier account</span>
              </label>
              {formData.create_supplier && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="First Name" value={formData.supplier_first_name} onChange={(e) => setFormData({ ...formData, supplier_first_name: e.target.value })} />
                  <Input label="Last Name" value={formData.supplier_last_name} onChange={(e) => setFormData({ ...formData, supplier_last_name: e.target.value })} />
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Seller Email ID</label>
                    <div className="flex items-center rounded-lg border border-gray-300 px-3 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-200">
                      <input
                        type="text"
                        value={toEmailId(formData.supplier_email)}
                        onChange={(e) => setFormData({ ...formData, supplier_email: e.target.value })}
                        placeholder="storeowner"
                        className="w-full py-3 outline-none bg-transparent"
                      />
                      <span className="text-sm text-gray-500 ml-2 whitespace-nowrap">@{STAFF_EMAIL_DOMAIN}</span>
                    </div>
                  </div>
                  <Input label="Password" type="password" value={formData.supplier_password} onChange={(e) => setFormData({ ...formData, supplier_password: e.target.value })} />
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" variant="primary">{editingStore ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminStores;
