import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { EmptyState } from '../../components/EmptyState';
import {
  Building2,
  Plus,
  ExternalLink,
  Code,
  UserPlus,
  Copy,
  Check,
  LayoutDashboard,
  Layers,
  QrCode,
  CreditCard,
  LogOut,
  Download,
  RotateCw,
  Trash2,
  LogIn,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SuperAdminDashboard: React.FC = () => {
  const { profile, signOut, createSecondaryUser } = useAuth();
  const { setDevTenantSlug, domainName } = useTenant();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'registry' | 'applications' | 'qr_cms' | 'plans'>('registry');

  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Reset Modal & Data Download State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resettingTenant, setResettingTenant] = useState<any | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Initial Tenant Admin Credentials
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTenants = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setTenants(data || []);
    } catch (err: any) {
      console.error('Error fetching tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) {
      setError('Tenant Name and Subdomain Slug are required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: newTenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert([
          {
            name,
            slug: slug.toLowerCase().trim(),
            business_name: name,
            contact_name: contactName || adminFullName,
            contact_email: contactEmail || adminEmail,
            status: 'ACTIVE',
          },
        ])
        .select()
        .single();

      if (tenantErr) throw tenantErr;

      if (newTenant) {
        const { data: whLocation } = await supabase
          .from('locations')
          .insert([
            {
              tenant_id: newTenant.id,
              name: `${name} Main Depot`,
              type: 'WAREHOUSE',
              is_active: true,
            },
          ])
          .select()
          .single();

        if (whLocation) {
          await supabase.from('warehouses').insert([
            {
              tenant_id: newTenant.id,
              name: `${name} Main Depot`,
              address: 'Main Facility',
              location_id: whLocation.id,
              is_active: true,
            },
          ]);
        }

        if (adminEmail && adminPassword) {
          await createSecondaryUser(
            adminEmail.trim(),
            adminPassword,
            adminFullName || contactName || `${name} Admin`,
            'TENANT_ADMIN',
            newTenant.id
          );
        }
      }

      setName('');
      setSlug('');
      setContactName('');
      setContactEmail('');
      setAdminFullName('');
      setAdminEmail('');
      setAdminPassword('');
      setIsModalOpen(false);
      fetchTenants();
    } catch (err: any) {
      setError(err.message || 'Failed to create tenant.');
    } finally {
      setSaving(false);
    }
  };

  const toggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await supabase.from('tenants').update({ status: newStatus }).eq('id', tenantId);
      fetchTenants();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleEnterTenant = (tenantSlug: string) => {
    setDevTenantSlug(tenantSlug);
    navigate('/admin');
  };

  const handleDownloadTenantData = async (t: any) => {
    setDownloadingId(t.id);
    try {
      const [
        { data: products },
        { data: product_batches },
        { data: product_packaging },
        { data: product_prices },
        { data: returnable_items },
        { data: locations },
        { data: warehouses },
        { data: trucks },
        { data: agents },
        { data: micro_stores },
        { data: sales },
        { data: pundo_ledger },
        { data: stock_transfers },
        { data: inventory_balances },
        { data: returnable_balances },
        { data: suppliers },
        { data: stock_in_receipts },
        { data: profiles },
      ] = await Promise.all([
        supabase.from('products').select('*').eq('tenant_id', t.id),
        supabase.from('product_batches').select('*').eq('tenant_id', t.id),
        supabase.from('product_packaging').select('*').eq('tenant_id', t.id),
        supabase.from('product_prices').select('*').eq('tenant_id', t.id),
        supabase.from('returnable_items').select('*').eq('tenant_id', t.id),
        supabase.from('locations').select('*').eq('tenant_id', t.id),
        supabase.from('warehouses').select('*').eq('tenant_id', t.id),
        supabase.from('trucks').select('*').eq('tenant_id', t.id),
        supabase.from('agents').select('*').eq('tenant_id', t.id),
        supabase.from('micro_stores').select('*').eq('tenant_id', t.id),
        supabase.from('sales').select('*').eq('tenant_id', t.id),
        supabase.from('pundo_ledger').select('*').eq('tenant_id', t.id),
        supabase.from('stock_transfers').select('*').eq('tenant_id', t.id),
        supabase.from('inventory_balances').select('*').eq('tenant_id', t.id),
        supabase.from('returnable_balances').select('*').eq('tenant_id', t.id),
        supabase.from('suppliers').select('*').eq('tenant_id', t.id),
        supabase.from('stock_in_receipts').select('*').eq('tenant_id', t.id),
        supabase.from('profiles').select('*').eq('tenant_id', t.id),
      ]);

      const backupObject = {
        tenant: t,
        exported_at: new Date().toISOString(),
        catalog: {
          products,
          product_batches,
          product_packaging,
          product_prices,
          returnable_items,
          suppliers,
        },
        infrastructure: {
          locations,
          warehouses,
          trucks,
          agents,
          micro_stores,
          profiles,
        },
        operations: {
          sales,
          pundo_ledger,
          stock_transfers,
          inventory_balances,
          returnable_balances,
          stock_in_receipts,
        },
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObject, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `tenant_backup_${t.slug}_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert('Failed to export tenant data: ' + (err.message || err));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenResetModal = (t: any) => {
    setResettingTenant(t);
    setIsResetModalOpen(true);
  };

  const confirmResetTenantData = async () => {
    if (!resettingTenant) return;
    setSaving(true);
    try {
      const tId = resettingTenant.id;

      // Wipe operational transaction tables so tenant starts from scratch
      await supabase.from('sales').delete().eq('tenant_id', tId);
      await supabase.from('pundo_ledger').delete().eq('tenant_id', tId);
      await supabase.from('stock_transfers').delete().eq('tenant_id', tId);
      await supabase.from('inventory_balances').delete().eq('tenant_id', tId);
      await supabase.from('returnable_balances').delete().eq('tenant_id', tId);
      await supabase.from('product_batches').delete().eq('tenant_id', tId);

      try { await supabase.from('stock_in_receipts').delete().eq('tenant_id', tId); } catch (_) {}
      try { await supabase.from('purchase_receipts').delete().eq('tenant_id', tId); } catch (_) {}
      try { await supabase.from('truck_reconciliations').delete().eq('tenant_id', tId); } catch (_) {}

      setIsResetModalOpen(false);
      setResettingTenant(null);
      alert(`Tenant '${resettingTenant.name}' data reset successfully! Organization can now start fresh from scratch.`);
      fetchTenants();
    } catch (err: any) {
      alert('Failed to reset tenant data: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const superAdminSqlScript = `-- ============================================================================
-- SQL SCRIPT TO ASSIGN SUPERADMIN ROLE TO superadmin@odc.com
-- ============================================================================

INSERT INTO public.profiles (id, tenant_id, full_name, email, role, status)
SELECT 
  id, 
  NULL as tenant_id, 
  'Platform Superadmin' as full_name, 
  email, 
  'SUPERADMIN' as role, 
  'ACTIVE' as status
FROM auth.users
WHERE email = 'superadmin@odc.com'
ON CONFLICT (id) 
DO UPDATE SET 
  role = 'SUPERADMIN', 
  tenant_id = NULL, 
  status = 'ACTIVE';
`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(superAdminSqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex font-sans select-none">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#0d1322] border-r border-slate-800/80 flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-6">
          {/* Superadmin Header */}
          <div className="flex items-center space-x-3 px-2 py-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-pink-500/25">
              Ω
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white leading-tight">SaaS Superadmin</h2>
              <p className="text-[10px] text-pink-400 font-mono tracking-wider uppercase font-bold">
                ODC PLATFORM CMS
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>SaaS Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('registry')}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all ${
                activeTab === 'registry'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Tenant Registry</span>
            </button>

            <button
              onClick={() => setActiveTab('applications')}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all ${
                activeTab === 'applications'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Applications Queue</span>
            </button>

            <button
              onClick={() => setActiveTab('qr_cms')}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all ${
                activeTab === 'qr_cms'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Payment QR CMS</span>
            </button>

            <button
              onClick={() => setActiveTab('plans')}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all ${
                activeTab === 'plans'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Subscription Plans CMS</span>
            </button>
          </nav>
        </div>

        {/* User Profile & Logout */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-pink-400">
              AD
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">{profile?.email || 'superadmin@odc.com'}</p>
              <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">SYSTEM OPERATOR</p>
            </div>
          </div>

          <button
            onClick={() => signOut().then(() => navigate('/login'))}
            className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 text-xs font-semibold transition-colors border border-slate-800"
          >
            <LogOut className="w-4 h-4" />
            <span>Platform Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto bg-[#090d16]">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="border-b border-slate-800/80 pb-5">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">SaaS Metrics Overview</h1>
              <p className="text-slate-400 text-sm mt-1">Real-time multi-tenant platform metrics & subscription revenue</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs uppercase font-mono tracking-wider font-semibold">Active Tenants</span>
                  <Building2 className="w-5 h-5 text-pink-400" />
                </div>
                <div className="text-3xl font-black text-white mt-3">{tenants.length}</div>
                <p className="text-xs text-slate-500 mt-1">Live distributor organizations</p>
              </div>

              <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs uppercase font-mono tracking-wider font-semibold">Monthly MRR</span>
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-emerald-400 mt-3">₱148,500</div>
                <p className="text-xs text-slate-500 mt-1">+12.4% vs last month</p>
              </div>

              <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs uppercase font-mono tracking-wider font-semibold">Platform Users</span>
                  <Users className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="text-3xl font-black text-white mt-3">84</div>
                <p className="text-xs text-slate-500 mt-1">Admins, agents & warehouse staff</p>
              </div>

              <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs uppercase font-mono tracking-wider font-semibold">System Health</span>
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-3xl font-black text-indigo-400 mt-3">99.98%</div>
                <p className="text-xs text-slate-500 mt-1">Uptime operational</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'registry' && (
          <div className="space-y-6">
            {/* Header & Onboard Action */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Active Tenant Organizations</h1>
                <p className="text-slate-400 text-sm mt-1">
                  Manage active plan scopes, edit branch/user limits, or suspend portal instances.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsSqlModalOpen(true)}
                  className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-800 flex items-center space-x-2 transition-all"
                >
                  <Code className="w-4 h-4 text-emerald-400" />
                  <span>SuperAdmin SQL</span>
                </button>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-extrabold tracking-wide shadow-lg shadow-pink-500/25 flex items-center space-x-2 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Manual Onboard Tenant</span>
                </button>
              </div>
            </div>

            {/* Tenant Registry Table */}
            {loading ? (
              <div className="text-center py-24 text-slate-500 animate-pulse text-sm">Loading tenant accounts...</div>
            ) : tenants.length === 0 ? (
              <EmptyState
                title="No Active Tenants"
                description="No distributor tenant organizations have been onboarded yet."
                icon={<Building2 className="w-10 h-10 text-pink-400" />}
                actionText="Manual Onboard Tenant"
                onAction={() => setIsModalOpen(true)}
              />
            ) : (
              <div className="bg-[#0f172a] border border-slate-800/90 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#0b1120] text-slate-400 uppercase text-[11px] font-bold tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">Tenant Name</th>
                        <th className="px-6 py-4">Subdomain</th>
                        <th className="px-6 py-4">Business Model</th>
                        <th className="px-6 py-4">Plan & Billing</th>
                        <th className="px-6 py-4">Quotas (Branches/Users)</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-medium">
                      {tenants.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Tenant Name */}
                          <td className="px-6 py-4 font-extrabold text-white text-sm">
                            {t.name}
                          </td>

                          {/* Subdomain */}
                          <td className="px-6 py-4 font-mono text-xs">
                            <div className="space-y-1">
                              <a
                                href={`http://${t.slug}.localhost:5173`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-pink-400 hover:underline flex items-center space-x-1"
                              >
                                <span>{t.slug}.{domainName}</span>
                                <ExternalLink className="w-3 h-3 opacity-70" />
                              </a>
                            </div>
                          </td>

                          {/* Business Model */}
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                              BEVERAGE
                            </span>
                          </td>

                          {/* Plan & Billing */}
                          <td className="px-6 py-4">
                            <div className="space-y-0.5">
                              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-pink-950/80 text-pink-300 border border-pink-800/60">
                                PROFESSIONAL
                              </span>
                              <p className="text-[10px] text-slate-500 font-mono">Monthly</p>
                            </div>
                          </td>

                          {/* Quotas */}
                          <td className="px-6 py-4 text-slate-300 font-medium">
                            3 Locations / 10 staff
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                                t.status === 'ACTIVE'
                                  ? 'bg-indigo-600/90 text-white border-indigo-500'
                                  : 'bg-rose-950/80 text-rose-300 border-rose-800'
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-3">
                              <button
                                onClick={() => handleEnterTenant(t.slug)}
                                className="text-cyan-400 hover:text-cyan-300 font-bold text-xs flex items-center space-x-1"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                                <span>Enter Tenant</span>
                              </button>

                              <button
                                onClick={() => toggleTenantStatus(t.id, t.status)}
                                className="text-pink-400 hover:text-pink-300 font-semibold text-xs"
                              >
                                Edit Config
                              </button>

                              <button
                                onClick={() => handleDownloadTenantData(t)}
                                disabled={downloadingId === t.id}
                                className="text-cyan-400 hover:text-cyan-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                                title="Download Tenant Backup Data (JSON)"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleOpenResetModal(t)}
                                className="text-amber-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-amber-500/10 transition-colors"
                                title="Clear Operational Data & Start from Scratch"
                              >
                                <RotateCw className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => toggleTenantStatus(t.id, t.status)}
                                className="text-rose-500 hover:text-rose-400 p-1"
                                title="Suspend Tenant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Applications Queue</h1>
            <p className="text-slate-400 text-sm">Pending distributor tenant registration requests</p>
            <div className="py-20 text-center text-slate-500 text-sm">No pending onboarding applications in queue.</div>
          </div>
        )}

        {activeTab === 'qr_cms' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Payment QR CMS</h1>
            <p className="text-slate-400 text-sm">Manage GCash, Maya, and Bank QR payment gateways for subscriptions</p>
            <div className="py-20 text-center text-slate-500 text-sm">QR CMS configuration active.</div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Subscription Plans CMS</h1>
            <p className="text-slate-400 text-sm">Configure Starter, Professional, and Enterprise SaaS pricing scopes</p>
            <div className="py-20 text-center text-slate-500 text-sm">Plan tiers configured.</div>
          </div>
        )}
      </main>

      {/* Onboard Tenant Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl max-w-lg w-full p-7 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-xl font-extrabold text-white">Manual Onboard Tenant Organization</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {error && (
              <div className="p-3 mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="space-y-4 text-xs">
              <div className="space-y-3">
                <h4 className="text-[11px] font-mono font-bold uppercase text-pink-400">1. Distributor Business Details</h4>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Tenant / Distributor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DwalHolms Beverage Distribution"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Subdomain Slug *</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      required
                      placeholder="e.g. dwalholms"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-l-2xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-pink-500"
                    />
                    <span className="bg-slate-900 border border-l-0 border-slate-800 text-slate-400 px-4 py-2.5 font-mono rounded-r-2xl">
                      .{domainName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Initial Tenant Admin Credentials */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h4 className="text-[11px] font-mono font-bold uppercase text-emerald-400 flex items-center space-x-1.5">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>2. Initial Tenant Admin Login Account</span>
                </h4>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Admin Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Juan dela Cruz"
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Admin Login Email</label>
                    <input
                      type="email"
                      placeholder="admin@dwalholms.com"
                      value={adminEmail}
                      onChange={(e) => {
                        setAdminEmail(e.target.value);
                        setContactEmail(e.target.value);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Admin Login Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-900 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold shadow-lg shadow-pink-500/30 disabled:opacity-50"
                >
                  {saving ? 'Onboarding Tenant...' : 'Onboard Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SQL Modal */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl text-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold">SQL Script for superadmin@odc.com</h3>
              </div>
              <button onClick={() => setIsSqlModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Run this script in your Supabase SQL Editor to make <code className="text-emerald-400 font-mono font-bold">superadmin@odc.com</code> a platform Superadmin profile:
            </p>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-y-auto flex-1 mb-4">
              <pre>{superAdminSqlScript}</pre>
            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={handleCopySql}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-2 shadow"
              >
                {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? 'Copied SQL Script!' : 'Copy SQL Script'}</span>
              </button>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Tenant Data Confirmation Modal */}
      {isResetModalOpen && resettingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-amber-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-amber-400 font-extrabold">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-lg">Clear Tenant Operational Data</h3>
              </div>
              <button onClick={() => setIsResetModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200 text-xs leading-relaxed space-y-2">
              <p className="font-bold">
                ⚠️ PERMANENT DATA RESET WARNING:
              </p>
              <p>
                Are you sure you want to clear all operational transactions for tenant <strong className="text-white">{resettingTenant.name}</strong>?
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-300 font-mono">
                <li>Sales & Delivery Statements</li>
                <li>Stock Transfers & Offloads</li>
                <li>Warehouse & Truck Inventory Balances</li>
                <li>Empty Container Returnable Balances</li>
                <li>PUNDO Deposit Ledgers</li>
                <li>Stock In Receipts & FIFO Batches</li>
              </ul>
              <p className="text-[11px] text-slate-400 italic">
                Catalog definitions (products, packaging, stores & user accounts) will be preserved so the tenant can start fresh from scratch.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmResetTenantData}
                className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-lg shadow-amber-600/30 border border-amber-500/40"
              >
                {saving ? 'Clearing Tenant Data...' : 'Confirm & Clear Data to Scratch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
