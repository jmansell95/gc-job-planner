import React from 'react';
import {
  X, Cog, Wrench, Package, Truck, Anchor, ShieldCheck, ShieldAlert, ShieldX,
  HelpCircle, CheckCircle2, AlertTriangle, AlertCircle, Clock, Link2,
  Wrench as WrenchIcon, CalendarClock, CalendarCheck, ExternalLink, Database,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';

const TYPE_META = {
  rig: { label: 'Rig', icon: Cog, tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  machinery: { label: 'Machinery', icon: Wrench, tint: 'bg-purple-50 text-purple-700 border-purple-200' },
  trailer: { label: 'Trailer', icon: Package, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  vehicle: { label: 'Vehicle', icon: Truck, tint: 'bg-slate-50 text-slate-700 border-slate-200' },
  lifting: { label: 'Lifting Gear', icon: Anchor, tint: 'bg-teal-50 text-teal-700 border-teal-200' },
};

const STOCK_META = {
  in_stock: { label: 'In Stock', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: CheckCircle2 },
  low_stock: { label: 'Low Stock', tone: 'text-amber-700 bg-amber-50 border-amber-200', Icon: AlertTriangle },
  out_of_stock: { label: 'Out of Stock', tone: 'text-red-700 bg-red-50 border-red-200', Icon: AlertCircle },
  needs_service: { label: 'Needs Service', tone: 'text-orange-700 bg-orange-50 border-orange-200', Icon: AlertTriangle },
  unknown: { label: 'Unknown', tone: 'text-slate-600 bg-slate-50 border-slate-200', Icon: AlertCircle },
};

const COMPLIANCE_META = {
  compliant: { label: 'Compliant', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: ShieldCheck, pct: 100 },
  expiring: { label: 'Expiring Soon', tone: 'text-amber-700 bg-amber-50 border-amber-200', Icon: ShieldAlert, pct: 65 },
  expired: { label: 'Expired', tone: 'text-red-700 bg-red-50 border-red-200', Icon: ShieldX, pct: 15 },
  unknown: { label: 'Unknown', tone: 'text-slate-600 bg-slate-50 border-slate-200', Icon: HelpCircle, pct: 40 },
};

const MAINTENANCE_META = {
  ok: { label: 'Serviced & Current', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: WrenchIcon, pct: 100 },
  due_soon: { label: 'Service Due Soon', tone: 'text-amber-700 bg-amber-50 border-amber-200', Icon: CalendarClock, pct: 60 },
  overdue: { label: 'Service Overdue', tone: 'text-red-700 bg-red-50 border-red-200', Icon: AlertTriangle, pct: 10 },
  unknown: { label: 'No Service Data', tone: 'text-slate-600 bg-slate-50 border-slate-200', Icon: HelpCircle, pct: 35 },
};

function Gauge({ pct, tone }) {
  const color = tone.includes('emerald') ? '#10b981' : tone.includes('amber') ? '#f59e0b' : tone.includes('red') ? '#ef4444' : '#94a3b8';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Panel({ title, source, icon: Icon, iconTint, children }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${iconTint}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800">{title}</p>
          <p className="text-[10px] text-slate-400 flex items-center gap-1"><Link2 className="w-2.5 h-2.5" /> {source}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-slate-500">{label}</span>
      <span className={`text-slate-700 font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export default function AssetPassport({ asset, onClose, allAssets = [] }) {
  if (!asset) return null;

  const typeMeta = TYPE_META[asset.asset_type] || TYPE_META.machinery;
  const stockMeta = STOCK_META[asset.stock_level] || STOCK_META.unknown;
  const compMeta = COMPLIANCE_META[asset.compliance_status] || COMPLIANCE_META.unknown;
  const maintMeta = MAINTENANCE_META[asset.maintenance_status] || MAINTENANCE_META.unknown;

  const linkedItems = (asset.linked_equipment_ids || [])
    .map(id => allAssets.find(a => a.id === id))
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${typeMeta.tint} flex-shrink-0`}>
              <typeMeta.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate">Asset Passport</h3>
              <p className="text-[11px] text-slate-400 truncate">{asset.name} · {typeMeta.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition flex-shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Identity strip */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">{asset.serial_number || 'No serial'}</span>
            {asset.rig_type && asset.rig_type !== 'n/a' && <span className="uppercase font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">{asset.rig_type}</span>}
            {asset.equipment_type && <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded">{asset.equipment_type}</span>}
            {asset.compliance_category && <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded">{asset.compliance_category}</span>}
            {!asset.is_active && <span className="text-red-700 font-bold bg-red-50 px-2 py-1 rounded uppercase">Inactive</span>}
          </div>

          {/* Compliance panel (GC) */}
          <Panel title="Compliance & Safety" source="GC Compliance Manager" icon={compMeta.Icon} iconTint="bg-white border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${compMeta.tone}`}>
                <compMeta.Icon className="w-3.5 h-3.5" /> {compMeta.label}
              </span>
              <span className="text-[11px] text-slate-400">
                {asset.compliance_last_checked ? `Checked ${safeFormat(asset.compliance_last_checked, 'dd MMM yyyy')}` : 'Never checked'}
              </span>
            </div>
            <Gauge pct={compMeta.pct} tone={compMeta.tone} />
            <div className="mt-3 space-y-0.5 divide-y divide-slate-50">
              <Row label="Expiry date" value={asset.compliance_expiry_date ? safeFormat(asset.compliance_expiry_date, 'dd MMM yyyy') : 'Lifetime CoC'} />
              <Row label="Responsible person" value={asset.responsible_person} />
              {asset.tooling_notes && <Row label="Tooling" value={asset.tooling_notes} />}
            </div>
          </Panel>

          {/* Maintenance panel (GC) */}
          <Panel title="Service & Repair History" source="GC Compliance Manager" icon={maintMeta.Icon} iconTint="bg-white border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${maintMeta.tone}`}>
                <maintMeta.Icon className="w-3.5 h-3.5" /> {maintMeta.label}
              </span>
              {asset.next_service_date && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" /> Next: {safeFormat(asset.next_service_date, 'dd MMM yyyy')}
                </span>
              )}
            </div>
            <Gauge pct={maintMeta.pct} tone={maintMeta.tone} />
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <CalendarCheck className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500">Last serviced:</span>
                <span className="text-slate-700 font-medium">{asset.last_service_date ? safeFormat(asset.last_service_date, 'dd MMM yyyy') : 'No record'}</span>
              </div>
              {asset.service_notes && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <p className="text-[10px] uppercase font-medium text-slate-400 mb-0.5">Service notes</p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">{asset.service_notes}</p>
                </div>
              )}
              {asset.repair_notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-[10px] uppercase font-medium text-amber-500 mb-0.5">Repair notes</p>
                  <p className="text-xs text-amber-700 whitespace-pre-wrap">{asset.repair_notes}</p>
                </div>
              )}
              {!asset.last_service_date && !asset.next_service_date && !asset.service_notes && !asset.repair_notes && (
                <p className="text-xs text-slate-400 italic">No service or repair data recorded in GC Compliance Manager for this asset.</p>
              )}
            </div>
          </Panel>

          {/* Inventory panel (Asset Panda) */}
          <Panel title="Inventory & Stock" source="Asset Panda" icon={Database} iconTint="bg-white border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${stockMeta.tone}`}>
                <stockMeta.Icon className="w-3.5 h-3.5" /> {stockMeta.label}
              </span>
              <span className={`text-[11px] flex items-center gap-1 ${asset.sync_status === 'synced' ? 'text-emerald-600' : asset.sync_status === 'failed' ? 'text-red-500' : 'text-slate-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${asset.sync_status === 'synced' ? 'bg-emerald-500' : asset.sync_status === 'failed' ? 'bg-red-500' : 'bg-slate-300'}`} />
                {asset.sync_status === 'synced' ? 'Synced' : asset.sync_status === 'failed' ? 'Sync failed' : asset.sync_status === 'pending' ? 'Pending' : 'Never synced'}
              </span>
            </div>
            <div className="mt-2 space-y-0.5 divide-y divide-slate-50">
              <Row label="Last sync" value={asset.last_sync_timestamp ? safeFormat(asset.last_sync_timestamp, 'dd MMM yyyy HH:mm') : 'Never'} />
              <Row label="Asset Panda ID" value={asset.panda_asset_id} mono />
              <Row label="GC Compliance ID" value={asset.external_compliance_id} mono />
            </div>
          </Panel>

          {/* Linked equipment */}
          {linkedItems.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] uppercase font-medium text-slate-400 mb-2">{linkedItems.length} linked item(s)</p>
              <div className="flex flex-wrap gap-1.5">
                {linkedItems.map(eq => {
                  const m = TYPE_META[eq.asset_type] || TYPE_META.machinery;
                  return (
                    <span key={eq.id} className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border ${m.tint}`}>
                      <m.icon className="w-3 h-3" /> {eq.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1 pt-1">
            <ExternalLink className="w-3 h-3" /> This passport is a read-only view. Manage records directly in GC Compliance Manager and Asset Panda, then sync.
          </p>
        </div>
      </div>
    </div>
  );
}