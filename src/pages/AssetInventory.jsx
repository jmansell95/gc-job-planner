import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Boxes, Search, RefreshCw, QrCode, Printer, X, Filter, MapPin,
  Package, AlertTriangle, CheckCircle2, Clock, Database, Wrench,
  ShieldCheck, ShieldAlert, ShieldX, Loader2, Download, LayoutGrid, List,
  HardHat, Truck, Car, Zap, Anchor, Plug,
} from 'lucide-react';
import AssetQRCard from '@/components/assetcommand/AssetQRCard';
import { useToast } from '@/components/ui/use-toast';
import { differenceInDays } from 'date-fns';

const ASSET_TYPE_META = {
  rig: { label: 'Rig', icon: HardHat, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  machinery: { label: 'Machinery', icon: Wrench, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  trailer: { label: 'Trailer', icon: Truck, color: 'bg-slate-100 text-slate-700 border-slate-200' },
  vehicle: { label: 'Vehicle', icon: Car, color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  lifting: { label: 'Lifting Gear', icon: Anchor, color: 'bg-violet-100 text-violet-700 border-violet-200' },
  portable_appliance: { label: 'Portable Appliance', icon: Zap, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const STOCK_META = {
  in_stock: { label: 'In Stock', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  low_stock: { label: 'Low Stock', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  out_of_stock: { label: 'Out of Stock', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  needs_service: { label: 'Needs Service', cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  unknown: { label: 'Unknown', cls: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
};

const SYNC_META = {
  synced: { label: 'Synced', icon: CheckCircle2, cls: 'text-emerald-600' },
  pending: { label: 'Pending', icon: Clock, cls: 'text-amber-600' },
  failed: { label: 'Failed', icon: AlertTriangle, cls: 'text-red-600' },
  never: { label: 'Never', icon: AlertTriangle, cls: 'text-slate-400' },
};

const COMPLIANCE_META = {
  compliant: { label: 'Compliant', icon: ShieldCheck, cls: 'text-emerald-600 bg-emerald-50' },
  expiring: { label: 'Expiring', icon: ShieldAlert, cls: 'text-amber-600 bg-amber-50' },
  expired: { label: 'Expired', icon: ShieldX, cls: 'text-red-600 bg-red-50' },
  unknown: { label: 'Unknown', icon: ShieldX, cls: 'text-slate-400 bg-slate-50' },
};

function StatTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tone}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase text-slate-400 font-semibold">{label}</p>
        <p className="text-xl font-bold text-slate-800 tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
}

function AssetCard({ asset, onClick, selected, onToggleSelect }) {
  const typeMeta = ASSET_TYPE_META[asset.asset_type] || ASSET_TYPE_META.machinery;
  const TypeIcon = typeMeta.icon;
  const stockMeta = STOCK_META[asset.stock_level || 'unknown'] || STOCK_META.unknown;
  const syncMeta = SYNC_META[asset.sync_status || 'never'] || SYNC_META.never;
  const SyncIcon = syncMeta.icon;
  const compMeta = COMPLIANCE_META[asset.compliance_status || 'unknown'] || COMPLIANCE_META.unknown;
  const CompIcon = compMeta.icon;

  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-xl border-2 ${selected ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'} shadow-sm hover:shadow-md transition cursor-pointer p-3.5`}
    >
      {/* Selection checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-md flex items-center justify-center transition ${
          selected ? 'bg-emerald-600' : 'bg-white border-2 border-slate-300 hover:border-emerald-400'
        }`}
      >
        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
      </button>

      <div className="flex items-start gap-2.5 mb-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${typeMeta.color}`}>
          <TypeIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <p className="text-sm font-bold text-slate-800 truncate">{asset.name}</p>
          <p className="text-[11px] text-slate-400 truncate">{asset.serial_number || 'No serial'}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${stockMeta.cls}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${stockMeta.dot} mr-1`} />
          {stockMeta.label}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${compMeta.cls} flex items-center gap-1`}>
          <CompIcon className="w-2.5 h-2.5" /> {compMeta.label}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1 truncate">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{asset.storage_location || 'No location'}</span>
        </span>
        <span className={`flex items-center gap-0.5 ${syncMeta.cls} flex-shrink-0`}>
          <SyncIcon className="w-3 h-3" /> {syncMeta.label}
        </span>
      </div>

      {asset.panda_asset_id && (
        <p className="text-[9px] text-slate-300 font-mono mt-1.5 truncate">Panda ID: {asset.panda_asset_id}</p>
      )}
    </div>
  );
}

function AssetDetailDrawer({ asset, onClose }) {
  if (!asset) return null;
  const typeMeta = ASSET_TYPE_META[asset.asset_type] || ASSET_TYPE_META.machinery;
  const TypeIcon = typeMeta.icon;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="hero-gradient text-white px-5 py-4 sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center flex-shrink-0">
                <TypeIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-base truncate">{asset.name}</p>
                <p className="text-xs text-white/80 truncate">{typeMeta.label}{asset.serial_number ? ` · ${asset.serial_number}` : ''}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-lg transition flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* QR Code */}
          <AssetQRCard asset={asset} />

          {/* Stock & compliance */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Stock Level</p>
              <p className="text-sm font-bold text-slate-700">{(STOCK_META[asset.stock_level] || STOCK_META.unknown).label}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Compliance</p>
              <p className="text-sm font-bold text-slate-700">{(COMPLIANCE_META[asset.compliance_status] || COMPLIANCE_META.unknown).label}</p>
            </div>
          </div>

          {/* Full details */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase">Asset Details</h3>
            </div>
            <div className="divide-y divide-slate-50">
              <DetailRow label="Equipment Type" value={asset.equipment_type} />
              <DetailRow label="Category" value={asset.compliance_category} />
              <DetailRow label="Rig Type" value={asset.rig_type && asset.rig_type !== 'n/a' ? asset.rig_type.toUpperCase() : null} />
              <DetailRow label="Colour" value={asset.colour} />
              <DetailRow label="Storage Location" value={asset.storage_location} />
              <DetailRow label="Responsible Person" value={asset.responsible_person} />
              <DetailRow label="Tooling Notes" value={asset.tooling_notes} />
              <DetailRow label="Service Notes" value={asset.service_notes} />
              <DetailRow label="Repair Notes" value={asset.repair_notes} />
            </div>
          </div>

          {/* Compliance & maintenance */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase">Compliance & Maintenance</h3>
            </div>
            <div className="divide-y divide-slate-50">
              <DetailRow label="Compliance Expiry" value={asset.compliance_expiry_date} />
              <DetailRow label="Last Service" value={asset.last_service_date} />
              <DetailRow label="Next Service" value={asset.next_service_date} />
              <DetailRow label="Maintenance Status" value={asset.maintenance_status} />
              <DetailRow label="Operating Hours" value={asset.operating_hours != null ? `${asset.operating_hours}h` : null} />
              <DetailRow label="Hours Since Service" value={asset.hours_since_last_service != null ? `${asset.hours_since_last_service}h` : null} />
              <DetailRow label="Service Interval" value={asset.service_interval_hours != null ? `${asset.service_interval_hours}h` : null} />
            </div>
          </div>

          {/* Asset Panda sync */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-violet-600" />
              <h3 className="text-xs font-bold text-slate-700 uppercase">Asset Panda Sync</h3>
            </div>
            <div className="divide-y divide-slate-50">
              <DetailRow label="Panda Asset ID" value={asset.panda_asset_id} mono />
              <DetailRow label="Sync Status" value={(SYNC_META[asset.sync_status] || SYNC_META.never).label} />
              <DetailRow label="Last Sync" value={asset.last_sync_timestamp ? new Date(asset.last_sync_timestamp).toLocaleString('en-GB') : null} />
              <DetailRow label="Active" value={asset.is_active === false ? 'No (deactivated)' : 'Yes'} />
            </div>
          </div>

          {asset.notes && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
              <p className="text-[10px] uppercase text-amber-600 font-semibold mb-1">Notes</p>
              <p className="text-xs text-amber-800 whitespace-pre-wrap">{asset.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  const hasValue = value != null && value !== '';
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
      <span className="text-xs text-slate-400 font-medium flex-shrink-0">{label}</span>
      <span className={`text-xs text-right ${hasValue ? 'text-slate-700 font-semibold' : 'text-slate-300 italic'} ${mono ? 'font-mono' : ''}`}>
        {hasValue ? value : '—'}
      </span>
    </div>
  );
}

export default function AssetInventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [syncFilter, setSyncFilter] = useState('all');
  const [view, setView] = useState('grid');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets-inventory'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const locations = useMemo(() => {
    const set = new Set();
    assets.forEach(a => { if (a.storage_location) set.add(a.storage_location); });
    return Array.from(set).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (search) {
        const q = search.toLowerCase();
        const match = a.name?.toLowerCase().includes(q) ||
          a.serial_number?.toLowerCase().includes(q) ||
          a.equipment_type?.toLowerCase().includes(q) ||
          a.panda_asset_id?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (typeFilter !== 'all' && a.asset_type !== typeFilter) return false;
      if (stockFilter !== 'all' && (a.stock_level || 'unknown') !== stockFilter) return false;
      if (locationFilter !== 'all' && a.storage_location !== locationFilter) return false;
      if (syncFilter !== 'all' && (a.sync_status || 'never') !== syncFilter) return false;
      return true;
    });
  }, [assets, search, typeFilter, stockFilter, locationFilter, syncFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const pandaLinked = assets.filter(a => a.panda_asset_id);
    return {
      total: assets.length,
      pandaLinked: pandaLinked.length,
      inStock: assets.filter(a => a.stock_level === 'in_stock').length,
      issues: assets.filter(a => a.stock_level === 'out_of_stock' || a.stock_level === 'needs_service').length,
      compliant: assets.filter(a => a.compliance_status === 'compliant').length,
      expiringSoon: assets.filter(a => {
        if (!a.compliance_expiry_date) return false;
        const d = differenceInDays(new Date(a.compliance_expiry_date + 'T00:00:00'), new Date());
        return d >= 0 && d <= 30;
      }).length,
    };
  }, [assets]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncAssetPanda', { action: 'sync' });
      const d = res.data || res;
      if (d.ok !== false) {
        toast({ title: 'Asset Panda sync complete', description: d.message || d.summary || `${d.synced || 0} assets updated` });
        queryClient.invalidateQueries({ queryKey: ['site-assets-inventory'] });
      } else {
        toast({ title: 'Sync failed', description: d.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Sync failed', description: e.message, variant: 'destructive' });
    }
    setSyncing(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    setSelectedIds(filtered.map(a => a.id));
  };

  const clearSelection = () => setSelectedIds([]);

  const printBulkQR = () => {
    const selected = assets.filter(a => selectedIds.includes(a.id));
    if (selected.length === 0) return;
    const w = window.open('', '_blank', 'width=800,height=600');
    const cards = selected.map(a => {
      const summary = [
        `ASSET: ${a.name}`,
        `TYPE: ${(a.asset_type || '').toUpperCase()}`,
        a.serial_number ? `SERIAL: ${a.serial_number}` : '',
        `STATUS: ${(a.compliance_status || 'unknown').toUpperCase()}`,
      ].filter(Boolean).join('\n');
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=6&data=${encodeURIComponent(summary)}`;
      return `<div class="card"><h3>${a.name}</h3><div class="meta">${(a.asset_type || '').toUpperCase()}${a.serial_number ? ' · ' + a.serial_number : ''}</div><img src="${qrSrc}" /><div class="loc">${a.storage_location || ''}</div></div>`;
    }).join('');
    w.document.write(`
      <html><head><title>Asset QR Labels — Bulk Print</title>
      <style>
        body { font-family: Inter, sans-serif; margin: 0; padding: 20px; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .card { border: 2px solid #2E5A1A; border-radius: 10px; padding: 12px; text-align: center; page-break-inside: avoid; }
        h3 { margin: 0 0 2px; font-size: 13px; color: #1c4a12; }
        .meta { font-size: 10px; color: #475569; margin-bottom: 6px; }
        .loc { font-size: 10px; color: #94a3b8; margin-top: 4px; }
        img { width: 150px; height: 150px; }
        @media print { body { padding: 10px; } .grid { grid-template-columns: repeat(3, 1fr); } }
      </style></head>
      <body><div class="grid">${cards}</div></body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 800);
  };

  const exportCSV = () => {
    const rows = [['Name', 'Type', 'Serial', 'Stock Level', 'Compliance', 'Location', 'Panda ID', 'Sync Status']];
    filtered.forEach(a => {
      rows.push([
        a.name || '', a.asset_type || '', a.serial_number || '',
        a.stock_level || '', a.compliance_status || '',
        a.storage_location || '', a.panda_asset_id || '', a.sync_status || '',
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `asset-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-violet-600" /> Asset Panda Inventory
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Full inventory console — view all assets synced from Asset Panda, generate QR codes, and track stock levels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 disabled:opacity-50 transition">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync Asset Panda
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <StatTile icon={Boxes} label="Total Assets" value={stats.total} tone="bg-slate-100 text-slate-600" />
        <StatTile icon={Database} label="Panda Linked" value={stats.pandaLinked} tone="bg-violet-100 text-violet-600" />
        <StatTile icon={Package} label="In Stock" value={stats.inStock} tone="bg-emerald-100 text-emerald-600" />
        <StatTile icon={AlertTriangle} label="Stock Issues" value={stats.issues} tone="bg-red-100 text-red-600" />
        <StatTile icon={ShieldCheck} label="Compliant" value={stats.compliant} tone="bg-blue-100 text-blue-600" />
        <StatTile icon={ShieldAlert} label="Expiring ≤30d" value={stats.expiringSoon} tone="bg-amber-100 text-amber-600" />
      </div>

      {/* Search + filters bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, serial, Panda ID…"
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <button onClick={() => setShowFilters(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
              showFilters ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}>
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition ${view === 'grid' ? 'bg-white shadow-sm text-violet-600' : 'text-slate-400'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition ${view === 'list' ? 'bg-white shadow-sm text-violet-600' : 'text-slate-400'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-violet-500">
              <option value="all">All Types</option>
              {Object.entries(ASSET_TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
            <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-violet-500">
              <option value="all">All Stock Levels</option>
              {Object.entries(STOCK_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
            <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-violet-500">
              <option value="all">All Locations</option>
              {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={syncFilter} onChange={e => setSyncFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-violet-500">
              <option value="all">All Sync Status</option>
              {Object.entries(SYNC_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-20 bg-violet-600 text-white rounded-xl shadow-lg px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-semibold">{selectedIds.length} asset{selectedIds.length > 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={printBulkQR}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold transition">
              <Printer className="w-3.5 h-3.5" /> Print QR Labels
            </button>
            <button onClick={selectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition">
              Select All ({filtered.length})
            </button>
            <button onClick={clearSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>
      )}

      {/* Asset grid / list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
          <span className="ml-2 text-sm text-slate-500">Loading inventory…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-slate-200">
          <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">No assets found</p>
          <p className="text-xs text-slate-400 mt-1">
            {assets.length === 0 ? 'Sync from Asset Panda to populate your inventory.' : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(a => (
            <AssetCard
              key={a.id}
              asset={a}
              onClick={() => setSelectedAsset(a)}
              selected={selectedIds.includes(a.id)}
              onToggleSelect={() => toggleSelect(a.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 text-[10px] uppercase text-slate-400 font-semibold">
                    <button onClick={selectedIds.length === filtered.length ? clearSelection : selectAll}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedIds.length === filtered.length ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                      {selectedIds.length === filtered.length && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase text-slate-400 font-semibold">Name</th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase text-slate-400 font-semibold">Type</th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase text-slate-400 font-semibold">Serial</th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase text-slate-400 font-semibold">Stock</th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase text-slate-400 font-semibold">Compliance</th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase text-slate-400 font-semibold">Location</th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase text-slate-400 font-semibold">Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(a => {
                  const stockMeta = STOCK_META[a.stock_level || 'unknown'] || STOCK_META.unknown;
                  const compMeta = COMPLIANCE_META[a.compliance_status || 'unknown'] || COMPLIANCE_META.unknown;
                  const syncMeta = SYNC_META[a.sync_status || 'never'] || SYNC_META.never;
                  return (
                    <tr key={a.id} onClick={() => setSelectedAsset(a)} className="hover:bg-slate-50 cursor-pointer">
                      <td className="px-3 py-2.5" onClick={e => { e.stopPropagation(); toggleSelect(a.id); }}>
                        <button className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedIds.includes(a.id) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                          {selectedIds.includes(a.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800 truncate max-w-[200px]">{a.name}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs">{(ASSET_TYPE_META[a.asset_type] || {}).label || a.asset_type}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs font-mono">{a.serial_number || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${stockMeta.cls}`}>{stockMeta.label}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${compMeta.cls}`}>{compMeta.label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs truncate max-w-[120px]">{a.storage_location || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-semibold ${syncMeta.cls}`}>{syncMeta.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      <AssetDetailDrawer asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
    </div>
  );
}