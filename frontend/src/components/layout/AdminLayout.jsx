import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaHome,
  FaBox,
  FaList,
  FaShoppingCart,
  FaUsers,
  FaTruck,
  FaChartBar,
  FaCog,
  FaBars,
  FaTimes,
  FaSignOutAlt,
  FaWarehouse,
  FaMoneyBillWave,
  FaEnvelope,
  FaStore,
  FaBell,
  FaStar,
  FaDolly,
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { notificationsAPI } from '../../services/api';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === 'admin';

  const fetchNotifications = async () => {
    if (!isAdmin) return;
    try {
      const [listRes, countRes] = await Promise.all([
        notificationsAPI.getAll({ per_page: 10 }),
        notificationsAPI.getUnreadCount(),
      ]);
      setNotifications(listRes.data?.data ?? []);
      setUnreadCount(countRes.data?.data?.count ?? 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s so decline notifications appear sooner
    const onFocus = () => fetchNotifications();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.role, isAdmin]);

  const handleNotificationClick = async (n) => {
    setNotificationsOpen(false);
    try {
      if (!n.read_at) {
        await notificationsAPI.markAsRead(n.id);
        fetchNotifications();
      }
    } catch {
      // ignore
    }
    navigate(n.data?.link || '/admin/inventory');
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      fetchNotifications();
    } catch {
      // ignore
    }
  };

  const menuItems = [
    { name: 'Dashboard', path: '/admin', icon: FaHome },
    { name: 'Products', path: '/admin/products', icon: FaBox },
    { name: 'Stores', path: '/admin/stores', icon: FaStore },
    { name: 'Categories', path: '/admin/categories', icon: FaList },
    { name: 'Inventory', path: '/admin/inventory', icon: FaWarehouse },
    { name: 'Orders', path: '/admin/orders', icon: FaShoppingCart },
    { name: 'Payments', path: '/admin/payments', icon: FaMoneyBillWave },
    { name: 'Customers', path: '/admin/users', icon: FaUsers },
    { name: 'Deliveries', path: '/admin/deliveries', icon: FaTruck },
    { name: 'Logistics', path: '/admin/logistics', icon: FaDolly },
    { name: 'Reviews', path: '/admin/reviews', icon: FaStar },
    { name: 'Reports', path: '/admin/reports', icon: FaChartBar },
    { name: 'Newsletter', path: '/admin/newsletter', icon: FaEnvelope },
    { name: 'Settings', path: '/admin/settings', icon: FaCog },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const displayName = user?.name ?? ([user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Admin');
  const initials = (user?.first_name?.[0] && user?.last_name?.[0])
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : (user?.name?.slice(0, 2) || user?.email?.slice(0, 2) || 'AU').toUpperCase();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 min-w-[18rem] bg-gray-900 transform transition-transform duration-300 ease-in-out flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 bg-gray-800">
          <Link to="/admin" className="flex items-center">
            <span className="text-xl font-bold text-white">Ganda Hub</span>
            <span className="ml-2 text-xs text-primary-400">Admin</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation - compact, no scroll */}
        <nav className="mt-2 px-2 py-1 overflow-hidden">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/admin'
              ? location.pathname === '/admin' || location.pathname === '/admin/'
              : location.pathname.startsWith(item.path);
            
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info + Logout - directly below nav */}
        <div className="flex-shrink-0 mt-2 p-2 border-t border-gray-800">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-white font-medium text-xs truncate">{displayName}</p>
              <p className="text-gray-400 text-[10px] truncate">{user?.email ?? '—'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
          >
            <FaSignOutAlt className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`lg:pl-72 transition-all duration-300`}>
        {/* Top Bar */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 lg:px-8">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <FaBars className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen((o) => !o)}
                  className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Notifications"
                >
                  <FaBell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] text-xs font-bold text-white bg-red-500 rounded-full">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setNotificationsOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute right-0 top-full mt-1 w-80 max-h-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden flex flex-col">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
                        <span className="font-medium text-gray-900">Notifications</span>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-xs text-primary-600 hover:text-primary-700"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="px-4 py-6 text-center text-gray-500 text-sm">No notifications yet</p>
                        ) : (
                          notifications.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                                !n.read_at ? 'bg-primary-50/50' : ''
                              }`}
                            >
                              <p className="text-sm text-gray-800">{n.data?.message ?? 'Notification'}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <Link
                          to="/admin/inventory"
                          onClick={() => setNotificationsOpen(false)}
                          className="px-4 py-2 text-center text-sm text-primary-600 hover:bg-gray-50 border-t border-gray-100"
                        >
                          View all in Inventory
                        </Link>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <Link
              to="/"
              className="text-sm text-gray-600 hover:text-primary-600"
            >
              View Store
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-5">
          <Outlet />
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminLayout;
