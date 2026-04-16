import { useState, useEffect, useMemo, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaToggleOn, FaToggleOff, FaEye, FaUsers, FaUserCheck, FaUserSlash } from 'react-icons/fa';
import { usersAPI, sellerApplicationsAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';

const STAFF_EMAIL_DOMAIN = 'gandahub.com';
const toStaffEmail = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const localPart = raw.includes('@') ? raw.split('@')[0] : raw;
  return `${localPart}@${STAFF_EMAIL_DOMAIN}`;
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1 });
  const [sellerApplications, setSellerApplications] = useState([]);
  const [loadingSellerApplications, setLoadingSellerApplications] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'customer',
    is_active: true,
  });

  const fetchSellerApplications = useCallback(async () => {
    try {
      setLoadingSellerApplications(true);
      const response = await sellerApplicationsAPI.getAll({ status: 'pending', per_page: 10 });
      setSellerApplications(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch seller applications:', error);
    } finally {
      setLoadingSellerApplications(false);
    }
  }, []);

  useEffect(() => {
    fetchSellerApplications();
  }, [fetchSellerApplications]);

  const fetchUsers = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.active = statusFilter === 'active';
      const response = await usersAPI.getAll(params);
      setUsers(response.data.data || []);
      setMeta(response.data.meta || { current_page: 1, last_page: 1 });
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, roleFilter, statusFilter, fetchUsers]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
  };

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        password: '',
        phone: user.phone || '',
        role: user.role || 'customer',
        is_active: user.is_active !== false,
      });
    } else {
      setEditingUser(null);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        phone: '',
        role: 'customer',
        is_active: true,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData };
      if (['rider', 'supplier'].includes(data.role)) {
        data.email = toStaffEmail(data.email);
      }
      if (!data.password) delete data.password;
      
      if (editingUser) {
        await usersAPI.update(editingUser.id, data);
        toast.success('User updated successfully');
      } else {
        await usersAPI.create(data);
        toast.success('User created successfully');
      }
      setShowModal(false);
      fetchUsers(meta.current_page);
    } catch (error) {
      const message = error.response?.data?.message || 'Operation failed';
      toast.error(message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await usersAPI.delete(id);
      toast.success('User deleted successfully');
      fetchUsers(meta.current_page);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete user';
      toast.error(message);
    }
  };

  const toggleStatus = async (id) => {
    try {
      await usersAPI.toggleStatus(id);
      toast.success('User status updated');
      fetchUsers(meta.current_page);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update status';
      toast.error(message);
    }
  };

  const approveSellerApplication = async (id) => {
    try {
      await sellerApplicationsAPI.approve(id, {});
      toast.success('Seller application approved. Supplier account and store created.');
      fetchSellerApplications();
      fetchUsers(meta.current_page);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to approve seller application';
      toast.error(message);
    }
  };

  const rejectSellerApplication = async (id) => {
    const review_note = window.prompt('Optional reason for rejection:', '') || '';
    try {
      await sellerApplicationsAPI.reject(id, { review_note });
      toast.success('Seller application rejected');
      fetchSellerApplications();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to reject seller application';
      toast.error(message);
    }
  };

  const openDetailModal = async (id) => {
    try {
      setDetailLoading(true);
      setShowDetailModal(true);
      const response = await usersAPI.getOne(id);
      setDetailUser(response.data?.data || null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load user details');
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const getRoleBadge = (role) => {
    const variants = {
      admin: 'danger',
      customer: 'primary',
      rider: 'info',
      supplier: 'success',
      logistics: 'warning',
    };
    return <Badge variant={variants[role] || 'default'}>{role}</Badge>;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const stats = useMemo(() => {
    return {
      totalOnPage: users.length,
      active: users.filter((u) => Boolean(u.is_active)).length,
      inactive: users.filter((u) => !u.is_active).length,
      staff: users.filter((u) => ['supplier', 'rider', 'logistics'].includes(u.role)).length,
    };
  }, [users]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Users</h1>
        <Button variant="primary" onClick={() => openModal()}>
          <FaPlus />
          Add User
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <FaUsers />
            Users on this page
          </div>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalOnPage}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <FaUserCheck />
            Active
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <FaUserSlash />
            Inactive
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.inactive}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <FaUsers />
            Staff (supplier/rider/logistics)
          </div>
          <p className="text-2xl font-bold text-primary-600 mt-1">{stats.staff}</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="relative flex-grow">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="customer">Customer</option>
            <option value="rider">Rider</option>
            <option value="supplier">Supplier</option>
            <option value="logistics">Logistics Partner</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <Button type="submit" variant="primary">
            Search
          </Button>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear
          </Button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                      No users found for the selected filters.
                    </td>
                  </tr>
                ) : users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-semibold">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{user.first_name} {user.last_name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {user.phone || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleStatus(user.id)}
                        className={`p-2 rounded-lg ${user.is_active ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'}`}
                      >
                        {user.is_active ? <FaToggleOn className="w-6 h-6" /> : <FaToggleOff className="w-6 h-6" />}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openDetailModal(user.id)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                          title="View details"
                        >
                          <FaEye />
                        </button>
                        <button
                          onClick={() => openModal(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
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

        {/* Pagination */}
        <div className="p-4 border-t">
          <Pagination
            currentPage={meta.current_page}
            totalPages={meta.last_page}
            onPageChange={fetchUsers}
          />
        </div>
      </div>

      {/* User Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Edit User' : 'Add User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
            />
          </div>

          <Input
            label={['rider', 'supplier'].includes(formData.role) ? 'Email ID' : 'Email'}
            type={['rider', 'supplier'].includes(formData.role) ? 'text' : 'email'}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            helperText={['rider', 'supplier'].includes(formData.role) ? `@${STAFF_EMAIL_DOMAIN} is added automatically.` : undefined}
            required
          />

          <Input
            label={editingUser ? 'Password (leave blank to keep current)' : 'Password'}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required={!editingUser}
          />

          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            >
              <option value="customer">Customer</option>
              <option value="rider">Rider</option>
              <option value="admin">Admin</option>
              <option value="supplier">Supplier</option>
              <option value="logistics">Logistics Partner</option>
            </select>
          </div>

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
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailUser(null);
        }}
        title="User Details"
      >
        {detailLoading ? (
          <Loading />
        ) : detailUser ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-gray-500">Name</p>
                <p className="font-medium text-gray-800">{detailUser.first_name} {detailUser.last_name}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-gray-500">Role</p>
                <div className="mt-1">{getRoleBadge(detailUser.role)}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-gray-500">Email</p>
                <p className="font-medium text-gray-800 break-all">{detailUser.email}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-gray-500">Phone</p>
                <p className="font-medium text-gray-800">{detailUser.phone || '-'}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-gray-500">Orders</p>
                <p className="font-medium text-gray-800">{detailUser.orders_count ?? 0}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-gray-500">Reviews</p>
                <p className="font-medium text-gray-800">{detailUser.reviews_count ?? 0}</p>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-gray-500">Joined</p>
              <p className="font-medium text-gray-800">{detailUser.created_at ? formatDate(detailUser.created_at) : '-'}</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">No user details available.</p>
        )}
      </Modal>

      <div className="mt-8 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Pending Seller Applications</h2>
          <p className="text-sm text-gray-600">Approve to create supplier login and store automatically.</p>
        </div>
        {loadingSellerApplications ? (
          <Loading />
        ) : sellerApplications.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No pending seller applications.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applicant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sellerApplications.map((application) => (
                  <tr key={application.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <p className="font-medium text-gray-800">{application.store_name}</p>
                      <p className="text-xs text-gray-500">{application.message || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{application.first_name} {application.last_name}</p>
                      <p className="text-sm text-gray-500">{application.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{application.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {[application.address, application.city, application.state, application.zip_code].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {application.document_url ? (
                        <a
                          href={application.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700 underline"
                        >
                          {application.document_name || 'View document'}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="primary" onClick={() => approveSellerApplication(application.id)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => rejectSellerApplication(application.id)}>
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Users;
