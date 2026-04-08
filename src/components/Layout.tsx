import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { UserProfile } from '../types';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Wallet, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  user: UserProfile;
}

export default function Layout({ user }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'bendahara', 'cabang'] },
    { name: 'Cabang', path: '/cabang', icon: Building2, roles: ['admin', 'bendahara'] },
    { name: 'Peserta', path: '/peserta', icon: Users, roles: ['admin', 'bendahara', 'cabang'] },
    { name: 'Keuangan', path: '/keuangan', icon: Wallet, roles: ['admin', 'bendahara', 'cabang'] },
    { name: 'Laporan', path: '/laporan', icon: FileText, roles: ['admin', 'bendahara', 'cabang'] },
    { name: 'Pengaturan', path: '/pengaturan', icon: Settings, roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => {
    const hasRole = item.roles.includes(user.role);
    if (!hasRole) return false;
    
    // If user is a branch and status is not 'aktif', only show Dashboard
    if (user.role === 'cabang' && user.status !== 'aktif') {
      return item.name === 'Dashboard';
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-200 lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-blue-600 tracking-tight">CAEM</h1>
            <p className="text-xs text-gray-500 font-medium mt-1">Sistem Manajemen Bimbel</p>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-blue-50 text-blue-600" 
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon size={20} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                {user.displayName?.[0] || user.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName || 'User'}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-200"
            >
              <LogOut size={20} />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden"
          >
            <Menu size={24} />
          </button>
          
          <div className="flex-1 px-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {navItems.find(item => item.path === location.pathname)?.name || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Add notifications or other header items here */}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
