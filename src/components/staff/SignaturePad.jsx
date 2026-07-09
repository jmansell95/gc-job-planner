import React, { useRef, useState, useEffect } from 'react';
import { Eraser, PenLine } from 'lucide-react';

export default function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x: x * (canvas.width / rect.width), y: y * (canvas.height / rect.height) };
  };

  const start = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    if (!hasSignature) setHasSignature(true);
  };

  const end = (e) => {
    if (e) e.preventDefault();
    if (isDrawing && hasSignature && onChange) {
      onChange(canvasRef.current.toDataURL('image/png'));
    }
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    if (onChange) onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={160}
          className="w-full h-40 touch-none"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={end}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <PenLine className="w-5 h-5 text-slate-300 mb-1" />
            <p className="text-sm text-slate-300">Sign here with your finger</p>
          </div>
        )}
      </div>
      <button onClick={clear} className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium">
        <Eraser className="w-3.5 h-3.5" /> Clear signature
      </button>
    </div>
  );
}