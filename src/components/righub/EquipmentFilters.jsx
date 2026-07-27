import React, { useMemo } from 'react';
import { Filter, X } from 'lucide-react';
import { ASSET_TYPE_META } from '@/utils/rigRollup';

/**
 * Equipment filter bar for the Rig Hub equipment view.
 * Lets the user filter by asset type, compliance category and responsible
 * person. Designed to sit above the equipment grid and stay in sync with the
 * existing search + status controls.
 */
export default function EquipmentFilters({
  assets = [],
  filters,
  setFilters,
}) {
  // Build option lists from the actual data so unknown values still appear.
  const { types, categories, people } = useMemo(() => {
    const tSet = new Set();
    const cSet = new Set();
    const pSet = new Set();
    assets.forEach(a => {
      if (a.asset_type) tSet.add(a.asset_type);
      if (a.compliance_category) cSet.add(a.compliance_category);
      if (a.responsible_person) pSet.add(a.responsible_person);
    });
    return {
      types: [...tSet],
      categories: [...cSet],
      people: [...pSet],
    };
  }, [assets]);

  const hasActiveFilter = filters.type || filters.category || filters.person;

  const selectClass =
    'px-2.5 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600 bg-white cursor-pointer';
  const labelClass = 'text-[10px] font-semibold text-slate-400 uppercase tracking-wide';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-slate-400 flex-shrink-0">
        <Filter className="w-3.5 h-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">Filters</span>
      </div>

      {/* Asset type */}
      <div className="flex flex-col">
        <select
          value={filters.type || ''}
          onChange={e => setFilters(f => ({ ...f, type: e.target.value || null }))}
          className={selectClass}
        >
          <option value="">All Types</option>
          {types.map(t => (
            <option key={t} value={t}>{ASSET_TYPE_META[t]?.label || t}</option>
          ))}
        </select>
      </div>

      {/* Compliance category */}
      {categories.length > 0 && (
        <div className="flex flex-col">
          <select
            value={filters.category || ''}
            onChange={e => setFilters(f => ({ ...f, category: e.target.value || null }))}
            className={selectClass}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      {/* Responsible person */}
      {people.length > 0 && (
        <div className="flex flex-col">
          <select
            value={filters.person || ''}
            onChange={e => setFilters(f => ({ ...f, person: e.target.value || null }))}
            className={selectClass}
          >
            <option value="">All People</option>
            {people.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      )}

      {hasActiveFilter && (
        <button
          onClick={() => setFilters({ type: null, category: null, person: null })}
          className="inline-flex items-center gap-1 px-2 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition"
          title="Clear filters"
        >
          <X className="w-3.5 h-3.5" /> Clear
        </button>
      )}
    </div>
  );
}