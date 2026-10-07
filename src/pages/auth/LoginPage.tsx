import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { DevTenantSelector } from '../../components/DevTenantSelector';
import { ShieldCheck, Mail, Lock, ArrowRight, Truck, LayoutDashboard, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col justify-between">
      <ConnectionBanner />
      <DevTenantSelector />

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg border-zinc-200 bg-white">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="w-12 h-12 rounded-lg bg-zinc-900 flex items-center justify-center mx-auto text-xl font-bold text-white shadow-xs">
              {tenant ? tenant.name.charAt(0) : 'B'}
            </div>
            <CardTitle className="text-xl font-bold tracking-tight text-zinc-900">
              {tenant ? tenant.name : 'Beverage Distribution System'}
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              ODC Inventory, Truck Delivery & PUNDO Management
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {!isSupabaseConfigured && (
              <div className="p-3.5 bg-zinc-100 border border-zinc-200 rounded-lg text-xs text-zinc-700 space-y-2.5">
                <p className="font-semibold text-zinc-900">Direct Demo Access:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate('/admin')}
                    className="w-full flex items-center justify-center space-x-1.5"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Admin Portal</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/agent')}
                    className="w-full flex items-center justify-center space-x-1.5"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Agent Tablet</span>
                  </Button>
                </div>

                <div className="pt-2 border-t border-zinc-200 text-center">
                  <button
                    onClick={() => navigate('/odc')}
                    className="text-[11px] text-zinc-600 hover:text-zinc-900 hover:underline inline-flex items-center space-x-1 font-mono cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ODC Superadmin (/odc)</span>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <Input
                    type="email"
                    required
                    placeholder="agent@distributor.com or admin@distributor.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 mt-2 font-medium"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
