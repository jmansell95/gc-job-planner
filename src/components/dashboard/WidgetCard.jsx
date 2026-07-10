import React from 'react';
import { GripVertical, EyeOff } from 'lucide-react';
import { WIDGET_REGISTRY } from '@/components/dashboard/registry';

export default function WidgetCard({ widgetId, customizeMode, dragHandleProps, onHide, children }) {
  const config = WIDGET_REGISTRY[widgetId];
  if (!config) return <div className="mb-6">{children}</div>;

  if (!customizeMode) {
    return <div className="mb-6">{children}</div>;
  }

  return (
    <div className="mb-6 rounded-2xl overflow-hidden bg-white/50 ring-2 ring-emerald-300/70 ring-offset-2 ring-offset-slate-50 shadow-sm">
      <div
        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50/95 border-b border-emerald-100 cursor-grab active:cursor-grabbing select-none"
        {...dragHandleProps}
      >
        <GripVertical className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-emerald-800">{config.title}</span>
        <button
          onClick={onHide}
          type="button"
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-red-600 bg-white rounded-lg border border-slate-200 hover:border-red-200 transition"
        >
          <EyeOff className="w-3 h-3" /> Hide
        </button>
      </div>
      <div className="p-1 pointer-events-none opacity-50">
        {children}
      </div>
    </div>
  );
}