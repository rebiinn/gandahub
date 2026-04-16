import { useState, useEffect, useMemo } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaSync, FaTags, FaCheckCircle, FaBan } from 'react-icons/fa';
import { categoriesAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Loading from '../../components/common/Loading';
import Badge from '../../components/common/Badge';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name_asc');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    is_active: true,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await categoriesAPI.getAll();
      setCategories(response.data.data || []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      toast.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name || '',
        is_active: category.is_active !== false,
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        is_active: true,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      toast.error('Category name is required');
      return;
    }
    try {
      const payload = {
        ...formData,
        name: trimmedName,
      };
      if (editingCategory) {
        await categoriesAPI.update(editingCategory.id, payload);
        toast.success('Category updated successfully');
      } else {
        await categoriesAPI.create(payload);
        toast.success('Category created successfully');
      }
      setShowModal(false);
      fetchCategories();
    } catch (error) {
      const message = error.response?.data?.message || 'Operation failed';
      toast.error(message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await categoriesAPI.delete(id);
      toast.success('Category deleted successfully');
      fetchCategories();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete category';
      toast.error(message);
    }
  };

  const filteredCategories = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    let list = categories;

    if (statusFilter !== 'all') {
      const shouldBeActive = statusFilter === 'active';
      list = list.filter((category) => Boolean(category.is_active) === shouldBeActive);
    }

    if (needle) {
      list = list.filter((category) => {
        const haystack = [category.name, category.slug]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      });
    }

    const next = [...list];
    next.sort((a, b) => {
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'products_desc') return Number(b.products_count || 0) - Number(a.products_count || 0);
      if (sortBy === 'products_asc') return Number(a.products_count || 0) - Number(b.products_count || 0);
      if (sortBy === 'status') {
        if (a.is_active === b.is_active) return (a.name || '').localeCompare(b.name || '');
        return a.is_active ? -1 : 1;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    return next;
  }, [categories, searchTerm, statusFilter, sortBy]);

  const summary = useMemo(() => {
    const activeCount = filteredCategories.filter((c) => c.is_active).length;
    const inactiveCount = filteredCategories.length - activeCount;
    const totalProducts = filteredCategories.reduce((sum, c) => sum + Number(c.products_count || 0), 0);
    const emptyCount = filteredCategories.filter((c) => Number(c.products_count || 0) === 0).length;

    return {
      total: filteredCategories.length,
      activeCount,
      inactiveCount,
      totalProducts,
      emptyCount,
    };
  }, [filteredCategories]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortBy('name_asc');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Categories</h1>
        <Button variant="primary" onClick={() => openModal()}>
          <FaPlus />
          Add Category
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaTags />
            Total Categories
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
            <FaTags />
            Products Linked
          </div>
          <p className="text-2xl font-bold text-primary-600 mt-1">{summary.totalProducts}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaBan />
            Empty Categories
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-1">{summary.emptyCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative min-w-[260px] flex-grow">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search category name or slug..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500 min-w-[180px]"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500 min-w-[220px]"
          >
            <option value="name_asc">Sort: Name (A-Z)</option>
            <option value="name_desc">Sort: Name (Z-A)</option>
            <option value="products_desc">Sort: Most products first</option>
            <option value="products_asc">Sort: Least products first</option>
            <option value="status">Sort: Active first</option>
          </select>
          <Button type="button" variant="outline" onClick={fetchCategories}>
            <FaSync />
            Refresh
          </Button>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Showing {filteredCategories.length} category(ies). Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString('en-PH') : '—'}
        </p>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                      No categories match your current filters/search.
                    </td>
                  </tr>
                ) : filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                          <span className="text-primary-600 font-semibold">
                            {category.name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{category.name}</p>
                          <p className="text-sm text-gray-500">{category.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {category.products_count || 0}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={category.is_active ? 'success' : 'danger'}>
                        {category.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModal(category)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
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

      {/* Category Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Category Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <span>Active</span>
          </label>

          <div className="flex justify-end gap-4 pt-4">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingCategory ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Categories;
