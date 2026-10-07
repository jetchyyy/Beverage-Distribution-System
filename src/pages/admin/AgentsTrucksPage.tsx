import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import type { Agent, Truck } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import { Truck as TruckIcon, UserCheck, Plus, Key, Mail, Edit2, ShieldAlert } from 'lucide-react';
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

export const AgentsTrucksPage: React.FC = () => {
  const { tenant } = useTenant();
  const { createSecondaryUser } = useAuth();
  const { showSuccess, showError } = useModal();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);

  const [isTruckModalOpen, setIsTruckModalOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);

  // Edit Agent Modal State
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmployeeCode, setEditEmployeeCode] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAssignedTruckId, setEditAssignedTruckId] = useState('');

  // Edit Truck Modal State
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [editPlateNumber, setEditPlateNumber] = useState('');
  const [editTruckCode, setEditTruckCode] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTruckStatus, setEditTruckStatus] = useState<'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'>('ACTIVE');
  const [editTruckAssignedAgentId, setEditTruckAssignedAgentId] = useState('');

  // Truck form state
  const [plateNumber, setPlateNumber] = useState('');
  const [truckCode, setTruckCode] = useState('');
  const [description, setDescription] = useState('');

  // Agent form state (Includes login email & password!)
  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [assignedTruckId, setAssignedTruckId] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!tenant) return;
    try {
      const [trksRes, agsRes] = await Promise.all([
        supabase.from('trucks').select('*').eq('tenant_id', tenant.id).order('truck_code'),
        supabase.from('agents').select('*').eq('tenant_id', tenant.id).order('full_name'),
      ]);

      if (trksRes.error) console.error('Error fetching trucks:', trksRes.error);
      if (agsRes.error) console.error('Error fetching agents:', agsRes.error);

      setTrucks(trksRes.data || []);
      setAgents(agsRes.data || []);
    } catch (err) {
      console.error('Error fetching fleet data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenant]);

  const handleCreateTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !plateNumber || !truckCode) return;
    setSaving(true);
    setError(null);

    try {
      const { data: loc, error: locErr } = await supabase
        .from('locations')
        .insert([
          {
            tenant_id: tenant.id,
            name: `Truck ${truckCode.toUpperCase()} (${plateNumber.toUpperCase()})`,
            type: 'TRUCK',
            is_active: true,
          },
        ])
        .select()
        .single();

      if (locErr) throw locErr;

      await supabase.from('trucks').insert([
        {
          tenant_id: tenant.id,
          plate_number: plateNumber.toUpperCase().trim(),
          truck_code: truckCode.toUpperCase().trim(),
          description,
          location_id: loc.id,
          status: 'ACTIVE',
        },
      ]);

      setIsTruckModalOpen(false);
      const createdPlate = plateNumber.toUpperCase().trim();
      setPlateNumber('');
      setTruckCode('');
      setDescription('');
      fetchData();
      showSuccess({
        title: 'Truck Registered',
        description: `Truck "${createdPlate}" has been added to your fleet.`,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to create truck.';
      setError(msg);
      showError({ title: 'Registration Failed', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !employeeCode || !fullName || !agentEmail || !agentPassword) {
      const msg = 'Employee code, Full Name, Email, and Password are required for Agent account creation.';
      setError(msg);
      showError({ title: 'Missing Information', description: msg });
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const { data: userData, error: authErr } = await createSecondaryUser(
        agentEmail.trim(),
        agentPassword,
        fullName.trim(),
        'AGENT',
        tenant.id
      );

      if (authErr) throw authErr;

      const userId = userData?.user?.id || null;

      await supabase.from('agents').insert([
        {
          tenant_id: tenant.id,
          user_id: userId,
          employee_code: employeeCode.toUpperCase().trim(),
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          assigned_truck_id: assignedTruckId || null,
          status: 'ACTIVE',
        },
      ]);

      setIsAgentModalOpen(false);
      const createdName = fullName.trim();
      setEmployeeCode('');
      setFullName('');
      setAgentEmail('');
      setAgentPassword('');
      setPhone('');
      setAssignedTruckId('');
      fetchData();
      showSuccess({
        title: 'Agent Account Created',
        description: `Route sales credentials created for "${createdName}".`,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to create agent account.';
      setError(msg);
      showError({ title: 'Creation Failed', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const openEditAgentModal = (agent: Agent) => {
    setEditingAgent(agent);
    setEditFullName(agent.full_name || '');
    setEditEmployeeCode(agent.employee_code || '');
    setEditPhone(agent.phone || '');
    setEditAssignedTruckId(agent.assigned_truck_id || '');
    setError(null);
  };

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !editingAgent || !editFullName.trim() || !editEmployeeCode.trim()) {
      setError('Please provide agent full name and employee code.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: agErr } = await supabase
        .from('agents')
        .update({
          full_name: editFullName.trim(),
          employee_code: editEmployeeCode.toUpperCase().trim(),
          phone: editPhone.trim() || null,
          assigned_truck_id: editAssignedTruckId || null,
        })
        .eq('id', editingAgent.id);

      if (agErr) throw agErr;

      setEditingAgent(null);
      fetchData();
      showSuccess({
        title: 'Agent Updated',
        description: `Agent "${editFullName.trim()}" and assigned vehicle have been updated.`,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to update agent.';
      setError(msg);
      showError({ title: 'Update Failed', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const openEditTruckModal = (truck: Truck) => {
    setEditingTruck(truck);
    setEditTruckCode(truck.truck_code || '');
    setEditPlateNumber(truck.plate_number || '');
    setEditDescription(truck.description || '');
    setEditTruckStatus((truck.status as any) || 'ACTIVE');

    const assigned = agents.find((a) => a.assigned_truck_id === truck.id);
    setEditTruckAssignedAgentId(assigned?.id || '');
    setError(null);
  };

  const handleUpdateTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !editingTruck || !editTruckCode.trim() || !editPlateNumber.trim()) {
      setError('Please provide truck code and plate number.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: trkErr } = await supabase
        .from('trucks')
        .update({
          truck_code: editTruckCode.toUpperCase().trim(),
          plate_number: editPlateNumber.toUpperCase().trim(),
          description: editDescription.trim() || null,
          status: editTruckStatus,
        })
        .eq('id', editingTruck.id);

      if (trkErr) throw trkErr;

      // Handle driver reassignment
      const previousAgent = agents.find((a) => a.assigned_truck_id === editingTruck.id);

      if (previousAgent && previousAgent.id !== editTruckAssignedAgentId) {
        await supabase
          .from('agents')
          .update({ assigned_truck_id: null })
          .eq('id', previousAgent.id);
      }

      if (editTruckAssignedAgentId) {
        await supabase
          .from('agents')
          .update({ assigned_truck_id: editingTruck.id })
          .eq('id', editTruckAssignedAgentId);
      }

      setEditingTruck(null);
      fetchData();
      showSuccess({
        title: 'Truck Updated',
        description: `Vehicle "${editTruckCode.toUpperCase().trim()}" and driver assignment updated.`,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to update truck.';
      setError(msg);
      showError({ title: 'Update Failed', description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Agents & Fleet Management</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Register delivery trucks, assign vehicle routes, and manage route sales agent credentials
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsAgentModalOpen(true)}
            className="gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Agent Account</span>
          </Button>
          <Button
            onClick={() => setIsTruckModalOpen(true)}
            className="gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Truck</span>
          </Button>
        </div>
      </div>

      {/* Trucks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <TruckIcon className="w-4 h-4 text-zinc-700" />
            <span>Delivery Trucks ({trucks.length})</span>
          </h2>
        </div>

        {trucks.length === 0 ? (
          <EmptyState
            title="No Trucks Registered"
            description="No delivery trucks registered. Add trucks to assign mobile inventory locations for route agents."
            actionText="Register Truck"
            onAction={() => setIsTruckModalOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trucks.map((t) => {
              const assignedAgent = agents.find((a) => a.assigned_truck_id === t.id);

              return (
                <Card key={t.id} className="border-zinc-200 shadow-xs hover:border-zinc-300 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-xs bg-zinc-50">
                        {t.truck_code}
                      </Badge>
                      <Badge
                        variant={t.status === 'ACTIVE' ? 'secondary' : 'outline'}
                        className={`text-xs ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {t.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-2 font-mono">{t.plate_number}</CardTitle>
                    <CardDescription>{t.description || 'Standard Delivery Vehicle'}</CardDescription>

                    {/* Assigned Driver Box */}
                    <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-medium">Assigned Driver:</span>
                      {assignedAgent ? (
                        <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
                          <UserCheck className="w-3.5 h-3.5 text-zinc-700" />
                          <span>{assignedAgent.full_name}</span>
                          <span className="font-mono text-[10px] text-zinc-400 font-normal">({assignedAgent.employee_code})</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic text-[11px]">Unassigned</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditTruckModal(t)}
                      className="text-xs h-7 text-zinc-600 hover:text-zinc-900 gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{assignedAgent ? 'Switch Driver / Edit' : 'Assign Driver / Edit'}</span>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Route Agents Section */}
      <div className="space-y-4 pt-6 border-t border-zinc-200">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-zinc-700" />
            <span>Route Agents ({agents.length})</span>
          </h2>
        </div>

        {agents.length === 0 ? (
          <EmptyState
            title="No Agents Registered"
            description="No route agents have been created yet. Create agent login credentials to authorize tablet delivery operations."
            actionText="Create Agent Account"
            onAction={() => setIsAgentModalOpen(true)}
          />
        ) : (
          <Card className="border-zinc-200 shadow-xs">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-50/50">
                    <TableHead className="w-[120px] text-xs">Employee Code</TableHead>
                    <TableHead className="text-xs">Full Name</TableHead>
                    <TableHead className="text-xs">Assigned Truck</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Auth Status</TableHead>
                    <TableHead className="text-right text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((ag) => {
                    const assignedTruck = (ag as any).trucks || trucks.find((t) => t.id === ag.assigned_truck_id);

                    return (
                      <TableRow key={ag.id} className="hover:bg-zinc-50/80">
                        <TableCell className="font-mono font-medium text-xs text-zinc-900">
                          {ag.employee_code}
                        </TableCell>
                        <TableCell className="font-semibold text-xs text-zinc-900">
                          {ag.full_name}
                        </TableCell>
                        <TableCell>
                          {assignedTruck ? (
                            <Badge variant="outline" className="font-mono text-[11px] bg-zinc-50 text-zinc-800 border-zinc-300">
                              <TruckIcon className="w-3 h-3 mr-1 text-zinc-600" />
                              {assignedTruck.truck_code} ({assignedTruck.plate_number})
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">No truck assigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-zinc-500 text-xs font-mono">
                          {ag.phone || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] bg-zinc-100 text-zinc-700">
                            {ag.user_id ? 'Login Active' : 'Active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditAgentModal(ag)}
                            className="h-7 text-xs gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit / Switch Truck</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Agent & Truck Assignment Modal */}
      {editingAgent && (
        <Dialog open={!!editingAgent} onOpenChange={(open) => !open && setEditingAgent(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-zinc-700" />
                <span>Edit Agent & Truck Assignment</span>
              </DialogTitle>
              <DialogDescription>
                Update route sales agent details and switch assigned delivery vehicle.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleUpdateAgent} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Employee Code *</label>
                  <Input
                    type="text"
                    required
                    value={editEmployeeCode}
                    onChange={(e) => setEditEmployeeCode(e.target.value)}
                    className="font-mono uppercase text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-medium text-zinc-700 mb-1">Full Name *</label>
                  <Input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">Phone Number</label>
                <Input
                  type="text"
                  placeholder="+63 917 111 2222"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="pt-2 border-t border-zinc-100">
                <label className="block font-semibold text-zinc-900 mb-1 flex items-center gap-1.5">
                  <TruckIcon className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Assigned Delivery Truck</span>
                </label>
                <p className="text-[11px] text-zinc-500 mb-2">
                  Select which truck this agent will drive. Stock transfers and sales will automatically sync to this vehicle.
                </p>
                <select
                  value={editAssignedTruckId}
                  onChange={(e) => setEditAssignedTruckId(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="">No truck assigned (Unassigned)</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.truck_code} — {t.plate_number} {t.description ? `(${t.description})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingAgent(null)}>
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

      {/* Edit Truck & Assign Driver Modal */}
      {editingTruck && (
        <Dialog open={!!editingTruck} onOpenChange={(open) => !open && setEditingTruck(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TruckIcon className="w-4 h-4 text-zinc-700" />
                <span>Edit Truck & Assign Driver</span>
              </DialogTitle>
              <DialogDescription>
                Update vehicle specifications and assign route sales driver.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleUpdateTruck} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Truck Code *</label>
                  <Input
                    type="text"
                    required
                    value={editTruckCode}
                    onChange={(e) => setEditTruckCode(e.target.value)}
                    className="font-mono uppercase text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Plate Number *</label>
                  <Input
                    type="text"
                    required
                    value={editPlateNumber}
                    onChange={(e) => setEditPlateNumber(e.target.value)}
                    className="font-mono uppercase text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">Description</label>
                <Input
                  type="text"
                  placeholder="Forward Truck / 6-wheeler"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">Operational Status</label>
                <select
                  value={editTruckStatus}
                  onChange={(e) => setEditTruckStatus(e.target.value as any)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="pt-2 border-t border-zinc-100">
                <label className="block font-semibold text-zinc-900 mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Assign Route Driver</span>
                </label>
                <select
                  value={editTruckAssignedAgentId}
                  onChange={(e) => setEditTruckAssignedAgentId(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer"
                >
                  <option value="">No driver assigned (Unassigned)</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name} ({a.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingTruck(null)}>
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

      {/* Truck Modal */}
      <Dialog open={isTruckModalOpen} onOpenChange={setIsTruckModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register Delivery Truck</DialogTitle>
            <DialogDescription>
              Add a new vehicle to the distribution fleet.
            </DialogDescription>
          </DialogHeader>

          {error && <div className="p-2 bg-red-50 text-red-600 text-xs rounded">{error}</div>}

          <form onSubmit={handleCreateTruck} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Truck Code *</label>
              <Input
                type="text"
                required
                placeholder="TRK-001"
                value={truckCode}
                onChange={(e) => setTruckCode(e.target.value)}
                className="font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Plate Number *</label>
              <Input
                type="text"
                required
                placeholder="ABC-1234"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                className="font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Description</label>
              <Input
                type="text"
                placeholder="6-wheeler beverage truck"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTruckModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-zinc-900 text-white hover:bg-zinc-800">
                {saving ? 'Registering...' : 'Register Truck'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Agent Auth Account Creation Modal */}
      <Dialog open={isAgentModalOpen} onOpenChange={setIsAgentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Agent Account</DialogTitle>
            <DialogDescription>
              Create credentials for mobile tablet access.
            </DialogDescription>
          </DialogHeader>

          {error && <div className="p-2 bg-red-50 text-red-600 text-xs rounded">{error}</div>}

          <form onSubmit={handleCreateAgent} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Emp Code *</label>
                <Input
                  type="text"
                  required
                  placeholder="AG-101"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  className="font-mono uppercase text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Agent Full Name *</label>
                <Input
                  type="text"
                  required
                  placeholder="Juan Dela Cruz"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            {/* Login Credentials Section */}
            <div className="space-y-3 pt-3 border-t border-zinc-200">
              <h4 className="text-xs font-semibold uppercase text-zinc-900 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-zinc-600" />
                <span>Tablet Login Credentials</span>
              </h4>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Agent Email *</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                  <Input
                    type="email"
                    required
                    placeholder="agent1@distributor.com"
                    value={agentEmail}
                    onChange={(e) => setAgentEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Agent Password *</label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={agentPassword}
                  onChange={(e) => setAgentPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Phone Number</label>
              <Input
                type="text"
                placeholder="+63 917 111 2222"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {trucks.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Assign Truck (Optional)</label>
                <select
                  value={assignedTruckId}
                  onChange={(e) => setAssignedTruckId(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
                >
                  <option value="">No truck assigned yet</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.truck_code} — {t.plate_number}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAgentModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-zinc-900 text-white hover:bg-zinc-800">
                {saving ? 'Creating...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
