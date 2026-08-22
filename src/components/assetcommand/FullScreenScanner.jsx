import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Keyboard, AlertTriangle, ScanLine, Loader2, WifiOff, Zap } from 'lucide-react';
import ScanResultPopup from './ScanResultPopup';

/**
 * Full-screen camera scanner overlay — opens when the user taps the scan
 * button on the Asset Scanner. Continuous scanning with cooldown, a manual-entry
 * fallback for devices without a native BarcodeDetector, and a ScanResultPopup
 * bottom-sheet that overlays the live camera for every scan result.
 *
 * Props:
 *   onScan(val)       — called with every detected code (parent resolves it)
 *   onClose()         — close the viewfinder
 *   resolving         — true while parent is resolving the last scan
 *   scanResult        — last resolved SiteAsset (shown in popup)
 *   scanError         — last scan value that failed to resolve
 *   pendingPanda      — Panda confirm data (new-asset path)
 *   alreadyInBasket   — true if scanResult is already in the basket
 *   confirming        — true while Panda link is being confirmed
 *   refreshing        — true while background Panda refresh is in flight
 *   onViewAsset(a)    — open the Asset Command Drawer for this asset
 *   onScanNext()      — dismiss popup, ready for next scan
 *   onAddToBasket(a)  — add asset to basket, then scan next
 *   onConfirmPanda()  — confirm Panda link
 *   onCancelPanda()   — cancel Panda confirm
 */
