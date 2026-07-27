import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Cog, Wrench, Package, Truck, Anchor, Plug, ShieldCheck, ShieldAlert, ShieldX,
  HelpCircle, Plus, Search, Pencil, Link2, ChevronRight, Boxes, Layers, ScanLine, X,
} from 'lucide-react';
import { rollupCompliance, COMPLIANCE_META, ASSET_TYPE_META, findParentRig, daysUntil } from '@/utils/rigRollup';
import RigDetailDrawer from '@/components/righub/RigDetailDrawer';
import EquipmentDetailDrawer from '@/components/righub/EquipmentDetailDrawer';
import RecertPipeline from '@/components/righub/RecertPipeline';
import MasterCertificateVault from '@/components/righub/MasterCertificateVault';
import CertificateVault from '@/components/righub/CertificateVault';
import EquipmentFilters from '@/components/righub/EquipmentFilters';
import RecertActionModal from '@/components/righub/RecertActionModal';
import AssetComplianceEditor from '@/components/AssetComplianceEditor';
import FleetMaintenancePanel from '@/components/righub/FleetMaintenancePanel';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Skeleton } from '@/components/StateViews';
import { RefreshCw, Lock } from 'lucide-react';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };

export default function RigHub() {
  const navigate = useNavigate();
  const [view, setView] = useState('rigs'); // 'rigs' | 'equipment'
  const [search, setSearch] = useState('');
  const [compFilter, setCompFilter] = useState('all');
  const [openRig, setOpenRig] = useState(null);
  const [openEquip, setOpenEquip] = useState(null);
  const [editorAsset, setEditorAsset] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [recertAsset, setRecertAsset] = useState(null);
  const [certVaultRig, setCertVaultRig] = useState(null);
  const [equipFilters, setEquipFilters] = useState({ type: null, category: null, person: null });

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  // count of assets needing re-cert for the tab badge
  const recertCount = useMemo(() => assets.filter(a => {
    const d = daysUntil(a.compliance_expiry_date);
    const sd = daysUntil(a.next_service_date);
    return a.compliance_status === 'expired' || a.compliance_status === 'expiring'
      || (d !== null && d <= 30) || (sd !== null && sd <= 30)
      || (d === null && sd === null && a.compliance_status !== 'compliant');
  }).length, [assets]);

  const rigs = useMemo(() => assets.filter(a => a.asset_type === 'rig'), [assets]);
  const equipment = useMemo(() => assets.filter(a => a.asset_type !== 'rig'), [assets]);

  // Master rollups per rig
  const rigsByMaster = useMemo(() => rigs.map(rig => {
    const linked = (rig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean);
    return { rig, linked, rollup: rollupCompliance(rig, linked) };
  }), [rigs, assets]);

  // Summary tiles
  const rigsCompliant = rigsByMaster.filter(r => r.rollup.master === 'compliant').length;
  const rigsWarning = rigsByMaster.filter(r => r.rollup.master === 'expiring' || r.rollup.master === 'expired').length;
  const equipExpired = equipment.filter(a => a.compliance_status === 'expired').length;
  const patAssets = assets.filter(a => a.asset_type === 'portable_appliance');
  const patDue = patAssets.filter(a => {
    const d = daysUntil(a.compliance_expiry_date);
    return a.compliance_status === 'expired' || a.compliance_status === 'expiring' || (d !== null && d <= 30) || (d === null && a.compliance_status !== 'compliant');
  }).length;

  const q = search.toLowerCase().trim();
  const filterFn = (a) => {
    if (compFilter !== 'all' && (a.compliance_status || 'unknown') !== compFilter) return false;
    if (!q) return true;
    return (a.name || '').toLowerCase().includes(q) || (a.serial_number || '').toLowerCase().includes(q);
  };

  const filteredRigs = rigsByMaster.filter(({ rig }) => {
    if (compFilter !== 'all' && rollupCompliance(rig, (rig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean)).master !== compFilter) return false;
    if (!q) return true;
    return (rig.name || '').toLowerCase().includes(q) || (rig.serial_number || '').toLowerCase().includes(q);
  });

  const filteredEquip = equipment.filter(eq => {
    if (!filterFn(eq)) return false;
    if (equipFilters.type && eq.asset_type !== equipFilters.type) return false;
    if (equipFilters.category && (eq.compliance_category || '') !== equipFilters.category) return false;
    if (equipFilters.person && (eq.responsible_person || '') !== equipFilters.person) return false;
    return true;
  }).map(eq => ({
    equip: eq,
    parentRig: findParentRig(eq.id, rigs),
  }));

  const openAdd = () => { setEditorAsset(null); setEditorOpen(true); };
  const openEdit = (asset) => { setEditorAsset(asset); setEditorOpen(true); };

  return (
    <div className="min-h-screen bg-slate-50">
      <Breadcrumbs />
      {/* Hero header */}
      <div className="hero-gradient text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate('/admin')} className="p-2 bg-white/15 hover:bg-white/25 rounded-lg transition flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight truncate">Fleet Hub</h1>
                <p className="text-sm text-white/70">Master record for every rig, equipment, certificate & maintenance booking</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => navigate('/pat-testing')} className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-400/90 hover:bg-amber-400 text-slate-900 rounded-lg font-semibold text-sm active:scale-95 transition shadow-sm">
                <Plug className="w-4 h-4" /> PAT Console
              </button>
              <button onClick={openAdd} className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-[#2E5A1A] rounded-lg font-semibold text-sm hover:bg-white/90 active:scale-95 transition flex-shrink-0 shadow-sm">
                <Plus className="w-4 h-4" /> Add Asset
              </button>
            </div>
          </div>

          {/* Summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Rig Systems', value: rigs.length, icon: Boxes },
              { label: 'Healthy Rigs', value: rigsCompliant, icon: ShieldCheck },
              { label: 'Rigs Need Attention', value: rigsWarning, icon: ShieldAlert },
              { label: 'Expired Equipment', value: equipExpired, icon: ShieldX },
              { label: 'PAT Due', value: patDue, icon: Plug, onClick: () => navigate('/pat-testing') },
            ].map(s => {
              const SIcon = s.icon;
              const Wrapper = s.onClick ? 'button' : 'div';
              return (
                <Wrapper key={s.label} onClick={s.onClick}
                  className={`bg-white/10 backdrop-blur-sm rounded-xl p-3.5 ring-1 ring-white/15 text-left ${s.onClick ? 'hover:bg-white/15 active:scale-[0.98] transition cursor-pointer' : ''}`}>
                  <SIcon className="w-5 h-5 text-white/80 mb-1.5" />
                  <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                  <p className="text-[11px] text-white/70 font-medium">{s.label}</p>
                </Wrapper>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* View toggle + filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 mb-5 space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg flex-wrap">
              <button onClick={() => setView('rigs')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-semibold transition ${view === 'rigs' ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                <Boxes className="w-4 h-4" /> Rigs <span className="text-xs text-slate-400">{rigs.length}</span>
              </button>
              <button onClick={() => setView('equipment')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-semibold transition ${view === 'equipment' ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                <Layers className="w-4 h-4" /> Equipment <span className="text-xs text-slate-400">{equipment.length}</span>
              </button>
              <button onClick={() => setView('recert')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-semibold transition ${view === 'recert' ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                <RefreshCw className="w-4 h-4" /> Re-cert Pipeline
                {recertCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">{recertCount}</span>}
              </button>
              <button onClick={() => setView('certificates')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-semibold transition ${view === 'certificates' ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                <Lock className="w-4 h-4" /> Certificate Vault
              </button>
              <button onClick={() => setView('maintenance')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-semibold transition ${view === 'maintenance' ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                <Wrench className="w-4 h-4" /> Maintenance
              </button>
            </div>
            {(view === 'rigs' || view === 'equipment') && (
            <div className="flex gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or serial..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <select value={compFilter} onChange={e => setCompFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                <option value="all">All Status</option>
                <option value="compliant">Compliant</option>
                <option value="expiring">Expiring</option>
                <option value="expired">Expired</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            )}
            {view !== 'certificates' && (
            <div className="flex gap-2 sm:hidden">
              <button onClick={() => navigate('/pat-testing')} className="inline-flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold">
                <Plug className="w-4 h-4" /> PAT
              </button>
              <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        ) : view === 'maintenance' ? (
          <FleetMaintenancePanel />
        ) : view === 'recert' ? (
          <RecertPipeline assets={assets} onRecert={(a) => setRecertAsset(a)} onOpenAsset={(a) => a.asset_type === 'rig' ? setOpenRig(a) : setOpenEquip(a)} />
        ) : view === 'certificates' ? (
          <MasterCertificateVault assets={assets} onOpenAsset={(a) => a.asset_type === 'rig' ? setOpenRig(a) : setOpenEquip(a)} />
        ) : view === 'rigs' ? (
          filteredRigs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <Boxes className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No rigs found. {rigs.length === 0 ? 'Add a rig asset to get started.' : 'Try clearing your filters.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRigs.map(({ rig, linked, rollup }) => {
                const meta = COMPLIANCE_META[rollup.master];
                const MasterIcon = rollup.master === 'expired' ? ShieldX : rollup.master === 'expiring' ? ShieldAlert : rollup.master === 'unknown' ? HelpCircle : ShieldCheck;
                const border = rollup.master === 'expired' ? 'border-l-4 border-l-red-400' : rollup.master === 'expiring' ? 'border-l-4 border-l-amber-400' : rollup.master === 'unknown' ? 'border-l-4 border-l-slate-300' : '';
                return (
                  <button key={rig.id} onClick={() => setOpenRig(rig)} className={`insight-card rounded-xl p-4 text-left ${border}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Cog className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{rig.name}</p>
                          {rig.rig_type && rig.rig_type !== 'n/a' && <p className="text-[11px] text-blue-600 font-bold uppercase">{rig.rig_type} Rig</p>}
                          {rig.serial_number && <p className="text-xs text-slate-400 font-mono truncate">{rig.serial_number}</p>}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                    </div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${meta.tone}`}>
                        <MasterIcon className="w-3.5 h-3.5" /> {meta.label}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1"><Link2 className="w-3 h-3" /> {linked.length} linked</span>
                    </div>
                    <div className="flex gap-1.5">
                      {['compliant', 'expiring', 'expired', 'unknown'].map(k => rollup.counts[k] > 0 && (
                        <span key={k} className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${COMPLIANCE_META[k].tone}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${COMPLIANCE_META[k].dot}`} /> {rollup.counts[k]}
                        </span>
                      ))}
                    </div>
                    {rig.next_service_date && (
                      <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                        <ScanLine className="w-3 h-3" /> Next service {safeFmt(rig.next_service_date)}
                      </p>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setCertVaultRig(rig); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setCertVaultRig(rig); } }}
                      className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2E5A1A]/10 hover:bg-[#2E5A1A]/20 text-[#2E5A1A] rounded-lg text-[11px] font-semibold transition w-full justify-center"
                    >
                      <Lock className="w-3.5 h-3.5" /> View Certificates
                    </span>
                  </button>
                );
              })}
            </div>
          )
        ) : filteredEquip.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <Layers className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No equipment found. {equipment.length === 0 ? 'Add equipment assets to get started.' : 'Try clearing your filters.'}</p>
          </div>
        ) : (
          <>
          <div className="mb-4">
            <EquipmentFilters assets={equipment} filters={equipFilters} setFilters={setEquipFilters} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredEquip.map(({ equip, parentRig }) => {
              const meta = COMPLIANCE_META[equip.compliance_status || 'unknown'];
              const Icon = TYPE_ICON[equip.asset_type] || Wrench;
              const border = equip.compliance_status === 'expired' ? 'border-l-4 border-l-red-400' : equip.compliance_status === 'expiring' ? 'border-l-4 border-l-amber-400' : equip.compliance_status === 'unknown' ? 'border-l-4 border-l-slate-300' : '';
              const d = daysUntil(equip.compliance_expiry_date);
              return (
                <button key={equip.id} onClick={() => setOpenEquip(equip)} className={`insight-card rounded-xl p-4 text-left ${border}`}>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{equip.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{ASSET_TYPE_META[equip.asset_type]?.label || equip.asset_type}{equip.equipment_type ? ` · ${equip.equipment_type}` : ''}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.tone}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                    </span>
                    {parentRig ? (
                      <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-0.5"><Link2 className="w-3 h-3" /> {parentRig.name}</span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Unlinked</span>
                    )}
                  </div>
                  {d !== null && (
                    <p className={`text-[10px] font-medium ${d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {d < 0 ? 'Expired' : `Expires in ${d} days`} · {safeFmt(equip.compliance_expiry_date)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
          </>
        )}
      </div>

      {/* Drawers */}
      {openRig && (
        <RigDetailDrawer
          rig={openRig}
          allAssets={assets}
          onClose={() => setOpenRig(null)}
          onOpenEquipment={(eq) => setOpenEquip(eq)}
          onEdit={(a) => { setOpenRig(null); openEdit(a); }}
        />
      )}
      {openEquip && (
        <EquipmentDetailDrawer
          equipment={openEquip}
          parentRig={findParentRig(openEquip.id, rigs)}
          onClose={() => setOpenEquip(null)}
          onOpenRig={(rig) => { setOpenEquip(null); setOpenRig(rig); }}
          onEdit={(a) => { setOpenEquip(null); openEdit(a); }}
        />
      )}
      {editorOpen && (
        <AssetComplianceEditor asset={editorAsset} onClose={() => { setEditorOpen(false); setEditorAsset(null); }} />
      )}
      {recertAsset && (
        <RecertActionModal asset={recertAsset} onClose={() => setRecertAsset(null)} />
      )}
      {certVaultRig && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCertVaultRig(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white rounded-t-2xl z-10 border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0">
                  <Lock className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{certVaultRig.name} — Certificates</h3>
                  <p className="text-[11px] text-slate-400 truncate">Rig & all linked equipment · view or download</p>
                </div>
              </div>
              <button onClick={() => setCertVaultRig(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-4">
              <CertificateVault
                assets={[certVaultRig, ...(certVaultRig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean)]}
                assetIds={[certVaultRig.id, ...(certVaultRig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => a.id)]}
                assetNames={{
                  [certVaultRig.id]: certVaultRig.name,
                  ...(certVaultRig.linked_equipment_ids || []).reduce((m, id) => {
                    const a = assets.find(x => x.id === id);
                    if (a) m[id] = a.name;
                    return m;
                  }, {}),
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function safeFmt(d) { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch { return d; } }