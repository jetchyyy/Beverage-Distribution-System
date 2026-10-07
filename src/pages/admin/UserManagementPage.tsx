import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import type { Profile, UserRole } from '../../types/database.types';
import {
  UserPlus,
  Shield,
  CheckSquare,
  Square,
  Edit2,
  AlertCircle,
  Search,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
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

export const FEATURE_CATALOG = [
  { key: 'dashboard', label: 'Dashboard', path: '/admin', description: 'Overview metrics & real-time distributor KPIs' },
  { key: 'analytics', label: 'Analytics & Trends', path: '/admin/analytics', description: 'Real-time sales velocity, PUNDO circulation, route performance & FIFO aging' },
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
  const { showError, showSuccess, confirm } = useModal();

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
    if (!tenant) {
      setLoading(false);
      return;
    }
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
      showSuccess({
        title: 'User Created',
        description: `Staff account for "${newFullName.trim()}" has been created successfully.`,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to create staff account';
      setError(msg);
      showError({ title: 'Creation Failed', description: msg });
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
      showSuccess({
        title: 'Permissions Updated',
        description: `Feature permissions for "${editingUser.full_name}" have been saved.`,
      });
    } catch (err: any) {
      showError({
        title: 'Update Failed',
        description: err.message || 'Failed to update permissions.',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (userToToggle: Profile) => {
    const newStatus = userToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = newStatus === 'ACTIVE' ? 'activate' : 'deactivate';
    const ok = await confirm({
      title: `${newStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'} User`,
      description: `Are you sure you want to ${actionLabel} account "${userToToggle.full_name}"?`,
      confirmText: newStatus === 'ACTIVE' ? 'Activate' : 'Deactivate',
      variant: newStatus === 'ACTIVE' ? 'default' : 'destructive',
    });
    if (!ok) return;

    try {
      await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userToToggle.id);
      fetchStaffUsers();
    } catch (err: any) {
      console.error('Error toggling status:', err);
      showError({
        title: 'Status Update Failed',
        description: err.message || 'Failed to update user status.',
      });
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
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">User Management & Permissions</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage staff accounts for {tenant?.name || 'Distributor'} and configure role permissions
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-1.5 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create Staff Account</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-md">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
        <Input
          type="text"
          placeholder="Search staff accounts by name, email or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-zinc-400">Loading staff accounts...</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Details</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Feature Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentProfile?.id;
                  const isTenantAdminUser = u.role === 'TENANT_ADMIN' || u.role === 'SUPERADMIN';
                  const allowedList = u.allowed_features && u.allowed_features.length > 0
                    ? u.allowed_features
                    : FEATURE_CATALOG.map((f) => f.key);

                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-semibold text-zinc-900 text-sm">{u.full_name}</div>
                        <div className="text-xs text-zinc-400 font-mono">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs uppercase">
                          <Shield className="w-3 h-3 mr-1 text-zinc-600" />
                          {u.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isTenantAdminUser ? (
                          <span className="text-xs text-zinc-600 font-medium">
                            Full Access (All Features)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {FEATURE_CATALOG.map((feat) => {
                              const hasIt = allowedList.includes(feat.key);
                              return (
                                <Badge
                                  key={feat.key}
                                  variant={hasIt ? "secondary" : "outline"}
                                  className={`text-[10px] px-1.5 py-0 ${!hasIt ? 'opacity-40 line-through' : ''}`}
                                >
                                  {feat.label.split(' ')[0]}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                          {u.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isTenantAdminUser && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(u)}
                              className="h-8 gap-1 text-xs"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Permissions</span>
                            </Button>
                          )}

                          {!isSelf && !isTenantAdminUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleUserStatus(u)}
                              className={`h-8 text-xs ${u.status === 'ACTIVE' ? 'text-red-600 hover:text-red-700' : 'text-zinc-900'}`}
                            >
                              {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create Staff Account Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Staff Account</DialogTitle>
            <DialogDescription>
              Assign login credentials and specific module permissions.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreateStaffAccount} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Full Name *</label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Maria Santos"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Email Address *</label>
                <Input
                  type="email"
                  required
                  placeholder="staff@distributor.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Password *</label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">System Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  <option value="WAREHOUSE_STAFF">Warehouse Staff</option>
                  <option value="ACCOUNTING_REPORT">Accounting / Cashier</option>
                  <option value="AGENT">Route Delivery Agent</option>
                  <option value="TENANT_ADMIN">Tenant Admin (Full Access)</option>
                </select>
              </div>
            </div>

            {/* Feature Permissions Checkbox Grid */}
            <div className="space-y-2 pt-2 border-t border-zinc-200">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Feature Permissions
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllCreate}
                  className="h-7 text-xs"
                >
                  {selectedFeatures.length === FEATURE_CATALOG.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-zinc-50 p-3 rounded-lg border border-zinc-200 max-h-56 overflow-y-auto">
                {FEATURE_CATALOG.map((feat) => {
                  const isChecked = selectedFeatures.includes(feat.key);

                  return (
                    <div
                      key={feat.key}
                      onClick={() => toggleFeatureInCreate(feat.key)}
                      className={`flex items-start gap-2 p-2 rounded-md cursor-pointer transition-all border ${
                        isChecked
                          ? 'bg-white border-zinc-300 text-zinc-900 shadow-xs'
                          : 'border-transparent text-zinc-500 hover:bg-zinc-100'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <div className="text-xs font-semibold">{feat.label}</div>
                        <div className="text-[10px] text-zinc-500 leading-tight">{feat.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Modal */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        {editingUser && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Feature Permissions</DialogTitle>
              <DialogDescription>
                {editingUser.full_name} ({editingUser.email})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Allowed Modules
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllEdit}
                  className="h-7 text-xs"
                >
                  {editFeatures.length === FEATURE_CATALOG.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-zinc-50 p-3 rounded-lg border border-zinc-200 max-h-64 overflow-y-auto">
                {FEATURE_CATALOG.map((feat) => {
                  const isChecked = editFeatures.includes(feat.key);

                  return (
                    <div
                      key={feat.key}
                      onClick={() => toggleFeatureInEdit(feat.key)}
                      className={`flex items-start gap-2 p-2 rounded-md cursor-pointer transition-all border ${
                        isChecked
                          ? 'bg-white border-zinc-300 text-zinc-900 shadow-xs'
                          : 'border-transparent text-zinc-500 hover:bg-zinc-100'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <div className="text-xs font-semibold">{feat.label}</div>
                        <div className="text-[10px] text-zinc-500 leading-tight">{feat.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={handleSavePermissions}>
                {saving ? 'Saving...' : 'Save Permissions'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};