export default function FullScreenScanner({
  onScan, onClose,
  resolving, scanResult, scanError, pendingPanda, alreadyInBasket,
  confirming, refreshing,
  onViewAsset, onScanNext, onAddToBasket, onConfirmPanda, onCancelPanda,
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cooldown, setCooldown] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const cooldownTimerRef = useRef(null);

  const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (cooldownTimerRef.current) { clearTimeout(cooldownTimerRef.current); cooldownTimerRef.current = null; }
    setCooldown(false);
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Reset the scan cooldown whenever the popup is cleared (Scan Next / Add to
  // Basket) so the scanner is immediately ready for the next barcode.
  useEffect(() => {
    if (!scanResult && !scanError && !pendingPanda && !resolving) {
      if (cooldownTimerRef.current) { clearTimeout(cooldownTimerRef.current); cooldownTimerRef.current = null; }
      setCooldown(false);
    }
  }, [scanResult, scanError, pendingPanda, resolving]);

  const detectLoop = useCallback(async () => {
    if (!streamRef.current || !videoRef.current) return;
    if (cooldown) { rafRef.current = requestAnimationFrame(detectLoop); return; }
    if (detectorRef.current && videoRef.current.readyState >= 2) {
      try {
        const codes = await detectorRef.current.detect(videoRef.current);
        if (codes && codes.length > 0) {
          const val = codes[0].rawValue || '';
          if (val) {
            onScan(val);
            setCooldown(true);
            if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
            cooldownTimerRef.current = setTimeout(() => setCooldown(false), 1500);
          }
        }
      } catch (_) { /* transient */ }
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [cooldown, onScan]);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      // Single clean request — ideal is a HINT so it never throws
      // OverconstrainedError. 4K ideal makes the browser negotiate the absolute
      // highest resolution the back-camera sensor offers (often 1920×1080 or
      // 3840×2160). No min, no fallback — both can silently drop to 640×480.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      const settings = track.getSettings ? track.getSettings() : {};
      console.log('[Scanner] Camera resolution:', settings.width, '×', settings.height);

      if (videoRef.current) {
        // Do NOT set width/height attributes — that caps the render buffer
        // below the stream's native resolution and forces an upscale. Let
        // the browser use the stream's full native size as the intrinsic
        // buffer; CSS object-cover then only DOWNSCALES to the viewport.
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (caps.torch) setTorchSupported(true);
      // Reset digital zoom to minimum (1×) — some phones apply default zoom
      // that softens the image.
      if (caps.zoom && caps.zoom.min != null) {
        try { await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] }); } catch (_) {}
      }
      // Force continuous autofocus for sharp barcode reads where supported
      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (_) {}
      }
      setCameraActive(true);
      if (hasNativeDetector) {
        try {
          detectorRef.current = new window.BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
          });
        } catch (_) { detectorRef.current = new window.BarcodeDetector(); }
        detectLoop();
      } else {
        setShowManual(true);
      }
    } catch (err) {
      setCameraError(err.message || 'Could not access camera');
      setShowManual(true);
    }
  }, [detectLoop, hasNativeDetector]);

  useEffect(() => { startCamera(); }, [startCamera]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (_) {}
  }, [torchOn]);

  const handleManualSubmit = (e) => {
    e?.preventDefault();
    const val = manualValue.trim();
    if (!val) return;
    onScan(val);
    setManualValue('');
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Camera video — full bleed */}
      <div className="absolute inset-0">
        <video ref={videoRef} playsInline muted autoPlay
          className="w-full h-full object-cover bg-black"
          style={{ transform: 'translateZ(0)', willChange: 'transform', imageRendering: 'auto' }} />
      </div>

      {/* Dark scrim for contrast */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2 safe-area-top">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Scanning…</p>
            <p className="text-white/60 text-[11px]">Point at any QR or barcode</p>
          </div>
        </div>
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center active:scale-95 transition"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Reticle — centered with corner brackets + glow ring + scan line */}
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div className="relative w-[78vw] h-[52vh] max-w-[420px] max-h-[420px]">
          {/* Glow ring */}
          <div className="absolute -inset-4 rounded-[2rem] bg-emerald-400/20 blur-2xl animate-pulse" />
          {/* Frame */}
          <div className="absolute inset-0 rounded-[1.75rem] border-2 border-white/30" />
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-[1.75rem]" />
          <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-[1.75rem]" />
          <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-[1.75rem]" />
          <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-[1.75rem]" />
          {/* Scan line */}
          {!cooldown && cameraActive && (
            <div className="absolute left-4 right-4 h-0.5 bg-emerald-400 shadow-[0_0_12px_2px_rgba(16,185,129,0.8)] animate-[scanline_2s_ease-in-out_infinite]" />
          )}
          {/* Cooldown overlay */}
          {cooldown && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="px-3 py-1.5 rounded-full bg-amber-400/90 text-amber-950 text-xs font-bold">Scanned — wait…</div>
            </div>
          )}
        </div>
      </div>

      {/* Scan result popup — bottom sheet over the live camera */}
      <ScanResultPopup
        resolving={resolving}
        scanResult={scanResult}
        scanError={scanError}
        pendingPanda={pendingPanda}
        alreadyInBasket={alreadyInBasket}
        confirming={confirming}
        refreshing={refreshing}
        onViewAsset={onViewAsset}
        onScanNext={onScanNext}
        onAddToBasket={onAddToBasket}
        onConfirmPanda={onConfirmPanda}
        onCancelPanda={onCancelPanda}
      />

      {/* Bottom controls */}
      <div className="relative z-10 px-4 pb-6 safe-area-bottom">
        {cameraError && !cameraActive && (
          <div className="flex items-center gap-2 bg-amber-500/20 rounded-xl px-4 py-2.5 mb-3 border border-amber-400/40">
            <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <p className="text-white/90 text-xs flex-1">{cameraError}</p>
          </div>
        )}
        {showManual ? (
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <input
                type="text"
                value={manualValue}
                onChange={e => setManualValue(e.target.value)}
                placeholder="Type barcode…"
                autoFocus
                className="w-full pl-11 pr-4 py-3.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-base font-medium text-white placeholder-white/40 focus:outline-none focus:border-emerald-400"
              />
            </div>
            <button type="submit" disabled={!manualValue.trim()} className="px-5 py-3.5 bg-emerald-500 text-white rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition">
              Add
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-center gap-3">
            {torchSupported && (
              <button
                onClick={toggleTorch}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold active:scale-95 transition ${torchOn ? 'bg-amber-400 text-amber-950' : 'bg-white/10 backdrop-blur-md text-white'}`}
              >
                <Zap className="w-4 h-4" /> {torchOn ? 'Torch On' : 'Torch'}
              </button>
            )}
            <button
              onClick={() => setShowManual(true)}
              className="flex items-center gap-2 px-4 py-3 bg-white/10 backdrop-blur-md text-white rounded-xl text-sm font-semibold active:scale-95 transition"
            >
              <Keyboard className="w-4 h-4" /> Manual
            </button>
            {!hasNativeDetector && (
              <div className="flex items-center gap-1.5 text-white/50 text-xs">
                <WifiOff className="w-3.5 h-3.5" /> Live detect unsupported
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes scanline { 0%,100% { top: 12%; } 50% { top: 88%; } }`}</style>
    </div>
  );
}