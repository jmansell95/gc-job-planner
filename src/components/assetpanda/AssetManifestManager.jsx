import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, QrCode, Package, Search, X, FileStack, AlertTriangle, CheckCircle2, History, Clock, ArrowDownToLine } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Admin manager for Van Manifest QR codes — maps a single QR code to a list
// of SiteAsset IDs so crews can scan one sheet for bulky items (casing, rig
// tooling) instead of individual barcodes.
export default function AssetManifestManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingManifest, setEditingManifest] = useState(null);
  const [search, setSearch] = useState('');

  const { data: manifests = [], isLoading } = useQuery({
    queryKey: ['asset-manifests-admin'],
    queryFn: () => base44.entities.AssetManifest.list('-created_date', 200),
  });

  const { data: siteAssets = [] } = useQuery({
    queryKey: ['site-assets-manifest'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const { data: returnLogs = [] } = useQuery({
    queryKey: ['asset-return-logs'],
    queryFn: () => base44.entities.AssetReturnLog.list('-returned_at', 20),
  });

  const filtered = manifests.filter(m =>
    !search ||
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.manifest_code?.toLowerCase().includes(search.toLowerCase()) ||
    m.category?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (manifest) => {
    if (!confirm(`Delete manifest "${manifest.name}"? This won't affect assets already returned.`)) return;
    try {
      await base44.entities.AssetManifest.delete(manifest.id);
      queryClient.invalidateQueries({ queryKey: ['asset-manifests-admin'] });
      queryClient.invalidateQueries({ queryKey: ['asset-manifests'] });
      toast({ title: 'Manifest deleted' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (manifest) => {
    try {
      await base44.entities.AssetManifest.update(manifest.id, { is_active: !manifest.is_active });
      queryClient.invalidateQueries({ queryKey: ['asset-manifests-admin'] });
      queryClient.invalidateQueries({ queryKey: ['asset-manifests'] });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-600" /> Van Manifest QR Codes
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Create QR print-outs for bulky items (casing, rig tooling) that can't have individual barcodes. Crews scan one sheet to log all items in the bundle.
          </p>
        </div>
        <button
          onClick={() => { setEditingManifest(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" /> New Manifest
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, code or category…"
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
          <QrCode className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">No manifests yet</p>
          <p className="text-xs text-slate-400 mt-1">Create a manifest QR for each bulky-item bundle kept in the vans.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(m => (
            <div key={m.id} className={`rounded-xl border p-4 ${m.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileStack className="w-4 h-4 text-violet-600 flex-shrink-0" />
                    <p className="font-semibold text-sm text-slate-900 truncate">{m.name}</p>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mb-2">{m.manifest_code}</p>
                  {m.category && <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium mb-2">{m.category}</span>}
                  <p className="text-xs text-slate-500">
                    <Package className="w-3 h-3 inline mr-1" />
                    {(m.asset_ids || []).length} item{(m.asset_ids || []).length !== 1 ? 's' : ''}
                  </p>
                  {(m.asset_names || []).length > 0 && (
                    <p className="text-[11px] text-slate-400 mt-1 truncate">
                      {(m.asset_names || []).slice(0, 3).join(', ')}{m.asset_names.length > 3 ? ` +${m.asset_names.length - 3} more` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => { setEditingManifest(m); setShowForm(true); }}
                    className="text-xs text-slate-500 hover:text-emerald-600 font-medium px-2 py-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(m)}
                    className="text-xs text-slate-500 hover:text-amber-600 font-medium px-2 py-1"
                  >
                    {m.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(m)}
                    className="text-xs text-slate-500 hover:text-red-500 font-medium px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ManifestForm
          manifest={editingManifest}
          siteAssets={siteAssets}
          onClose={() => { setShowForm(false); setEditingManifest(null); }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['asset-manifests-admin'] });
            queryClient.invalidateQueries({ queryKey: ['asset-manifests'] });
            setShowForm(false);
            setEditingManifest(null);
          }}
        />
      )}

      {/* Recent Returns Log */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-slate-600" /> Recent Gear Returns
        </h3>
        {returnLogs.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
            <ArrowDownToLine className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No returns logged yet</p>
            <p className="text-xs text-slate-400 mt-1">Returns will appear here when crews scan gear during decommissioning.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {returnLogs.map(log => (
              <div key={log.id} className="px-4 py-3 bg-white flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {log.total_items || 0} item{log.total_items !== 1 ? 's' : ''} from {log.job_name || '—'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {log.staff_name || 'Unknown'} · {log.return_date}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  {log.synced_to_panda ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Synced
                    </span>
                  ) : log.sync_error ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> Failed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ManifestForm({ manifest, siteAssets, onClose, onSaved }) {
  const { toast } = useToast();
  const [name, setName] = useState(manifest?.name || '');
  const [manifestCode, setManifestCode] = useState(manifest?.manifest_code || '');
  const [category, setCategory] = useState(manifest?.category || '');
  const [selectedAssetIds, setSelectedAssetIds] = useState(manifest?.asset_ids || []);
  const [assetSearch, setAssetSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredAssets = siteAssets.filter(a =>
    !assetSearch ||
    a.name?.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.serial_number?.toLowerCase().includes(assetSearch.toLowerCase())
  );

  const toggleAsset = (id) => {
    setSelectedAssetIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!name.trim() || !manifestCode.trim()) {
      toast({ title: 'Name and QR code are required', variant: 'destructive' });
      return;
    }
    if (selectedAssetIds.length === 0) {
      toast({ title: 'Select at least one asset', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const selectedAssets = siteAssets.filter(a => selectedAssetIds.includes(a.id));
      const payload = {
        name: name.trim(),
        manifest_code: manifestCode.trim(),
        category: category.trim(),
        asset_ids: selectedAssetIds,
        asset_names: selectedAssets.map(a => a.name),
        panda_asset_ids: selectedAssets.map(a => a.panda_asset_id).filter(Boolean),
        is_active: manifest?.is_active !== false,
      };
      if (manifest?.id) {
        await base44.entities.AssetManifest.update(manifest.id, payload);
        toast({ title: 'Manifest updated' });
      } else {
        await base44.entities.AssetManifest.create(payload);
        toast({ title: 'Manifest created', description: 'Print the QR code and keep it in the van.' });
      }
      onSaved();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Generate a random QR code value
  const generateCode = () => {
    const code = 'GC-MANIFEST-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    setManifestCode(code);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">{manifest ? 'Edit Manifest' : 'New Van Manifest'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Manifest Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. 5x 125mm Casing Set"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">QR Code Value *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manifestCode}
                onChange={e => setManifestCode(e.target.value)}
                placeholder="The value encoded in the QR code"
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="button"
                onClick={generateCode}
                className="px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200"
              >
                Generate
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Use this value when printing the QR code for the van.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category (optional)</label>
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Casing, Tooling, Lifting Gear"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assets in this bundle ({selectedAssetIds.length})</label>
            <input
              type="text"
              value={assetSearch}
              onChange={e => setAssetSearch(e.target.value)}
              placeholder="Search assets…"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-2 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {filteredAssets.slice(0, 50).map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAsset(a.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${
                    selectedAssetIds.includes(a.id) ? 'bg-emerald-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                    selectedAssetIds.includes(a.id) ? 'bg-emerald-600' : 'bg-white border-2 border-slate-300'
                  }`}>
                    {selectedAssetIds.includes(a.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.name}</p>
                    <p className="text-[11px] text-slate-400">{a.serial_number || 'No serial'} · {a.asset_type}</p>
                  </div>
                </button>
              ))}
              {filteredAssets.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">No assets found.</p>
              )}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-4 flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : manifest ? 'Update' : 'Create Manifest'}
          </button>
        </div>
      </div>
    </div>
  );
}