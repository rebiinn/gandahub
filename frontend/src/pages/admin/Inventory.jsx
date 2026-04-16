import { useState, useEffect, useMemo, useCallback } from 'react';
import { FaExclamationTriangle, FaPlus, FaMinus, FaTrash, FaSearch, FaSync, FaBoxes, FaWarehouse } from 'react-icons/fa';
import { productsAPI, storesAPI, inventoryReceiptsAPI } from '../../services/api';
import { toAbsoluteImageUrl, PLACEHOLDER_PRODUCT } from '../../utils/imageUrl';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });
  const [stores, setStores] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [quickSearch, setQuickSearch] = useState('');
  const [sortBy, setSortBy] = useState('stock_desc');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    const loadReceipts = async () => {
      try {
        const res = await inventoryReceiptsAPI.getAll({ per_page: 10 });
        setReceipts(res.data.data || []);
      } catch (e) {
        console.error('Failed to load inventory receipts:', e);
      }
    };
    loadReceipts();
  }, []);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await storesAPI.getList();
        setStores(res.data.data || []);
      } catch (e) {
        console.error('Failed to fetch stores:', e);
      }
    };
    fetchStores();
  }, []);

  const fetchProducts = useCallback(async (page = 1, overrides = {}) => {
    const activeFilter = overrides.filter ?? filter;
    const activeSupplierId = overrides.selectedSupplierId ?? selectedSupplierId;

    try {
      setLoading(true);
      const params = { page, active: true, per_page: 50 }; // inventory grid should load enough rows for quick ops
      if (activeSupplierId) params.store_id = activeSupplierId;
      if (activeFilter === 'low_stock') {
        // Fetch all and filter client-side for low stock
      }
      const response = await productsAPI.getAll(params);
      let data = response.data.data || [];
      
      if (activeFilter === 'low_stock') {
        data = data.filter(p => p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0);
      } else if (activeFilter === 'out_of_stock') {
        data = data.filter(p => p.stock_quantity === 0);
      }
      
      setProducts(data);
      setMeta(response.data.meta || { current_page: 1, last_page: 1 });
      setSelectedIds(new Set()); // Clear selection when list changes
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to fetch inventory products');
    } finally {
      setLoading(false);
    }
  }, [filter, selectedSupplierId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const getStockBadge = (product) => {
    if (product.stock_quantity === 0) {
      return <Badge variant="danger">Out of Stock</Badge>;
    }
    if (product.stock_quantity <= product.low_stock_threshold) {
      return <Badge variant="warning">Low Stock</Badge>;
    }
    return <Badge variant="success">In Stock</Badge>;
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleProducts = useMemo(() => {
    const needle = quickSearch.trim().toLowerCase();
    let list = products;

    if (needle) {
      list = list.filter((product) => {
        const haystack = [
          product.name,
          product.sku,
          product.brand,
          product.store?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      });
    }

    const next = [...list];
    next.sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'stock_asc') return Number(a.stock_quantity || 0) - Number(b.stock_quantity || 0);
      if (sortBy === 'stock_desc') return Number(b.stock_quantity || 0) - Number(a.stock_quantity || 0);
      if (sortBy === 'warehouse_desc') return Number(b.inventory_stock || 0) - Number(a.inventory_stock || 0);
      if (sortBy === 'warehouse_asc') return Number(a.inventory_stock || 0) - Number(b.inventory_stock || 0);

      const aRisk = Number(a.stock_quantity || 0) - Number(a.low_stock_threshold || 0);
      const bRisk = Number(b.stock_quantity || 0) - Number(b.low_stock_threshold || 0);
      return aRisk - bRisk;
    });

    return next;
  }, [products, quickSearch, sortBy]);

  const summary = useMemo(() => {
    const totalInShop = visibleProducts.reduce((sum, p) => sum + Number(p.stock_quantity || 0), 0);
    const totalWarehouse = visibleProducts.reduce((sum, p) => sum + Number(p.inventory_stock || 0), 0);
    const lowStockCount = visibleProducts.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold).length;
    const outOfStockCount = visibleProducts.filter((p) => p.stock_quantity === 0).length;
    const healthyCount = visibleProducts.filter((p) => p.stock_quantity > p.low_stock_threshold).length;

    return {
      totalProducts: visibleProducts.length,
      totalInShop,
      totalWarehouse,
      lowStockCount,
      outOfStockCount,
      healthyCount,
    };
  }, [visibleProducts]);

  const allVisibleSelected = useMemo(() => {
    return visibleProducts.length > 0 && visibleProducts.every((p) => selectedIds.has(p.id));
  }, [visibleProducts, selectedIds]);

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleProducts.forEach((p) => next.delete(p.id));
      } else {
        visibleProducts.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setDeleting(true);
      await Promise.all([...selectedIds].map((id) => productsAPI.delete(id)));
      toast.success(`${selectedIds.size} product(s) deleted successfully`);
      setShowDeleteModal(false);
      setSelectedIds(new Set());
      fetchProducts(meta.current_page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete some products');
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteModal = () => {
    if (selectedIds.size > 0) setShowDeleteModal(true);
  };

  const clearFilters = () => {
    const alreadyDefault = filter === 'all' && selectedSupplierId === '';
    setFilter('all');
    setSelectedSupplierId('');
    setQuickSearch('');
    setSortBy('stock_desc');
    setSelectedIds(new Set());
    if (alreadyDefault) {
      fetchProducts(1, { filter: 'all', selectedSupplierId: '' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FaPlus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {summary.healthyCount}
              </p>
              <p className="text-sm text-gray-500">In Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <FaExclamationTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {summary.lowStockCount}
              </p>
              <p className="text-sm text-gray-500">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <FaMinus className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {summary.outOfStockCount}
              </p>
              <p className="text-sm text-gray-500">Out of Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <FaBoxes className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{summary.totalInShop}</p>
              <p className="text-sm text-gray-500">Units In Shop</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <FaWarehouse className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{summary.totalWarehouse}</p>
              <p className="text-sm text-gray-500">Units In Warehouse</p>
            </div>
          </div>
        </div>
      </div>

      {/* Supplier & Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative min-w-[260px] flex-grow">
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Quick search: product, SKU, brand, supplier..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
              />
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500 min-w-[220px]"
            >
              <option value="stock_desc">Sort: In-shop stock (high to low)</option>
              <option value="stock_asc">Sort: In-shop stock (low to high)</option>
              <option value="warehouse_desc">Sort: Warehouse (high to low)</option>
              <option value="warehouse_asc">Sort: Warehouse (low to high)</option>
              <option value="name_asc">Sort: Name (A-Z)</option>
              <option value="name_desc">Sort: Name (Z-A)</option>
              <option value="risk_desc">Sort: At risk first</option>
            </select>
            <Button type="button" variant="outline" onClick={() => fetchProducts(meta.current_page)}>
              <FaSync />
              Refresh
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear
            </Button>
          </div>

          {/* Supplier selection at top */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-medium text-gray-700">Supplier:</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => {
                setSelectedSupplierId(e.target.value);
                setSelectedIds(new Set());
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500 min-w-[180px]"
            >
              <option value="">All products</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 ml-2">
              Showing {summary.totalProducts} product(s)
            </p>
            <p className="text-xs text-gray-500 ml-auto">
              Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString('en-PH') : '—'}
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'All Products' },
              { value: 'low_stock', label: 'Low Stock' },
              { value: 'out_of_stock', label: 'Out of Stock' },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setFilter(item.value)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filter === item.value
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-4 p-4 bg-primary-50 rounded-xl border border-primary-200">
          <span className="text-sm font-medium text-gray-700">
            {selectedIds.size} product(s) selected
          </span>
          <button
            onClick={openDeleteModal}
            className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
          >
            <FaTrash />
            Delete selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warehouse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">In Shop</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threshold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visibleProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                      No products match your current inventory filters.
                    </td>
                  </tr>
                ) : visibleProducts.map((product) => (
                  <tr key={product.id} className={`hover:bg-gray-50 ${selectedIds.has(product.id) ? 'bg-primary-50' : ''} ${product.stock_quantity <= product.low_stock_threshold ? 'bg-yellow-50' : ''} ${product.stock_quantity === 0 ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={toAbsoluteImageUrl(product.thumbnail)}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded-lg"
                          onError={(e) => {
                            if (e.target.src !== PLACEHOLDER_PRODUCT && !e.target.dataset.failed) {
                              e.target.dataset.failed = '1';
                              e.target.src = PLACEHOLDER_PRODUCT;
                            }
                          }}
                        />
                        <div>
                          <p className="font-medium text-gray-800">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.store?.name || 'Unknown supplier'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{product.sku}</td>
                    <td className="px-6 py-4 font-medium text-gray-800">{formatPrice(product.price)}</td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-700">
                        {product.inventory_stock ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-lg font-bold ${
                        product.stock_quantity === 0 ? 'text-red-600' :
                        product.stock_quantity <= product.low_stock_threshold ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{product.low_stock_threshold}</td>
                    <td className="px-6 py-4">{getStockBadge(product)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 border-t">
          <Pagination
            currentPage={meta.current_page}
            totalPages={meta.last_page}
            onPageChange={fetchProducts}
          />
        </div>
      </div>

      {/* Inventory records (stock receipts from supplier approvals) */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
        <h2 className="px-6 py-4 font-semibold text-gray-800 border-b">Recent stock receipts</h2>
        <p className="px-6 py-2 text-sm text-gray-500">Historical warehouse receipt records (product, supplier, quantity, stocked date).</p>
        {receipts.length === 0 ? (
          <p className="p-6 text-gray-500 text-sm">No stock receipts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stocked date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {receipts.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">{rec.product?.name ?? '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{rec.store?.name ?? '-'}</td>
                    <td className="px-6 py-4">{rec.quantity}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {rec.stocked_date ? new Date(rec.stocked_date).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete selected products?"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete {selectedIds.size} product(s)? This cannot be undone.
        </p>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleBulkDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Inventory;
