import React from 'react';
import { GripVertical, EyeOff } from 'lucide-react';
import { WIDGET_REGISTRY } from '@/components/dashboard/registry';

const SIZE_LABELS = { sm: 'S', md: 'M', lg: 'L' };

export default function WidgetCard({ widgetId, customizeMode, dragHandleProps, onHide, size = 'md', onResize, children }) {
  const config = WIDGET_REGISTRY[widgetId];
  if (!config) return <div>{children}</div>;

  if (!customizeMode) {
    return <div>{children}</div>;
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-white/80 backdrop-blur-sm ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-slate-50 shadow-lg">
      <div
        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 cursor-grab active:cursor-grabbing select-none"
        {...dragHandleProps}
      >
        <GripVertical className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-emerald-800 truncate">{config.title}</span>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-0.5 bg-white rounded-lg border border-slate-200 p-0.5">
            {['sm', 'md', 'lg'].map(s => (
              <button key={s} onClick={() => onResize?.(s)} type="button"
                className={`w-6 h-6 text-[11px] font-bold rounded transition ${size === s ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                {SIZE_LABELS[s]}
              </button>
            ))}
          </div>
          <button onClick={onHide} type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-red-600 bg-white rounded-lg border border-slate-200 hover:border-red-200 transition">
            <EyeOff className="w-3 h-3" /> Hide
          </button>
        </div>
      </div>
      <div className="p-1 pointer-events-none opacity-50">
        {children}
      </div>
    </div>
  );
}