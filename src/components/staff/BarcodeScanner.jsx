import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, ScanLine, Keyboard, X, CheckCircle2, AlertTriangle } from 'lucide-react';

// A lightweight barcode/QR scanner that uses the native BarcodeDetector API
// when available (Chrome on Android), with a manual-entry fallback for iOS
// and hardware Bluetooth scanners that act as keyboards.
export default function BarcodeScanner({ onScan, placeholder = 'Scan or type barcode…', autoFocus = true }) {
  const [mode, setMode] = useState('input'); // 'input' | 'camera'
  const [manualValue, setManualValue] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [lastScan, setLastScan] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const inputRef = useRef(null);

  // Check if BarcodeDetector is available
  const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (autoFocus && mode === 'input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode, autoFocus]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleManualSubmit = (e) => {
    e?.preventDefault();
    const val = manualValue.trim();
    if (!val) return;
    setLastScan(val);
    setManualValue('');
    onScan(val);
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      if (hasNativeDetector) {
        try {
          detectorRef.current = new window.BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
          });
        } catch (_) {
          detectorRef.current = new window.BarcodeDetector();
        }
        detectLoop();
      }
    } catch (err) {
      setCameraError(err.message || 'Could not access camera');
    }
  };

  const detectLoop = async () => {
    if (!streamRef.current || !videoRef.current) return;
    if (detectorRef.current && videoRef.current.readyState >= 2) {
      try {
        const codes = await detectorRef.current.detect(videoRef.current);
        if (codes && codes.length > 0) {
          const val = codes[0].rawValue || '';
          if (val) {
            setLastScan(val);
            onScan(val);
            stopCamera();
            return;
          }
        }
      } catch (_) {
        // detection errors are transient — keep looping
      }
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  };

  const switchToCamera = () => {
    setMode('camera');
    setTimeout(startCamera, 100);
  };

  const switchToInput = () => {
    stopCamera();
    setMode('input');
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={switchToInput}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
            mode === 'input' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          <Keyboard className="w-4 h-4" /> Manual
        </button>
        <button
          type="button"
          onClick={switchToCamera}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
            mode === 'camera' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          <Camera className="w-4 h-4" /> Camera
        </button>
      </div>

      {/* Manual input mode */}
      {mode === 'input' && (
        <form onSubmit={handleManualSubmit} className="space-y-2">
          <div className="relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={manualValue}
              onChange={e => setManualValue(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-11 pr-4 py-3.5 border-2 border-slate-200 rounded-xl text-base font-medium focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          {manualValue.trim() && (
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold active:scale-95 transition"
            >
              <CheckCircle2 className="w-4 h-4" /> Confirm Scan
            </button>
          )}
        </form>
      )}

      {/* Camera mode */}
      {mode === 'camera' && (
        <div className="space-y-2">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Scan frame overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-emerald-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
            {!cameraActive && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2.5 bg-white/90 text-slate-800 rounded-xl text-sm font-semibold flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Start Camera
                </button>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
                <p className="text-xs text-white/90 mb-3">{cameraError}</p>
                <button
                  type="button"
                  onClick={switchToInput}
                  className="px-3 py-2 bg-white/20 text-white rounded-lg text-xs font-semibold"
                >
                  Use Manual Entry
                </button>
              </div>
            )}
          </div>
          {cameraActive && (
            <button
              type="button"
              onClick={stopCamera}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold"
            >
              <X className="w-4 h-4" /> Stop Camera
            </button>
          )}
          {!hasNativeDetector && cameraActive && (
            <p className="text-[11px] text-slate-400 text-center">
              Live detection not supported on this device — use Manual entry to type the code.
            </p>
          )}
        </div>
      )}

      {/* Last scan confirmation */}
      {lastScan && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="text-xs text-emerald-800 font-medium truncate">Last scan: {lastScan}</p>
        </div>
      )}
    </div>
  );
}