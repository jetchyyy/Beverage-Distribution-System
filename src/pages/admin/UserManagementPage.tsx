import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import type { Profile, UserRole } from '../../types/database.types';
import {
  Users,
  UserPlus,
  Shield,
  CheckSquare,
  Square,
  Edit2,
  Lock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
} from 'lucide-react';

export const FEATURE_CATALOG = [
  { key: 'dashboard', label: 'Dashboard', path: '/admin', description: 'Overview metrics & real-time distributor KPIs' },
  { key: 'products', label: 'Products & Packaging', path: '/admin/products', description: 'Beverage catalog, packaging cases & pricing' },
  { key: 'warehouse', label: 'Warehouse Inventory', path: '/admin/warehouse', description: 'Main depot stock, FIFO batch lots & adjustments' },
  { key: 'transfers', label: 'Stock Transfers', path: '/admin/transfers', description: 'Truck dispatch loading & route EOD offload returns' },
  { key: 'stock_in', label: 'Stock In (Receiving)', path: '/admin/purchasing', description: 'Stock In receiving receipts & Control Number tracking' },
  { key: 'promotions', label: 'Promos & Supplier Claims', path: '/admin/promotions', description: 'Configure trade deals (5+1 promo) & track supplier reimbursement claims' },
  { key: 'agents', label: 'Agents & Trucks', path: '/admin/agents-trucks', description: 'Route sales personnel & delivery fleet trucks' },
  { key: 'stores', label: 'Micro Stores', path: '/admin/stores', description: 'Retail store accounts, locations & deposit ledgers' },
  { key: 'sales', label: 'Deliveries & Sales', path: '/admin/sales', description: 'Store delivery transactions & sales history' },
  { key: 'pundo', label: 'Returnables & PUNDO', path: '/admin/pundo', description: 'Empty bottle & case deposit balance tracking' },
  { key: 'reports', label: 'Reports & Audits', path: '/admin/reports', description: 'Financial analytics, sales audit & inventory reports' },
  { key: 'settings', label: 'Tenant Settings', path: '/admin/settings', description: 'Distributor profile, tax ID & tenant configuration' },
  { key: 'users', label: 'User Management', path: '/admin/users', description: 'Create staff accounts & assign feature permissions' },
];

