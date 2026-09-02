import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
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
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const SettingsPage: React.FC = () => {
  const { tenant, refreshTenants, domainName } = useTenant();

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
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update tenant settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!tenant) {
    return (
      <div className="py-20 text-center text-slate-500 animate-pulse">
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
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      description: 'Add beverage SKUs (San Miguel, RC Cola, etc.). Configure packaging conversion ratios (e.g. 1 Case = 24 Bottles) and set selling prices per case and per bottle.',
    },
    {
      step: 2,
      title: 'Configure Bottle & Case PUNDO Rates',
      icon: RotateCcw,
      path: '/admin/pundo',
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      description: 'Set deposit rates for empty bottles (e.g., ₱3.00/bottle) and empty cases (e.g., ₱50.00/case). Note: Bottle PUNDO and Case PUNDO are calculated separately!',
    },
    {
      step: 3,
      title: 'Register Suppliers & Receive Purchase Stock',
      icon: Building2,
      path: '/admin/purchasing',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      description: 'Register beverage suppliers. Record Purchase Receipts when factory shipments arrive at the Main Warehouse Depot to add initial stock.',
    },
    {
      step: 4,
      title: 'Register Delivery Fleet & Create Agent Login Accounts',
      icon: Truck,
      path: '/admin/agents-trucks',
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      description: 'Register delivery trucks and create Route Agent accounts with login email & password for mobile tablet access.',
    },
    {
      step: 5,
      title: 'Onboard Micro Stores (Sari-Sari Stores)',
      icon: Store,
      path: '/admin/stores',
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      description: 'Add retail micro stores and sari-sari store accounts served by your delivery truck routes.',
    },
    {
      step: 6,
      title: 'Dispatch Stock Transfers from Warehouse to Agent Truck',
      icon: ArrowRightLeft,
      path: '/admin/transfers',
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      description: 'Issue Stock Transfer receipts moving beverage product cases from the Main Warehouse to Agent Trucks prior to route deployment.',
    },
    {
      step: 7,
      title: 'Agent Touch Delivery & Empties Collection (Mobile Tablet)',
      icon: ShoppingBag,
      path: '/agent/deliver',
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      description: 'Agent logs in on mobile/tablet -> Selects Store -> Records Delivered Cases -> Records Returned Empties. System automatically calculates separate Bottle PUNDO + Case PUNDO deposits.',
    },
    {
      step: 8,
      title: 'End-of-Day Route Reconciliation & Movement Audits',
      icon: CheckSquare,
      path: '/agent/reconcile',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      description: 'Agent submits physical end-of-route truck count. Admin inspects sales history, PUNDO ledgers, and movement audit trails in Reports.',
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">System Settings & Operations Guide</h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure distributor settings & learn step-by-step system workflows
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 self-start">
          <button
            onClick={() => setActiveSubTab('workflow')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'workflow'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Workflow & User Guide</span>
          </button>

          <button
            onClick={() => setActiveSubTab('profile')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Tenant Profile Settings</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Interactive System Workflow & User Guide */}
      {activeSubTab === 'workflow' && (
        <div className="space-y-8">
          <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-800/80 rounded-3xl p-6 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>First-Time User Quickstart Guide</span>
                </div>
                <h2 className="text-xl font-extrabold text-white">How to Operate the Beverage Distribution System</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Follow this 8-step workflow from initial catalog setup to daily agent truck reconciliation. Click any step card to navigate directly to that module.
                </p>
              </div>

              <div className="hidden lg:block p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                <HelpCircle className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* Workflow Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {workflowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.step}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-indigo-500/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-950 text-indigo-400 border border-slate-800">
                        Step {step.step} of 8
                      </span>
                      <div className={`p-2.5 rounded-2xl border ${step.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white leading-snug">{step.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80">
                    <Link
                      to={step.path}
                      className="inline-flex items-center space-x-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      <span>Open {step.title.split(' ')[1] || 'Module'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Business Rules Reference Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span>Core Business Rules & Accounting Policies</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
                <span className="font-bold text-indigo-400">1. Separate PUNDO Accounting</span>
                <p className="text-slate-400 leading-relaxed">
                  Bottle PUNDO and Case PUNDO are calculated separately. Returning empty bottles does not cancel outstanding case returns.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
                <span className="font-bold text-emerald-400">2. Immutable Transactions</span>
                <p className="text-slate-400 leading-relaxed">
                  Confirmed sales receipts and stock transfers cannot be deleted to ensure 100% audit integrity and accurate historical ledgers.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
                <span className="font-bold text-cyan-400">3. Multi-Tenant Subdomain Security</span>
                <p className="text-slate-400 leading-relaxed">
                  All data is isolated by tenant subdomain (`{tenant.slug}.{domainName}`). Non-superadmin users are hard-locked to their tenant context.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Tenant Profile Settings */}
      {activeSubTab === 'profile' && (
        <div className="space-y-6">
          {success && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Tenant settings updated successfully!</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Subdomain Info Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center space-x-3 text-indigo-400">
              <Globe className="w-5 h-5" />
              <h2 className="text-base font-bold text-white">Subdomain & Routing</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase font-mono tracking-wider font-semibold">Tenant Subdomain Slug</span>
                <p className="font-mono text-indigo-300 font-bold text-sm">{tenant.slug}</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase font-mono tracking-wider font-semibold">Full Portal Domain</span>
                <p className="font-mono text-emerald-400 font-bold text-sm">{tenant.slug}.{domainName}</p>
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 text-sm">
            <div className="flex items-center space-x-3 text-indigo-400 border-b border-slate-800 pb-3">
              <Building2 className="w-5 h-5" />
              <h2 className="text-base font-bold text-white">Distributor Business Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Distributor Display Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Registered Business / Legal Name</label>
                <input
                  type="text"
                  placeholder="e.g. San Miguel Distribution Corp."
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tax Identification Number (TIN)</label>
                <input
                  type="text"
                  placeholder="000-123-456-000"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Person Name</label>
                <input
                  type="text"
                  placeholder="e.g. Juan dela Cruz"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Email</label>
                <input
                  type="email"
                  placeholder="info@distributor.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Phone</label>
                <input
                  type="text"
                  placeholder="+63 917 000 1122"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Physical Address / Main Warehouse Depot Location</label>
              <textarea
                rows={3}
                placeholder="123 Industrial Highway, Mandaue City, Cebu"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              ></textarea>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Saving Settings...' : 'Save Tenant Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
