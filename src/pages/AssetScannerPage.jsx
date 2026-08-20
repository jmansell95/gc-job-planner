import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine, X, Package, Truck, Trash2, CheckCircle2,
  AlertCircle, Lock, Unlock, ArrowLeft, Layers, Store, PackageOpen,
  Search, Wrench, ChevronRight, ShieldCheck, Undo2,
} from 'lucide-react';
import BarcodeScanner from '@/components/staff/BarcodeScanner';
import UnifiedScanBasket from '@/components/assetcommand/UnifiedScanBasket';
import ScanResultCard from '@/components/assetcommand/ScanResultCard';
import PandaScanConfirmCard from '@/components/assetcommand/PandaScanConfirmCard';
import AssetCommandDrawer from '@/components/assetcommand/AssetCommandDrawer';
import DriveAwayModal from '@/components/assetcommand/DriveAwayModal';
import ReportFaultModal from '@/components/assetcommand/ReportFaultModal';
import BookToVehicleModal from '@/components/assetcommand/BookToVehicleModal';
import FieldHubTabs from '@/components/fieldhub/FieldHubTabs';
import MyGearTab from '@/components/fieldhub/MyGearTab';
import MyTodayTab from '@/components/fieldhub/MyTodayTab';
import GoodsInDeliveryNote from '@/components/assetcommand/GoodsInDeliveryNote';
import SiteCollectMode from '@/components/logistics/SiteCollectMode';
import SiteCollectionScanner from '@/components/logistics/SiteCollectionScanner';
import { enableKioskScannerMode, disableKioskScannerMode, isKioskScannerMode } from '@/utils/kioskMode';
import { playSuccess, playError, playConfirm } from '@/utils/scanFeedback';
import { useToast } from '@/components/ui/use-toast';

const TYPE_ICONS = { rig: Wrench, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Package, portable_appliance: Wrench };

/**
 * Asset Scanner — full-screen, kiosk-style page optimised for tablets.
 * Unified basket handles both Sign Out (to job) and Return (to yard).
 * Goods-In mode uses a delivery-note-driven flow for consumables.
 */