export const UserManagementPage: React.FC = () => {
  const { tenant } = useTenant();
  const { createSecondaryUser, profile: currentProfile } = useAuth();

  const [staffUsers, setStaffUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('WAREHOUSE_STAFF');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(
    FEATURE_CATALOG.map((f) => f.key)
  );

  // Edit Permissions Modal State
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editFeatures, setEditFeatures] = useState<string[]>([]);

  const fetchStaffUsers = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setStaffUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching staff users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffUsers();
  }, [tenant]);

  const toggleFeatureInCreate = (key: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleFeatureInEdit = (key: string) => {
    setEditFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllCreate = () => {
    if (selectedFeatures.length === FEATURE_CATALOG.length) {
      setSelectedFeatures([]);
    } else {
      setSelectedFeatures(FEATURE_CATALOG.map((f) => f.key));
    }
  };

  const handleSelectAllEdit = () => {
    if (editFeatures.length === FEATURE_CATALOG.length) {
      setEditFeatures([]);
    } else {
      setEditFeatures(FEATURE_CATALOG.map((f) => f.key));
    }
  };

  const handleCreateStaffAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !newEmail || !newPassword || !newFullName) return;

    setSaving(true);
    setError(null);
    try {
      const { error: createErr } = await createSecondaryUser(
        newEmail.trim(),
        newPassword,
        newFullName.trim(),
        newRole,
        tenant.id,
        selectedFeatures
      );

      if (createErr) throw createErr;

      setIsCreateModalOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('WAREHOUSE_STAFF');
      setSelectedFeatures(FEATURE_CATALOG.map((f) => f.key));
      fetchStaffUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create staff account');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ allowed_features: editFeatures, updated_at: new Date().toISOString() })
        .eq('id', editingUser.id);

      if (updateErr) throw updateErr;

      setEditingUser(null);
      fetchStaffUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (userToToggle: Profile) => {
    const newStatus = userToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userToToggle.id);
      fetchStaffUsers();
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const openEditModal = (u: Profile) => {
    setEditingUser(u);
    const existing = u.allowed_features && u.allowed_features.length > 0
      ? u.allowed_features
      : FEATURE_CATALOG.map((f) => f.key);
    setEditFeatures(existing);
  };

  const filteredUsers = staffUsers.filter(
    (u) =>
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>Tenant User Management & Feature Access</span>
          </h1>
          <p className="text-slate-400 text-sm">
            Create staff accounts for {tenant?.name || 'Distributor'} and configure custom feature permission checkboxes
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/30 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create Staff Account</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center space-x-3 bg-slate-900 border border-slate-800 rounded-2xl p-3">
        <Search className="w-4 h-4 text-slate-400 ml-1" />
        <input
          type="text"
          placeholder="Search staff accounts by name, email or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 animate-pulse">Loading tenant staff accounts...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-4">User Details</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Feature Permissions</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentProfile?.id;
                  const isTenantAdminUser = u.role === 'TENANT_ADMIN' || u.role === 'SUPERADMIN';
                  const allowedList = u.allowed_features && u.allowed_features.length > 0
                    ? u.allowed_features
                    : FEATURE_CATALOG.map((f) => f.key);

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-white text-sm">{u.full_name}</div>
                        <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase font-mono border ${
                          isTenantAdminUser
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                            : u.role === 'WAREHOUSE_STAFF'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : u.role === 'AGENT'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                        }`}>
                          <Shield className="w-3 h-3 mr-1" />
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {isTenantAdminUser ? (
                          <span className="text-xs text-emerald-400 font-mono font-bold">
                            Full Access (12/12 Features)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {FEATURE_CATALOG.map((feat) => {
                              const hasIt = allowedList.includes(feat.key);
                              return (
                                <span
                                  key={feat.key}
                                  className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${
                                    hasIt
                                      ? 'bg-indigo-950 text-indigo-300 border-indigo-700/60'
                                      : 'bg-slate-950 text-slate-600 border-slate-800 line-through opacity-50'
                                  }`}
                                >
                                  {feat.label.split(' ')[0]}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {u.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3 h-3 mr-1" />
                            INACTIVE
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {!isTenantAdminUser && (
                            <button
                              onClick={() => openEditModal(u)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs flex items-center space-x-1 border border-slate-700"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit Permissions</span>
                            </button>
                          )}

                          {!isSelf && !isTenantAdminUser && (
                            <button
                              onClick={() => toggleUserStatus(u)}
                              className={`px-2.5 py-1.5 rounded-xl font-bold text-xs ${
                                u.status === 'ACTIVE'
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Staff Account Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl text-slate-100 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-lg text-white flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <span>Create Staff Account & Assign Permissions</span>
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaffAccount} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maria Santos"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="staff@distributor.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">System Role *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="WAREHOUSE_STAFF">Warehouse Staff</option>
                    <option value="ACCOUNTING_REPORT">Accounting / Cashier</option>
                    <option value="AGENT">Route Delivery Agent</option>
                    <option value="TENANT_ADMIN">Tenant Admin (Full Access)</option>
                  </select>
                </div>
              </div>

              {/* Feature Permissions Checkbox Grid */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-indigo-300 uppercase tracking-wider">
                    Feature Access Permissions (Sidebar Pages)
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllCreate}
                    className="text-xs text-indigo-400 hover:underline font-bold"
                  >
                    {selectedFeatures.length === FEATURE_CATALOG.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800 max-h-56 overflow-y-auto">
                  {FEATURE_CATALOG.map((feat) => {
                    const isChecked = selectedFeatures.includes(feat.key);

                    return (
                      <div
                        key={feat.key}
                        onClick={() => toggleFeatureInCreate(feat.key)}
                        className={`flex items-start space-x-2.5 p-2 rounded-xl cursor-pointer transition-all border ${
                          isChecked
                            ? 'bg-indigo-950/60 border-indigo-500/40 text-white'
                            : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-900'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-bold">{feat.label}</div>
                          <div className="text-[10px] text-slate-500 leading-tight">{feat.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/30"
                >
                  {saving ? 'Creating Account...' : 'Confirm & Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-slate-100 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-white flex items-center space-x-2">
                  <Lock className="w-5 h-5 text-indigo-400" />
                  <span>Edit Feature Permissions</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{editingUser.full_name} ({editingUser.email})</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-extrabold text-indigo-300 uppercase tracking-wider">
                  Allowed Features Checkboxes
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllEdit}
                  className="text-xs text-indigo-400 hover:underline font-bold"
                >
                  {editFeatures.length === FEATURE_CATALOG.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800 max-h-64 overflow-y-auto">
                {FEATURE_CATALOG.map((feat) => {
                  const isChecked = editFeatures.includes(feat.key);

                  return (
                    <div
                      key={feat.key}
                      onClick={() => toggleFeatureInEdit(feat.key)}
                      className={`flex items-start space-x-2.5 p-2.5 rounded-xl cursor-pointer transition-all border ${
                        isChecked
                          ? 'bg-indigo-950/60 border-indigo-500/40 text-white'
                          : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <div className="text-xs font-bold">{feat.label}</div>
                        <div className="text-[10px] text-slate-500 leading-tight">{feat.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSavePermissions}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/30"
              >
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
