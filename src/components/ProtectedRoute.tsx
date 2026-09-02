import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import type { UserRole } from '../types/database.types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireSuperAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireSuperAdmin,
}) => {
  const { user, profile, loading, role, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-mono">Authenticating session...</p>
        </div>
      </div>
    );
  }

  // If Supabase is configured and user is not authenticated, redirect to /login
  if (isSupabaseConfigured && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If SuperAdmin is required (e.g. /odc route)
  if (requireSuperAdmin && isSupabaseConfigured && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto text-xl font-bold">
            🚫
          </div>
          <h2 className="text-xl font-extrabold text-white">Access Denied</h2>
          <p className="text-xs text-slate-400">
            The <code className="text-indigo-300 font-mono">/odc</code> route is strictly reserved for platform Superadmin users. Your account (<span className="text-white font-semibold">{profile?.email}</span>) has role: <strong className="text-amber-400">{role || 'User'}</strong>.
          </p>
          <div className="pt-2">
            <a
              href="/admin"
              className="inline-block px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
            >
              Return to Tenant Admin Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Check specific roles if specified
  if (allowedRoles && allowedRoles.length > 0 && isSupabaseConfigured && role) {
    const hasRole = allowedRoles.includes(role) || isSuperAdmin;
    if (!hasRole) {
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
};
