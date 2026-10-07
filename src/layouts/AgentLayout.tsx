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
import { Button } from '../components/ui/button';

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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans select-none pb-20 md:pb-0">
      <ConnectionBanner />
      <DevTenantSelector />

      <header className="bg-white border-b border-zinc-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-md bg-zinc-900 flex items-center justify-center font-bold text-white shadow-xs">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-zinc-900 leading-tight">
              {tenant ? tenant.name : 'Agent Route Portal'}
            </h2>
            <p className="text-[11px] text-zinc-500 font-mono flex items-center">
              <User className="w-3 h-3 inline mr-1 text-zinc-400" />
              <span>{profile?.full_name || 'Route Agent'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {canSwitchToAdmin && (
            <Link
              to="/admin"
              className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium transition-colors border border-zinc-200 flex items-center space-x-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin View</span>
            </Link>
          )}

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

      <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full py-1 rounded-md transition-all touch-target ${
                active
                  ? 'bg-zinc-900 text-white font-medium shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
