import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Keyboard, CheckCircle2, AlertTriangle, ScanLine, Loader2, WifiOff, Zap } from 'lucide-react';

/**
 * Full-screen camera viewfinder overlay — opens when the user taps the scan
 * button on the Asset Scanner. Continuous scanning with cooldown, inline result
 * toast, and a manual-entry fallback for devices without a native BarcodeDetector.
 *
 * Props:
 *   onScan(val)      — called with every detected code (parent resolves it)
 *   onClose()        — close the viewfinder
 *   resolving        — true while parent is resolving the last scan
 *   lastResult       — last resolved SiteAsset (shown as inline toast)
 *   lastError        — last scan value that failed to resolve
 *   resultColor      — compliance color key for the inline toast ring
 */
export default function FullScreenScanner({ onScan, onClose, resolving, lastResult, lastError, resultColor = 'emerald' }) {
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // Apply continuous autofocus and zoom via applyConstraints (more reliable
      // than getUserMedia advanced constraints, which iOS silently ignores).
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (_) {}
      }
      if (caps.zoom) {
        const targetZoom = Math.min(3, caps.zoom);
        try { await track.applyConstraints({ advanced: [{ zoom: targetZoom }] }); } catch (_) {}
      }
      if (caps.torch) setTorchSupported(true);
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

  const ringColor = {
    emerald: 'border-emerald-400 text-emerald-300',
    amber: 'border-amber-400 text-amber-300',
    red: 'border-red-400 text-red-300',
    slate: 'border-slate-400 text-slate-300',
  }[resultColor] || 'border-emerald-400 text-emerald-300';

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Camera video — full bleed */}
      <div className="absolute inset-0">
        <video ref={videoRef} playsInline muted className="w-full h-full object-contain sm:object-cover" />
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
            <p className="text-white/60 text-[11px]">Point at a QR code or barcode</p>
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
        <div className="relative w-64 h-64 max-w-[70vw] max-h-[40vh]">
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

      {/* Inline result toast */}
      {(resolving || lastResult || lastError) && (
        <div className="relative z-10 px-4 pb-3">
          {resolving && (
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/20">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
              <p className="text-white text-sm font-medium">Checking Asset Panda…</p>
            </div>
          )}
          {!resolving && lastResult && (
            <div className={`flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border-2 ${ringColor}`}>
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-bold truncate">{lastResult.name}</p>
                <p className="text-white/60 text-[11px] truncate">Added to basket · {(lastResult.compliance_status || 'unknown')}</p>
              </div>
            </div>
          )}
          {!resolving && lastError && (
            <div className="flex items-center gap-3 bg-red-500/20 backdrop-blur-md rounded-2xl px-4 py-3 border-2 border-red-400/60">
              <AlertTriangle className="w-5 h-5 text-red-300 flex-shrink-0" />
              <p className="text-white text-sm font-medium truncate">No match for "{lastError}"</p>
            </div>
          )}
        </div>
      )}

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