import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Cog, Wrench, Package, Truck, Anchor, Plug,
  Plus, Search, Boxes, ScanLine, X, TrendingUp, RefreshCw, Lock,
  CheckSquare, Upload, Database, MapPin, QrCode, Trash2, CircleDot,
} from 'lucide-react';
import Vehicles from '@/pages/Vehicles';
import { rollupCompliance, daysUntil } from '@/utils/rigRollup';
import RigDetailDrawer from '@/components/righub/RigDetailDrawer';
import EquipmentDetailDrawer from '@/components/righub/EquipmentDetailDrawer';
import RecertPipeline from '@/components/righub/RecertPipeline';
import MasterCertificateVault from '@/components/righub/MasterCertificateVault';
import CertificateVault from '@/components/righub/CertificateVault';
import RecertActionModal from '@/components/righub/RecertActionModal';
import AssetComplianceEditor from '@/components/AssetComplianceEditor';
import FleetHealthGauge from '@/components/righub/FleetHealthGauge';
import FleetComplianceDonut from '@/components/righub/FleetComplianceDonut';
import FleetSyncPanel from '@/components/righub/FleetSyncPanel';
import DrillingEfficiencyPanel from '@/components/righub/DrillingEfficiencyPanel';
import FleetUtilizationHeatmap from '@/components/righub/FleetUtilizationHeatmap';
import BulkAssetUpload from '@/components/righub/BulkAssetUpload';
import SmartCertImport from '@/components/righub/SmartCertImport';
import BulkQRPrinter from '@/components/assetcommand/BulkQRPrinter';
import ScrapPilePanel from '@/components/assetcommand/ScrapPilePanel';
import AssetInventoryGrid from '@/components/assethub/AssetInventoryGrid';
import AssetDeploymentsPanel from '@/components/assethub/AssetDeploymentsPanel';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/StateViews';
import PageHeader from '@/components/PageHeader';
import TabBar from '@/components/TabBar';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Boxes },
  { id: 'rig', label: 'Rigs', icon: Cog },
  { id: 'lifting', label: 'Lifting Equipment', icon: Anchor },
  { id: 'machinery', label: 'Machinery', icon: Wrench },
  { id: 'trailer', label: 'Trailers', icon: Package },
  { id: 'vehicle', label: 'Vehicles', icon: Truck },
  { id: 'portable_appliance', label: 'PAT', icon: Plug },
];

