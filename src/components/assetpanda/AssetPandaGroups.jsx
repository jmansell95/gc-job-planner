import React, { useState } from 'react';
import { Layers, Plus, Trash2, Loader2, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const TYPE_HINTS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'rig', label: 'Rig' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'lifting', label: 'Lifting Gear' },
  { value: 'portable_appliance', label: 'Portable Appliance (PAT)' },
];

export default function AssetPandaGroups({ form, setForm, config, onSave, saving }) {
  const { toast } = useToast();
  const groups = form.groups || [];

  const updateGroup = (idx, patch) => {
    const next = [...groups];
    next[idx] = { ...next[idx], ...patch };
    setForm({ ...form, groups: next });
  };

  const addGroup = () => {
    setForm({
      ...form,
      groups: [...groups, { group_id: '', label: '', asset_type_hint: 'auto', field_map_overrides: [] }],
    });
  };

  const removeGroup = (idx) => {
    setForm({ ...form, groups: groups.filter((_, i) => i !== idx) });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Layers className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">Groups</h3>
        <span className="text-[11px] text-slate-400 hidden sm:inline">— sync multiple Asset Panda groups from one database</span>
        <button
          onClick={addGroup}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add group
        </button>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-500">
          Each group syncs its own Asset Panda objects into your asset inventory, tagged with the group label so you can
          filter by source on the Assets Hub. Set an asset-type hint to classify all objects in a group as one type,
          or leave it on Auto-detect to classify from each object's name and type field.
        </p>

        {groups.length === 0 && (
          <div className="text-center py-6 text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
            No groups yet. The legacy group ID (if set) is used as a single group. Click <strong>Add group</strong> to sync multiple groups.
          </div>
        )}

        {groups.map((g, idx) => (
          <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2.5 bg-slate-50/40">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex-shrink-0">Group {idx + 1}</span>
              {g.last_sync_summary && (
                <span className="text-[10px] text-emerald-600 font-medium truncate">✓ {g.last_sync_summary}</span>
              )}
              <button
                onClick={() => removeGroup(idx)}
                className="ml-auto p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition flex-shrink-0"
                aria-label="Remove group"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Group ID *</label>
                <input
                  type="text"
                  value={g.group_id || ''}
                  onChange={(e) => updateGroup(idx, { group_id: e.target.value })}
                  placeholder="e.g. 1234-5678"
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Label *</label>
                <input
                  type="text"
                  value={g.label || ''}
                  onChange={(e) => updateGroup(idx, { label: e.target.value })}
                  placeholder="e.g. Rigs, Lifting Gear"
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Asset Type Hint</label>
                <select
                  value={g.asset_type_hint || 'auto'}
                  onChange={(e) => updateGroup(idx, { asset_type_hint: e.target.value })}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500"
                >
                  {TYPE_HINTS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer mt-1.5">
              <input
                type="checkbox"
                checked={g.is_asset_group !== false}
                onChange={(e) => updateGroup(idx, { is_asset_group: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span>Sync as asset group {g.is_asset_group === false && <span className="text-amber-600 font-medium">— reference table (updates existing only, no new records)</span>}</span>
            </label>
          </div>
        ))}

        {groups.length > 0 && (
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save groups
          </button>
        )}
      </div>
    </div>
  );
}