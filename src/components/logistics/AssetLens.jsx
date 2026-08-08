import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, ScanLine, Loader2, RefreshCw, CheckCircle2, AlertTriangle,
  ShieldCheck, ShieldAlert, ShieldX, Cog, Wrench, Package, Truck, Anchor,
  Database, Link2, AlertCircle, Camera, FileText, QrCode, Wrench as WrenchIcon,
  Trash2, History, Layers, Scan,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';
import BarcodeScanner from '@/components/staff/BarcodeScanner';
import AssetPassportDrawer from '@/components/assetcommand/AssetPassportDrawer';
import AssetQRCard from '@/components/assetcommand/AssetQRCard';
import BookToVehicleModal from '@/components/assetcommand/BookToVehicleModal';
import ScrapModal from '@/components/assetcommand/ScrapModal';
import AssetMovementHistory from '@/components/assetcommand/AssetMovementHistory';
import BulkScanBasket from '@/components/logistics/BulkScanBasket';

const TYPE_META = {
  rig: { label: 'Rig', icon: Cog, tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  machinery: { label: 'Machinery', icon: Wrench, tint: 'bg-purple-50 text-purple-700 border-purple-200' },
  trailer: { label: 'Trailer', icon: Package, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  vehicle: { label: 'Vehicle', icon: Truck, tint: 'bg-slate-50 text-slate-700 border-slate-200' },
  lifting: { label: 'Lifting Gear', icon: Anchor, tint: 'bg-teal-50 text-teal-700 border-teal-200' },
  portable_appliance: { label: 'PAT', icon: WrenchIcon, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const COMPLIANCE_META = {
  compliant: { label: 'Compliant', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: ShieldCheck },
  expiring: { label: 'Expiring Soon', tone: 'text-amber-700 bg-amber-50 border-amber-200', Icon: ShieldAlert },
  expired: { label: 'Expired', tone: 'text-red-700 bg-red-50 border-red-200', Icon: ShieldX },
  unknown: { label: 'Unknown', tone: 'text-slate-600 bg-slate-50 border-slate-200', Icon: AlertCircle },
};

const SYNC_META = {
  synced: { label: 'Synced', tone: 'text-emerald-700' },
  pending: { label: 'Pending', tone: 'text-amber-700' },
  failed: { label: 'Failed', tone: 'text-red-700' },
  never: { label: 'Never synced', tone: 'text-slate-500' },
};

const SERVICE_TYPES = [
  { value: 'service', label: 'Service' },
  { value: 'repair', label: 'Repair' },
  { value: 'loler_inspection', label: 'LOLER Inspection' },
  { value: 'puwer_inspection', label: 'PUWER Inspection' },
  { value: 'pat_inspection', label: 'PAT Test' },
  { value: 'pre_use_check', label: 'Pre-use Check' },
];

export default function AssetLens({ open, onClose, assets: propAssets = [] }) {
  const queryClient = useQueryClient();
  const [bulkMode, setBulkMode] = useState(false);
  const [basket, setBasket] = useState([]);
  const [lastBulkScan, setLastBulkScan] = useState('');
  const [bulkScanError, setBulkScanError] = useState('');
  const [scannedValue, setScannedValue] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [passportAsset, setPassportAsset] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [showBookVehicle, setShowBookVehicle] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({ record_type: 'service', result: 'pass', notes: '' });
  const [savingService, setSavingService] = useState(false);
  const [showScrap, setShowScrap] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: config = null } = useQuery({
    queryKey: ['assetpanda-config'],
    queryFn: async () => { const list = await base44.entities.AssetPandaConfig.filter({ key: 'global' }); return list[0] || null; },
    enabled: open,
  });

  const { data: fetchedAssets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
    enabled: open && propAssets.length === 0,
  });
  const allAssets = propAssets.length > 0 ? propAssets : fetchedAssets;

  const match = useMemo(() => {
    const q = scannedValue.trim().toLowerCase();
    if (!q) return null;
    return allAssets.find((a) => {
      const sn = (a.serial_number || '').toLowerCase().trim();
      const pid = (a.panda_asset_id || '').toLowerCase().trim();
      const nm = (a.name || '').toLowerCase().trim();
      return sn === q || pid === q || nm === q || (sn && sn.includes(q)) || (pid && pid.includes(q));
    }) || null;
  }, [scannedValue, allAssets]);

  const handleScan = useCallback((val) => {
    if (bulkMode) {
      const q = val.trim().toLowerCase();
      if (!q) return;
      const found = allAssets.find((a) => {
        const sn = (a.serial_number || '').toLowerCase().trim();
        const pid = (a.panda_asset_id || '').toLowerCase().trim();
        const nm = (a.name || '').toLowerCase().trim();
        return sn === q || pid === q || nm === q || (sn && sn.includes(q)) || (pid && pid.includes(q));
      });
      if (!found) { setBulkScanError(val); setLastBulkScan(''); return; }
      setBulkScanError('');
      setLastBulkScan(found.name);
      setBasket((prev) => prev.find((a) => a.id === found.id) ? prev : [...prev, found]);
    } else {
      setScannedValue(val);
    }
  }, [bulkMode, allAssets]);

  const removeFromBasket = (id) => setBasket((prev) => prev.filter((a) => a.id !== id));
  const clearBasket = () => setBasket([]);

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null); setSyncError(null);
    try {
      const res = await base44.functions.invoke('syncAssetPanda', {});
      setSyncResult(res);
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['assetpanda-config'] });
    } catch (e) { setSyncError(e?.message || 'Sync failed'); }
    finally { setSyncing(false); }
  };

  const handleSaveService = async () => {
    if (!match) return;
    setSavingService(true);
    try {
      await base44.entities.ServiceRecord.create({
        site_asset_id: match.id,
        record_type: serviceForm.record_type,
        date: new Date().toISOString().slice(0, 10),
        result: serviceForm.result,
        notes: serviceForm.notes,
      });
      if (serviceForm.record_type === 'repair' || serviceForm.result === 'fail') {
        await base44.entities.SiteAsset.update(match.id, {
          maintenance_status: serviceForm.result === 'fail' ? 'overdue' : 'due_soon',
          repair_notes: serviceForm.notes,
          service_notes: serviceForm.notes,
        });
      } else {
        await base44.entities.SiteAsset.update(match.id, {
          last_service_date: new Date().toISOString().slice(0, 10),
          service_notes: serviceForm.notes,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['service-records'] });
      setShowServiceForm(false);
      setServiceForm({ record_type: 'service', result: 'pass', notes: '' });
    } catch (e) { console.error('Service save error:', e); }
    setSavingService(false);
  };

  if (!open) return null;

  const typeMeta = match ? TYPE_META[match.asset_type] || TYPE_META.machinery : null;
  const compMeta = match ? COMPLIANCE_META[match.compliance_status] || COMPLIANCE_META.unknown : null;
  const syncMeta = match ? SYNC_META[match.sync_status] || SYNC_META.never : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 pt-0 sm:pt-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[100vh] sm:max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <ScanLine className="w-4.5 h-4.5 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Asset Lens</h3>
              <p className="text-[11px] text-slate-400">{bulkMode ? 'Scan items into the basket' : 'Scan to view, service, book or print'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition active:scale-90">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="px-4 sm:px-5 pt-4">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => { setBulkMode(false); setBulkScanError(''); setLastBulkScan(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition ${!bulkMode ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
            >
              <Scan className="w-4 h-4" /> Single
            </button>
            <button
              onClick={() => { setBulkMode(true); setScannedValue(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition ${bulkMode ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
            >
              <Layers className="w-4 h-4" /> Bulk {basket.length > 0 && <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold">{basket.length}</span>}
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Instructions */}
          {!bulkMode && (
            <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
              <Camera className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-800">
                <strong>How to scan:</strong> Tap <strong>Camera</strong> below, allow camera access, then point at the Asset Panda QR label on the asset. Center the code in the frame. Or use <strong>Manual</strong> to type the serial number.
              </p>
            </div>
          )}
          {bulkMode && (
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5">
              <Layers className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                <strong>Bulk mode:</strong> Scan each asset — they collect in the basket below. When ready, book them all onto a vehicle in one go.
              </p>
            </div>
          )}

          {/* Scanner */}
          <BarcodeScanner onScan={handleScan} placeholder="Scan or type serial / Asset Panda ID…" autoFocus={false} />

          {/* Config warning */}
          {!config?.group_id && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Asset Panda isn't configured. Add your API token + group ID in Settings → Asset Panda Sync Data.</span>
            </div>
          )}

          {/* === BULK MODE === */}
          {bulkMode && (
            <div className="space-y-3">
              {/* Last scan feedback */}
              {lastBulkScan && !bulkScanError && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 animate-pop-in">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-800 font-semibold truncate">Added: {lastBulkScan}</p>
                </div>
              )}
              {bulkScanError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  <AlertCircle className="w-4.5 h-4.5 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-700 font-medium flex-1 truncate">No match for "{bulkScanError}"</p>
                  <button onClick={() => setBulkScanError('')} className="p-1 text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              {/* Basket */}
              {basket.length > 0 ? (
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <BulkScanBasket items={basket} onRemove={removeFromBasket} onClear={clearBasket} />
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Basket is empty — scan an item to start</p>
                </div>
              )}

              {/* Bulk book button */}
              {basket.length > 0 && (
                <button
                  onClick={() => setShowBookVehicle(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-700 text-white rounded-xl font-bold text-sm hover:bg-emerald-800 transition shadow-sm active:scale-95"
                >
                  <Truck className="w-5 h-5" /> Book {basket.length} to Vehicle
                </button>
              )}
            </div>
          )}

          {/* === SINGLE MODE === */}
          {!bulkMode && (
            <>
              {/* No match */}
              {scannedValue.trim() && !match && (
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-6 justify-center">
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                  No asset matches "{scannedValue}".
                </div>
              )}

              {/* Match found — Action Panel */}
              {match && typeMeta && (
                <div className="space-y-3">
                  {/* Asset identity */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3.5 flex items-center gap-3 border-b border-slate-100">
                      <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${typeMeta.tint}`}>
                        <typeMeta.icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{match.name}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono">{match.serial_number || '—'}</span>
                          {match.rig_type && match.rig_type !== 'n/a' && <span className="text-[10px] uppercase font-semibold text-slate-500">{match.rig_type}</span>}
                          {!match.is_active && <span className="text-[10px] uppercase font-bold text-red-600">Inactive</span>}
                        </p>
                      </div>
                    </div>

                    {/* Status badges */}
                    <div className="grid grid-cols-2 divide-x divide-slate-100">
                      <div className="px-4 py-2.5">
                        <p className="text-[10px] uppercase font-medium text-slate-400 mb-1">Compliance</p>
                        <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border ${compMeta.tone}`}>
                          <compMeta.Icon className="w-3.5 h-3.5" /> {compMeta.label}
                        </div>
                      </div>
                      <div className="px-4 py-2.5">
                        <p className="text-[10px] uppercase font-medium text-slate-400 mb-1">Stock</p>
                        <span className="text-xs font-semibold text-slate-700">{(match.stock_level || 'unknown').replace(/_/g, ' ')}</span>
                      </div>
                    </div>

                    {/* Sync provenance */}
                    <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 flex items-center gap-1.5"><Link2 className="w-3 h-3" /> Asset Panda</span>
                      <span className={`font-medium ${syncMeta.tone}`}>{syncMeta.label}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPassportAsset(match)}
                      className="flex flex-col items-center gap-1.5 p-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition active:scale-95">
                      <FileText className="w-5 h-5" />
                      <span className="text-xs font-semibold">View Passport</span>
                      <span className="text-[10px] text-white/60">Full details & history</span>
                    </button>
                    <button onClick={() => setShowHistory(s => !s)}
                      className="flex flex-col items-center gap-1.5 p-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition active:scale-95">
                      <History className="w-5 h-5" />
                      <span className="text-xs font-semibold">Movement History</span>
                      <span className="text-[10px] text-white/70">Who booked in/out</span>
                    </button>
                    <button onClick={() => setShowServiceForm(s => !s)}
                      className="flex flex-col items-center gap-1.5 p-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition active:scale-95">
                      <Wrench className="w-5 h-5" />
                      <span className="text-xs font-semibold">Log Service / Repair</span>
                      <span className="text-[10px] text-white/70">Record maintenance</span>
                    </button>
                    <button onClick={() => setShowBookVehicle(true)}
                      className="flex flex-col items-center gap-1.5 p-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl transition active:scale-95">
                      <Truck className="w-5 h-5" />
                      <span className="text-xs font-semibold">Book to Vehicle</span>
                      <span className="text-[10px] text-white/70">Load & notify driver</span>
                    </button>
                    <button onClick={() => setShowScrap(true)}
                      className="flex flex-col items-center gap-1.5 p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition active:scale-95">
                      <Trash2 className="w-5 h-5" />
                      <span className="text-xs font-semibold">Scrap</span>
                      <span className="text-[10px] text-white/70">Send to scrap pile</span>
                    </button>
                    <button onClick={() => setShowQR(true)}
                      className="flex flex-col items-center gap-1.5 p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition active:scale-95">
                      <QrCode className="w-5 h-5" />
                      <span className="text-xs font-semibold">Print QR Label</span>
                      <span className="text-[10px] text-slate-500">Generate label</span>
                    </button>
                  </div>

                  {/* Movement History */}
                  {showHistory && <AssetMovementHistory asset={match} />}

                  {/* Inline service form */}
                  {showServiceForm && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">Quick Service / Repair Log</p>
                        <button onClick={() => setShowServiceForm(false)} className="p-1.5 text-slate-400 hover:bg-white rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Type</label>
                          <select value={serviceForm.record_type} onChange={e => setServiceForm(p => ({ ...p, record_type: e.target.value }))}
                            className="w-full px-2.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                            {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Result</label>
                          <select value={serviceForm.result} onChange={e => setServiceForm(p => ({ ...p, result: e.target.value }))}
                            className="w-full px-2.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                            <option value="pass">Pass</option>
                            <option value="fail">Fail</option>
                            <option value="advisory">Advisory</option>
                            <option value="n/a">N/A</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Notes</label>
                        <textarea value={serviceForm.notes} onChange={e => setServiceForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                          placeholder="Findings, defects, parts replaced…" className="w-full px-2.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
                      </div>
                      <button onClick={handleSaveService} disabled={savingService}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition disabled:opacity-60 active:scale-95">
                        {savingService ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />} {savingService ? 'Saving…' : 'Save Service Record'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Sync action */}
          <div className="pt-1 border-t border-slate-100">
            <button onClick={handleSync} disabled={syncing || !config?.group_id}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm active:scale-95">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? 'Syncing from Asset Panda…' : 'Refresh all from Asset Panda'}
            </button>
            {syncError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {syncError}</p>}
            {syncResult && <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> {syncResult.summary || 'Sync complete'}</p>}
            <p className="text-[10px] text-slate-400 mt-2 text-center flex items-center justify-center gap-1">
              <Database className="w-3 h-3" /> {allAssets.length} assets in cache · last sync {config?.last_sync_at ? safeFormat(config.last_sync_at, 'dd MMM HH:mm') : 'never'}
            </p>
          </div>
        </div>
      </div>

      {/* Overlays */}
      {passportAsset && (
        <AssetPassportDrawer asset={passportAsset} allAssets={allAssets} onClose={() => setPassportAsset(null)} />
      )}
      {showQR && match && (
        <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowQR(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">QR Label</h3>
              <button onClick={() => setShowQR(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-5"><AssetQRCard asset={match} /></div>
          </div>
        </div>
      )}
      {showBookVehicle && (bulkMode
        ? <BookToVehicleModal assets={basket} onClose={() => setShowBookVehicle(false)} onSuccess={clearBasket} />
        : match && <BookToVehicleModal asset={match} onClose={() => setShowBookVehicle(false)} />
      )}
      {showScrap && match && (
        <ScrapModal asset={match} onClose={() => setShowScrap(false)} />
      )}
    </div>
  );
}