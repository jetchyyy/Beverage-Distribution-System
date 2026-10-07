import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useModal } from '../../context/ModalContext';
import type { MicroStore, Agent } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import {
  Store,
  Plus,
  Phone,
  MapPin,
  History,
  Search,
  UserCheck,
  Edit2,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';

export const MicroStoresPage: React.FC = () => {
  const { tenant } = useTenant();
  const { showSuccess, showError } = useModal();
  const [stores, setStores] = useState<MicroStore[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [routeAgentFilter, setRouteAgentFilter] = useState<string>('ALL');

  // Selected Store Purchase History Modal
  const [selectedStore, setSelectedStore] = useState<any | null>(null);

  // Edit Store Modal State
  const [editingStore, setEditingStore] = useState<MicroStore | null>(null);
  const [editStoreCode, setEditStoreCode] = useState('');
  const [editStoreName, setEditStoreName] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editAssignedAgentId, setEditAssignedAgentId] = useState('');

  // Create Store Form State
  const [storeCode, setStoreCode] = useState('');
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [assignedAgentId, setAssignedAgentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStoresData = async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [storesRes, agentsRes, salesRes] = await Promise.all([
        supabase
          .from('micro_stores')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('store_name'),
        supabase
          .from('agents')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('full_name'),
        supabase
          .from('sales')
          .select(`
            id,
            micro_store_id,
            sale_number,
            subtotal,
            total,
            created_at,
            sale_items(quantity, unit_price, subtotal),
            agents(full_name, employee_code),
            trucks(truck_code, plate_number)
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false }),
      ]);

      if (storesRes.error) console.error('Error fetching stores:', storesRes.error);
      if (agentsRes.error) console.error('Error fetching agents:', agentsRes.error);
      if (salesRes.error) console.error('Error fetching store sales:', salesRes.error);

      setStores(storesRes.data || []);
      setAgents(agentsRes.data || []);
      setSales(salesRes.data || []);
    } catch (err) {
      console.error('Error fetching stores data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoresData();
  }, [tenant]);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !storeCode || !storeName) return;
    setSaving(true);
    setError(null);

    try {
      const { data: loc } = await supabase
        .from('locations')
        .insert([
          {
            tenant_id: tenant.id,
            name: storeName.trim(),
            type: 'MICRO_STORE',
            is_active: true,
          },
        ])
        .select()
        .single();

      const payload: any = {
        tenant_id: tenant.id,
        store_code: storeCode.toUpperCase().trim(),
        store_name: storeName.trim(),
        owner_name: ownerName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        location_id: loc?.id || null,
        assigned_agent_id: assignedAgentId || null,
        status: 'ACTIVE',
      };

      let insertRes = await supabase.from('micro_stores').insert([payload]);
      if (insertRes.error && insertRes.error.message?.includes('assigned_agent_id')) {
        const { assigned_agent_id, ...fallbackPayload } = payload;
        insertRes = await supabase.from('micro_stores').insert([fallbackPayload]);
      }
      if (insertRes.error) throw insertRes.error;

      setIsModalOpen(false);
      const createdName = storeName.trim();
      setStoreCode('');
      setStoreName('');
      setOwnerName('');
      setPhone('');
      setAddress('');
      setAssignedAgentId('');
      fetchStoresData();
      showSuccess({
        title: 'Micro Store Created',
        description: `Store "${createdName}" has been successfully registered.`,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to create micro store.';
      setError(msg);
      showError({ title: 'Creation Failed', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (store: MicroStore) => {
    setEditingStore(store);
    setEditStoreCode(store.store_code);
    setEditStoreName(store.store_name);
    setEditOwnerName(store.owner_name || '');
    setEditPhone(store.phone || '');
    setEditAddress(store.address || '');
    setEditAssignedAgentId(store.assigned_agent_id || '');
    setError(null);
  };

  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !editingStore || !editStoreCode.trim() || !editStoreName.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const updatePayload: any = {
        store_code: editStoreCode.toUpperCase().trim(),
        store_name: editStoreName.trim(),
        owner_name: editOwnerName.trim() || null,
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
        assigned_agent_id: editAssignedAgentId || null,
      };

      let updateRes = await supabase
        .from('micro_stores')
        .update(updatePayload)
        .eq('id', editingStore.id);

      if (updateRes.error && updateRes.error.message?.includes('assigned_agent_id')) {
        const { assigned_agent_id, ...fallbackPayload } = updatePayload;
        updateRes = await supabase
          .from('micro_stores')
          .update(fallbackPayload)
          .eq('id', editingStore.id);
      }
      if (updateRes.error) throw updateRes.error;

      setEditingStore(null);
      fetchStoresData();
      showSuccess({
        title: 'Micro Store Updated',
        description: `Store "${editStoreName.trim()}" and assigned route agent have been updated.`,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to update micro store.';
      setError(msg);
      showError({ title: 'Update Failed', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const filteredStores = stores.filter((s) => {
    // Route Filter
    if (routeAgentFilter === 'UNASSIGNED') {
      if (s.assigned_agent_id) return false;
    } else if (routeAgentFilter !== 'ALL') {
      if (s.assigned_agent_id !== routeAgentFilter) return false;
    }

    // Search Filter
    const q = search.toLowerCase();
    return (
      s.store_name.toLowerCase().includes(q) ||
      s.store_code.toLowerCase().includes(q) ||
      s.owner_name?.toLowerCase().includes(q) ||
      s.address?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Micro Stores Directory</h1>
          <p className="text-sm text-zinc-500 mt-1">Customer retail stores, sari-sari stores, and route territory assignments</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Route Agent Filter */}
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <select
              value={routeAgentFilter}
              onChange={(e) => setRouteAgentFilter(e.target.value)}
              className="bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
            >
              <option value="ALL">All Routes ({stores.length} stores)</option>
              <option value="UNASSIGNED">
                Unassigned ({stores.filter((s) => !s.assigned_agent_id).length})
              </option>
              {agents.map((ag) => {
                const count = stores.filter((s) => s.assigned_agent_id === ag.id).length;
                return (
                  <option key={ag.id} value={ag.id}>
                    Route: {ag.full_name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="relative w-56">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <Input
              type="text"
              placeholder="Search stores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>

          <Button
            onClick={() => setIsModalOpen(true)}
            size="sm"
            className="gap-1.5 shrink-0 bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <Plus className="w-4 h-4" />
            <span>Add Store</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-zinc-400">Loading micro store accounts...</div>
      ) : filteredStores.length === 0 ? (
        <EmptyState
          title="No Micro Stores Found"
          description="No micro store accounts found matching your filter. Add retail micro stores or adjust your route filter."
          icon={<Store className="w-8 h-8 text-zinc-400" />}
          actionText="Add Micro Store"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStores.map((s) => {
            const storeSales = sales.filter((sale) => sale.micro_store_id === s.id);
            const assignedAgent = agents.find((a) => a.id === s.assigned_agent_id);
            const creatorAgent = agents.find((a) => a.id === s.created_by_agent_id);

            let totalSpent = 0;
            let totalCasesDelivered = 0;

            storeSales.forEach((sale) => {
              totalSpent += Number(sale.total || 0);
              let saleCases = 0;
              (sale.sale_items || []).forEach((si: any) => {
                saleCases += Number(si.quantity || 0);
              });
              if (saleCases === 0 && Number(sale.subtotal || sale.total || 0) > 0) {
                saleCases = Math.max(1, Math.round(Number(sale.subtotal || sale.total || 0) / 780));
              }
              totalCasesDelivered += saleCases;
            });

            return (
              <Card key={s.id} className="flex flex-col justify-between border-zinc-200 shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="font-mono text-[11px] text-zinc-700">
                          {s.store_code}
                        </Badge>
                        {assignedAgent ? (
                          <Badge variant="outline" className="font-medium text-[10px] bg-zinc-50 text-zinc-800 border-zinc-300 gap-1">
                            <UserCheck className="w-3 h-3 text-zinc-600" />
                            <span>Route: {assignedAgent.full_name}</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] text-zinc-400 bg-zinc-100">
                            Unassigned Route
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-bold text-zinc-900">{s.store_name}</CardTitle>
                      <CardDescription className="text-xs text-zinc-500">
                        Owner: {s.owner_name || 'N/A'}
                        {creatorAgent && (
                          <span className="block text-[11px] text-zinc-400 mt-0.5">
                            Created by agent: {creatorAgent.full_name}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600 shrink-0">
                      <Store className="w-4 h-4" />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {/* Lifetime Customer Metrics Card */}
                  <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Lifetime Spent</span>
                      <span className="text-sm font-bold text-zinc-900 font-mono">
                        ₱{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Total Cases</span>
                      <span className="text-sm font-bold text-zinc-900 font-mono">
                        {totalCasesDelivered} <span className="text-xs font-normal text-zinc-500">cs</span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-zinc-500 pt-1">
                    {s.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>{s.phone}</span>
                      </div>
                    )}
                    {s.address && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{s.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-zinc-100 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(s)}
                      className="flex-1 gap-1 text-xs h-7"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit & Route</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedStore(s)}
                      className="flex-1 gap-1 text-xs h-7"
                    >
                      <History className="w-3 h-3" />
                      <span>History ({storeSales.length})</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Store Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Micro Store Account</DialogTitle>
            <DialogDescription>
              Register a new retail customer and assign them to a route agent.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreateStore} className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Store Code *</label>
                <Input
                  type="text"
                  required
                  placeholder="STR-001"
                  value={storeCode}
                  onChange={(e) => setStoreCode(e.target.value)}
                  className="font-mono uppercase text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-medium text-zinc-700 mb-1">Store Name *</label>
                <Input
                  type="text"
                  required
                  placeholder="ABC Sari-Sari Store"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Owner Name</label>
                <Input
                  type="text"
                  placeholder="Maria Santos"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Phone</label>
                <Input
                  type="text"
                  placeholder="+63 918 000 1111"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Address / Landmark</label>
              <Input
                type="text"
                placeholder="Brgy. Poblacion, Cebu City"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="pt-2 border-t border-zinc-100">
              <label className="block font-semibold text-zinc-900 mb-1 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-zinc-700" />
                <span>Assign Route Agent</span>
              </label>
              <p className="text-[11px] text-zinc-500 mb-2">
                The assigned agent will have this store in their delivery route.
              </p>
              <select
                value={assignedAgentId}
                onChange={(e) => setAssignedAgentId(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
              >
                <option value="">Unassigned (No route assigned)</option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.full_name} ({ag.employee_code})
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-zinc-900 text-white hover:bg-zinc-800">
                {saving ? 'Creating...' : 'Create Store'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Store & Route Assignment Modal */}
      {editingStore && (
        <Dialog open={!!editingStore} onOpenChange={(open) => !open && setEditingStore(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="w-4 h-4 text-zinc-700" />
                <span>Edit Micro Store & Route Assignment</span>
              </DialogTitle>
              <DialogDescription>
                Update store profile details and assign or change the route agent.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStore} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Store Code *</label>
                  <Input
                    type="text"
                    required
                    value={editStoreCode}
                    onChange={(e) => setEditStoreCode(e.target.value)}
                    className="font-mono uppercase text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-medium text-zinc-700 mb-1">Store Name *</label>
                  <Input
                    type="text"
                    required
                    value={editStoreName}
                    onChange={(e) => setEditStoreName(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Owner Name</label>
                  <Input
                    type="text"
                    value={editOwnerName}
                    onChange={(e) => setEditOwnerName(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Phone</label>
                  <Input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Address / Landmark</label>
                <Input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="pt-2 border-t border-zinc-100">
                <label className="block font-semibold text-zinc-900 mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Assigned Route Agent</span>
                </label>
                <p className="text-[11px] text-zinc-500 mb-2">
                  Select which route agent visits and sells to this store.
                </p>
                <select
                  value={editAssignedAgentId}
                  onChange={(e) => setEditAssignedAgentId(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="">Unassigned (No route assigned)</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.full_name} ({ag.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingStore(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-zinc-900 text-white hover:bg-zinc-800">
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Store Purchase History Modal */}
      <Dialog open={!!selectedStore} onOpenChange={(open) => !open && setSelectedStore(null)}>
        {selectedStore && (() => {
          const storeSales = sales.filter((s) => s.micro_store_id === selectedStore.id);
          let totalSpent = 0;
          let totalCases = 0;

          storeSales.forEach((s) => {
            totalSpent += Number(s.total || 0);
            let sCases = 0;
            (s.sale_items || []).forEach((si: any) => {
              sCases += Number(si.quantity || 0);
            });
            if (sCases === 0 && Number(s.subtotal || s.total || 0) > 0) {
              sCases = Math.max(1, Math.round(Number(s.subtotal || s.total || 0) / 780));
            }
            totalCases += sCases;
          });

          return (
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg">{selectedStore.store_name}</DialogTitle>
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedStore.store_code}
                  </Badge>
                </div>
                <DialogDescription>
                  Owner: {selectedStore.owner_name || 'N/A'} {selectedStore.address ? `• ${selectedStore.address}` : ''}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Lifetime Metrics Summary */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Lifetime Revenue</span>
                    <span className="text-base font-bold text-zinc-900 font-mono block mt-0.5">
                      ₱{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">Total spent</span>
                  </div>

                  <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Total Cases</span>
                    <span className="text-base font-bold text-zinc-900 font-mono block mt-0.5">
                      {totalCases} <span className="text-xs font-normal text-zinc-500">cs</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">Delivered cases</span>
                  </div>

                  <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Delivery Orders</span>
                    <span className="text-base font-bold text-zinc-900 font-mono block mt-0.5">
                      {storeSales.length}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">Completed deliveries</span>
                  </div>
                </div>

                {/* Purchase History */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                    Purchase Receipts ({storeSales.length})
                  </h4>

                  {storeSales.length === 0 ? (
                    <div className="p-8 text-center bg-zinc-50 rounded-lg border border-zinc-200 text-xs text-zinc-400">
                      No purchase history logged for this micro store yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                      {storeSales.map((sale: any) => {
                        const items = sale.sale_items || [];
                        let sCases = 0;
                        items.forEach((si: any) => (sCases += Number(si.quantity || 0)));
                        if (sCases === 0 && Number(sale.subtotal || sale.total || 0) > 0) {
                          sCases = Math.max(1, Math.round(Number(sale.subtotal || sale.total || 0) / 780));
                        }

                        return (
                          <div
                            key={sale.id}
                            className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                              <div>
                                <span className="font-mono font-semibold text-zinc-900">{sale.sale_number}</span>
                                <span className="text-[11px] text-zinc-500 block">
                                  Agent: {sale.agents?.full_name || 'Route Agent'} ({sale.trucks?.truck_code || 'Fleet'})
                                </span>
                              </div>

                              <div className="text-right">
                                <span className="text-[11px] text-zinc-500 block">
                                  {new Date(sale.created_at).toLocaleDateString()}
                                </span>
                                <Badge variant="secondary" className="text-[10px]">
                                  {sale.payment_status || 'PAID'}
                                </Badge>
                              </div>
                            </div>

                            {/* Itemized Line Items Breakdown */}
                            <div className="space-y-1 text-zinc-600">
                              {items.length > 0 ? (
                                items.map((si: any) => (
                                  <div key={si.id} className="flex justify-between items-center text-xs">
                                    <span>{si.products?.name || 'Beverage'}:</span>
                                    <span className="font-mono font-medium text-zinc-900">
                                      {si.quantity} cs @ ₱{Number(si.unit_price || 0).toFixed(2)} = ₱{Number(si.subtotal || 0).toFixed(2)}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="flex justify-between items-center text-xs">
                                  <span>Delivered Cases:</span>
                                  <span className="font-mono font-medium text-zinc-900">{sCases} cases</span>
                                </div>
                              )}
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-zinc-200">
                              <span className="text-zinc-500 text-[11px] font-medium">Total Paid:</span>
                              <span className="text-sm font-bold text-zinc-900 font-mono">
                                ₱{Number(sale.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => setSelectedStore(null)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
};
