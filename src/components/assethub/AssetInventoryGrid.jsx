import React, { useMemo } from 'react';
import {
  Cog, Wrench, Package, Truck, Anchor, Plug, ShieldCheck, ShieldAlert, ShieldX,
  HelpCircle, ChevronRight, Link2, Lock, ScanLine, Check, CheckSquare,
} from 'lucide-react';
import { rollupCompliance, COMPLIANCE_META, ASSET_TYPE_META, findParentRig, daysUntil } from '@/utils/rigRollup';
import RigUtilizationSparkline from '@/components/righub/RigUtilizationSparkline';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };
const TYPE_GRADIENT = {
  rig: 'from-emerald-500 to-emerald-700', machinery: 'from-violet-500 to-purple-700',
  trailer: 'from-amber-500 to-orange-600', vehicle: 'from-slate-500 to-slate-700',
  lifting: 'from-teal-500 to-cyan-700', portable_appliance: 'from-amber-400 to-yellow-600',
};

function safeFmt(d) { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch { return d; } }

/**
 * Unified inventory grid — renders rigs (with compliance rollup) and equipment
 * in a single grid, filtered by category, search, and compliance status.
 * All items are Asset Panda inventory.
 */
export default function AssetInventoryGrid({
  assets, rigs, category, search, compFilter,
  selectionMode, selected, setSelected,
  onOpenRig, onOpenEquip, onCertVault,
}) {
  const q = search.toLowerCase().trim();

  const rigsByMaster = useMemo(() => rigs.map(rig => {
    const linked = (rig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean);
    return { rig, linked, rollup: rollupCompliance(rig, linked) };
  }), [rigs, assets]);

  const filteredRigs = useMemo(() => rigsByMaster.filter(({ rig, rollup }) => {
    if (compFilter !== 'all' && rollup.master !== compFilter) return false;
    if (!q) return true;
    return (rig.name || '').toLowerCase().includes(q) || (rig.serial_number || '').toLowerCase().includes(q);
  }), [rigsByMaster, q, compFilter]);

  const filteredEquip = useMemo(() => assets.filter(a => {
    if (a.asset_type === 'rig') return false;
    if (category !== 'all' && a.asset_type !== category) return false;
    if (compFilter !== 'all' && (a.compliance_status || 'unknown') !== compFilter) return false;
    if (!q) return true;
    return (a.name || '').toLowerCase().includes(q) || (a.serial_number || '').toLowerCase().includes(q);
  }).map(eq => ({ equip: eq, parentRig: findParentRig(eq.id, rigs) })), [assets, rigs, category, q, compFilter]);

  const showRigs = category === 'all' || category === 'rig';
  const showEquip = category !== 'rig';
  const totalCount = (showRigs ? filteredRigs.length : 0) + (showEquip ? filteredEquip.length : 0);

  if (totalCount === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <Package className="w-10 h-10 text-slate-200 mx-auto mb-2" />
        <p className="text-sm text-slate-400">
          {assets.length === 0 ? 'No assets yet. Sync from Asset Panda to populate.' : 'No assets match your filters.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rig cards (with compliance rollup) */}
      {showRigs && filteredRigs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRigs.map(({ rig, linked, rollup }) => {
            const meta = COMPLIANCE_META[rollup.master];
            const MasterIcon = rollup.master === 'expired' ? ShieldX : rollup.master === 'expiring' ? ShieldAlert : rollup.master === 'unknown' ? HelpCircle : ShieldCheck;
            const border = rollup.master === 'expired' ? 'border-l-4 border-l-red-500 ring-1 ring-red-100' : rollup.master === 'expiring' ? 'border-l-4 border-l-amber-500 ring-1 ring-amber-100' : rollup.master === 'unknown' ? 'border-l-4 border-l-slate-400 ring-1 ring-slate-100' : 'border-l-4 border-l-emerald-500 ring-1 ring-emerald-100';
            return (
              <button key={rig.id} onClick={() => onOpenRig(rig)} className={`insight-card rounded-xl p-4 text-left ${border}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm"><Cog className="w-6 h-6 text-white" /></div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{rig.name}</p>
                      {rig.rig_type && rig.rig_type !== 'n/a' && <p className="text-[11px] text-blue-600 font-bold uppercase">{rig.rig_type} Rig</p>}
                      {rig.serial_number && <p className="text-xs text-slate-400 font-mono truncate">{rig.serial_number}</p>}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                </div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${meta.tone}`}><MasterIcon className="w-3.5 h-3.5" /> {meta.label}</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Link2 className="w-3 h-3" /> {linked.length} linked</span>
                </div>
                <div className="flex gap-1.5">
                  {['compliant', 'expiring', 'expired', 'unknown'].map(k => rollup.counts[k] > 0 && (
                    <span key={k} className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${COMPLIANCE_META[k].tone}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${COMPLIANCE_META[k].dot}`} /> {rollup.counts[k]}
                    </span>
                  ))}
                </div>
                {(() => {
                  const totalUnits = (rig.linked_equipment_ids || []).length + 1;
                  const pct = totalUnits > 0 ? Math.round((rollup.counts.compliant / totalUnits) * 100) : 0;
                  return (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1"><span>Compliance</span><span className="font-semibold text-slate-600">{pct}%</span></div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct >= 85 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })()}
                <RigUtilizationSparkline rigId={rig.id} />
                {rig.next_service_date && <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1"><ScanLine className="w-3 h-3" /> Next service {safeFmt(rig.next_service_date)}</p>}
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onCertVault(rig); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onCertVault(rig); } }} className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2E5A1A]/10 hover:bg-[#2E5A1A]/20 text-[#2E5A1A] rounded-lg text-[11px] font-semibold transition w-full justify-center"><Lock className="w-3.5 h-3.5" /> View Certificates</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Equipment cards */}
      {showEquip && filteredEquip.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEquip.map(({ equip, parentRig }) => {
            const meta = COMPLIANCE_META[equip.compliance_status || 'unknown'];
            const Icon = TYPE_ICON[equip.asset_type] || Wrench;
            const statusAccent = equip.compliance_status === 'expired' ? 'border-l-4 border-l-red-500 ring-1 ring-red-100' : equip.compliance_status === 'expiring' ? 'border-l-4 border-l-amber-500 ring-1 ring-amber-100' : equip.compliance_status === 'unknown' ? 'border-l-4 border-l-slate-400 ring-1 ring-slate-100' : 'border-l-4 border-l-emerald-500 ring-1 ring-emerald-100';
            const grad = TYPE_GRADIENT[equip.asset_type] || 'from-slate-500 to-slate-700';
            const d = daysUntil(equip.compliance_expiry_date);
            const isSel = selected.has(equip.id);
            const handleCardClick = () => {
              if (selectionMode) {
                setSelected(prev => { const n = new Set(prev); n.has(equip.id) ? n.delete(equip.id) : n.add(equip.id); return n; });
              } else { onOpenEquip(equip); }
            };
            return (
              <div key={equip.id} onClick={handleCardClick} className={`insight-card rounded-xl p-4 text-left relative ${statusAccent} ${selectionMode ? 'cursor-pointer' : ''} ${isSel ? 'ring-2 ring-emerald-500' : ''}`}>
                {selectionMode && <div className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center border-2 transition ${isSel ? 'bg-emerald-500 border-emerald-500' : 'bg-white/80 border-slate-300'}`}>{isSel && <Check className="w-4 h-4 text-white" />}</div>}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 shadow-md`}><Icon className="w-5 h-5 text-white" /></div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{equip.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{ASSET_TYPE_META[equip.asset_type]?.label || equip.asset_type}{equip.equipment_type ? ` · ${equip.equipment_type}` : ''}</p>
                    </div>
                  </div>
                  {!selectionMode && <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />}
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.tone}`}><span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}</span>
                  {parentRig ? <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-0.5"><Link2 className="w-3 h-3" /> {parentRig.name}</span> : <span className="text-[10px] text-slate-400">{equip.storage_location || 'Yard'}</span>}
                </div>
                {d !== null && <p className={`text-[10px] font-medium ${d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>{d < 0 ? 'Expired' : `Expires in ${d} days`} · {safeFmt(equip.compliance_expiry_date)}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}