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
  Users,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { profile, signOut, isSuperAdmin, isTenantAdmin, isAgent, hasFeatureAccess } = useAuth();
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

  const allNavItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, featureKey: 'dashboard' },
    { label: 'Analytics & Trends', path: '/admin/analytics', icon: TrendingUp, featureKey: 'analytics' },
    { label: 'Products & Packaging', path: '/admin/products', icon: Package, featureKey: 'products' },
    { label: 'Warehouse Inventory', path: '/admin/warehouse', icon: Warehouse, featureKey: 'warehouse' },
    { label: 'Stock Transfers', path: '/admin/transfers', icon: ArrowRightLeft, featureKey: 'transfers' },
    { label: 'Stock In', path: '/admin/purchasing', icon: Building2, featureKey: 'stock_in' },
    { label: 'Promos & Claims', path: '/admin/promotions', icon: Tag, featureKey: 'promotions' },
    { label: 'Agents & Trucks', path: '/admin/agents-trucks', icon: Truck, featureKey: 'agents' },
    { label: 'Micro Stores', path: '/admin/stores', icon: Store, featureKey: 'stores' },
    { label: 'Deliveries & Sales', path: '/admin/sales', icon: ShoppingBag, featureKey: 'sales' },
    { label: 'Returnables & PUNDO', path: '/admin/pundo', icon: RotateCcw, featureKey: 'pundo' },
    { label: 'Reports & Audits', path: '/admin/reports', icon: BarChart3, featureKey: 'reports' },
    { label: 'User Management', path: '/admin/users', icon: Users, featureKey: 'users' },
    { label: 'Tenant Settings', path: '/admin/settings', icon: Settings, featureKey: 'settings' },
  ];

  // Filter sidebar navigation items based on user feature permissions
  const navItems = allNavItems.filter((item) => hasFeatureAccess(item.featureKey));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans">
      <ConnectionBanner />
      <DevTenantSelector />

      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 text-zinc-600 hover:text-zinc-900 rounded-md border border-zinc-200 hover:bg-zinc-100 cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-md bg-zinc-900 flex items-center justify-center font-bold text-white shadow-xs text-sm">
              {tenant ? tenant.name.charAt(0) : 'B'}
            </div>
            <div>
              <h2 className="font-semibold text-sm text-zinc-900 leading-tight">
                {tenant ? tenant.name : 'Beverage Distribution System'}
              </h2>
              <p className="text-[11px] text-zinc-500 font-mono">
                {tenant ? tenant.slug : 'Main Tenant'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isSuperAdmin && (
            <Link
              to="/odc"
              className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-800 hover:bg-zinc-200 text-xs font-medium"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ODC Superadmin</span>
            </Link>
          )}

          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-zinc-900">{profile?.full_name || 'User'}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{profile?.role || 'Staff'}</p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut().then(() => navigate('/login'))}
            className="text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="hidden md:flex flex-col w-60 bg-white border-r border-zinc-200 p-3 space-y-0.5 overflow-y-auto">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400 px-3 py-2">
            Main Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-zinc-900 text-zinc-50 shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-zinc-50' : 'text-zinc-500'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-4 mt-auto border-t border-zinc-200">
            <Link
              to="/agent"
              className="flex items-center justify-between px-3 py-2 rounded-md bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-medium text-xs border border-zinc-200 transition-colors"
            >
              <span>Agent Mobile View</span>
              <Truck className="w-3.5 h-3.5 text-zinc-500" />
            </Link>
          </div>
        </aside>

        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-xs flex">
            <div className="w-64 bg-white h-full p-4 border-r border-zinc-200 flex flex-col space-y-1">
              <div className="flex items-center justify-between mb-3 border-b border-zinc-200 pb-2">
                <span className="font-semibold text-zinc-900 text-sm">Navigation</span>
                <button onClick={() => setMobileOpen(false)} className="text-zinc-500 hover:text-zinc-900">
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
                    className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      active
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="pt-4 mt-auto border-t border-zinc-200">
                <Link
                  to="/agent"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between px-3 py-2 rounded-md bg-zinc-900 text-white font-medium text-xs"
                >
                  <span>Agent Tablet Portal</span>
                  <Truck className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-50/50">{children}</main>
      </div>
    </div>
  );
};
