import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { DevTenantSelector } from '../components/DevTenantSelector';
import { ConnectionBanner } from '../components/ConnectionBanner';
import {
  LayoutDashboard,
  Package,
  ArrowRightLeft,
  Truck,
  Store,
  RotateCcw,
  ShoppingBag,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  Menu,
  X,
  Warehouse,
  ShieldCheck,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { profile, signOut, isSuperAdmin, isTenantAdmin, isAgent } = useAuth();
  const { tenant } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Strict Role Security Guard: Agent accounts cannot access Admin view
  useEffect(() => {
    if (profile && (profile.role === 'AGENT' || (isAgent && !isTenantAdmin))) {
      navigate('/agent', { replace: true });
    }
  }, [profile, isAgent, isTenantAdmin, navigate]);

  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Products & Packaging', path: '/admin/products', icon: Package },
    { label: 'Warehouse Inventory', path: '/admin/warehouse', icon: Warehouse },
    { label: 'Stock Transfers', path: '/admin/transfers', icon: ArrowRightLeft },
    { label: 'Agents & Trucks', path: '/admin/agents-trucks', icon: Truck },
    { label: 'Micro Stores', path: '/admin/stores', icon: Store },
    { label: 'Deliveries & Sales', path: '/admin/sales', icon: ShoppingBag },
    { label: 'Returnables & PUNDO', path: '/admin/pundo', icon: RotateCcw },
    { label: 'Suppliers & Receipts', path: '/admin/purchasing', icon: Building2 },
    { label: 'Reports & Audits', path: '/admin/reports', icon: BarChart3 },
    { label: 'Tenant Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <ConnectionBanner />
      <DevTenantSelector />

      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
              {tenant ? tenant.name.charAt(0) : 'B'}
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white leading-tight">
                {tenant ? tenant.name : 'Beverage Distribution System'}
              </h2>
              <p className="text-[10px] text-indigo-400 uppercase font-mono tracking-wider">
                {tenant ? tenant.slug : 'Main Tenant'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {isSuperAdmin && (
            <Link
              to="/odc"
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-950 border border-indigo-700/60 text-indigo-300 hover:text-white text-xs font-semibold"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ODC Superadmin</span>
            </Link>
          )}

          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-200">{profile?.full_name || 'User'}</p>
            <p className="text-[10px] text-slate-400 uppercase">{profile?.role || 'Staff'}</p>
          </div>

          <button
            onClick={() => signOut().then(() => navigate('/login'))}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-1 overflow-y-auto">
          <div className="text-[11px] font-mono uppercase text-slate-500 font-semibold px-3 mb-2">
            Navigation Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-6 mt-auto border-t border-slate-800">
            <Link
              to="/agent"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-medium text-xs transition-colors border border-slate-700"
            >
              <span>Switch to Agent Mobile View</span>
              <Truck className="w-4 h-4" />
            </Link>
          </div>
        </aside>

        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex">
            <div className="w-72 bg-slate-900 h-full p-4 border-r border-slate-800 flex flex-col space-y-1">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <span className="font-bold text-white text-sm">Navigation</span>
                <button onClick={() => setMobileOpen(false)} className="text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'bg-indigo-600 text-white shadow-md font-semibold'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="pt-6 mt-auto border-t border-slate-800">
                <Link
                  to="/agent"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs"
                >
                  <span>Agent Tablet Portal</span>
                  <Truck className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950">{children}</main>
      </div>
    </div>
  );
};
