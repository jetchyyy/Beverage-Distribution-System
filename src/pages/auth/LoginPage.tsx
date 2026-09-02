import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { DevTenantSelector } from '../../components/DevTenantSelector';
import { ShieldCheck, Mail, Lock, ArrowRight, Truck, LayoutDashboard, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInErr } = await signIn(email, password);
    if (signInErr) {
      setError(signInErr.message || 'Invalid email or password.');
    } else {
      // Check role from user profile and navigate to appropriate portal
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (prof?.role === 'AGENT') {
          navigate('/agent');
        } else if (prof?.role === 'SUPERADMIN') {
          navigate('/odc');
        } else {
          navigate('/admin');
        }
      } else {
        navigate('/admin');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <ConnectionBanner />
      <DevTenantSelector />

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto text-2xl font-black text-white shadow-lg shadow-indigo-600/30">
              {tenant ? tenant.name.charAt(0) : 'B'}
            </div>
            <h1 className="text-2xl font-extrabold text-white">
              {tenant ? tenant.name : 'Beverage Distribution System'}
            </h1>
            <p className="text-xs text-slate-400">
              Multi-Tenant Inventory, Truck Delivery & PUNDO Management System
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="p-4 bg-indigo-950/60 border border-indigo-700/60 rounded-2xl text-xs text-indigo-200 space-y-3">
              <p className="font-semibold text-white">⚡ Supabase Direct Portal Access:</p>
              <p>Choose an interface to enter in local demonstration mode:</p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => navigate('/admin')}
                  className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center space-x-1.5 shadow"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Admin Portal</span>
                </button>
                <button
                  onClick={() => navigate('/agent')}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center space-x-1.5 shadow"
                >
                  <Truck className="w-4 h-4" />
                  <span>Agent Tablet</span>
                </button>
              </div>

              <div className="pt-2 border-t border-indigo-800/80 text-center">
                <button
                  onClick={() => navigate('/odc')}
                  className="text-[11px] text-indigo-400 hover:underline inline-flex items-center space-x-1 font-mono"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>ODC Superadmin (/odc)</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="agent@distributor.com or admin@distributor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-10 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 touch-target"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In with Email & Password'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
