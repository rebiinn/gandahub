import { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaPlus, FaMinus, FaEdit, FaTruck, FaTrash, FaBoxOpen } from 'react-icons/fa';
import { productsAPI, stockRequestsAPI, storesAPI, inventoryReceiptsAPI } from '../../services/api';
import { toAbsoluteImageUrl, PLACEHOLDER_PRODUCT } from '../../utils/imageUrl';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Loading from '../../components/common/Loading';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import { intFromQuantityInput, intFromQuantityInputOrEmpty } from '../../utils/quantityInput';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });
  const [showModal, setShowModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockChange, setStockChange] = useState({ quantity: 0, operation: 'add' });
  const [requestQuantity, setRequestQuantity] = useState(10);
  const [requestNotes, setRequestNotes] = useState('');
  const [requestStoreId, setRequestStoreId] = useState('');
  const [requestProductId, setRequestProductId] = useState('');
  const [requestProducts, setRequestProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [requesting, setRequesting] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseQuantity, setReleaseQuantity] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [receipts, setReceipts] = useState([]);

  useEffect(() => {
    fetchProducts();
  }, [filter, selectedSupplierId]);

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

  const fetchProducts = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, active: true }; // Only products in the shop (admin-approved via Add to Shop)
      if (selectedSupplierId) params.store_id = selectedSupplierId;
      if (filter === 'low_stock') {
        // Fetch all and filter client-side for low stock
      }
      const response = await productsAPI.getAll(params);
      let data = response.data.data || [];
      
      if (filter === 'low_stock') {
        data = data.filter(p => p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0);
      } else if (filter === 'out_of_stock') {
        data = data.filter(p => p.stock_quantity === 0);
      }
      
      setProducts(data);
      setMeta(response.data.meta || { current_page: 1, last_page: 1 });
      setSelectedIds(new Set()); // Clear selection when list changes
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const openStockModal = (product) => {
    setSelectedProduct(product);
    setStockChange({ quantity: 0, operation: 'add' });
    setShowModal(true);
  };

  const openReleaseModal = (product) => {
    setSelectedProduct(product);
    setReleaseQuantity('');
    setShowReleaseModal(true);
  };

  const handleReleaseToShop = async () => {
    const qty = releaseQuantity === '' ? 0 : Number(releaseQuantity);
    if (!selectedProduct || qty < 1) {
      toast.error('Enter a valid quantity');
      return;
    }
    const warehouse = selectedProduct.inventory_stock ?? 0;
    if (qty > warehouse) {
      toast.error(`Cannot release more than warehouse stock (${warehouse})`);
      return;
    }
    try {
      setReleasing(true);
      await productsAPI.releaseStock(selectedProduct.id, qty);
      toast.success('Stock released to shop');
      setShowReleaseModal(false);
      fetchProducts(meta.current_page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to release stock');
    } finally {
      setReleasing(false);
    }
  };

  const loadRequestProducts = async (storeId) => {
    if (!storeId) {
      setRequestProducts([]);
      return;
    }
    try {
      const res = await productsAPI.getAll({
        store_id: storeId,
        active: '', // include both active and inactive products for that supplier
        per_page: 100,
      });
      setRequestProducts(res.data.data || []);
    } catch (error) {
      console.error('Failed to load supplier products for request modal:', error);
      setRequestProducts([]);
    }
  };

  const openRequestModal = (product = null) => {
    setSelectedProduct(product);
    setRequestProductId(product?.id || '');
    setRequestQuantity(product?.low_stock_threshold || 10);
    setRequestNotes('');
    const storeId = selectedSupplierId || product?.store_id || '';
    setRequestStoreId(storeId);
    loadRequestProducts(storeId);
    setShowRequestModal(true);
  };

  const handleStockRequest = async (e) => {
    e.preventDefault();
    const productId = selectedProduct?.id || requestProductId;
    if (!productId || requestQuantity < 1) {
      toast.error('Select a product and enter a valid quantity');
      return;
    }
    if (!requestStoreId) {
      toast.error('Please select a supplier');
      return;
    }
    try {
      setRequesting(true);
      await stockRequestsAPI.create({
        product_id: productId,
        store_id: requestStoreId,
        quantity_requested: requestQuantity,
        notes: requestNotes || undefined,
      });
      toast.success('Request sent to supplier');
      setShowRequestModal(false);
      setSelectedProduct(null);
      setRequestProductId('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send request');
    } finally {
      setRequesting(false);
      setShowRequestModal(false);
    }
  };

  const handleStockUpdate = async () => {
    if (stockChange.quantity < 0 && stockChange.operation !== 'set') {
      toast.error('Please enter a valid quantity');
      return;
    }
    if (stockChange.operation !== 'set' && stockChange.quantity === 0) {
      toast.error('Please enter a quantity');
      return;
    }
    try {
      await productsAPI.updateWarehouseStock(selectedProduct.id, stockChange);
      toast.success('Warehouse stock updated');
      setShowModal(false);
      fetchProducts(meta.current_page);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update warehouse stock';
      toast.error(message);
    }
  };

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

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FaPlus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {products.filter(p => p.stock_quantity > p.low_stock_threshold).length}
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
                {products.filter(p => p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0).length}
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
                {products.filter(p => p.stock_quantity === 0).length}
              </p>
              <p className="text-sm text-gray-500">Out of Stock</p>
            </div>
          </div>
        </div>
      </div>

      {/* Supplier & Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
            {selectedSupplierId && (
              <Button variant="primary" onClick={() => openRequestModal()} className="flex items-center gap-2">
                <FaTruck />
                Request stock
              </Button>
            )}
          </div>
          <div className="flex gap-2 sm:ml-auto">
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
                      checked={products.length > 0 && selectedIds.size === products.length}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => (
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
                        <p className="font-medium text-gray-800">{product.name}</p>
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
                    <td className="px-6 py-4 flex items-center gap-1">
                      {(product.inventory_stock ?? 0) > 0 && (
                        <button
                          onClick={() => openReleaseModal(product)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Release to shop"
                        >
                          <FaBoxOpen />
                        </button>
                      )}
                      <button
                        onClick={() => openStockModal(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Adjust warehouse"
                      >
                        <FaEdit />
                      </button>
                    </td>
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
        <p className="px-6 py-2 text-sm text-gray-500">Approved supplier requests create these records (product, supplier, quantity, stocked date).</p>
        {receipts.length === 0 ? (
          <p className="p-6 text-gray-500 text-sm">No stock receipts yet. Approved requests will appear here.</p>
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

      {/* Request from Supplier Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        title="Request Stock from Supplier"
      >
        {requestStoreId && (
          <form onSubmit={handleStockRequest} className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Supplier</p>
              <p className="text-gray-900 font-medium">{stores.find(s => s.id == requestStoreId)?.name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Product</label>
              <select
                value={requestProductId}
                onChange={(e) => {
                  const id = e.target.value;
                  setRequestProductId(id);
                  const p = requestProducts.find(pr => pr.id == id);
                  if (p) setRequestQuantity(p.low_stock_threshold || 10);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
                required
              >
                <option value="">Choose product...</option>
                {requestProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku}, Available: {p.supplier_stock_quantity ?? 0})</option>
                ))}
              </select>
              {requestProducts.length === 0 && (
                <p className="text-sm text-amber-600 mt-1">No products from this supplier. Select a different supplier.</p>
              )}
            </div>
            <Input
              label="Quantity needed"
              type="number"
              min="1"
              value={requestQuantity}
              onChange={(e) => setRequestQuantity(intFromQuantityInput(e.target.value))}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
              <textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                placeholder="e.g. Urgent, need by Friday"
              />
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowRequestModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={requesting || requestProducts.length === 0}>Send Request</Button>
            </div>
          </form>
        )}
      </Modal>

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

      {/* Release to Shop Modal */}
      <Modal
        isOpen={showReleaseModal}
        onClose={() => setShowReleaseModal(false)}
        title="Release to Shop"
      >
        {selectedProduct && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
              <img
                src={toAbsoluteImageUrl(selectedProduct.thumbnail)}
                alt={selectedProduct.name}
                className="w-16 h-16 object-cover rounded-lg"
                onError={(e) => {
                  if (e.target.src !== PLACEHOLDER_PRODUCT && !e.target.dataset.failed) {
                    e.target.dataset.failed = '1';
                    e.target.src = PLACEHOLDER_PRODUCT;
                  }
                }}
              />
              <div>
                <p className="font-medium text-gray-800">{selectedProduct.name}</p>
                <p className="text-sm text-gray-500">Warehouse: {selectedProduct.inventory_stock ?? 0} → In shop: {selectedProduct.stock_quantity}</p>
              </div>
            </div>
            <Input
              label="Quantity to release to shop"
              type="number"
              min="1"
              max={selectedProduct.inventory_stock ?? 0}
              value={releaseQuantity}
              onChange={(e) => setReleaseQuantity(intFromQuantityInputOrEmpty(e.target.value))}
            />
            <div className="bg-green-50 p-3 rounded-lg text-sm text-green-800">
              {releaseQuantity === '' ? (
                <p>Enter a quantity to see warehouse and shop levels after release.</p>
              ) : (
                <p>
                  After release: Warehouse {((selectedProduct.inventory_stock ?? 0) - Number(releaseQuantity))}, In shop {(selectedProduct.stock_quantity ?? 0) + Number(releaseQuantity)}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <Button variant="outline" onClick={() => setShowReleaseModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleReleaseToShop}
                disabled={releasing || releaseQuantity === '' || Number(releaseQuantity) < 1}
              >
                {releasing ? 'Releasing...' : 'Release to Shop'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Adjust Warehouse Stock Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Adjust Warehouse Stock"
      >
        {selectedProduct && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
              <img
                src={toAbsoluteImageUrl(selectedProduct.thumbnail)}
                alt={selectedProduct.name}
                className="w-16 h-16 object-cover rounded-lg"
                onError={(e) => {
                  if (e.target.src !== PLACEHOLDER_PRODUCT && !e.target.dataset.failed) {
                    e.target.dataset.failed = '1';
                    e.target.src = PLACEHOLDER_PRODUCT;
                  }
                }}
              />
              <div>
                <p className="font-medium text-gray-800">{selectedProduct.name}</p>
                <p className="text-sm text-gray-500">Warehouse: {selectedProduct.inventory_stock ?? 0} · In shop: {selectedProduct.stock_quantity}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Operation</label>
              <select
                value={stockChange.operation}
                onChange={(e) => setStockChange({ ...stockChange, operation: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
              >
                <option value="add">Add to warehouse</option>
                <option value="subtract">Remove from warehouse</option>
                <option value="set">Set warehouse stock</option>
              </select>
            </div>

            <Input
              label="Quantity"
              type="number"
              min="0"
              value={stockChange.quantity}
              onChange={(e) => setStockChange({ ...stockChange, quantity: intFromQuantityInput(e.target.value) })}
            />

            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
              {stockChange.operation === 'add' && (
                <p>Warehouse will be: {(selectedProduct.inventory_stock ?? 0) + stockChange.quantity}</p>
              )}
              {stockChange.operation === 'subtract' && (
                <p>Warehouse will be: {Math.max(0, (selectedProduct.inventory_stock ?? 0) - stockChange.quantity)}</p>
              )}
              {stockChange.operation === 'set' && (
                <p>Warehouse will be set to: {stockChange.quantity}</p>
              )}
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleStockUpdate}>Update Warehouse</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Inventory;
