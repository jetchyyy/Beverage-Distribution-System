import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useModal } from '../../context/ModalContext';
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
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';

export const SuperAdminDashboard: React.FC = () => {
  const { profile, signOut, createSecondaryUser } = useAuth();
  const { setDevTenantSlug, domainName } = useTenant();
  const { showError, showSuccess } = useModal();
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
      showSuccess({
        title: 'Export Complete',
        description: `Tenant backup for '${t.name}' downloaded successfully.`,
      });
    } catch (err: any) {
      showError({
        title: 'Export Failed',
        description: 'Failed to export tenant data: ' + (err.message || err),
      });
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
      const tenantName = resettingTenant.name;
      setResettingTenant(null);
      showSuccess({
        title: 'Tenant Reset Completed',
        description: `Tenant '${tenantName}' data was reset successfully. The organization can now start fresh.`,
      });
      fetchTenants();
    } catch (err: any) {
      showError({
        title: 'Reset Failed',
        description: 'Failed to reset tenant data: ' + (err.message || err),
      });
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex font-sans select-none">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-3 px-2 py-1">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center font-bold text-white text-sm">
              ODC
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-900 leading-tight">Platform Admin</h2>
              <p className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase font-semibold">
                Superadmin CMS
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>SaaS Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('registry')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'registry'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Tenant Registry</span>
            </button>

            <button
              onClick={() => setActiveTab('applications')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'applications'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Applications Queue</span>
            </button>

            <button
              onClick={() => setActiveTab('qr_cms')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'qr_cms'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Payment QR CMS</span>
            </button>

            <button
              onClick={() => setActiveTab('plans')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'plans'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Subscription Plans</span>
            </button>
          </nav>
        </div>

        {/* User Profile & Logout */}
        <div className="pt-4 border-t border-zinc-200 space-y-3">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-900">
              SA
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-zinc-900 truncate">{profile?.email || 'superadmin@odc.com'}</p>
              <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider font-semibold">SUPERADMIN</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut().then(() => navigate('/login'))}
            className="w-full gap-1.5 text-xs text-zinc-600"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto bg-zinc-50">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="border-b border-zinc-200 pb-5">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">SaaS Metrics Overview</h1>
              <p className="text-sm text-zinc-500 mt-1">Real-time platform metrics and subscription health</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between text-zinc-500">
                    <CardDescription className="text-xs uppercase font-mono font-semibold">Active Tenants</CardDescription>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-zinc-900 mt-1">{tenants.length}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-zinc-500">Live distributor organizations</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between text-zinc-500">
                    <CardDescription className="text-xs uppercase font-mono font-semibold">Monthly MRR</CardDescription>
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-zinc-900 mt-1">₱148,500</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-zinc-500">+12.4% vs last month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between text-zinc-500">
                    <CardDescription className="text-xs uppercase font-mono font-semibold">Platform Users</CardDescription>
                    <Users className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-zinc-900 mt-1">84</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-zinc-500">Admins, agents & warehouse staff</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between text-zinc-500">
                    <CardDescription className="text-xs uppercase font-mono font-semibold">System Health</CardDescription>
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-zinc-900 mt-1">99.98%</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-zinc-500">Uptime operational</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'registry' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Tenant Organizations</h1>
                <p className="text-sm text-zinc-500 mt-1">
                  Manage active plan scopes, portal instances, and tenant environments
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsSqlModalOpen(true)}
                  className="gap-1.5"
                >
                  <Code className="w-4 h-4" />
                  <span>Superadmin SQL</span>
                </Button>
                <Button
                  onClick={() => setIsModalOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Onboard Tenant</span>
                </Button>
              </div>
            </div>

            {/* Tenant Registry Table */}
            {loading ? (
              <div className="text-center py-24 text-zinc-400 text-sm">Loading tenant accounts...</div>
            ) : tenants.length === 0 ? (
              <EmptyState
                title="No Active Tenants"
                description="No distributor tenant organizations have been onboarded yet."
                icon={<Building2 className="w-8 h-8 text-zinc-400" />}
                actionText="Onboard Tenant"
                onAction={() => setIsModalOpen(true)}
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant Name</TableHead>
                        <TableHead>Subdomain</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-semibold text-zinc-900">
                            {t.name}
                          </TableCell>

                          <TableCell className="font-mono text-xs">
                            {(() => {
                              const isLocal = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
                              const tenantUrl = isLocal
                                ? `http://${t.slug}.localhost:${window.location.port || '5173'}`
                                : `https://${t.slug}.${domainName}`;

                              return (
                                <a
                                  href={tenantUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-zinc-900 hover:underline flex items-center gap-1"
                                >
                                  <span>{t.slug}.{domainName}</span>
                                  <ExternalLink className="w-3 h-3 opacity-60" />
                                </a>
                              );
                            })()}
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[10px] uppercase">
                              Beverage
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                              Professional
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Badge variant={t.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                              {t.status}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEnterTenant(t.slug)}
                                className="h-8 gap-1 text-xs"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                                <span>Enter</span>
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownloadTenantData(t)}
                                disabled={downloadingId === t.id}
                                className="h-8 w-8"
                                title="Download Backup (JSON)"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenResetModal(t)}
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                title="Reset Data"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleTenantStatus(t.id, t.status)}
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Toggle Status"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-zinc-900">Applications Queue</h1>
            <p className="text-zinc-500 text-sm">Pending distributor tenant registration requests</p>
            <div className="py-20 text-center text-zinc-400 text-sm border border-dashed border-zinc-200 rounded-lg">
              No pending onboarding applications in queue.
            </div>
          </div>
        )}

        {activeTab === 'qr_cms' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-zinc-900">Payment QR CMS</h1>
            <p className="text-zinc-500 text-sm">Manage payment gateways for tenant billing</p>
            <div className="py-20 text-center text-zinc-400 text-sm border border-dashed border-zinc-200 rounded-lg">
              QR configuration active.
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-zinc-900">Subscription Plans CMS</h1>
            <p className="text-zinc-500 text-sm">Configure SaaS pricing tiers and scope</p>
            <div className="py-20 text-center text-zinc-400 text-sm border border-dashed border-zinc-200 rounded-lg">
              Plan tiers configured.
            </div>
          </div>
        )}
      </main>

      {/* Onboard Tenant Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Onboard Tenant Organization</DialogTitle>
            <DialogDescription>
              Create a new isolated distributor workspace.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateTenant} className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-zinc-900">1. Distributor Details</h4>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Tenant Name *</label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. DwalHolms Beverage Distribution"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Subdomain Slug *</label>
                <div className="flex items-center">
                  <Input
                    type="text"
                    required
                    placeholder="e.g. dwalholms"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="rounded-r-none font-mono"
                  />
                  <span className="bg-zinc-100 border border-l-0 border-zinc-200 text-zinc-500 px-3 py-2 font-mono text-sm rounded-r-lg">
                    .{domainName}
                  </span>
                </div>
              </div>
            </div>

            {/* Initial Tenant Admin Credentials */}
            <div className="space-y-3 pt-3 border-t border-zinc-200">
              <h4 className="text-xs font-bold uppercase text-zinc-900 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-zinc-600" />
                <span>2. Initial Tenant Admin</span>
              </h4>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Admin Full Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Juan dela Cruz"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Admin Email</label>
                  <Input
                    type="email"
                    placeholder="admin@dwalholms.com"
                    value={adminEmail}
                    onChange={(e) => {
                      setAdminEmail(e.target.value);
                      setContactEmail(e.target.value);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Admin Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Onboarding...' : 'Onboard Tenant'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SQL Modal */}
      <Dialog open={isSqlModalOpen} onOpenChange={setIsSqlModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-zinc-700" />
              <DialogTitle>Superadmin SQL Script</DialogTitle>
            </div>
            <DialogDescription>
              Execute in Supabase SQL Editor to grant platform superadmin rights.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-zinc-950 p-4 rounded-lg font-mono text-xs text-zinc-200 overflow-x-auto my-2">
            <pre>{superAdminSqlScript}</pre>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsSqlModalOpen(false)}>
              Close
            </Button>
            <Button onClick={handleCopySql} className="gap-1.5">
              {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSql ? 'Copied!' : 'Copy Script'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Tenant Data Confirmation Modal */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        {resettingTenant && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <DialogTitle>Clear Tenant Data</DialogTitle>
              </div>
              <DialogDescription>
                Permanent data wipe for organization {resettingTenant.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs leading-relaxed space-y-2">
              <p className="font-semibold">
                This will delete all operational transactions:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] font-mono">
                <li>Sales & Delivery Statements</li>
                <li>Stock Transfers & Offloads</li>
                <li>Inventory Balances</li>
                <li>Empty Container Balances</li>
                <li>PUNDO Deposit Ledgers</li>
                <li>Stock In Receipts & Batches</li>
              </ul>
              <p className="text-[11px] text-zinc-600 italic">
                Products, stores, and user accounts will remain intact.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsResetModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={saving}
                onClick={confirmResetTenantData}
              >
                {saving ? 'Clearing...' : 'Confirm Clear Data'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};
