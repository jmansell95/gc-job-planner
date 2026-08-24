import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowUpRight, Eye, Boxes, AlertTriangle } from 'lucide-react';
import { getDropdownUsage } from '@/utils/dropdownUsageMap';

/**
 * DropdownUsagePanel — the "Where it's used" + "Preview" sections shown inside
 * an expanded Dropdown Manager card. Renders the curated usage map with
 * jump-links, a visual mock of the dropdown widget, and a data-impact summary
 * from the fetched per-option counts.
 *
 * Props:
 *   listKey — the ConfigList key
 *   options — the current option array (draft or saved)
 *   usage   — { mapped, counts, total, entity } from getConfigListUsage (or null/loading)
 */
export default function DropdownUsagePanel({ listKey, options, usage }) {
  const locations = getDropdownUsage(listKey);

  return (
    <div className="space-y-3">
      {/* Where it's used */}
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <MapPin className="w-3.5 h-3.5 text-emerald-700" />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Where it's used</span>
          <span className="ml-auto text-[10px] text-slate-400">{locations.length} location{locations.length !== 1 ? 's' : ''}</span>
        </div>
        {locations.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No usage locations recorded for this list.</p>
        ) : (
          <div className="space-y-1.5">
            {locations.map((loc, i) => (
              <Link
                key={i}
                to={loc.route}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 transition group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {loc.page} <span className="text-slate-400 font-normal">›</span> {loc.section}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{loc.field}</p>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Preview — visual mock of the dropdown widget */}
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Preview</span>
          <span className="text-[10px] text-slate-400 font-normal">· how it looks on the form</span>
        </div>
        <div className="relative">
          <select disabled className="w-full appearance-none px-3 py-2 pr-8 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-500 cursor-not-allowed">
            {(options || []).slice(0, 10).map((o) => (
              <option key={o.value}>{o.label}{o.critical ? ' ●' : ''}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
        </div>
        {(options || []).length > 10 && (
          <p className="text-[10px] text-slate-400 mt-1">+{(options || []).length - 10} more option{(options || []).length - 10 !== 1 ? 's' : ''} not shown in preview</p>
        )}
        <p className="text-[10px] text-slate-400 mt-1 italic">This is a static preview — not a live control.</p>
      </div>

      {/* Data-impact summary */}
      {usage && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Boxes className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Data impact</span>
            {usage.mapped ? (
              <span className="ml-auto text-[10px] text-slate-400">{usage.total} record{usage.total !== 1 ? 's' : ''} use this list</span>
            ) : (
              <span className="ml-auto text-[10px] text-slate-400">no usage tracking</span>
            )}
          </div>
          {usage.mapped ? (
            <p className="text-[10px] text-slate-500">
              Counts shown on each option below are live from <span className="font-mono text-slate-600">{usage.entity}</span>. Rename a label to keep counts; removing an option orphans records still using its value.
            </p>
          ) : (
            <p className="text-[10px] text-slate-400 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-500" />
              This list isn't linked to a tracked entity field, so per-option record counts aren't available.
            </p>
          )}
        </div>
      )}
    </div>
  );
}