import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Wrench, ShieldCheck, ShieldAlert, ShieldX, Truck, Cog, Package, Anchor, RefreshCw, Info, HelpCircle, ScanLine, Plus, Pencil, Plug } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import SyncComplianceButton from '@/components/SyncComplianceButton';
import AssetComplianceEditor from '@/components/AssetComplianceEditor';
import ComplianceAttentionPanel from '@/components/ComplianceAttentionPanel';
import { useConfigLists } from '@/hooks/useConfigLists';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import AssetPassport from '@/components/logistics/AssetPassport';
import { useNavigate } from 'react-router-dom';

const assetTypeConfig = {
  rig: { label: 'Rig', icon: Cog, badge: 'bg-blue-100 text-blue-700' },
  machinery: { label: 'Machinery', icon: Wrench, badge: 'bg-purple-100 text-purple-700' },
  trailer: { label: 'Trailer', icon: Package, badge: 'bg-amber-100 text-amber-700' },
  vehicle: { label: 'Vehicle', icon: Truck, badge: 'bg-slate-100 text-slate-700' },
  lifting: { label: 'Lifting Equipment', icon: Anchor, badge: 'bg-teal-100 text-teal-700' },
  portable_appliance: { label: 'PAT / Electrical', icon: Plug, badge: 'bg-amber-100 text-amber-700' },
};

