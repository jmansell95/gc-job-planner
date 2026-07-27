import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  X, Cog, Wrench, Package, Truck, Anchor, Plug, ShieldCheck, ShieldAlert, ShieldX,
  HelpCircle, Pencil, Link2, Unlink, Plus, Save, ChevronRight, ScanLine, Layers,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';
import { rollupCompliance, COMPLIANCE_META, ASSET_TYPE_META, daysUntil } from '@/utils/rigRollup';
import ServiceHistoryPanel from '@/components/compliance/ServiceHistoryPanel';
import CertificateVault from '@/components/righub/CertificateVault';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };

function MasterBadge({ master }) {
  const meta = COMPLIANCE_META[master];
  const Icon = master === 'expired' ? ShieldX : master === 'expiring' ? ShieldAlert : master === 'unknown' ? HelpCircle : ShieldCheck;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${meta.tone}`}>
      <Icon className="w-4 h-4" /> {meta.label} System
    </span>
  );
}

export default function RigDetailDrawer({ rig, allAssets = [], onClose, onOpenEquipment, onEdit }) {
  const [showLinker, setShowLinker] = useState(false);
  const [pendingLinks, setPendingLinks] = useState([]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const linkedItems = useMemo(
    () => (rig.linked_equipment_ids || []).map(id => allAssets.find(a => a.id === id)).filter(Boolean),
    [rig, allAssets]
  );

  const rollup = useMemo(() => rollupCompliance(rig, linkedItems), [rig, linkedItems]);
  const assetNames = useMemo(() => {
    const m = { [rig.id]: rig.name };
    linkedItems.forEach(i => { m[i.id] = i.name; });
    return m;
  }, [rig, linkedItems]);

  // Equipment that can be linked (not a rig, not already linked, active)
  const linkable = allAssets.filter(a =>
    a.id !== rig.id && a.asset_type !== 'rig' && !(rig.linked_equipment_ids || []).includes(a.id) && a.is_active !== false
  );

  const togglePending = (id) => setPendingLinks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const saveLinks = async () => {
    if (pendingLinks.length === 0) { setShowLinker(false); return; }
    setSaving(true);
    try {
      const newIds = [...(rig.linked_equipment_ids || []), ...pendingLinks];
      await base44.entities.SiteAsset.update(rig.id, { linked_equipment_ids: newIds });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      setPendingLinks([]);
      setShowLinker(false);
    } catch (e) { /* bubble */ }
    setSaving(false);
  };

  const unlink = async (eqId) => {
    const newIds = (rig.linked_equipment_ids || []).filter(id => id !== eqId);
    try {
      await base44.entities.SiteAsset.update(rig.id, { linked_equipment_ids: newIds });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
    } catch (e) { /* bubble */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl z-10 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-md">
                <Cog className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 truncate text-lg">{rig.name}</h3>
                <p className="text-xs text-slate-400 truncate">
                  {rig.rig_type && rig.rig_type !== 'n/a' ? <span className="uppercase font-semibold text-blue-600">{rig.rig_type} · </span> : null}
                  Rig System · {rollup.total} asset{rollup.total !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <MasterBadge master={rollup.master} />
              {onEdit && (
                <button onClick={() => onEdit(rig)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              )}
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Compliance rollup strip */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'compliant', label: 'Compliant', grad: 'stat-gradient-emerald' },
              { key: 'expiring', label: 'Expiring', grad: 'stat-gradient-amber' },
              { key: 'expired', label: 'Expired', grad: 'stat-gradient-rose' },
              { key: 'unknown', label: 'Unknown', grad: 'stat-gradient-slate' },
            ].map(s => (
              <div key={s.key} className="rounded-xl border border-slate-200 p-2.5 text-center">
                <p className={`text-2xl font-bold tabular-nums ${s.key === 'expired' ? 'text-red-600' : s.key === 'expiring' ? 'text-amber-600' : s.key === 'compliant' ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {rollup.counts[s.key]}
                </p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Rig's own compliance + identity */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1"><ScanLine className="w-3 h-3" /> Rig Passport</p>
            <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
              <span className="font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">{rig.serial_number || 'No serial'}</span>
              {rig.equipment_type && <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded">{rig.equipment_type}</span>}
              {!rig.is_active && <span className="text-red-700 font-bold bg-red-50 px-2 py-1 rounded uppercase">Inactive</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Rig status</span><span className={`font-semibold ${COMPLIANCE_META[rig.compliance_status || 'unknown'].tone.split(' ')[0]}`}>{COMPLIANCE_META[rig.compliance_status || 'unknown'].label}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Expiry</span><span className="font-medium text-slate-700">{rig.compliance_expiry_date ? safeFormat(rig.compliance_expiry_date, 'dd MMM yyyy') : 'Lifetime'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Last service</span><span className="font-medium text-slate-700">{rig.last_service_date ? safeFormat(rig.last_service_date, 'dd MMM yyyy') : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Next service</span><span className={`font-semibold ${(daysUntil(rig.next_service_date) ?? 99) < 0 ? 'text-red-600' : (daysUntil(rig.next_service_date) ?? 99) <= 30 ? 'text-amber-600' : 'text-slate-700'}`}>{rig.next_service_date ? safeFormat(rig.next_service_date, 'dd MMM yyyy') : '—'}</span></div>
            </div>
            {rig.tooling_notes && <p className="text-xs text-slate-500 mt-2.5"><span className="font-semibold text-slate-600">Tooling:</span> {rig.tooling_notes}</p>}
          </div>

          {/* Linked Toolkit */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800">Linked Toolkit & Equipment</p>
                <p className="text-[10px] text-slate-400">{linkedItems.length} item{linkedItems.length !== 1 ? 's' : ''} — click any to open its record</p>
              </div>
              <button onClick={() => setShowLinker(s => !s)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#2E5A1A]/10 hover:bg-[#2E5A1A]/20 text-[#2E5A1A] rounded-lg text-xs font-semibold transition">
                <Plus className="w-3.5 h-3.5" /> Link
              </button>
            </div>

            {showLinker && (
              <div className="p-3 bg-emerald-50/40 border-b border-emerald-100">
                <p className="text-[11px] font-medium text-slate-600 mb-2">Select equipment to link to this rig:</p>
                <div className="max-h-44 overflow-y-auto space-y-1.5">
                  {linkable.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No unlinked equipment available.</p>
                  ) : linkable.map(a => {
                    const Icon = TYPE_ICON[a.asset_type] || Wrench;
                    const checked = pendingLinks.includes(a.id);
                    return (
                      <label key={a.id} className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-emerald-300 transition">
                        <input type="checkbox" checked={checked} onChange={() => togglePending(a.id)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                        <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-800 truncate">{a.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{a.equipment_type || a.asset_type}{a.serial_number ? ` · ${a.serial_number}` : ''}</p>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${COMPLIANCE_META[a.compliance_status || 'unknown'].dot} flex-shrink-0`} />
                      </label>
                    );
                  })}
                </div>
                {pendingLinks.length > 0 && (
                  <button onClick={saveLinks} disabled={saving}
                    className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-xs font-semibold hover:brightness-110 transition disabled:opacity-60">
                    <Save className="w-3.5 h-3.5" /> {saving ? 'Linking…' : `Link ${pendingLinks.length} item${pendingLinks.length !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            )}

            <div className="p-3">
              {linkedItems.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-3">No equipment linked yet. Use <strong>Link</strong> to build this rig's toolkit.</p>
              ) : (
                <div className="space-y-1.5">
                  {linkedItems.map(eq => {
                    const Icon = TYPE_ICON[eq.asset_type] || Wrench;
                    const meta = COMPLIANCE_META[eq.compliance_status || 'unknown'];
                    const d = daysUntil(eq.compliance_expiry_date);
                    return (
                      <div key={eq.id} className="group flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-slate-50 transition cursor-pointer"
                        onClick={() => onOpenEquipment(eq)}>
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 truncate">{eq.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {eq.equipment_type || ASSET_TYPE_META[eq.asset_type]?.label || eq.asset_type}
                            {eq.serial_number ? ` · ${eq.serial_number}` : ''}
                          </p>
                        </div>
                        {d !== null && (
                          <span className={`text-[10px] font-medium flex-shrink-0 ${d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {d < 0 ? 'Expired' : `${d}d`}
                          </span>
                        )}
                        <span className={`w-2.5 h-2.5 rounded-full ${meta.dot} flex-shrink-0`} />
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition flex-shrink-0" />
                        <button onClick={(e) => { e.stopPropagation(); unlink(eq.id); }}
                          className="p-1 text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100" title="Unlink">
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Certificate vault — rig + all linked */}
          <CertificateVault assetIds={[rig.id, ...linkedItems.map(i => i.id)]} assetNames={assetNames} />

          {/* Service history for the rig itself */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
                <Wrench className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <p className="text-xs font-semibold text-slate-800">Rig Service & Inspection Timeline</p>
            </div>
            <div className="p-4">
              <ServiceHistoryPanel assetId={rig.id} assetName={rig.name} assetType={rig.asset_type} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}