import React, { useState } from 'react';
import { GripVertical, EyeOff, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { WIDGET_REGISTRY } from '@/components/dashboard/registry';

const SIZE_LABELS = { sm: 'S', md: 'M', lg: 'L' };

// Widgets that stay expanded by default — the most critical at-a-glance panels.
// Everything else defaults to collapsed so the dashboard loads clean and tidy.
const EXPANDED_BY_DEFAULT = new Set([
  'executive-snapshot',
  'field-crews',
  'field-priorities',
]);

export default function WidgetCard({ widgetId, customizeMode, dragHandleProps, onHide, size = 'md', onResize, onMoveUp, onMoveDown, canMoveUp = true, canMoveDown = true, children }) {
  const config = WIDGET_REGISTRY[widgetId];
  const [collapsed, setCollapsed] = useState(!EXPANDED_BY_DEFAULT.has(widgetId));

  if (!config) return <div>{children}</div>;

  // ── Normal mode — collapsible card with header ──
  if (!customizeMode) {
    const Icon = config.icon;
    return (
      <div className="insight-card rounded-2xl overflow-hidden">
        {/* Header — clickable to toggle collapse */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 transition text-left group"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 group-hover:text-[#2E5A1A] transition" />
            : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 group-hover:text-[#2E5A1A] transition" />
          }
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm icon-tile-glow">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{config.title}</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full transition ${collapsed ? 'bg-slate-100 text-slate-500' : 'bg-[#2E5A1A]/10 text-[#2E5A1A]'}`}>
            {collapsed ? 'Show' : 'Hide'}
          </span>
        </button>
        {/* Content — only when expanded */}
        {!collapsed && (
          <div className="p-3 border-t border-slate-100">
            {children}
          </div>
        )}
      </div>
    );
  }

  // ── Customize mode — full edit controls ──
  return (
    <div className="rounded-2xl overflow-hidden bg-white/80 backdrop-blur-sm ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-slate-50 shadow-lg">
      <div
        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 cursor-grab active:cursor-grabbing select-none"
        {...dragHandleProps}
      >
        <GripVertical className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-emerald-800 truncate">{config.title}</span>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          {/* Click to reorder — no dragging needed */}
          <div className="flex items-center gap-0.5 bg-white rounded-lg border border-slate-200 p-0.5">
            <button onClick={onMoveUp} type="button" disabled={!canMoveUp}
              className="w-6 h-6 flex items-center justify-center rounded transition disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 hover:bg-slate-100 enabled:hover:text-emerald-700">
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={onMoveDown} type="button" disabled={!canMoveDown}
              className="w-6 h-6 flex items-center justify-center rounded transition disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 hover:bg-slate-100 enabled:hover:text-emerald-700">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
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