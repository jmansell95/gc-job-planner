import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import FullScreenScanner from '@/components/assetcommand/FullScreenScanner';
import ScanResultPopup from '@/components/assetcommand/ScanResultPopup';
import PATTestForm from '@/components/pat/PATTestForm';
import ReportFaultModal from '@/components/assetcommand/ReportFaultModal';
import { playSuccess, playError } from '@/utils/scanFeedback';
import { useToast } from '@/components/ui/use-toast';

/**
 * GlobalScannerOverlay — full-screen camera scanner that can be opened
 * from anywhere via the GlobalScannerContext. Resolves barcodes against
 * SiteAsset inventory and shows context-aware action buttons:
 *
 * - All assets: View, Log Fault, Scan Next
 * - Portable appliances: + PAT Test, Log Repair
 *
 * In 'pat' mode (opened from the PAT Console), PAT Test / Log Repair /
 * Log Fault forms open as overlays on top of the live camera so the
 * tester can scan the next item immediately after saving.
 */
export default function GlobalScannerOverlay({ mode = 'global', onClose }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [pendingPanda, setPendingPanda] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [patAsset, setPatAsset] = useState(null);
  const [faultAsset, setFaultAsset] = useState(null);
  const [repairAsset, setRepairAsset] = useState(null);
  const lastScanRef = useRef({ value: '', ts: 0 });

  const handleScan = useCallback(async (val) => {
    const q = val.trim();
    if (!q) return;
    const now = Date.now();
    if (lastScanRef.current.value === q && now - lastScanRef.current.ts < 2000) return;
    lastScanRef.current = { value: q, ts: now };
    setResolving(true);
    setScanError('');
    try {
      const res = await base44.functions.invoke('resolveAssetByQR', { scan: q });
      const data = res.data || res;
      if (data.needs_confirm) {
        setResolving(false);
        setScanResult(null);
        setPendingPanda(data);
        return;
      }
      const found = data.asset;
      if (!found) {
        setResolving(false);
        playError();
        setScanError(val);
        setScanResult(null);
        return;
      }
      playSuccess();
      setScanError('');
      setScanResult(found);
      setPendingPanda(null);
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
    } catch (e) {
      playError();
      setScanError(val);
      setScanResult(null);
    }
    setResolving(false);
  }, [queryClient]);

  const handleScanNext = useCallback(() => {
    setScanResult(null);
    setScanError('');
    setPendingPanda(null);
  }, []);

  const handleViewAsset = useCallback((asset) => {
    onClose();
    navigate(`/assets/${asset.id}`);
  }, [navigate, onClose]);

  const handlePATTest = useCallback((asset) => {
    setPatAsset(asset);
  }, []);

  const handleLogFault = useCallback((asset) => {
    setFaultAsset(asset);
  }, []);

  const handleLogRepair = useCallback((asset) => {
    setRepairAsset(asset);
  }, []);

  const handleConfirmPanda = async () => {
    if (!pendingPanda) return;
    setConfirming(true);
    try {
      const res = await base44.functions.invoke('confirmPandaScanLink', {
        panda_id: pendingPanda.panda_id,
        group_id: pendingPanda.group_id,
        barcode: pendingPanda.barcode || '',
      });
      const created = res.data?.asset || res.asset;
      if (created) {
        queryClient.invalidateQueries({ queryKey: ['site-assets'] });
        setScanResult(created);
        setPendingPanda(null);
        toast({ title: 'Linked to Asset Panda', description: `${created.name} added to your inventory` });
      }
    } catch (e) {
      toast({ title: 'Could not link', description: e.message, variant: 'destructive' });
    }
    setConfirming(false);
  };

  // Build context-aware action buttons for the scan result popup
  const isPortableAppliance = scanResult?.asset_type === 'portable_appliance';
  const actions = [];
  if (isPortableAppliance) {
    actions.push({
      label: 'PAT Test',
      icon: 'Zap',
      onClick: handlePATTest,
      className: 'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:brightness-110 transition active:scale-95',
    });
    actions.push({
      label: 'Log Repair',
      icon: 'Wrench',
      onClick: handleLogRepair,
      className: 'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition active:scale-95',
    });
  }
  actions.push({
    label: 'Log Fault',
    icon: 'AlertTriangle',
    onClick: handleLogFault,
    className: 'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition active:scale-95',
  });

  return (
    <>
      <FullScreenScanner
        onScan={handleScan}
        onClose={onClose}
        resolving={resolving}
        scanResult={scanResult}
        scanError={scanError}
        pendingPanda={pendingPanda}
        confirming={confirming}
        onViewAsset={handleViewAsset}
        onScanNext={handleScanNext}
        onConfirmPanda={handleConfirmPanda}
        onCancelPanda={() => setPendingPanda(null)}
        extraActions={actions}
      />

      {/* PAT Test form overlay — sits on top of the live camera */}
      {patAsset && (
        <div className="fixed inset-0 z-[80] bg-white overflow-y-auto">
          <PATTestForm
            asset={patAsset}
            onClose={() => setPatAsset(null)}
            onSaved={() => {
              setPatAsset(null);
              handleScanNext();
              queryClient.invalidateQueries({ queryKey: ['site-assets'] });
              toast({ title: 'PAT test saved', description: patAsset.name });
            }}
          />
        </div>
      )}

      {/* Fault report overlay */}
      {faultAsset && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <ReportFaultModal
            asset={faultAsset}
            staffProfile={null}
            onClose={() => { setFaultAsset(null); handleScanNext(); }}
          />
        </div>
      )}

      {/* Repair log overlay — reuses ReportFaultModal with a repair-type note */}
      {repairAsset && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <RepairLogOverlay asset={repairAsset} onClose={() => { setRepairAsset(null); handleScanNext(); }} />
        </div>
      )}
    </>
  );
}

/**
 * RepairLogOverlay — quick repair log. Creates a ServiceRecord of type
 * 'repair' against the asset. Lighter than ReportFaultModal — just a
 * description and save button, overlaid on the scanner.
 */
function RepairLogOverlay({ asset, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!note.trim()) { toast({ title: 'Describe the repair', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await base44.entities.ServiceRecord.create({
        site_asset_id: asset.id,
        record_type: 'repair',
        date: new Date().toISOString().slice(0, 10),
        result: 'n/a',
        tested_by: 'Field Report',
        notes: `[Repair Log] ${note}`,
      });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['service-records'] });
      toast({ title: 'Repair logged', description: asset.name });
      onClose();
    } catch (e) {
      toast({ title: 'Error', description: 'Could not log repair.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-900">Log Repair</h3>
          <p className="text-xs text-slate-500">{asset.name}</p>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
          <span className="sr-only">Close</span> ✕
        </button>
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={4}
        placeholder="Describe the repair carried out..."
        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none mb-4"
      />
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Repair'}
        </button>
      </div>
    </div>
  );
}