const complianceConfig = {
  compliant: { label: 'Compliant', icon: ShieldCheck, badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  expiring: { label: 'Expiring Soon', icon: ShieldAlert, badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  expired: { label: 'Expired', icon: ShieldX, badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  unknown: { label: 'Unknown', icon: HelpCircle, badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
};

export default function SiteAssetManager() {
  const navigate = useNavigate();
  const { getOptions } = useConfigLists();
  const complianceStatusOptions = getOptions('compliance_statuses');

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  // Compliance issue counts for visual warnings
  const expiredCount = assets.filter(a => a.compliance_status === 'expired').length;
  const unknownCount = assets.filter(a => a.compliance_status === 'unknown').length;
  const expiringCount = assets.filter(a => a.compliance_status === 'expiring').length;


  // Filter state
  const [typeTab, setTypeTab] = useState('all');
  const [search, setSearch] = useState('');
  const [compFilter, setCompFilter] = useState('all');
  const [passportAsset, setPassportAsset] = useState(null);
  const [editorAsset, setEditorAsset] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const openAdd = () => { setEditorAsset(null); setEditorOpen(true); };
  const openEdit = (asset) => { setEditorAsset(asset); setEditorOpen(true); };

  const typeTabs = [
    { key: 'all', label: 'All', icon: null },
    { key: 'rig', label: 'Rigs', icon: Cog },
    { key: 'lifting', label: 'Lifting', icon: Anchor },
    { key: 'machinery', label: 'Machinery', icon: Wrench },
    { key: 'trailer', label: 'Trailers', icon: Package },
    { key: 'portable_appliance', label: 'PAT', icon: Plug },
  ];

  const filteredAssets = assets.filter(a => {
    if (typeTab !== 'all' && a.asset_type !== typeTab) return false;
    if (compFilter !== 'all' && (a.compliance_status || 'unknown') !== compFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const nameMatch = (a.name || '').toLowerCase().includes(q);
      const serialMatch = (a.serial_number || '').toLowerCase().includes(q);
      if (!nameMatch && !serialMatch) return false;
    }
    return true;
  });

  return (
    <div>
      <SettingsSectionHeader
        icon={Wrench}
        title="Asset Manager"
        description="Add & manage all rigs, machinery, trailers, vehicles, lifting gear & PAT — this app is the master record"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={openAdd} type="button"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg hover:brightness-110 active:scale-95 transition text-sm font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> Add Asset
            </button>
            <button onClick={() => navigate('/rig-hub')} type="button"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-95 transition text-sm font-semibold shadow-sm">
              <ScanLine className="w-4 h-4" /> Open Asset Hub
            </button>
            <SyncComplianceButton />
          </div>
        }
      />

      {/* Master-system info banner */}
      <div className="insight-card rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Info className="w-4 h-4 text-emerald-600" />
        </div>
        <p className="text-sm text-slate-600 pt-1">
          This app is the <strong>master record</strong> for all assets. Add and edit rigs, machinery, trailers, vehicles, lifting gear and PAT directly here. Use <strong>Import from GC</strong> once to pull your existing records from the old Compliance Manager before you delete it — imported records are kept permanently.
        </p>
      </div>

      {/* Compliance summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Compliant', value: assets.filter(a => a.compliance_status === 'compliant').length, grad: 'stat-gradient-emerald', Icon: ShieldCheck },
          { label: 'Expiring in 30 days', value: expiringCount, grad: 'stat-gradient-amber', Icon: ShieldAlert },
          { label: 'Expired', value: expiredCount, grad: 'stat-gradient-rose', Icon: ShieldX },
          { label: 'Unknown', value: unknownCount, grad: 'stat-gradient-slate', Icon: HelpCircle },
        ].map(s => {
          const SIcon = s.Icon;
          return (
            <div key={s.label} className="insight-card rounded-xl p-3.5 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${s.grad} flex items-center justify-center shadow-md icon-tile-glow`}>
                <SIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{s.value}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Non-compliant items pulled from GC — actionable list to fix then re-sync */}
      <ComplianceAttentionPanel assets={assets} />

      {/* Filters */}
      {assets.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 mb-4 space-y-3">
          <div className="flex gap-1 flex-wrap">
            {typeTabs.map(tab => {
              const count = tab.key === 'all' ? assets.length : assets.filter(a => a.asset_type === tab.key).length;
              const TabIcon = tab.icon;
              return (
                <button key={tab.key} onClick={() => setTypeTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${typeTab === tab.key ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {TabIcon && <TabIcon className="w-3.5 h-3.5" />} {tab.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${typeTab === tab.key ? 'bg-emerald-600' : 'bg-slate-200'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 flex-wrap">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or serial..."
              className="flex-1 min-w-[180px] px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            <select value={compFilter} onChange={e => setCompFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
              <option value="all">All Status</option>
              {complianceStatusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : assets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState icon={Wrench} title="No assets yet" message="Add an asset, or use Import from GC to pull your existing rigs, machinery and trailers from the Compliance Manager." actionLabel="Add Asset" onAction={openAdd} />
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState icon={Wrench} title="No matches" message="No assets match your current filters. Try clearing the search or changing the filter." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAssets.map(asset => {
            const typeCfg = assetTypeConfig[asset.asset_type] || assetTypeConfig.machinery;
            const compCfg = complianceConfig[asset.compliance_status] || complianceConfig.unknown;
            const TypeIcon = typeCfg.icon;
            const CompIcon = compCfg.icon;
            const cardBorder = asset.compliance_status === 'expired' ? 'border-l-4 border-l-red-400' :
              asset.compliance_status === 'expiring' ? 'border-l-4 border-l-amber-400' :
              asset.compliance_status === 'unknown' ? 'border-l-4 border-l-slate-300' :
              !asset.compliance_last_checked ? 'border-l-4 border-l-blue-300' : '';
            return (
              <div key={asset.id} className={`insight-card rounded-xl p-4 ${cardBorder}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <TypeIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{asset.name}</p>
                      {asset.equipment_type && <p className="text-[11px] text-emerald-700 font-semibold truncate" title={`Equipment type: ${asset.equipment_type}`}>{asset.equipment_type}</p>}
                      {asset.serial_number && <p className="text-xs text-slate-400 font-mono truncate">{asset.serial_number}</p>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeCfg.badge}`}>{typeCfg.label}</span>
                  {asset.compliance_category && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 truncate" title={`GC category: ${asset.compliance_category}`}>{asset.compliance_category}</span>
                  )}
                  {asset.rig_type && asset.rig_type !== 'n/a' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 uppercase">{asset.rig_type}</span>
                  )}
                  {!asset.is_active && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-600">Inactive</span>}
                </div>
                <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${compCfg.badge}`}>
                  <CompIcon className="w-4 h-4" />
                  <span className="text-xs font-semibold">{compCfg.label}</span>
                  {asset.compliance_expiry_date 
                    ? <span className="text-xs opacity-70 ml-auto">Expires {asset.compliance_expiry_date}</span>
                    : (asset.asset_type === 'machinery' || asset.asset_type === 'trailer')
                    ? <span className="text-xs opacity-70 ml-auto">Lifetime CoC</span>
                    : null}
                </div>
                {asset.compliance_last_checked && (
                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5" />
                    Synced {new Date(asset.compliance_last_checked).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {asset.tooling_notes && (
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">{asset.tooling_notes}</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openEdit(asset)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A]/10 hover:bg-[#2E5A1A]/20 text-[#2E5A1A] rounded-lg text-xs font-semibold transition"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setPassportAsset(asset)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
                  >
                    <ScanLine className="w-3.5 h-3.5" /> Passport
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <AssetPassport asset={passportAsset} onClose={() => setPassportAsset(null)} allAssets={assets} onEdit={(a) => { setPassportAsset(null); openEdit(a); }} />
      {editorOpen && (
        <AssetComplianceEditor asset={editorAsset} onClose={() => { setEditorOpen(false); setEditorAsset(null); }} />
      )}
    </div>
  );
}