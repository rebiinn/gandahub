import { useState, useEffect, useRef } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaImage, FaSpinner } from 'react-icons/fa';
import { productsAPI, categoriesAPI, storesAPI, uploadAPI } from '../../services/api';
import { toAbsoluteImageUrl, PLACEHOLDER_PRODUCT, thumbnailToPath } from '../../utils/imageUrl';
import { getProductShades, shadeHexForColorInput } from '../../utils/productShades';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    store_id: '', // set when editing a product
    description: '',
    short_description: '',
    price: '',
    sale_price: '',
    stock_quantity: '',
    brand: '',
    thumbnail: '',
    is_featured: false,
    is_active: true,
  });
  const [uploading, setUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [thumbBust, setThumbBust] = useState({}); // productId -> timestamp, so list re-loads thumbnail after update
  const fileInputRef = useRef(null);
  const previewBlobUrlRef = useRef(null);
  const [shadeRows, setShadeRows] = useState([{ name: '', hex: '', image: '' }]);
  const [uploadingShadeIndex, setUploadingShadeIndex] = useState(null);

  // Select from Inventory modal (add to shop)
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [inventoryMeta, setInventoryMeta] = useState({ current_page: 1, last_page: 1 });
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedForShop, setSelectedForShop] = useState(new Set());
  const [addingToShop, setAddingToShop] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await storesAPI.getList();
      setStores(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  const fetchProducts = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, active: true }; // Only products in the shop (admin controls via Add to Shop)
      if (search) params.search = search;
      const response = await productsAPI.getAll(params);
      setProducts(response.data.data || []);
      setMeta(response.data.meta || { current_page: 1, last_page: 1 });
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoriesAPI.getAll({ active: true });
      setCategories(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  const openSelectModal = () => {
    setShowSelectModal(true);
    setSelectedForShop(new Set());
    setInventorySearch('');
    fetchInventoryProducts(1, '');
  };

  const fetchInventoryProducts = async (page = 1, searchTerm = null) => {
    setInventoryLoading(true);
    try {
      const params = { page, per_page: 10, active: false };
      const q = searchTerm !== null ? searchTerm : inventorySearch;
      if (q) params.search = q;
      const response = await productsAPI.getAll(params);
      setInventoryProducts(response.data.data || []);
      setInventoryMeta(response.data.meta || { current_page: 1, last_page: 1 });
    } catch (error) {
      console.error('Failed to fetch inventory products:', error);
      toast.error('Failed to load inventory');
    } finally {
      setInventoryLoading(false);
    }
  };

  const toggleSelectForShop = (id) => {
    setSelectedForShop((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllForShop = () => {
    if (selectedForShop.size === inventoryProducts.length) {
      setSelectedForShop(new Set());
    } else {
      setSelectedForShop(new Set(inventoryProducts.map((p) => p.id)));
    }
  };

  const handleAddToShop = async () => {
    if (selectedForShop.size === 0) {
      toast.error('Select at least one product');
      return;
    }
    setAddingToShop(true);
    try {
      await Promise.all([...selectedForShop].map((id) => productsAPI.update(id, { is_active: true })));
      toast.success(`${selectedForShop.size} product(s) added to shop`);
      setShowSelectModal(false);
      setSelectedForShop(new Set());
      fetchProducts(meta.current_page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add products to shop');
    } finally {
      setAddingToShop(false);
    }
  };

  const openModal = (product = null) => {
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    setPreviewImageUrl(null);
    if (product) {
      setEditingProduct(product);
      setShowSelectModal(false);
      setFormData({
        name: product.name || '',
        category_id: product.category_id || '',
        store_id: product.store_id || '',
        description: product.description || '',
        short_description: product.short_description || '',
        price: product.price || '',
        sale_price: product.sale_price || '',
        stock_quantity: product.stock_quantity || '',
        brand: product.brand || '',
        thumbnail: product.thumbnail || '',
        is_featured: product.is_featured || false,
        is_active: product.is_active !== false,
      });
      setPreviewImageUrl(product.thumbnail || null);
      const shades = getProductShades(product);
      setShadeRows(
        shades.length
          ? shades.map((s) => ({ name: s.name, hex: s.hex || '', image: s.image || '' }))
          : [{ name: '', hex: '', image: '' }]
      );
    } else {
      return; // Add flow uses openSelectModal, not this modal
    }
    setShowModal(true);
  };

  const closeModal = () => {
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    setShadeRows([{ name: '', hex: '', image: '' }]);
    setUploadingShadeIndex(null);
    setShowModal(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Show the selected file in the preview immediately (no wait for server)
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
    }
    const blobUrl = URL.createObjectURL(file);
    previewBlobUrlRef.current = blobUrl;
    setPreviewImageUrl(blobUrl);

    try {
      setUploading(true);
      const response = await uploadAPI.uploadImage(file, 'products');
      const imageUrl = response.data.data?.url ?? response.data.data;
      if (!imageUrl || typeof imageUrl !== 'string') {
        toast.error('Upload succeeded but no image URL returned');
        return;
      }
      setFormData((prev) => ({ ...prev, thumbnail: imageUrl }));
      // Keep showing blob in preview so user always sees their image (server URL may 404 if storage link missing)
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Upload failed:', error);
      const msg = error.response?.data?.message || error.message || 'Upload failed';
      toast.error(typeof msg === 'string' ? msg : 'Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleShadeImageUpload = async (idx, e) => {
    const file = e.target.files?.[0];
    const input = e.target;
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    try {
      setUploadingShadeIndex(idx);
      const response = await uploadAPI.uploadImage(file, 'products');
      const imageUrl = response.data.data?.url ?? response.data.data;
      if (!imageUrl || typeof imageUrl !== 'string') {
        toast.error('Upload succeeded but no image URL returned');
        return;
      }
      updateShadeRow(idx, 'image', imageUrl);
      toast.success('Shade image uploaded');
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Upload failed';
      toast.error(typeof msg === 'string' ? msg : 'Failed to upload image');
    } finally {
      setUploadingShadeIndex(null);
      if (input) input.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        thumbnail: thumbnailToPath(formData.thumbnail) || formData.thumbnail || undefined,
        store_id: formData.store_id || undefined,
        sale_price: formData.sale_price || undefined,
      };
      if (editingProduct) {
        const shadesPayload = shadeRows
          .filter((r) => r.name.trim())
          .map((r) => {
            const o = { name: r.name.trim() };
            if (r.hex.trim()) o.hex = r.hex.trim();
            if (r.image.trim()) {
              o.image = thumbnailToPath(r.image.trim()) || r.image.trim();
            }
            return o;
          });
        const prevAttrs =
          editingProduct.attributes && typeof editingProduct.attributes === 'object'
            ? { ...editingProduct.attributes }
            : {};
        if (shadesPayload.length) prevAttrs.shades = shadesPayload;
        else delete prevAttrs.shades;
        payload.attributes = prevAttrs;

        const response = await productsAPI.update(editingProduct.id, payload);
        const updated = response?.data?.data;
        if (updated) {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === updated.id
                ? { ...p, ...updated, category: updated.category ?? p.category }
                : p
            )
          );
          setThumbBust((prev) => ({ ...prev, [updated.id]: Date.now() }));
        }
        toast.success('Product updated successfully');
        closeModal();
        // Don't refetch after update so the new image shows immediately (optimistic update stays)
      } else {
        await productsAPI.create(payload);
        toast.success('Product created successfully');
        closeModal();
        fetchProducts(meta.current_page);
      }
    } catch (error) {
      let message = 'Operation failed';
      if (error.response?.data) {
        const d = error.response.data;
        message = d.message || d.error || message;
        if (d.errors && typeof d.errors === 'object') {
          const msgs = Object.values(d.errors).flat().filter(Boolean);
          if (msgs.length) message = msgs.join('. ');
        }
      } else if (error.message) {
        message = error.message;
      }
      toast.error(message);
        console.error('Product save failed:', error.response?.data || error);
    }
  };

  const addShadeRow = () => {
    setShadeRows((rows) => [...rows, { name: '', hex: '', image: '' }]);
  };

  const removeShadeRow = (index) => {
    setShadeRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  };

  const updateShadeRow = (index, field, value) => {
    setShadeRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await productsAPI.delete(id);
      toast.success('Product deleted successfully');
      fetchProducts(meta.current_page);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete product';
      toast.error(message);
    }
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Products</h1>
        <p className="text-sm text-gray-500">
          View-only list of products currently visible in the shop.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-grow">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <Button type="submit" variant="primary">
            Search
          </Button>
        </form>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          key={product.id + (thumbBust[product.id] ?? '')}
                          src={
                            toAbsoluteImageUrl(product.thumbnail) +
                            (thumbBust[product.id] ? '?t=' + thumbBust[product.id] : '')
                          }
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
                          <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {product.category?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {product.store?.name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{formatPrice(product.price)}</p>
                      {product.sale_price && (
                        <p className="text-sm text-green-600">{formatPrice(product.sale_price)}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={product.stock_quantity > 10 ? 'success' : product.stock_quantity > 0 ? 'warning' : 'danger'}>
                        {product.stock_quantity}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={product.is_active ? 'success' : 'danger'}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => openModal(product)}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Edit product"
                      >
                        <FaEdit className="w-4 h-4" />
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

      {/* Select from Inventory Modal */}
      <Modal
        isOpen={showSelectModal}
        onClose={() => setShowSelectModal(false)}
        title="Select from Inventory to Show in Shop"
        size="lg"
      >
        <p className="text-gray-600 text-sm mb-4">
          Choose products from inventory to display in the shop. Only products not yet in the shop are listed.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchInventoryProducts(1, inventorySearch);
          }}
          className="flex gap-2 mb-4"
        >
          <input
            type="text"
            value={inventorySearch}
            onChange={(e) => setInventorySearch(e.target.value)}
            placeholder="Search inventory..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          />
          <Button type="submit" variant="primary">Search</Button>
        </form>
        <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
          {inventoryLoading ? (
            <div className="p-8 text-center text-gray-500">
              <FaSpinner className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : inventoryProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No products available. All inventory products are already in the shop, or create products via suppliers first.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={inventoryProducts.length > 0 && selectedForShop.size === inventoryProducts.length}
                      onChange={toggleSelectAllForShop}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Store</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inventoryProducts.map((p) => (
                  <tr key={p.id} className={`hover:bg-gray-50 ${selectedForShop.has(p.id) ? 'bg-primary-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedForShop.has(p.id)}
                        onChange={() => toggleSelectForShop(p.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={toAbsoluteImageUrl(p.thumbnail)}
                          alt={p.name}
                          className="w-10 h-10 object-cover rounded"
                          onError={(e) => { if (e.target.src !== PLACEHOLDER_PRODUCT) e.target.src = PLACEHOLDER_PRODUCT; }}
                        />
                        <div>
                          <p className="font-medium text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-500">SKU: {p.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{p.store?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.stock_quantity > 0 ? 'success' : 'danger'}>{p.stock_quantity}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {inventoryProducts.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedForShop.size} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowSelectModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleAddToShop}
                disabled={selectedForShop.size === 0 || addingToShop}
              >
                {addingToShop ? 'Adding...' : 'Add to Shop'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Product Modal (Edit only) */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Image</label>
            <div className="flex items-start gap-4">
              {/* Image Preview */}
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50">
                {(previewImageUrl ?? formData.thumbnail) ? (
                  <img
                    key={previewImageUrl ?? formData.thumbnail}
                    src={(previewImageUrl ?? formData.thumbnail).toString().startsWith('blob:')
                      ? (previewImageUrl ?? formData.thumbnail)
                      : toAbsoluteImageUrl(previewImageUrl ?? formData.thumbnail)}
                    alt="Product preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaImage className="w-8 h-8 text-gray-400" />
                )}
              </div>
              
              {/* Upload Controls */}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="product-image"
                />
                <label
                  htmlFor="product-image"
                  className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {uploading ? (
                    <>
                      <FaSpinner className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FaImage className="w-4 h-4" />
                      Choose Image
                    </>
                  )}
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  JPEG, PNG, GIF, or WebP. Max 5MB.
                </p>
                
                {/* Manual URL Input */}
                <div className="mt-3">
                  <Input
                    label="Or enter image URL"
                    placeholder="https://example.com/image.jpg"
                    value={formData.thumbnail}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData((prev) => ({ ...prev, thumbnail: v }));
                      setPreviewImageUrl(null);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <Input
            label="Product Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
                required
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Store (Market)</label>
              <select
                value={formData.store_id}
                onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
              >
                <option value="">Select Store</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Brand"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
            />
            <Input
              label="Sale Price"
              type="number"
              step="0.01"
              value={formData.sale_price}
              onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
            />
            <Input
              label="Stock Quantity"
              type="number"
              value={formData.stock_quantity}
              onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
              required
            />
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/80">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-800">Shades (lipstick, gloss, etc.)</label>
              <Button type="button" variant="outline" size="sm" onClick={addShadeRow}>
                <FaPlus className="w-3 h-3" /> Add shade
              </Button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Optional. Add variant shades here. The storefront always shows an <strong>Original</strong> option first (main product image / gallery); you don&apos;t need to add Original as a row.
            </p>
            <div className="space-y-3">
              {shadeRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start bg-white p-3 rounded-lg border border-gray-100">
                  <div className="md:col-span-3">
                    <Input
                      label="Shade name"
                      value={row.name}
                      onChange={(e) => updateShadeRow(idx, 'name', e.target.value)}
                      placeholder="e.g. Nude Pink"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Swatch color</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="color"
                        aria-label={`Color for shade ${idx + 1}`}
                        className="h-10 w-14 cursor-pointer rounded border border-gray-300 bg-white p-1 shrink-0"
                        value={shadeHexForColorInput(row.hex)}
                        onChange={(e) => updateShadeRow(idx, 'hex', e.target.value)}
                      />
                      <span className="text-xs font-mono text-gray-600 tabular-nums min-w-[4.5rem]">
                        {row.hex?.trim() || '—'}
                      </span>
                      <button
                        type="button"
                        className="text-xs text-gray-500 hover:text-primary-600 underline"
                        onClick={() => updateShadeRow(idx, 'hex', '')}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Shade image</label>
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                        {uploadingShadeIndex === idx ? (
                          <FaSpinner className="w-5 h-5 animate-spin text-primary-500" />
                        ) : row.image ? (
                          <img
                            src={toAbsoluteImageUrl(row.image)}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              if (e.target.src !== PLACEHOLDER_PRODUCT && !e.target.dataset.failed) {
                                e.target.dataset.failed = '1';
                                e.target.src = PLACEHOLDER_PRODUCT;
                              }
                            }}
                          />
                        ) : (
                          <FaImage className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
                          className="hidden"
                          id={`admin-shade-img-${idx}`}
                          onChange={(ev) => handleShadeImageUpload(idx, ev)}
                        />
                        <label
                          htmlFor={`admin-shade-img-${idx}`}
                          className={`inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 w-fit ${
                            uploadingShadeIndex === idx ? 'pointer-events-none opacity-60' : ''
                          }`}
                        >
                          <FaImage className="w-3.5 h-3.5" />
                          Choose image
                        </label>
                        {row.image && (
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline text-left w-fit"
                            onClick={() => updateShadeRow(idx, 'image', '')}
                          >
                            Remove image
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-1 flex justify-end pt-6 md:pt-0 md:items-start">
                    <button
                      type="button"
                      onClick={() => removeShadeRow(idx)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Remove shade"
                      disabled={shadeRows.length <= 1}
                    >
                      <FaTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Short Description</label>
            <textarea
              value={formData.short_description}
              onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_featured}
                onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span>Featured Product</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span>Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingProduct ? 'Update Product' : 'Create Product'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Products;
