import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Boxes, CheckCircle2, AlertTriangle, Package, FileStack, ChevronRight, Loader2, Info } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';

// Asset Recovery Step — shown during decommissioning so crew can scan
// individual asset barcodes or van manifest QR codes to log what they're
// bringing back to the yard. Integrates with Asset Panda via processAssetReturn.
export default function AssetRecoveryStep({ job, staffId, staffName, returnData, setReturnData }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [scanError, setScanError] = useState('');

  // Fetch assets assigned to this job
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['job-asset-assignments', job?.id],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ job_id: job?.id }),
    enabled: !!job?.id,
  });

  // Fetch all manifests for resolving scanned QR codes
  const { data: manifests = [] } = useQuery({
    queryKey: ['asset-manifests'],
    queryFn: () => base44.entities.AssetManifest.filter({ is_active: true }),
  });

  // Fetch site assets for name resolution
  const { data: siteAssets = [] } = useQuery({
    queryKey: ['site-assets-for-return'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const assetMap = useMemo(() => {
    const m = {};
    for (const a of siteAssets) m[a.id] = a;
    return m;
  }, [siteAssets]);

  const manifestMap = useMemo(() => {
    const m = {};
    for (const man of manifests) m[man.manifest_code] = man;
    return m;
  }, [manifests]);

  const assignmentAssetIds = useMemo(
    () => new Set(assignments.map(a => a.asset_id)),
    [assignments]
  );

  const returnedItems = returnData?.scannedItems || [];
  const returnedAssetIds = useMemo(
    () => new Set(returnedItems.map(i => i.asset_id)),
    [returnedItems]
  );

  const handleScan = (scannedValue) => {
    setScanError('');
    const val = scannedValue.trim();
    if (!val) return;

    // Check if it's a manifest QR code
    const manifest = manifestMap[val];
    if (manifest) {
      // Add all assets in this manifest
      const newItems = [...returnedItems];
      for (const assetId of (manifest.asset_ids || [])) {
        if (!returnedAssetIds.has(assetId) && !newItems.find(i => i.asset_id === assetId)) {
          const asset = assetMap[assetId];
          newItems.push({
            asset_id: assetId,
            asset_name: asset?.name || manifest.asset_names?.[manifest.asset_ids.indexOf(assetId)] || 'Unknown',
            scan_type: 'manifest',
            manifest_id: manifest.id,
            manifest_name: manifest.name,
          });
        }
      }
      setReturnData({
        ...returnData,
        scannedItems: newItems,
        scannedManifestIds: [...new Set([...(returnData?.scannedManifestIds || []), val])],
      });
      return;
    }

    // Try to match as an individual asset — by panda_asset_id or serial_number
    let matchedAsset = null;
    for (const a of siteAssets) {
      if (a.panda_asset_id === val || a.serial_number === val || a.id === val) {
        matchedAsset = a;
        break;
      }
    }

    if (matchedAsset) {
      if (returnedAssetIds.has(matchedAsset.id)) {
        setScanError('Already scanned');
        return;
      }
      setReturnData({
        ...returnData,
        scannedItems: [...returnedItems, {
          asset_id: matchedAsset.id,
          asset_name: matchedAsset.name,
          scan_type: 'individual',
        }],
        scannedAssetIds: [...new Set([...(returnData?.scannedAssetIds || []), matchedAsset.id])],
      });
    } else {
      // Unrecognised code — still add it as an unlisted item
      setReturnData({
        ...returnData,
        scannedItems: [...returnedItems, {
          asset_id: val,
          asset_name: `Unrecognised: ${val}`,
          scan_type: 'individual',
        }],
        scannedAssetIds: [...new Set([...(returnData?.scannedAssetIds || []), val])],
      });
      setScanError(`Code "${val}" not found in asset register — added as unlisted.`);
    }
  };

  const removeItem = (assetId) => {
    setReturnData({
      ...returnData,
      scannedItems: returnedItems.filter(i => i.asset_id !== assetId),
      scannedAssetIds: (returnData?.scannedAssetIds || []).filter(id => id !== assetId),
    });
  };

  // Assets assigned to this job that haven't been scanned yet
  const unscannedAssignments = assignments.filter(
    a => a.status !== 'returned' && !returnedAssetIds.has(a.asset_id)
  );

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-blue-900">Decommissioning — Asset Recovery</p>
          <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
            Scan each item you're bringing back to the yard. For bulky items (casing, rig tooling), scan the <strong>van manifest QR sheet</strong> instead of individual barcodes.
          </p>
        </div>
      </div>

      {/* Scanner */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
          <Boxes className="w-4 h-4 text-emerald-600" /> Scan assets or manifest QR
        </label>
        <BarcodeScanner onScan={handleScan} placeholder="Scan barcode or QR code…" />
        {scanError && (
          <div className="flex items-center gap-2 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">{scanError}</p>
          </div>
        )}
      </div>

      {/* Scanned items list */}
      {returnedItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">
              Returning ({returnedItems.length})
            </p>
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready to log
            </span>
          </div>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {returnedItems.map((item, i) => (
              <div key={i} className="px-3.5 py-3 flex items-center gap-3 bg-white">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  item.scan_type === 'manifest' ? 'bg-violet-100' : 'bg-emerald-100'
                }`}>
                  {item.scan_type === 'manifest'
                    ? <FileStack className="w-4 h-4 text-violet-600" />
                    : <Package className="w-4 h-4 text-emerald-600" />
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-slate-900 truncate">{item.asset_name}</p>
                  <p className="text-[11px] text-slate-400">
                    {item.scan_type === 'manifest'
                      ? `Via manifest: ${item.manifest_name || '—'}`
                      : 'Individual scan'
                    }
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.asset_id)}
                  className="text-xs text-slate-400 hover:text-red-500 font-medium px-2 py-1"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unscanned assigned assets warning */}
      {unscannedAssignments.length > 0 && assignmentsLoading === false && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-900">
              {unscannedAssignments.length} item{unscannedAssignments.length !== 1 ? 's' : ''} assigned to this job not yet scanned
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              If you're not bringing something back (left on site / hired), you can skip it — the yard manager will reconcile.
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {returnedItems.length === 0 && !assignmentsLoading && (
        <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
          <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500">No items scanned yet</p>
          <p className="text-xs text-slate-400 mt-1">Scan a barcode or manifest QR above to start logging returns.</p>
        </div>
      )}
    </div>
  );
}