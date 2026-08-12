import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine, X, Package, Truck, Trash2, CheckCircle2,
  AlertCircle, Lock, Unlock, ArrowLeft, Layers, Store, PackageOpen,
  Search, Wrench, ChevronRight, Plus,
} from 'lucide-react';
import BarcodeScanner from '@/components/staff/BarcodeScanner';
import BulkScanBasket from '@/components/logistics/BulkScanBasket';
import ScanResultCard from '@/components/assetcommand/ScanResultCard';
import AssetCommandDrawer from '@/components/assetcommand/AssetCommandDrawer';
import DriveAwayModal from '@/components/assetcommand/DriveAwayModal';
import ReportFaultModal from '@/components/assetcommand/ReportFaultModal';
import BookToVehicleModal from '@/components/assetcommand/BookToVehicleModal';
import FieldHubTabs from '@/components/fieldhub/FieldHubTabs';
import MyGearTab from '@/components/fieldhub/MyGearTab';
import MyTodayTab from '@/components/fieldhub/MyTodayTab';
import GoodsInScanner from '@/components/logistics/GoodsInScanner';
import SiteCollectMode from '@/components/logistics/SiteCollectMode';
import SiteCollectionScanner from '@/components/logistics/SiteCollectionScanner';
import { enableKioskScannerMode, disableKioskScannerMode, isKioskScannerMode } from '@/utils/kioskMode';
import { useToast } from '@/components/ui/use-toast';

const TYPE_ICONS = { rig: Wrench, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Package, portable_appliance: Wrench };

/**
 * Asset Scanner — full-screen, kiosk-style page optimised for tablets.
 * Camera-first design with real-time text search fallback.
 */
