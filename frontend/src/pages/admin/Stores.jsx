import { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaStore } from 'react-icons/fa';
import { storesAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Loading from '../../components/common/Loading';

const AdminStores = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
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

  const fetchStores = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await storesAPI.getAll({ per_page: 50 });
      setStores(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const openModal = (store = null) => {
    if (store) {
      setEditingStore(store);
      setFormData({
        name: store.name || '',
        slug: store.slug || '',
        description: store.description || '',
        address: store.address || '',
        phone: store.phone || '',
        is_active: store.is_active !== false,
      });
    } else {
      setEditingStore(null);
      setFormData({
        name: '',
        slug: '',
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
          slug: formData.slug || undefined,
          description: formData.description,
          address: formData.address,
          phone: formData.phone,
          is_active: formData.is_active,
        });
        toast.success('Store updated');
      } else {
        await storesAPI.create({
          name: formData.name,
          slug: formData.slug || undefined,
          description: formData.description,
          address: formData.address,
          phone: formData.phone,
          is_active: formData.is_active,
          create_supplier: formData.create_supplier,
          supplier_email: formData.supplier_email,
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Stores (Markets)</h1>
        <Button variant="primary" onClick={() => openModal()}>
          <FaPlus />
          Add Store
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <Loading />
        ) : stores.length === 0 ? (
          <p className="p-8 text-gray-500 text-center">No stores yet. Add a store and supplier to get started.</p>
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
                {stores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FaStore className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-800">{store.name}</p>
                          <p className="text-sm text-gray-500">{store.slug}</p>
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
          {!editingStore && (
            <Input label="Slug (optional)" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="auto-generated from name" />
          )}
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
                  <Input label="Email" type="email" value={formData.supplier_email} onChange={(e) => setFormData({ ...formData, supplier_email: e.target.value })} />
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
