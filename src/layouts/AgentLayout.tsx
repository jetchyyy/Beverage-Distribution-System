import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { DevTenantSelector } from '../components/DevTenantSelector';
import {
  Truck,
  ShoppingBag,
  RotateCcw,
  CheckSquare,
  Home,
  LogOut,
  User,
  ShieldCheck,
  History,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface AgentLayoutProps {
  children: React.ReactNode;
}

export const AgentLayout: React.FC<AgentLayoutProps> = ({ children }) => {
  const { profile, signOut, isTenantAdmin, isSuperAdmin } = useAuth();
  const { tenant } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Home', path: '/agent', icon: Home },
    { label: 'New Delivery', path: '/agent/deliver', icon: ShoppingBag },
    { label: 'Sales History', path: '/agent/sales-history', icon: History },
    { label: 'My Truck Stock', path: '/agent/truck', icon: Truck },
    { label: 'Store PUNDO', path: '/agent/pundo', icon: RotateCcw },
    { label: 'Reconcile', path: '/agent/reconcile', icon: CheckSquare },
  ];

  // Only Admin or Superadmin users can switch to Admin View
  const canSwitchToAdmin = isTenantAdmin || isSuperAdmin || profile?.role === 'TENANT_ADMIN' || profile?.role === 'SUPERADMIN';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none pb-20 md:pb-0">
      <ConnectionBanner />
      <DevTenantSelector />

      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-indigo-600/30">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-base text-white leading-tight">
              {tenant ? tenant.name : 'Agent Route Portal'}
            </h2>
            <p className="text-xs text-indigo-400 font-mono flex items-center space-x-1">
              <User className="w-3 h-3 inline mr-1" />
              <span>{profile?.full_name || 'Route Agent'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {canSwitchToAdmin && (
            <Link
              to="/admin"
              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-bold transition-all border border-indigo-500/30 flex items-center space-x-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin View</span>
            </Link>
          )}

          <button
            onClick={() => signOut().then(() => navigate('/login'))}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-rose-400 transition-colors touch-target flex items-center justify-center border border-slate-700/60"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 flex items-center justify-around shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full py-1.5 rounded-2xl transition-all touch-target ${
                active
                  ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/30 scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