export default function AssetScannerPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [basket, setBasket] = useState([]);
  const [lastScan, setLastScan] = useState('');
  const [scanError, setScanError] = useState('');
  const [showBook, setShowBook] = useState(false);
  const [kioskLocked, setKioskLocked] = useState(isKioskScannerMode());
  const [mode, setMode] = useState('assets');
  const [scanDelivery, setScanDelivery] = useState(null);
  const [staffProfile, setStaffProfile] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [commandAsset, setCommandAsset] = useState(null);
  const [driveAwayAsset, setDriveAwayAsset] = useState(null);
  const [faultAsset, setFaultAsset] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [hubTab, setHubTab] = useState('scan');
  const searchRef = useRef(null);

  useEffect(() => {
    base44.functions.invoke('getMyStaffProfile').then(res => setStaffProfile(res.data)).catch(() => {});
  }, []);

  const isHubAdmin = staffProfile?.is_admin || staffProfile?.system_role === 'super_admin';

  const { data: assets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  // Real-time search — filters as you type, matches name, serial, equipment_type, compliance_category
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
        return (
          name.includes(q) || serial.includes(q) || equip.includes(q) ||
          cat.includes(q) || panda.includes(q) ||
          name.startsWith(q) || serial.startsWith(q)
        );
      })
      .slice(0, 12);
  }, [assets, searchQuery]);

  const handleScan = useCallback((val) => {
    const q = val.trim().toLowerCase();
    if (!q) return;
    const found = assets.find((a) => {
      const sn = (a.serial_number || '').toLowerCase().trim();
      const pid = (a.panda_asset_id || '').toLowerCase().trim();
      const nm = (a.name || '').toLowerCase().trim();
      const equip = (a.equipment_type || '').toLowerCase().trim();
      return sn === q || pid === q || nm === q ||
        (sn && sn.includes(q)) || (pid && pid.includes(q)) ||
        (nm && nm.includes(q)) || (equip && equip.includes(q));
    });
    if (!found) {
      setScanError(val);
      setLastScan('');
      setScanResult(null);
      return;
    }
    setScanError('');
    setLastScan(found.name);
    setScanResult(found);
    setSearchQuery('');
    setShowSearch(false);
    setBasket((prev) => {
      if (prev.find((a) => a.id === found.id)) {
        toast({ title: 'Already in basket', description: found.name });
        return prev;
      }
      return [...prev, found];
    });
  }, [assets, toast]);

  // Tap a search result to add it
  const handleSelectResult = (asset) => {
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
  const clearBasket = () => setBasket([]);

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

  const handleBooked = () => {
    clearBasket();
    setShowBook(false);
    setLastScan('');
    setScanResult(null);
    queryClient.invalidateQueries({ queryKey: ['deliveries'] });
  };

  if (mode === 'goods-in') {
    return <GoodsInScanner onBack={() => setMode('assets')} />;
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

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0 safe-area-top">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Asset Scanner</h1>
            <p className="text-xs text-slate-400">{basket.length} item{basket.length !== 1 ? 's' : ''} in basket</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setMode('assets')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition active:scale-95 ${mode === 'assets' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
            >
              <ScanLine className="w-3.5 h-3.5" /> Assets
            </button>
            <button
              onClick={() => setMode('goods-in')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition active:scale-95 ${mode === 'goods-in' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'}`}
            >
              <Store className="w-3.5 h-3.5" /> Goods In
            </button>
            <button
              onClick={() => setMode('site-collect')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition active:scale-95 ${mode === 'site-collect' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
            >
              <PackageOpen className="w-3.5 h-3.5" /> Collect
            </button>
          </div>
          <button
            onClick={toggleKiosk}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95 ${kioskLocked ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' : 'bg-slate-100 text-slate-600'}`}
          >
            {kioskLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span className="hidden sm:inline">{kioskLocked ? 'Kiosk On' : 'Kiosk'}</span>
          </button>
          {!kioskLocked && (
            <button onClick={() => navigate('/admin')} className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl xl:max-w-4xl mx-auto w-full p-4 space-y-4">
          {/* Field Hub Tabs */}
          <FieldHubTabs activeTab={hubTab} onChange={setHubTab} isAdmin={isHubAdmin} />

          {hubTab === 'scan' && (
            <>
          {/* Scanner card with live search */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 relative">
            <BarcodeScanner
              onScan={handleScan}
              onSearch={(val) => { setSearchQuery(val); setShowSearch(true); setScanError(''); }}
              placeholder="Scan barcode or type to search (e.g. shackle)…"
              autoFocus={false}
            />

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
                              {asset.serial_number && (
                                <span className="text-[11px] text-slate-500 font-mono">{asset.serial_number}</span>
                              )}
                              {asset.equipment_type && (
                                <span className="text-[11px] text-slate-400 truncate">· {asset.equipment_type}</span>
                              )}
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

          {/* Hilti-style immediate scan result card */}
          {scanResult && !scanError && (
            <ScanResultCard
              asset={scanResult}
              onBookToVehicle={(asset) => { setShowBook(true); }}
              onDriveAway={(asset) => { setDriveAwayAsset(asset); setScanResult(null); }}
              onOpenCommand={(asset) => { setCommandAsset(asset); setScanResult(null); }}
              onDismiss={() => setScanResult(null)}
            />
          )}
          {scanError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium flex-1 truncate">No asset matches "{scanError}"</p>
              <button onClick={() => setScanError('')} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Basket */}
          {basket.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <BulkScanBasket items={basket} onRemove={removeFromBasket} onClear={clearBasket} />
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Package className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium text-base">Scan or search to add items</p>
              <p className="text-slate-400 text-sm mt-1">Point camera at a QR label or type a name like "shackle"</p>
            </div>
          )}
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

      {/* Sticky action bar */}
      {hubTab === 'scan' && basket.length > 0 && (
        <footer className="bg-white border-t border-slate-200 px-4 py-3 flex-shrink-0 safe-area-bottom">
          <div className="max-w-3xl xl:max-w-4xl mx-auto flex gap-2">
            <button
              onClick={() => setShowBook(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-700 text-white rounded-xl font-bold text-sm hover:bg-emerald-800 transition shadow-sm active:scale-95"
            >
              <Truck className="w-5 h-5" /> Book {basket.length} to Vehicle
            </button>
            <button
              onClick={clearBasket}
              className="px-4 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition active:scale-95"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </footer>
      )}

      {/* Book modal */}
      {showBook && (
        <BookToVehicleModal assets={basket} onClose={() => setShowBook(false)} onSuccess={handleBooked} />
      )}

      {/* Asset Command Drawer — self-contained details + actions */}
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

      {/* Drive Away — start shift & drive to job */}
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