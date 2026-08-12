import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine, X, Package, Truck, Trash2, CheckCircle2,
  AlertCircle, Lock, Unlock, ArrowLeft, Layers, Store, PackageOpen,
} from 'lucide-react';
import BarcodeScanner from '@/components/staff/BarcodeScanner';
import BulkScanBasket from '@/components/logistics/BulkScanBasket';
import BookToVehicleModal from '@/components/assetcommand/BookToVehicleModal';
import GoodsInScanner from '@/components/logistics/GoodsInScanner';
import SiteCollectMode from '@/components/logistics/SiteCollectMode';
import SiteCollectionScanner from '@/components/logistics/SiteCollectionScanner';
import { enableKioskScannerMode, disableKioskScannerMode, isKioskScannerMode } from '@/utils/kioskMode';
import { useToast } from '@/components/ui/use-toast';

/**
 * Asset Scanner — full-screen, kiosk-style page optimised for tablets.
 * Camera-first design: scan items into a basket, then bulk-book them
 * onto a vehicle. A "Kiosk" toggle pins this device to the scanner so
 * the app auto-opens here on every load.
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
  const [mode, setMode] = useState('assets'); // 'assets' | 'goods-in' | 'site-collect'
  const [scanDelivery, setScanDelivery] = useState(null);
  const [staffProfile, setStaffProfile] = useState(null);

  useEffect(() => {
    base44.functions.invoke('getMyStaffProfile').then(res => setStaffProfile(res.data)).catch(() => {});
  }, []);

  const { data: assets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const handleScan = useCallback((val) => {
    const q = val.trim().toLowerCase();
    if (!q) return;
    const found = assets.find((a) => {
      const sn = (a.serial_number || '').toLowerCase().trim();
      const pid = (a.panda_asset_id || '').toLowerCase().trim();
      const nm = (a.name || '').toLowerCase().trim();
      return sn === q || pid === q || nm === q || (sn && sn.includes(q)) || (pid && pid.includes(q));
    });
    if (!found) {
      setScanError(val);
      setLastScan('');
      return;
    }
    setScanError('');
    setLastScan(found.name);
    setBasket((prev) => {
      if (prev.find((a) => a.id === found.id)) {
        toast({ title: 'Already in basket', description: found.name });
        return prev;
      }
      return [...prev, found];
    });
  }, [assets, toast]);

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
    queryClient.invalidateQueries({ queryKey: ['deliveries'] });
  };

  // Goods In mode — render the dedicated goods-in scanner interface
  if (mode === 'goods-in') {
    return <GoodsInScanner onBack={() => setMode('assets')} />;
  }

  // Site Collect mode — show the driver's collection tasks
  if (mode === 'site-collect') {
    return (
      <>
        <div className="fixed inset-0 bg-slate-50 flex flex-col">
          <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0 safe-area-top">
            <div className="flex items-center gap-2.5">
              <button onClick={() => setMode('assets')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition active:scale-95">
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
            <div className="max-w-2xl mx-auto w-full p-4">
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
          {/* Mode toggle — Assets vs Goods In */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setMode('assets')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${mode === 'assets' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
            >
              <ScanLine className="w-3.5 h-3.5" /> Assets
            </button>
            <button
              onClick={() => setMode('goods-in')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${mode === 'goods-in' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'}`}
            >
              <Store className="w-3.5 h-3.5" /> Goods In
            </button>
            <button
              onClick={() => setMode('site-collect')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${mode === 'site-collect' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
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
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
          {/* Scanner card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <BarcodeScanner onScan={handleScan} placeholder="Scan or type serial number…" autoFocus={false} />
          </div>

          {/* Last scan feedback */}
          {lastScan && !scanError && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 animate-pop-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-800 font-semibold truncate">Added: {lastScan}</p>
            </div>
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
              <p className="text-slate-500 font-medium text-base">Scan items to add them to the basket</p>
              <p className="text-slate-400 text-sm mt-1">Point the camera at an Asset Panda QR label</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      {basket.length > 0 && (
        <footer className="bg-white border-t border-slate-200 px-4 py-3 flex-shrink-0 safe-area-bottom">
          <div className="max-w-2xl mx-auto flex gap-2">
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
    </div>
  );
}