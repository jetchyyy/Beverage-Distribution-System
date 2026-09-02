import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, UserRole } from '../types/database.types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  role: UserRole | null;
  isSuperAdmin: boolean;
  isTenantAdmin: boolean;
  isWarehouseStaff: boolean;
  isAgent: boolean;
  isAccounting: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  createSecondaryUser: (email: string, password: string, fullName: string, role?: UserRole, tenantId?: string) => Promise<{ error: any; data?: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (userId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Profile fetch error or non-existent:', error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase credentials are not configured yet.' } };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  // Create user without overwriting current SuperAdmin session (uses isolated client)
  const createSecondaryUser = async (
    email: string,
    password: string,
    fullName: string,
    userRole: UserRole = 'TENANT_ADMIN',
    tenantId?: string
  ) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
      return { error: { message: 'Supabase credentials missing.' } };
    }

    // Isolated client with NO session persistence so SuperAdmin stays logged in
    const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await tempSupabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: userRole,
          tenant_id: tenantId || null,
        },
      },
    });

    if (error) return { error };

    if (data.user) {
      // Upsert profile record directly into public profiles
      const { error: profileErr } = await supabase.from('profiles').upsert([
        {
          id: data.user.id,
          tenant_id: tenantId || null,
          full_name: fullName,
          email,
          role: userRole,
          status: 'ACTIVE',
        },
      ]);
      if (profileErr) console.warn('Profile creation warning:', profileErr);
    }

    return { error: null, data };
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const role = profile?.role ?? null;
  const isSuperAdmin = role === 'SUPERADMIN';
  const isTenantAdmin = role === 'TENANT_ADMIN' || isSuperAdmin;
  const isWarehouseStaff = role === 'WAREHOUSE_STAFF' || isTenantAdmin;
  const isAgent = role === 'AGENT';
  const isAccounting = role === 'ACCOUNTING_REPORT' || isTenantAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        role,
        isSuperAdmin,
        isTenantAdmin,
        isWarehouseStaff,
        isAgent,
        isAccounting,
        signIn,
        createSecondaryUser,
        signOut,
        refreshProfile: async () => {
          if (user) await fetchProfile(user.id);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