export default function AssetScannerPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [basket, setBasket] = useState([]);
  const [direction, setDirection] = useState('signout'); // 'signout' | 'return'
  const [lastScan, setLastScan] = useState('');
  const [scanError, setScanError] = useState('');
  const [showBook, setShowBook] = useState(false);
  const [kioskLocked, setKioskLocked] = useState(isKioskScannerMode());
  const [mode, setMode] = useState('assets'); // 'assets' | 'goods-in' | 'site-collect'
  const [scanDelivery, setScanDelivery] = useState(null);
  const [staffProfile, setStaffProfile] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [commandAsset, setCommandAsset] = useState(null);
  const [driveAwayAsset, setDriveAwayAsset] = useState(null);
  const [faultAsset, setFaultAsset] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [hubTab, setHubTab] = useState('scan');
  const [pendingPanda, setPendingPanda] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    base44.functions.invoke('getMyStaffProfile').then(res => setStaffProfile(res.data)).catch(() => {});
  }, []);

  const isHubAdmin = staffProfile?.is_admin || staffProfile?.system_role === 'super_admin';

  const { data: assets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const { data: myAssignments = [] } = useQuery({
    queryKey: ['my-today-assignments', staffProfile?.id],
    queryFn: () => base44.entities.RotaAssignment.filter({ staff_id: staffProfile.id, assigned_date: new Date().toISOString().slice(0, 10) }),
    enabled: !!staffProfile?.id,
  });

  // Jobs the staff member is working on today (for sign-out)
  const todaysJobs = useMemo(() => {
    const activeJobIds = myAssignments
      .filter(a => (a.status || 'assigned') !== 'completed' && a.job_id)
      .map(a => a.job_id);
    const uniqueIds = [...new Set(activeJobIds)];
    return uniqueIds.map(id => jobs.find(j => j.id === id)).filter(Boolean);
  }, [myAssignments, jobs]);

  // Jobs with outstanding asset assignments (for return)
  const { data: outstandingAssignments = [] } = useQuery({
    queryKey: ['outstanding-asset-assignments', staffProfile?.id],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ status: { $in: ['assigned', 'on_site'] } }),
    enabled: !!staffProfile?.id && direction === 'return',
  });

  const returnJobs = useMemo(() => {
    const jobIds = [...new Set(outstandingAssignments.map(a => a.job_id).filter(Boolean))];
    return jobIds.map(id => jobs.find(j => j.id === id)).filter(Boolean);
  }, [outstandingAssignments, jobs]);

  const availableJobs = direction === 'signout' ? todaysJobs : returnJobs;

  // Real-time search
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return assets
      .filter(a => {
        const name = (a.name || '').toLowerCase();
        const serial = (a.serial_number || '').toLowerCase();
        const equip = (a.equipment_type || '').toLowerCase();
        const cat = (a.compliance_category || '').toLowerCase();
        const panda = (a.panda_asset_id || '').toLowerCase();
        return name.includes(q) || serial.includes(q) || equip.includes(q) || cat.includes(q) || panda.includes(q);
      })
      .slice(0, 12);
  }, [assets, searchQuery]);

  const quickStats = useMemo(() => {
    const active = assets.filter(a => a.is_active !== false);
    const compliant = active.filter(a => a.compliance_status === 'compliant').length;
    const issues = active.filter(a => a.compliance_status === 'expired' || a.compliance_status === 'expiring').length;
    const rigs = active.filter(a => a.asset_type === 'rig').length;
    return { total: active.length, compliant, issues, rigs };
  }, [assets]);

  const [resolving, setResolving] = useState(false);

  const handleScan = useCallback(async (val) => {
    const q = val.trim();
    if (!q) return;
    setResolving(true);
    setScanError('');
    try {
      const res = await base44.functions.invoke('resolveAssetByQR', { scan: q });
      const data = res.data || res;
      if (data.needs_confirm) {
        setResolving(false);
        setScanError('');
        setLastScan(data.name || val);
        setScanResult(null);
        setPendingPanda(data);
        setSearchQuery('');
        setShowSearch(false);
        return;
      }
      const found = data.asset;
      if (!found) {
        setResolving(false);
        playError();
        setScanError(val);
        setLastScan('');
        setScanResult(null);
        return;
      }
      playSuccess();
      setScanError('');
      setLastScan(found.name);
      setScanResult(found);
      setPendingPanda(null);
      setSearchQuery('');
      setShowSearch(false);
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      setBasket((prev) => {
        if (prev.find((a) => a.id === found.id)) {
          toast({ title: 'Already in basket', description: found.name });
          return prev;
        }
        return [...prev, found];
      });
      if (data.source === 'panda' && data.created) {
        toast({ title: 'New from Asset Panda', description: `${found.name} added to local inventory` });
      }
    } catch (e) {
      playError();
      setScanError(val);
      setLastScan('');
      setScanResult(null);
    }
    setResolving(false);
  }, [toast, queryClient]);

  const handleSelectResult = (asset) => {
    playSuccess();
    setScanError('');
    setLastScan(asset.name);
    setScanResult(asset);
    setSearchQuery('');
    setShowSearch(false);
    setBasket((prev) => {
      if (prev.find((a) => a.id === asset.id)) {
        toast({ title: 'Already in basket', description: asset.name });
        return prev;
      }
      return [...prev, asset];
    });
  };

  const removeFromBasket = (id) => setBasket((prev) => prev.filter((a) => a.id !== id));
  const clearBasket = () => { setBasket([]); setSelectedJobId(''); };

  const toggleKiosk = () => {
    if (kioskLocked) {
      disableKioskScannerMode();
      setKioskLocked(false);
      toast({ title: 'Kiosk mode disabled', description: 'This device will open the dashboard normally.' });
    } else {
      enableKioskScannerMode();
      setKioskLocked(true);
      toast({ title: 'Kiosk mode enabled', description: 'This device will auto-open the scanner on every load.' });
    }
  };

  const handleConfirmPandaLink = async () => {
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
        setBasket((prev) => (prev.find((a) => a.id === created.id) ? prev : [...prev, created]));
        setScanResult(created);
        setLastScan(created.name);
        setPendingPanda(null);
        toast({ title: 'Linked to Asset Panda', description: `${created.name} added to your inventory` });
      } else {
        toast({ title: 'Could not link', description: res.data?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Could not link', description: e.message, variant: 'destructive' });
    }
    setConfirming(false);
  };

  // Unified commit — handles both sign-out and return
  const handleCommit = async () => {
    if (!selectedJobId || basket.length === 0) return;
    const job = availableJobs.find(j => j.id === selectedJobId);
    const jobName = job?.name || '';
    setCommitting(true);
    try {
      const me = await base44.auth.me();
      const myName = me?.full_name || me?.email || '';
      const assetIds = basket.map(a => a.id);

      if (direction === 'signout') {
        const res = await base44.functions.invoke('commitBasketSignOut', {
          asset_ids: assetIds,
          job_id: selectedJobId,
          job_name: jobName,
          staff_id: me?.id,
          staff_name: myName,
        });
        const data = res.data || res;
        if (data.error) throw new Error(data.error);
        playConfirm();
        toast({ title: 'Signed Out', description: `${data.assignments_created || assetIds.length} item(s) assigned to ${jobName}.` });
      } else {
        // Return — reuse the existing processAssetReturn function
        const res = await base44.functions.invoke('processAssetReturn', {
          job_id: selectedJobId,
          job_name: jobName,
          staff_id: me?.id,
          staff_name: myName,
          scanned_asset_ids: assetIds,
        });
        const data = res.data || res;
        if (data.error) throw new Error(data.error);
        playConfirm();
        toast({ title: 'Returned to Yard', description: `${data.assets_returned || assetIds.length} item(s) returned from ${jobName}.` });
      }

      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding-asset-assignments'] });
      clearBasket();
      setLastScan('');
      setScanResult(null);
    } catch (e) {
      toast({ title: 'Commit failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
    setCommitting(false);
  };

  const handleBooked = () => {
    clearBasket();
    setShowBook(false);
    setLastScan('');
    setScanResult(null);
    queryClient.invalidateQueries({ queryKey: ['deliveries'] });
  };

  if (mode === 'goods-in') {
    return <GoodsInDeliveryNote onBack={() => setMode('assets')} />;
  }

  if (mode === 'site-collect') {
    return (
      <>
        <div className="fixed inset-0 bg-slate-50 flex flex-col">
          <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0 safe-area-top">
            <div className="flex items-center gap-2.5">
              <button onClick={() => setMode('assets')} className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition active:scale-95">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <PackageOpen className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Site Collection</h1>
                <p className="text-xs text-slate-400">Scan QR codes to collect items from site</p>
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl xl:max-w-4xl mx-auto w-full p-4">
              <SiteCollectMode staff={staffProfile} onOpenScanner={(d) => setScanDelivery(d)} />
            </div>
          </div>
        </div>
        {scanDelivery && (
          <SiteCollectionScanner delivery={scanDelivery} onClose={() => setScanDelivery(null)} />
        )}
      </>
    );
  }

  const isSignOut = direction === 'signout';

  return (
    <div className="fixed inset-0 page-bg-vibrant flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0 safe-area-top">
        <div className="flex items-center gap-2.5 min-w-0">
          {!kioskLocked && (
            <button onClick={() => navigate(isHubAdmin ? '/admin' : '/staff-schedule')} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0 active:scale-95 touch-manipulation">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          )}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm flex-shrink-0">
            <ScanLine className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 leading-tight">Asset Scanner</h1>
            <p className="text-[11px] text-slate-500">{basket.length} item{basket.length !== 1 ? 's' : ''} · {isSignOut ? 'Sign Out' : 'Return'} mode</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isHubAdmin && (
            <button
              onClick={toggleKiosk}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95 ${kioskLocked ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' : 'bg-slate-100 text-slate-600'}`}
            >
              {kioskLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span className="hidden sm:inline">{kioskLocked ? 'Kiosk On' : 'Kiosk'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Mode toggles — segmented control */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-slate-200 px-4 py-2.5 flex gap-2 flex-shrink-0 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setMode('assets')}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold transition active:scale-95 ${mode === 'assets' ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}
        >
          <ScanLine className="w-3.5 h-3.5" /> Assets
        </button>
        {isHubAdmin && (
          <button
            onClick={() => setMode('goods-in')}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold transition active:scale-95 ${mode === 'goods-in' ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            <Store className="w-3.5 h-3.5" /> Goods In
          </button>
        )}
        <button
          onClick={() => setMode('site-collect')}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold transition active:scale-95 ${mode === 'site-collect' ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}
        >
          <PackageOpen className="w-3.5 h-3.5" /> Collect
        </button>
      </div>

      {/* Direction toggle — Sign Out / Return */}
      {hubTab === 'scan' && (
        <div className="bg-white/60 backdrop-blur-md px-4 py-2 flex-shrink-0">
          <div className="flex gap-1 p-1 bg-slate-100/80 rounded-xl max-w-xs">
            <button
              onClick={() => { setDirection('signout'); setSelectedJobId(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${isSignOut ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
            >
              <ShieldCheck className="w-4 h-4" /> Sign Out
            </button>
            <button
              onClick={() => { setDirection('return'); setSelectedJobId(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${!isSignOut ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`}
            >
              <Undo2 className="w-4 h-4" /> Return
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl xl:max-w-4xl mx-auto w-full p-4 space-y-4" style={{ paddingBottom: basket.length > 0 ? '100px' : '16px' }}>
          {/* Field Hub Tabs */}
          <FieldHubTabs activeTab={hubTab} onChange={setHubTab} isAdmin={isHubAdmin} />

          {hubTab === 'scan' && (
            <>
              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-900 leading-none tabular-nums">{quickStats.total}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Total Assets</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Layers className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-900 leading-none tabular-nums">{quickStats.rigs}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Rigs</p>
                  </div>
                </div>
                <div className={`bg-white rounded-2xl border p-3 flex items-center gap-2.5 ${quickStats.issues > 0 ? 'border-amber-200' : 'border-slate-200'}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${quickStats.issues > 0 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                    <CheckCircle2 className={`w-5 h-5 ${quickStats.issues > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-lg font-bold leading-none tabular-nums ${quickStats.issues > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{quickStats.issues > 0 ? quickStats.issues : '✓'}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{quickStats.issues > 0 ? 'Issues' : 'All Clear'}</p>
                  </div>
                </div>
              </div>

              {/* Scanner + My Gear split (tablet) / stacked (mobile) */}
              <div className="md:grid md:grid-cols-2 md:gap-4">
                <div className="space-y-4">
                  {/* Scanner card with live search */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 relative">
                    <BarcodeScanner
                      onScan={handleScan}
                      onSearch={(val) => { setSearchQuery(val); setShowSearch(true); setScanError(''); }}
                      placeholder="Scan barcode or type to search…"
                      autoFocus={false}
                      continuous
                    />
                    {resolving && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-sm rounded-2xl flex items-center justify-center gap-2.5">
                        <div className="w-5 h-5 border-2 border-[#2E5A1A] border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm font-medium text-[#2E5A1A]">Checking Asset Panda…</p>
                      </div>
                    )}

                    {/* Live search results dropdown */}
                    {showSearch && searchQuery.trim().length >= 2 && (
                      <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-lg max-h-80 overflow-y-auto">
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                          <Search className="w-3.5 h-3.5 text-slate-400" />
                          <p className="text-xs font-semibold text-slate-600">
                            {searchResults.length} match{searchResults.length !== 1 ? 'es' : ''} for "{searchQuery}"
                          </p>
                        </div>
                        {searchResults.length === 0 ? (
                          <div className="px-4 py-6 text-center">
                            <p className="text-sm text-slate-400">No assets found</p>
                            <p className="text-xs text-slate-300 mt-1">Try a different name, serial, or equipment type</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {searchResults.map(asset => {
                              const Icon = TYPE_ICONS[asset.asset_type] || Package;
                              return (
                                <button
                                  key={asset.id}
                                  onClick={() => handleSelectResult(asset)}
                                  className="w-full flex items-center gap-3 px-3 py-3 hover:bg-emerald-50 transition active:scale-[0.99] text-left"
                                >
                                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-4 h-4 text-slate-500" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{asset.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {asset.serial_number && <span className="text-[11px] text-slate-500 font-mono">{asset.serial_number}</span>}
                                      {asset.equipment_type && <span className="text-[11px] text-slate-400 truncate">· {asset.equipment_type}</span>}
                                    </div>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Panda confirm card */}
                  {pendingPanda && !scanError && (
                    <PandaScanConfirmCard
                      panda={pendingPanda}
                      confirming={confirming}
                      onConfirm={handleConfirmPandaLink}
                      onCancel={() => { setPendingPanda(null); setLastScan(''); }}
                    />
                  )}

                  {/* Scan result card */}
                  {scanResult && !scanError && (
                    <ScanResultCard
                      asset={scanResult}
                      onBookToVehicle={(asset) => { setShowBook(true); }}
                      onDriveAway={(asset) => { setDriveAwayAsset(asset); setScanResult(null); }}
                      onOpenCommand={(asset) => { setCommandAsset(asset); setScanResult(null); }}
                      onReportFault={(asset) => { setFaultAsset(asset); setScanResult(null); }}
                      onDismiss={() => setScanResult(null)}
                    />
                  )}

                  {/* Scan error */}
                  {scanError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700 font-medium flex-1 truncate">No asset matches "{scanError}"</p>
                      <button onClick={() => setScanError('')} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Empty state */}
                  {basket.length === 0 && !scanResult && !scanError && !pendingPanda && (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center mx-auto mb-3 ring-4 ring-emerald-50">
                        <ScanLine className="w-10 h-10 text-emerald-300" />
                      </div>
                      <p className="text-slate-700 font-bold text-base">Ready to Scan</p>
                      <p className="text-slate-400 text-sm mt-1">Point your camera at a QR code or barcode — items appear in the basket below.</p>
                    </div>
                  )}
                </div>

                {/* My Gear manifest — tablet sidebar */}
                <div className="hidden md:block">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Wrench className="w-4 h-4 text-emerald-700" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">My Gear Manifest</h3>
                    </div>
                    <MyGearTab staffProfile={staffProfile} allAssets={assets} onOpenAsset={setCommandAsset} />
                  </div>
                </div>
              </div>
            </>
          )}

          {hubTab === 'mygear' && (
            <MyGearTab staffProfile={staffProfile} allAssets={assets} onOpenAsset={setCommandAsset} />
          )}

          {hubTab === 'mytoday' && (
            <MyTodayTab staffProfile={staffProfile} allAssets={assets} />
          )}
        </div>
      </div>

      {/* Unified sticky basket */}
      {hubTab === 'scan' && basket.length > 0 && (
        <UnifiedScanBasket
          items={basket}
          onRemove={removeFromBasket}
          onClear={clearBasket}
          direction={direction}
          onToggleDirection={(d) => { setDirection(d); setSelectedJobId(''); }}
          onCommit={handleCommit}
          committing={committing}
          jobs={availableJobs}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
        />
      )}

      {/* Book to Vehicle modal */}
      {showBook && (
        <BookToVehicleModal assets={basket} onClose={() => setShowBook(false)} onSuccess={handleBooked} />
      )}

      {/* Asset Command Drawer */}
      {commandAsset && (
        <AssetCommandDrawer
          asset={commandAsset}
          allAssets={assets}
          staffProfile={staffProfile}
          onClose={() => setCommandAsset(null)}
          onDriveAway={(asset) => { setCommandAsset(null); setDriveAwayAsset(asset); }}
          onBookToVehicle={(asset) => { setCommandAsset(null); setBasket([asset]); setShowBook(true); }}
          onReportFault={(asset) => { setCommandAsset(null); setFaultAsset(asset); }}
        />
      )}

      {/* Drive Away */}
      {driveAwayAsset && (
        <DriveAwayModal
          asset={driveAwayAsset}
          staffProfile={staffProfile}
          onClose={() => setDriveAwayAsset(null)}
          onSuccess={() => { setDriveAwayAsset(null); setLastScan(''); }}
        />
      )}

      {/* Report Fault */}
      {faultAsset && (
        <ReportFaultModal
          asset={faultAsset}
          staffProfile={staffProfile}
          onClose={() => setFaultAsset(null)}
        />
      )}
    </div>
  );
}