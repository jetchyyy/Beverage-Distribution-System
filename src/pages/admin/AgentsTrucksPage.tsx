import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import type { Agent, Truck } from '../../types/database.types';
import { EmptyState } from '../../components/EmptyState';
import { Truck as TruckIcon, UserCheck, Plus, Key, Mail } from 'lucide-react';

export const AgentsTrucksPage: React.FC = () => {
  const { tenant } = useTenant();
  const { createSecondaryUser } = useAuth();
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
      const { data: trks } = await supabase.from('trucks').select('*').eq('tenant_id', tenant.id).order('truck_code');
      setTrucks(trks || []);

      const { data: ags } = await supabase.from('agents').select('*').eq('tenant_id', tenant.id).order('full_name');
      setAgents(ags || []);
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
      setPlateNumber('');
      setTruckCode('');
      setDescription('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to create truck.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !employeeCode || !fullName || !agentEmail || !agentPassword) {
      setError('Employee code, Full Name, Email, and Password are required for Agent account creation.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      // 1. Create Auth Account for Agent using isolated client (keeps Admin session active!)
      const { data: userData, error: authErr } = await createSecondaryUser(
        agentEmail.trim(),
        agentPassword,
        fullName.trim(),
        'AGENT',
        tenant.id
      );

      if (authErr) throw authErr;

      const userId = userData?.user?.id || null;

      // 2. Insert record into agents table
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
      setEmployeeCode('');
      setFullName('');
      setAgentEmail('');
      setAgentPassword('');
      setPhone('');
      setAssignedTruckId('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to create agent account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Agents & Delivery Fleet</h1>
          <p className="text-slate-400 text-sm">Register route agents with mobile tablet login credentials & trucks</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsAgentModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Create Agent Account</span>
          </button>
          <button
            onClick={() => setIsTruckModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Register Truck</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <TruckIcon className="w-5 h-5 text-cyan-400" />
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
              <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                    {t.truck_code}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                    {t.status}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t.plate_number}</h3>
                  <p className="text-xs text-slate-400">{t.description || 'Standard Delivery Vehicle'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-800">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <UserCheck className="w-5 h-5 text-indigo-400" />
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Employee Code</th>
                  <th className="px-6 py-4">Full Name</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Tablet Auth Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {agents.map((ag) => (
                  <tr key={ag.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-indigo-400 font-bold">{ag.employee_code}</td>
                    <td className="px-6 py-4 font-semibold text-white">{ag.full_name}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{ag.phone || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {ag.user_id ? 'LOGIN ENABLED' : 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Truck Modal */}
      {isTruckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="text-lg font-bold">Register Delivery Truck</h3>
              <button onClick={() => setIsTruckModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            {error && <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>}
            <form onSubmit={handleCreateTruck} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Truck Code *</label>
                <input
                  type="text"
                  required
                  placeholder="TRK-001"
                  value={truckCode}
                  onChange={(e) => setTruckCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Plate Number *</label>
                <input
                  type="text"
                  required
                  placeholder="ABC-1234"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="6-wheeler beverage truck"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsTruckModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Auth Account Creation Modal */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="text-lg font-bold">Create Agent Login Account</h3>
              <button onClick={() => setIsAgentModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            {error && <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>}
            <form onSubmit={handleCreateAgent} className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Emp Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="AG-101"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono uppercase text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Agent Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Juan Dela Cruz"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Login Credentials Section */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h4 className="text-xs font-mono font-bold uppercase text-emerald-400 flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5" />
                  <span>Agent Tablet Login Credentials</span>
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Agent Email *</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="agent1@distributor.com"
                      value={agentEmail}
                      onChange={(e) => setAgentEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Agent Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={agentPassword}
                    onChange={(e) => setAgentPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+63 917 111 2222"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              {trucks.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Truck (Optional)</label>
                  <select
                    value={assignedTruckId}
                    onChange={(e) => setAssignedTruckId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs"
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

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsAgentModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/30">
                  {saving ? 'Creating Agent...' : 'Create Agent Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
