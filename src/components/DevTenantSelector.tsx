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
    <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 text-xs flex items-center justify-between text-zinc-300">
      <div className="flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-zinc-300" />
        <span className="font-semibold text-white">SuperAdmin Context:</span>
        <span className="text-zinc-400">Viewing Tenant: <strong className="text-white">{tenant ? tenant.name : (tenantSlug || 'None')}</strong></span>
      </div>
      <div className="flex items-center space-x-2">
        <Building2 className="w-3.5 h-3.5 text-zinc-400" />
        <select
          value={tenantSlug || ''}
          onChange={(e) => setDevTenantSlug(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-white rounded-md px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer font-medium"
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
