import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useModal } from '../../context/ModalContext';
import {
  Building2,
  Save,
  CheckCircle2,
  AlertCircle,
  Globe,
  Shield,
  RefreshCw,
  BookOpen,
  Package,
  RotateCcw,
  ShoppingBag,
  Truck,
  Store,
  ArrowRightLeft,
  CheckSquare,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';

export const SettingsPage: React.FC = () => {
  const { tenant, refreshTenants, domainName } = useTenant();
  const { showSuccess, showError } = useModal();

  const [activeSubTab, setActiveSubTab] = useState<'workflow' | 'profile'>('workflow');

  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name || '');
      setBusinessName(tenant.business_name || '');
      setTaxId(tenant.tax_id || '');
      setContactName(tenant.contact_name || '');
      setContactEmail(tenant.contact_email || '');
      setContactPhone(tenant.contact_phone || '');
      setAddress(tenant.address || '');
    }
  }, [tenant]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: updateErr } = await supabase
        .from('tenants')
        .update({
          name: name.trim(),
          business_name: businessName.trim() || null,
          tax_id: taxId.trim() || null,
          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
          address: address.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenant.id);

      if (updateErr) throw updateErr;

      await refreshTenants();
      setSuccess(true);
      showSuccess({
        title: 'Settings Saved',
        description: 'Tenant organization details and profile have been updated.',
      });
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      const msg = err.message || 'Failed to update tenant settings.';
      setError(msg);
      showError({
        title: 'Save Failed',
        description: msg,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!tenant) {
    return (
      <div className="py-20 text-center text-sm text-zinc-400">
        Loading tenant configuration...
      </div>
    );
  }

  const workflowSteps = [
    {
      step: 1,
      title: 'Setup Products & Packaging Ratios',
      icon: Package,
      path: '/admin/products',
      description: 'Add beverage SKUs (San Miguel, RC Cola, etc.). Configure packaging conversion ratios (e.g. 1 Case = 24 Bottles) and set selling prices per case and per bottle.',
    },
    {
      step: 2,
      title: 'Configure Bottle & Case PUNDO Rates',
      icon: RotateCcw,
      path: '/admin/pundo',
      description: 'Set deposit rates for empty bottles (e.g., ₱3.00/bottle) and empty cases (e.g., ₱50.00/case). Note: Bottle PUNDO and Case PUNDO are calculated separately!',
    },
    {
      step: 3,
      title: 'Register Suppliers & Receive Purchase Stock',
      icon: Building2,
      path: '/admin/purchasing',
      description: 'Register beverage suppliers. Record Purchase Receipts when factory shipments arrive at the Main Warehouse Depot to add initial stock.',
    },
    {
      step: 4,
      title: 'Register Delivery Fleet & Create Agent Login Accounts',
      icon: Truck,
      path: '/admin/agents-trucks',
      description: 'Register delivery trucks and create Route Agent accounts with login email & password for mobile tablet access.',
    },
    {
      step: 5,
      title: 'Onboard Micro Stores (Sari-Sari Stores)',
      icon: Store,
      path: '/admin/stores',
      description: 'Add retail micro stores and sari-sari store accounts served by your delivery truck routes.',
    },
    {
      step: 6,
      title: 'Dispatch Stock Transfers from Warehouse to Agent Truck',
      icon: ArrowRightLeft,
      path: '/admin/transfers',
      description: 'Issue Stock Transfer receipts moving beverage product cases from the Main Warehouse to Agent Trucks prior to route deployment.',
    },
    {
      step: 7,
      title: 'Agent Touch Delivery & Empties Collection (Mobile Tablet)',
      icon: ShoppingBag,
      path: '/agent/deliver',
      description: 'Agent logs in on mobile/tablet -> Selects Store -> Records Delivered Cases -> Records Returned Empties. System automatically calculates separate Bottle PUNDO + Case PUNDO deposits.',
    },
    {
      step: 8,
      title: 'End-of-Day Route Reconciliation & Movement Audits',
      icon: CheckSquare,
      path: '/agent/reconcile',
      description: 'Agent submits physical end-of-route truck count. Admin inspects sales history, PUNDO ledgers, and movement audit trails in Reports.',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">System Settings & Operations Guide</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Configure distributor settings & learn step-by-step system workflows
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg self-start">
          <Button
            variant={activeSubTab === 'workflow' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveSubTab('workflow')}
            className="h-8 gap-1.5 text-xs"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Workflow Guide</span>
          </Button>

          <Button
            variant={activeSubTab === 'profile' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveSubTab('profile')}
            className="h-8 gap-1.5 text-xs"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Tenant Profile</span>
          </Button>
        </div>
      </div>

      {/* Tab 1: Interactive System Workflow & User Guide */}
      {activeSubTab === 'workflow' && (
        <div className="space-y-6">
          <Card className="bg-zinc-50">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <Badge variant="outline" className="font-mono text-xs mb-1">
                    System Architecture Guide
                  </Badge>
                  <CardTitle className="text-lg">How to Operate the Beverage Distribution System</CardTitle>
                  <CardDescription>
                    Follow this 8-step workflow from initial catalog setup to daily agent truck reconciliation. Click any step card to navigate directly to that module.
                  </CardDescription>
                </div>
                <HelpCircle className="w-6 h-6 text-zinc-400 hidden sm:block" />
              </div>
            </CardHeader>
          </Card>

          {/* Workflow Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <Card key={step.step} className="flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-xs">
                        Step {step.step} of 8
                      </Badge>
                      <div className="p-2 rounded-lg bg-zinc-100 text-zinc-700">
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>

                    <CardTitle className="text-base mt-2">{step.title}</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">{step.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="pt-3 border-t border-zinc-100">
                      <Link
                        to={step.path}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 hover:underline"
                      >
                        <span>Open {step.title.split(' ')[1] || 'Module'}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Business Rules Reference Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-zinc-700" />
                <span>Core Business Rules & Policies</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 space-y-1">
                  <span className="font-semibold text-zinc-900">1. Separate PUNDO Accounting</span>
                  <p className="text-zinc-600 leading-relaxed">
                    Bottle PUNDO and Case PUNDO are calculated separately. Returning empty bottles does not cancel outstanding case returns.
                  </p>
                </div>

                <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 space-y-1">
                  <span className="font-semibold text-zinc-900">2. Immutable Transactions</span>
                  <p className="text-zinc-600 leading-relaxed">
                    Confirmed sales receipts and stock transfers cannot be deleted to ensure audit integrity and accurate historical ledgers.
                  </p>
                </div>

                <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 space-y-1">
                  <span className="font-semibold text-zinc-900">3. Multi-Tenant Subdomain Security</span>
                  <p className="text-zinc-600 leading-relaxed">
                    All data is isolated by tenant subdomain (`{tenant.slug}.{domainName}`). Non-superadmin users are hard-locked to their tenant context.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Tenant Profile Settings */}
      {activeSubTab === 'profile' && (
        <div className="space-y-6">
          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Tenant settings updated successfully!</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Subdomain Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-700" />
                <CardTitle className="text-base">Subdomain & Routing</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 space-y-1">
                  <span className="text-zinc-500 uppercase font-mono font-medium text-[10px]">Tenant Subdomain Slug</span>
                  <p className="font-mono font-semibold text-zinc-900 text-sm">{tenant.slug}</p>
                </div>

                <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 space-y-1">
                  <span className="text-zinc-500 uppercase font-mono font-medium text-[10px]">Full Portal Domain</span>
                  <p className="font-mono font-semibold text-zinc-900 text-sm">{tenant.slug}.{domainName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Form */}
          <form onSubmit={handleSaveSettings}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-zinc-700" />
                  <CardTitle className="text-base">Distributor Business Details</CardTitle>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Distributor Display Name *</label>
                    <Input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Registered Business / Legal Name</label>
                    <Input
                      type="text"
                      placeholder="e.g. San Miguel Distribution Corp."
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Tax Identification Number (TIN)</label>
                    <Input
                      type="text"
                      placeholder="000-123-456-000"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Contact Person Name</label>
                    <Input
                      type="text"
                      placeholder="e.g. Juan dela Cruz"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Contact Email</label>
                    <Input
                      type="email"
                      placeholder="info@distributor.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Contact Phone</label>
                    <Input
                      type="text"
                      placeholder="+63 917 000 1122"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Physical Address / Main Warehouse Depot Location</label>
                  <Textarea
                    rows={3}
                    placeholder="123 Industrial Highway, Mandaue City, Cebu"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div className="flex justify-end pt-3 border-t border-zinc-100">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="gap-1.5"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      )}
    </div>
  );
};
