import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, RefreshCw, SwitchCamera, ImagePlus, Check } from 'lucide-react';

/**
 * CameraCapture — live camera with a "don't go outside this box" overlay frame.
 * Falls back to a native file input (with capture="environment") when the
 * device camera is unavailable or permission is denied.
 *
 * Props:
 *  - onCapture(file)  called with a JPEG File when the user captures
 *  - onCancel()        close without capturing
 *  - aspect            frame aspect ratio (width/height). 1.586 = card, 1.414 = A4
 *  - guideLabel        text shown above the frame
 */
export default function CameraCapture({ onCapture, onCancel, aspect = 1.586, guideLabel = 'Align within the frame' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [streamReady, setStreamReady] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [capturing, setCapturing] = useState(false);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = useCallback(async () => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStreamReady(true);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Camera unavailable');
      setStreamReady(false);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => stopStream();
  }, [startCamera]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setCapturing(true);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      setCapturing(false);
      if (!blob) return;
      stopStream();
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      onCapture(file);
    }, 'image/jpeg', 0.92);
  };

  const switchCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleFileFallback = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      stopStream();
      onCapture(file);
    }
  };

  // Frame dimensions: fit within viewport with padding
  const frameWidth = '85%';
  const frameHeight = `calc(85% / ${aspect})`;

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
        <button onClick={() => { stopStream(); onCancel(); }} className="p-2 hover:bg-white/10 rounded-lg transition">
          <X className="w-6 h-6" />
        </button>
        <p className="text-sm font-semibold">{guideLabel}</p>
        <button onClick={switchCamera} className="p-2 hover:bg-white/10 rounded-lg transition" disabled={!streamReady}>
          <SwitchCamera className="w-6 h-6" />
        </button>
      </div>

      {/* Camera viewport */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-slate-900">
        {streamReady ? (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-white/60 px-8 text-center">
            {error ? (
              <>
                <Camera className="w-12 h-12 opacity-40" />
                <p className="text-sm font-medium">Camera unavailable</p>
                <p className="text-xs text-white/40">{error}</p>
              </>
            ) : (
              <div className="w-8 h-8 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
            )}
          </div>
        )}

        {/* Overlay frame — "don't go outside this box" */}
        {streamReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="relative border-2 border-white/90 rounded-xl shadow-2xl"
              style={{ width: frameWidth, maxWidth: '420px', aspectRatio: aspect }}
            >
              {/* Corner accents */}
              <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              {/* Pulsing hint */}
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-emerald-300 bg-black/60 px-3 py-1 rounded-full">
                Keep card inside this box
              </div>
            </div>
          </div>
        )}

        {/* Dark mask around frame for emphasis */}
        {streamReady && (
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.45) 70%)',
          }} />
        )}
      </div>

      {/* Bottom controls */}
      <div className="bg-black/80 px-4 py-5 flex items-center justify-center gap-6" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
        {streamReady ? (
          <button
            onClick={capture}
            disabled={capturing}
            className="w-[72px] h-[72px] rounded-full bg-white ring-4 ring-white/30 flex items-center justify-center active:scale-90 transition disabled:opacity-50"
            aria-label="Capture photo"
          >
            {capturing ? (
              <div className="w-6 h-6 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin" />
            ) : (
              <Camera className="w-7 h-7 text-slate-900" />
            )}
          </button>
        ) : (
          <label className="flex flex-col items-center gap-2 cursor-pointer text-white">
            <div className="w-[72px] h-[72px] rounded-full bg-emerald-600 ring-4 ring-emerald-400/30 flex items-center justify-center active:scale-90 transition">
              <ImagePlus className="w-7 h-7 text-white" />
            </div>
            <span className="text-xs font-medium text-white/80">Choose from gallery</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileFallback} />
          </label>
        )}
      </div>
    </div>
  );
}