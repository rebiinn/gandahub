import { useState, useEffect, useRef } from 'react';
import { FaPlus, FaEdit, FaImage, FaSpinner, FaTrash } from 'react-icons/fa';
import { productsAPI, storesAPI, categoriesAPI, uploadAPI } from '../../services/api';
import { toAbsoluteImageUrl, PLACEHOLDER_PRODUCT, thumbnailToPath } from '../../utils/imageUrl';
import { normalizeQuantityInputString } from '../../utils/quantityInput';
import { getProductShades, shadeHexForColorInput } from '../../utils/productShades';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Loading from '../../components/common/Loading';

const SupplierProducts = () => {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    description: '',
    short_description: '',
    price: '',
    sale_price: '',
    supply_price: '',
    stock_quantity: '',
    brand: '',
    thumbnail: '',
  });
  const [uploading, setUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const fileInputRef = useRef(null);
  const [shadeRows, setShadeRows] = useState([{ name: '', hex: '', image: '' }]);
  const [uploadingShadeIndex, setUploadingShadeIndex] = useState(null);

  const loadStoreAndProducts = async () => {
    try {
      const storeRes = await storesAPI.getAll();
      const storeData = storeRes.data.data;
      const s = Array.isArray(storeData) ? storeData[0] : storeData;
      setStore(s);
      if (s?.id) {
        const [prodsRes, catRes] = await Promise.all([
          productsAPI.getAll({ store_id: s.id, active: '' }),
          categoriesAPI.getAll({ active: true }),
        ]);
        setProducts(prodsRes.data.data || []);
        setCategories(catRes.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStoreAndProducts();
  }, []);

  const openModal = (product = null) => {
    setPreviewImageUrl(null);
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name || '',
        category_id: product.category_id || '',
        description: product.description || '',
        short_description: product.short_description || '',
        price: product.price ?? '',
        sale_price: product.sale_price ?? '',
        supply_price: product.supply_price ?? '',
        stock_quantity: product.supplier_stock_quantity ?? product.stock_quantity ?? '',
        brand: product.brand || '',
        thumbnail: product.thumbnail || '',
      });
      setPreviewImageUrl(product.thumbnail || null);
      const shades = getProductShades(product);
      setShadeRows(
        shades.length
          ? shades.map((s) => ({ name: s.name, hex: s.hex || '', image: s.image || '' }))
          : [{ name: '', hex: '', image: '' }]
      );
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        category_id: '',
        description: '',
        short_description: '',
        price: '',
        sale_price: '',
        supply_price: '',
        stock_quantity: '0',
        brand: '',
        thumbnail: '',
      });
      setShadeRows([{ name: '', hex: '', image: '' }]);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShadeRows([{ name: '', hex: '', image: '' }]);
    setUploadingShadeIndex(null);
    setShowModal(false);
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
    setPreviewImageUrl(URL.createObjectURL(file));
    try {
      setUploading(true);
      const response = await uploadAPI.supplierUploadImage(file, 'products');
      const imageUrl = response.data.data?.url ?? response.data.data;
      if (!imageUrl || typeof imageUrl !== 'string') {
        toast.error('Upload succeeded but no image URL returned');
        return;
      }
      setFormData((prev) => ({ ...prev, thumbnail: imageUrl }));
      toast.success('Image uploaded');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      const response = await uploadAPI.supplierUploadImage(file, 'products');
      const imageUrl = response.data.data?.url ?? response.data.data;
      if (!imageUrl || typeof imageUrl !== 'string') {
        toast.error('Upload succeeded but no image URL returned');
        return;
      }
      updateShadeRow(idx, 'image', imageUrl);
      toast.success('Shade image uploaded');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingShadeIndex(null);
      if (input) input.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    const attrBase =
      editingProduct?.attributes && typeof editingProduct.attributes === 'object'
        ? { ...editingProduct.attributes }
        : {};
    if (shadesPayload.length) attrBase.shades = shadesPayload;
    else delete attrBase.shades;

    const payload = {
      name: formData.name,
      category_id: formData.category_id,
      description: formData.description || undefined,
      short_description: formData.short_description || undefined,
      price: formData.price,
      sale_price: formData.sale_price || undefined,
      supply_price: formData.supply_price || undefined,
      stock_quantity: parseInt(formData.stock_quantity, 10) || 0,
      brand: formData.brand || undefined,
      thumbnail: thumbnailToPath(formData.thumbnail) || formData.thumbnail || undefined,
    };
    if (editingProduct) {
      payload.attributes = attrBase;
    } else if (Object.keys(attrBase).length > 0) {
      payload.attributes = attrBase;
    }
    try {
      if (editingProduct) {
        await productsAPI.supplierUpdate(editingProduct.id, payload);
        toast.success('Product updated');
      } else {
        await productsAPI.supplierCreate(payload);
        toast.success('Product created');
      }
      closeModal();
      loadStoreAndProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleStockUpdate = async (product, operation, quantity) => {
    const q = parseInt(quantity, 10);
    if (isNaN(q) || q < 0) {
      toast.error('Enter a valid quantity');
      return;
    }
    try {
      await productsAPI.supplierUpdateStock(product.id, { quantity: q, operation });
      toast.success('Stock updated');
      loadStoreAndProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    }
  };

  const formatPrice = (amount) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

  if (loading && !store) return <Loading />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Products</h1>
          {store && (
            <p className="text-gray-600 mt-1">Manage cosmetic products for <strong>{store.name}</strong></p>
          )}
        </div>
        {store && (
          <Button variant="primary" onClick={() => openModal()}>
            <FaPlus />
            Add Product
          </Button>
        )}
      </div>

      {!store ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800">
          Store not found. Contact admin to set up your store.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {products.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 mb-4">No products yet.</p>
              <Button variant="primary" onClick={() => openModal()}>
                <FaPlus />
                Add your first product
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supply price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={toAbsoluteImageUrl(product.thumbnail)}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded-lg"
                            onError={(e) => {
                              if (e.target.src !== PLACEHOLDER_PRODUCT) e.target.src = PLACEHOLDER_PRODUCT;
                            }}
                          />
                          <div>
                            <p className="font-medium text-gray-800">{product.name}</p>
                            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{product.category?.name || '-'}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium">{formatPrice(product.price)}</p>
                        {product.sale_price && (
                          <p className="text-sm text-emerald-600">{formatPrice(product.sale_price)}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {product.supply_price != null ? formatPrice(product.supply_price) : '-'}
                      </td>
                      <td className="px-6 py-4">{product.supplier_stock_quantity ?? 0}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openModal(product)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            title="Edit"
                          >
                            <FaEdit />
                          </button>
                          <select
                            className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                            defaultValue=""
                            onChange={(e) => {
                              const v = e.target.value;
                              e.target.value = '';
                              if (!v) return;
                              const [op, q] = v.split(':');
                              if (op && q) handleStockUpdate(product, op, q);
                            }}
                          >
                            <option value="">Stock...</option>
                            <option value="add:1">+1</option>
                            <option value="add:5">+5</option>
                            <option value="add:10">+10</option>
                            <option value="subtract:1">-1</option>
                            <option value="set:0">Set 0</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editingProduct ? 'Edit Product' : 'Add Product'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Image</label>
            <div className="flex items-start gap-4">
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50">
                {(previewImageUrl ?? formData.thumbnail) ? (
                  <img
                    src={(previewImageUrl ?? formData.thumbnail).toString().startsWith('blob:')
                      ? (previewImageUrl ?? formData.thumbnail)
                      : toAbsoluteImageUrl(previewImageUrl ?? formData.thumbnail)}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaImage className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="supplier-product-image"
                />
                <label
                  htmlFor="supplier-product-image"
                  className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 ${uploading ? 'opacity-50' : ''}`}
                >
                  {uploading ? <FaSpinner className="animate-spin" /> : <FaImage />}
                  {uploading ? 'Uploading...' : 'Choose Image'}
                </label>
                <Input
                  label="Or image URL"
                  placeholder="https://..."
                  value={formData.thumbnail}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, thumbnail: e.target.value }));
                    setPreviewImageUrl(null);
                  }}
                  className="mt-2"
                />
              </div>
            </div>
          </div>

          <Input label="Product Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500"
              required
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input label="Price (₱)" type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required />
            <Input label="Sale Price (₱)" type="number" step="0.01" value={formData.sale_price} onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })} />
            <Input label="Supply price (₱)" type="number" step="0.01" value={formData.supply_price} onChange={(e) => setFormData({ ...formData, supply_price: e.target.value })} placeholder="Your cost" />
            <Input label="Available stock" type="number" min="0" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: normalizeQuantityInputString(e.target.value) })} required />
          </div>

          <Input label="Brand" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} />

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-800">Shades (optional)</span>
              <Button type="button" variant="outline" size="sm" onClick={addShadeRow}>
                <FaPlus className="w-3 h-3" /> Add shade e.g. Rosewood
              </Button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Variant shades only — customers also get an <strong>Original</strong> option on the product page (your main photos). No need to add Original here.
            </p>
            <div className="space-y-2">
              {shadeRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start bg-white p-3 rounded-lg border border-gray-100">
                  <div className="sm:col-span-3">
                    <Input label="Name" value={row.name} onChange={(e) => updateShadeRow(idx, 'name', e.target.value)} placeholder="Nude Pink" />
                  </div>
                  <div className="sm:col-span-4">
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
                        className="text-xs text-gray-500 hover:text-emerald-600 underline"
                        onClick={() => updateShadeRow(idx, 'hex', '')}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Shade image</label>
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                        {uploadingShadeIndex === idx ? (
                          <FaSpinner className="w-5 h-5 animate-spin text-emerald-600" />
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
                          id={`supplier-shade-img-${idx}`}
                          onChange={(ev) => handleShadeImageUpload(idx, ev)}
                        />
                        <label
                          htmlFor={`supplier-shade-img-${idx}`}
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
                  <div className="sm:col-span-1 flex justify-end pt-6 sm:pt-0 sm:items-start">
                    <button type="button" onClick={() => removeShadeRow(idx)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" disabled={shadeRows.length <= 1} title="Remove">
                      <FaTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Input label="Short Description" value={formData.short_description} onChange={(e) => setFormData({ ...formData, short_description: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
          </div>
          <p className="text-sm text-gray-500">
            New products start as &quot;Inactive&quot;. Admin will add them to the shop when ready.
          </p>

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" variant="primary">{editingProduct ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SupplierProducts;
