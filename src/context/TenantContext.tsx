import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Tenant, Profile } from '../types/database.types';

interface TenantContextType {
  tenant: Tenant | null;
  tenantSlug: string | null;
  loading: boolean;
  error: string | null;
  setDevTenantSlug: (slug: string) => void;
  availableTenants: Tenant[];
  refreshTenants: () => Promise<void>;
  domainName: string;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const domainName = 'bev.odysseyph.com';

  // Subdomain resolution on mount
  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    const searchParams = new URLSearchParams(window.location.search);
    const queryTenant = searchParams.get('tenant');

    let slug: string | null = null;

    if (queryTenant) {
      slug = queryTenant;
    } else if (hostname.endsWith('.localhost')) {
      const parts = hostname.split('.');
      if (parts.length > 1 && parts[0] !== 'localhost') {
        slug = parts[0];
      }
    } else if (hostname.endsWith('.bev.odysseyph.com') || hostname.includes('odysseyph.com')) {
      const parts = hostname.split('.');
      if (parts.length > 2) {
        const sub = parts[0];
        if (sub !== 'www' && sub !== 'app' && sub !== 'odc' && sub !== 'bev') {
          slug = sub;
        }
      }
    } else {
      const parts = hostname.split('.');
      if (parts.length > 2 && parts[0] !== 'www') {
        slug = parts[0];
      }
    }

    if (!slug) {
      const savedDevSlug = localStorage.getItem('dev_tenant_slug');
      if (savedDevSlug) {
        slug = savedDevSlug;
      }
    }

    setTenantSlug(slug);
  }, []);

  const fetchTenantData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: allTenants, error: allErr } = await supabase
        .from('tenants')
        .select('*')
        .order('name');

      if (allErr) throw allErr;
      setAvailableTenants(allTenants || []);

      // Check active auth session profile to enforce strict tenant binding
      const { data: { session } } = await supabase.auth.getSession();
      let userProfile: Profile | null = null;

      if (session?.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        userProfile = prof;
      }

      // STRICT RULE: If user is authenticated and is NOT SUPERADMIN, force tenant to profile.tenant_id
      if (userProfile && userProfile.role !== 'SUPERADMIN' && userProfile.tenant_id) {
        const userTenant = allTenants?.find((t) => t.id === userProfile.tenant_id);
        if (userTenant) {
          setTenant(userTenant);
          setTenantSlug(userTenant.slug);
          setError(null);
          return;
        }
      }

      // SuperAdmin or Unauthenticated mode resolution:
      if (tenantSlug) {
        const found = allTenants?.find((t) => t.slug.toLowerCase() === tenantSlug.toLowerCase());
        if (found) {
          setTenant(found);
          setError(null);
        } else {
          setTenant(null);
          setError(`Tenant "${tenantSlug}" not found or inactive.`);
        }
      } else if (allTenants && allTenants.length > 0) {
        setTenant(allTenants[0]);
        setTenantSlug(allTenants[0].slug);
      }
    } catch (err: any) {
      console.error('Tenant fetch error:', err);
      setError(err.message || 'Failed to load tenant.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantData();
  }, [tenantSlug]);

  const setDevTenantSlug = (slug: string) => {
    localStorage.setItem('dev_tenant_slug', slug);
    setTenantSlug(slug);
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantSlug,
        loading,
        error,
        setDevTenantSlug,
        availableTenants,
        refreshTenants: fetchTenantData,
        domainName,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
