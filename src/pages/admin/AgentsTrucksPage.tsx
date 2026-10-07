import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import type { Agent, Truck } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import { Truck as TruckIcon, UserCheck, Plus, Key, Mail } from 'lucide-react';
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
          phone,
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Agents & Fleet Management</h1>
          <p className="text-sm text-zinc-500 mt-1">Register delivery trucks and create route agent mobile credentials</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsAgentModalOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Agent Account</span>
          </Button>
          <Button
            onClick={() => setIsTruckModalOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Register Truck</span>
          </Button>
        </div>
      </div>

      {/* Trucks Section */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <TruckIcon className="w-4 h-4 text-zinc-700" />
          <span>Delivery Trucks ({trucks.length})</span>
        </h2>

        {trucks.length === 0 ? (
          <EmptyState
            title="No Trucks Registered"
            description="No delivery trucks registered. Add trucks to assign mobile inventory locations for route agents."
            actionText="Register Truck"
            onAction={() => setIsTruckModalOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trucks.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-xs">
                      {t.truck_code}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {t.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg mt-2 font-mono">{t.plate_number}</CardTitle>
                  <CardDescription>{t.description || 'Standard Delivery Vehicle'}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Route Agents Section */}
      <div className="space-y-4 pt-6 border-t border-zinc-200">
        <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-zinc-700" />
          <span>Route Agents ({agents.length})</span>
        </h2>

        {agents.length === 0 ? (
          <EmptyState
            title="No Agents Registered"
            description="No route agents have been created yet. Create agent login credentials to authorize tablet delivery operations."
            actionText="Create Agent Account"
            onAction={() => setIsAgentModalOpen(true)}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Employee Code</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Auth Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((ag) => (
                    <TableRow key={ag.id}>
                      <TableCell className="font-mono font-medium text-xs text-zinc-900">
                        {ag.employee_code}
                      </TableCell>
                      <TableCell className="font-semibold text-zinc-900">
                        {ag.full_name}
                      </TableCell>
                      <TableCell className="text-zinc-500 text-xs">
                        {ag.phone || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="text-xs">
                          {ag.user_id ? 'Login Active' : 'Active'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

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
              <Button type="submit" disabled={saving}>
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
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
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
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