export default function AssetHub() {
  const navigate = useNavigate();
  const [view, setView] = useState('inventory');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [compFilter, setCompFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [openRig, setOpenRig] = useState(null);
  const [openEquip, setOpenEquip] = useState(null);
  const [editorAsset, setEditorAsset] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [recertAsset, setRecertAsset] = useState(null);
  const [certVaultRig, setCertVaultRig] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkCerts, setBulkCerts] = useState(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [showBulkQR, setShowBulkQR] = useState(false);
  const [topTab, setTopTab] = useState('assets');

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const rigs = useMemo(() => assets.filter(a => a.asset_type === 'rig'), [assets]);
  const equipment = useMemo(() => assets.filter(a => a.asset_type !== 'rig'), [assets]);

  const rigsByMaster = useMemo(() => rigs.map(rig => {
    const linked = (rig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean);
    return { rig, linked, rollup: rollupCompliance(rig, linked) };
  }), [rigs, assets]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const c = { all: assets.length, rig: 0, lifting: 0, machinery: 0, trailer: 0, vehicle: 0, portable_appliance: 0 };
    assets.forEach(a => { if (c[a.asset_type] != null) c[a.asset_type]++; });
    return c;
  }, [assets]);

  // Compliance stats
  const recertCount = useMemo(() => assets.filter(a => {
    const d = daysUntil(a.compliance_expiry_date);
    const sd = daysUntil(a.next_service_date);
    return a.compliance_status === 'expired' || a.compliance_status === 'expiring'
      || (d !== null && d <= 30) || (sd !== null && sd <= 30)
      || (d === null && sd === null && a.compliance_status !== 'compliant');
  }).length, [assets]);

  const rigsWarning = rigsByMaster.filter(r => r.rollup.master === 'expiring' || r.rollup.master === 'expired').length;
  const equipExpired = equipment.filter(a => a.compliance_status === 'expired').length;
  const patDue = assets.filter(a => a.asset_type === 'portable_appliance').filter(a => {
    const d = daysUntil(a.compliance_expiry_date);
    return a.compliance_status === 'expired' || a.compliance_status === 'expiring' || (d !== null && d <= 30) || (d === null && a.compliance_status !== 'compliant');
  }).length;

  const totalKnown = assets.filter(a => a.compliance_status && a.compliance_status !== 'unknown').length;
  const compliantCount = assets.filter(a => a.compliance_status === 'compliant').length;
  const fleetHealthPct = totalKnown > 0 ? (compliantCount / totalKnown) * 100 : 0;

  const fleetCounts = useMemo(() => {
    const c = { compliant: 0, expiring: 0, expired: 0, unknown: 0 };
    assets.forEach(a => { c[(a.compliance_status || 'unknown')]++; });
    return c;
  }, [assets]);

  const pandaLinked = assets.filter(a => a.panda_asset_id).length;
  const localOnly = assets.length - pandaLinked;
  const stockIssues = assets.filter(a => a.stock_level === 'out_of_stock' || a.stock_level === 'needs_service').length;

  const tabs = [
    { id: 'inventory', label: 'Inventory', icon: Boxes, count: assets.length },
    { id: 'recert', label: 'Re-cert', icon: RefreshCw, badge: recertCount },
    { id: 'certificates', label: 'Certificates', icon: Lock },
    { id: 'deployments', label: 'Deployments', icon: MapPin },
    { id: 'efficiency', label: 'Efficiency', icon: TrendingUp },
    { id: 'scrap', label: 'Scrap Pile', icon: Trash2 },
  ];

  const openAdd = () => { setEditorAsset(null); setEditorOpen(true); };

  // Bulk cert helpers
  const filteredEquipForBulk = useMemo(() => equipment.filter(a => {
    if (sourceFilter === 'panda' && !a.panda_asset_id) return false;
    if (sourceFilter === 'local' && a.panda_asset_id) return false;
    if (category !== 'all' && category !== 'rig' && a.asset_type !== category) return false;
    if (compFilter !== 'all' && (a.compliance_status || 'unknown') !== compFilter) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (a.name || '').toLowerCase().includes(q) || (a.serial_number || '').toLowerCase().includes(q);
  }), [equipment, category, compFilter, search, sourceFilter]);

  if (topTab === 'fleet') {
    return (
      <div className="space-y-4">
        <PageHeader
          icon={Boxes}
          title="Assets & Fleet Command"
          subtitle="Unified inventory — Asset Panda synced + locally created · Rigs, gear, vehicles & PAT"
        />
        <TabBar
          tabs={[
            { id: 'assets', label: 'Assets', icon: Wrench },
            { id: 'fleet', label: 'Fleet', icon: Truck },
          ]}
          activeTab={topTab}
          onChange={setTopTab}
        />
        <Vehicles />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Boxes}
        title="Assets & Fleet Command"
        subtitle="Unified inventory — Asset Panda synced + locally created · Rigs, gear, vehicles & PAT"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => navigate('/scanner')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg font-semibold text-xs hover:bg-[#244715] transition shadow-sm"><ScanLine className="w-3.5 h-3.5" /> Tablet Scanner</button>
            <button onClick={() => setShowBulkQR(true)} className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold text-xs hover:border-[#2E5A1A] hover:text-[#2E5A1A] transition shadow-sm"><QrCode className="w-3.5 h-3.5" /> Print QR Labels</button>
            <button onClick={() => setShowSmartImport(true)} className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold text-xs hover:border-[#2E5A1A] hover:text-[#2E5A1A] transition shadow-sm"><ScanLine className="w-3.5 h-3.5" /> Smart Import</button>
            <button onClick={() => setShowBulkUpload(true)} className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold text-xs hover:border-[#2E5A1A] hover:text-[#2E5A1A] transition shadow-sm"><Upload className="w-3.5 h-3.5" /> Bulk Upload</button>
            <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2E5A1A] text-white rounded-lg font-semibold text-xs hover:bg-[#244715] transition shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Asset</button>
          </div>
        }
      />
      <TabBar
        tabs={[
          { id: 'assets', label: 'Assets', icon: Wrench },
          { id: 'fleet', label: 'Fleet', icon: Truck },
        ]}
        activeTab={topTab}
        onChange={setTopTab}
      />

      {/* Compliance overview — dark hero-gradient so the white-text charts are readable */}
      <div className="hero-gradient rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <FleetSyncPanel />
          </div>
          <div className="flex items-center gap-4 sm:gap-6 bg-white/5 rounded-xl ring-1 ring-white/10 px-4 sm:px-6 py-3">
            <FleetHealthGauge percent={fleetHealthPct} />
            <div className="h-16 w-px bg-white/15 hidden sm:block" />
            <FleetComplianceDonut counts={fleetCounts} onSegmentClick={(k) => { setCompFilter(k); setView('inventory'); }} />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-3">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg flex-wrap">
          {tabs.map(t => {
            const TIcon = t.icon;
            const active = view === t.id;
            return (
              <button key={t.id} onClick={() => setView(t.id)} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-semibold transition ${active ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                <TIcon className="w-4 h-4" /> {t.label}
                {t.count != null && <span className="text-xs text-slate-400">{t.count}</span>}
                {t.badge != null && t.badge > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">{t.badge}</span>}
              </button>
            );
          })}
        </div>

        {/* Category pills + search (inventory tab only) */}
        {view === 'inventory' && (
          <div className="space-y-3">
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map(cat => {
                const CIcon = cat.icon;
                const active = category === cat.id;
                const count = categoryCounts[cat.id] || 0;
                return (
                  <button key={cat.id} onClick={() => setCategory(cat.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${active ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <CIcon className="w-3.5 h-3.5" /> {cat.label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-white text-slate-400'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or serial..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <select value={compFilter} onChange={e => setCompFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                <option value="all">All Status</option>
                <option value="compliant">Compliant</option>
                <option value="expiring">Expiring</option>
                <option value="expired">Expired</option>
                <option value="unknown">Unknown</option>
              </select>
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                {[
                  { val: 'all', label: 'All Sources', Icon: Boxes },
                  { val: 'panda', label: 'Panda', Icon: Database },
                  { val: 'local', label: 'Local', Icon: CircleDot },
                ].map(opt => {
                  const OIcon = opt.Icon;
                  const active = sourceFilter === opt.val;
                  return (
                    <button key={opt.val} onClick={() => setSourceFilter(opt.val)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${active ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                      <OIcon className="w-3 h-3" /> {opt.label}
                    </button>
                  );
                })}
              </div>
              {category !== 'rig' && (
                <button onClick={() => { setSelectionMode(m => !m); setSelected(new Set()); }} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition flex-shrink-0 ${selectionMode ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}>
                  <CheckSquare className="w-4 h-4" /> {selectionMode ? 'Done' : 'Select'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
      ) : view === 'inventory' ? (
        <AssetInventoryGrid
          assets={assets}
          rigs={rigs}
          category={category}
          search={search}
          compFilter={compFilter}
          sourceFilter={sourceFilter}
          selectionMode={selectionMode}
          selected={selected}
          setSelected={setSelected}
          onOpenRig={setOpenRig}
          onOpenEquip={setOpenEquip}
          onCertVault={setCertVaultRig}
        />
      ) : view === 'deployments' ? (
        <ErrorBoundary><AssetDeploymentsPanel assets={assets} /></ErrorBoundary>
      ) : view === 'efficiency' ? (
        <ErrorBoundary><div className="space-y-4"><FleetUtilizationHeatmap assets={assets} /><DrillingEfficiencyPanel assets={assets} /></div></ErrorBoundary>
      ) : view === 'recert' ? (
        <ErrorBoundary><RecertPipeline assets={assets} onRecert={(a) => setRecertAsset(a)} onOpenAsset={(a) => a.asset_type === 'rig' ? setOpenRig(a) : setOpenEquip(a)} /></ErrorBoundary>
      ) : view === 'certificates' ? (
        <ErrorBoundary><MasterCertificateVault assets={assets} onOpenAsset={(a) => a.asset_type === 'rig' ? setOpenRig(a) : setOpenEquip(a)} /></ErrorBoundary>
      ) : view === 'scrap' ? (
        <ErrorBoundary><ScrapPilePanel /></ErrorBoundary>
      ) : null}

      {/* Bulk cert action bar */}
      {selectionMode && view === 'inventory' && filteredEquipForBulk.length > 0 && (
        <div className="sticky bottom-4 z-30 bg-[#2E5A1A] text-white rounded-xl shadow-2xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-semibold">{selected.size} of {filteredEquipForBulk.length} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setBulkCerts(filteredEquipForBulk.filter(a => selected.has(a.id)))} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold transition"><Lock className="w-3.5 h-3.5" /> View Certs</button>
            <button onClick={() => setSelected(new Set(filteredEquipForBulk.map(a => a.id)))} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition">Select All</button>
            <button onClick={() => { setSelected(new Set()); setSelectionMode(false); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition"><X className="w-3.5 h-3.5" /> Clear</button>
          </div>
        </div>
      )}

      {/* Drawers & modals */}
      {openRig && <RigDetailDrawer rig={openRig} allAssets={assets} onClose={() => setOpenRig(null)} onOpenEquipment={(eq) => setOpenEquip(eq)} onEdit={(a) => { setOpenRig(null); setEditorAsset(a); setEditorOpen(true); }} onRecert={(a) => { setOpenRig(null); setRecertAsset(a); }} />}
      {openEquip && <EquipmentDetailDrawer equipment={openEquip} parentRig={rigs.find(r => (r.linked_equipment_ids || []).includes(openEquip.id)) || null} onClose={() => setOpenEquip(null)} onOpenRig={(rig) => { setOpenEquip(null); setOpenRig(rig); }} onEdit={(a) => { setOpenEquip(null); setEditorAsset(a); setEditorOpen(true); }} onRecert={(a) => { setOpenEquip(null); setRecertAsset(a); }} />}
      {editorOpen && <AssetComplianceEditor asset={editorAsset} onClose={() => { setEditorOpen(false); setEditorAsset(null); }} />}
      {recertAsset && <RecertActionModal asset={recertAsset} onClose={() => setRecertAsset(null)} />}
      {certVaultRig && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCertVaultRig(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white rounded-t-2xl z-10 border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0"><div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0"><Lock className="w-4.5 h-4.5 text-white" /></div><div className="min-w-0"><h3 className="font-bold text-slate-900 truncate">{certVaultRig.name} — Certificates</h3><p className="text-[11px] text-slate-400 truncate">Rig & all linked equipment</p></div></div>
              <button onClick={() => setCertVaultRig(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-4"><CertificateVault assets={[certVaultRig, ...(certVaultRig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean)]} assetIds={[certVaultRig.id, ...(certVaultRig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => a.id)]} assetNames={{ [certVaultRig.id]: certVaultRig.name, ...(certVaultRig.linked_equipment_ids || []).reduce((m, id) => { const a = assets.find(x => x.id === id); if (a) m[id] = a.name; return m; }, {}) }} /></div>
          </div>
        </div>
      )}
      {bulkCerts && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setBulkCerts(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white rounded-t-2xl z-10 border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0"><div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0"><Lock className="w-4 h-4 text-white" /></div><div className="min-w-0"><h3 className="font-bold text-slate-900 truncate">{bulkCerts.length} Assets — Certificates</h3></div></div>
              <button onClick={() => setBulkCerts(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-4"><CertificateVault assets={bulkCerts} assetIds={bulkCerts.map(a => a.id)} assetNames={Object.fromEntries(bulkCerts.map(a => [a.id, a.name]))} /></div>
          </div>
        </div>
      )}
      {showBulkUpload && <BulkAssetUpload onClose={() => setShowBulkUpload(false)} />}
      {showSmartImport && <SmartCertImport onClose={() => setShowSmartImport(false)} />}
      {showBulkQR && <BulkQRPrinter onClose={() => setShowBulkQR(false)} />}
    </div>
  );
}