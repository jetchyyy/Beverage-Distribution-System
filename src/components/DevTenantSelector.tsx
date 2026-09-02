import React from 'react';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { Building2, ShieldCheck } from 'lucide-react';

export const DevTenantSelector: React.FC = () => {
  const { tenant, tenantSlug, setDevTenantSlug, availableTenants } = useTenant();
  const { isSuperAdmin } = useAuth();

  // STRICT SECURITY RULE: ONLY Superadmin can switch tenant contexts!
  // Tenant Admins, Warehouse Staff, and Agents must NEVER be able to see or switch tenant contexts.
  if (!isSuperAdmin || availableTenants.length === 0) return null;

  return (
    <div className="bg-indigo-950/90 border-b border-indigo-800/80 px-4 py-2 text-xs flex items-center justify-between text-indigo-200">
      <div className="flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span className="font-bold text-slate-100">SuperAdmin Tenant Switcher:</span>
        <span className="text-indigo-300">Viewing Tenant: <strong>{tenant ? tenant.name : (tenantSlug || 'None')}</strong></span>
      </div>
      <div className="flex items-center space-x-2">
        <Building2 className="w-3.5 h-3.5 text-indigo-400" />
        <select
          value={tenantSlug || ''}
          onChange={(e) => setDevTenantSlug(e.target.value)}
          className="bg-slate-900 border border-indigo-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium"
        >
          <option value="">Select Tenant Context...</option>
          {availableTenants.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name} ({t.slug})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
