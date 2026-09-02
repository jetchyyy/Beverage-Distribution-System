import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { Truck, PackageX } from 'lucide-react';

export const AgentTruckStock: React.FC = () => {
  const { tenant } = useTenant();
  const [productBalances, setProductBalances] = useState<any[]>([]);
  const [returnableBalances, setReturnableBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [truckCode, setTruckCode] = useState('');

  const fetchTruckInventory = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data: trkData } = await supabase
        .from('trucks')
        .select('*')
        .eq('tenant_id', tenant.id)
        .limit(1)
        .maybeSingle();

      if (trkData && trkData.location_id) {
        setTruckCode(trkData.truck_code);

        const { data: pBals } = await supabase
          .from('inventory_balances')
          .select('*, products(*)')
          .eq('location_id', trkData.location_id);

        // Filter out zero quantity items
        const activeProds = (pBals || []).filter((b) => Number(b.quantity || 0) > 0);
        setProductBalances(activeProds);

        const { data: rBals } = await supabase
          .from('returnable_balances')
          .select('*, returnable_items(*)')
          .eq('location_id', trkData.location_id);

        // Filter out zero quantity returnable containers
        const activeRets = (rBals || []).filter((b) => Number(b.quantity || 0) > 0);
        setReturnableBalances(activeRets);
      }
    } catch (err) {
      console.error('Error fetching truck inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTruckInventory();
  }, [tenant]);

  const isTruckEntirelyEmpty = productBalances.length === 0 && returnableBalances.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h1 className="text-xl font-extrabold text-white flex items-center space-x-2">
          <Truck className="w-5 h-5 text-indigo-400" />
          <span>My Truck Stock ({truckCode || 'TRK-001'})</span>
        </h1>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs animate-pulse">Checking truck inventory...</div>
      ) : isTruckEntirelyEmpty ? (
        <div className="py-12 px-6 text-center space-y-3 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <PackageX className="w-12 h-12 text-slate-600 mx-auto" />
          <h2 className="text-lg font-extrabold text-white">Truck is Empty</h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            No full product cases or collected empty containers are currently loaded on this truck.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <h2 className="text-xs font-mono uppercase font-bold text-slate-400 tracking-wider">Full Product Cases</h2>
            {productBalances.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
                No full product cases on board. Truck is empty.
              </div>
            ) : (
              <div className="space-y-2.5">
                {productBalances.map((b) => (
                  <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-base">{b.products?.name}</h4>
                      <p className="text-xs text-slate-400 font-mono">SKU: {b.products?.sku}</p>
                    </div>
                    <span className="text-xl font-black text-emerald-400 font-mono">
                      {b.quantity} <span className="text-xs text-slate-400 font-normal">{b.unit || 'case'}s</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h2 className="text-xs font-mono uppercase font-bold text-slate-400 tracking-wider">Collected Empty Returns On Truck</h2>
            {returnableBalances.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
                No empty bottles or cases collected on truck.
              </div>
            ) : (
              <div className="space-y-2.5">
                {returnableBalances.map((rb) => (
                  <div key={rb.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-base">{rb.returnable_items?.name}</h4>
                      <p className="text-xs text-slate-400 uppercase font-mono">{rb.returnable_items?.item_type || rb.returnable_items?.type}</p>
                    </div>
                    <span className="text-xl font-black text-amber-300 font-mono">
                      {rb.quantity} <span className="text-xs text-slate-400 font-normal">pcs</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
