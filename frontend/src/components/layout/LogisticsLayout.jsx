import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { FaTruck, FaUserCheck, FaBars, FaTimes, FaSignOutAlt, FaClipboardList } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';

const LogisticsLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = [
    { name: 'Dashboard', path: '/logistics', icon: FaClipboardList },
    { name: 'Deliveries', path: '/logistics/deliveries', icon: FaTruck },
    { name: 'Driver Applications', path: '/logistics/applications', icon: FaUserCheck },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 min-w-[18rem] bg-slate-900 transform transition-transform duration-300 ease-in-out flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between h-16 px-5 bg-slate-800">
          <Link to="/logistics" className="flex items-center">
            <FaTruck className="w-5 h-5 text-white mr-2" />
            <span className="text-lg font-bold text-white">Logistics</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-300 hover:text-white">
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-2 px-2 py-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/logistics'
              ? location.pathname === '/logistics' || location.pathname === '/logistics/'
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                  isActive ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-3 border-t border-slate-800">
          <p className="text-xs text-slate-300 truncate">{user?.first_name} {user?.last_name}</p>
          <p className="text-[11px] text-slate-400 truncate mb-2">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-red-300 hover:bg-red-500/20 rounded-lg transition-colors text-sm"
          >
            <FaSignOutAlt className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="lg:pl-72 transition-all duration-300">
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 lg:px-8">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-600 hover:text-gray-900">
            <FaBars className="w-6 h-6" />
          </button>
          <Link to="/" className="text-sm text-gray-600 hover:text-primary-600">View Store</Link>
        </header>

        <main className="p-4 lg:p-5">
          <Outlet />
        </main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
};

export default LogisticsLayout;

