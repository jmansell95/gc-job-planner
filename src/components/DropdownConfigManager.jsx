import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, ListChecks, AlertCircle, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Skeleton } from '@/components/StateViews';
import { useConfigLists } from '@/hooks/useConfigLists';

export default function DropdownConfigManager() {
  const { lists, isLoading, invalidate } = useConfigLists();
  const queryClient = useQueryClient();
  const [expandedKey, setExpandedKey] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  // Group lists by category for display
  const categories = {};
  lists.forEach(l => {
    const cat = l.category || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(l);
  });

  const getDraft = (key) => {
    if (drafts[key]) return drafts[key];
    const list = lists.find(l => l.key === key);
    return { options: list ? JSON.parse(JSON.stringify(list.options || [])) : [] };
  };

  const ensureDraft = (key) => {
    if (!drafts[key]) {
      const list = lists.find(l => l.key === key);
      setDrafts(prev => ({ ...prev, [key]: { options: list ? JSON.parse(JSON.stringify(list.options || [])) : [] } }));
    }
  };

  const addOption = (key) => {
    ensureDraft(key);
    const draft = drafts[key];
    const newOpts = [...draft.options, { value: `custom_${Date.now()}`, label: 'New Option', critical: false }];
    setDrafts(prev => ({ ...prev, [key]: { ...draft, options: newOpts } }));
  };

  const updateOption = (key, idx, field, value) => {
    ensureDraft(key);
    const draft = drafts[key];
    const newOpts = draft.options.map((o, i) => i === idx ? { ...o, [field]: value } : o);
    setDrafts(prev => ({ ...prev, [key]: { ...draft, options: newOpts } }));
  };

  const removeOption = (key, idx) => {
    ensureDraft(key);
    const draft = drafts[key];
    const newOpts = draft.options.filter((_, i) => i !== idx);
    setDrafts(prev => ({ ...prev, [key]: { ...draft, options: newOpts } }));
  };

  const moveOption = (key, idx, dir) => {
    ensureDraft(key);
    const draft = drafts[key];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= draft.options.length) return;
    const opts = [...draft.options];
    [opts[idx], opts[newIdx]] = [opts[newIdx], opts[idx]];
    setDrafts(prev => ({ ...prev, [key]: { ...draft, options: opts } }));
  };

  const save = async (key) => {
    setSavingKey(key);
    const draft = drafts[key];
    const existing = lists.find(l => l.key === key);
    try {
      if (existing?.id) {
        await base44.entities.ConfigList.update(existing.id, { options: draft.options });
      } else {
        await base44.entities.ConfigList.create({ key, ...draft, label: existing?.label || key, category: existing?.category || 'Other', is_system: existing?.is_system || false });
      }
      invalidate();
      setDrafts(prev => { const n = { ...prev }; delete n[key]; return n; });
    } catch (e) {
      console.error('Save failed:', e);
    }
    setSavingKey(null);
  };

  return (
    <div>
      <PageHeader title="Dropdown Manager" icon={ListChecks} subtitle="Add, rename, reorder or remove the options in every dropdown across the app. Changes take effect immediately on all forms." />

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(categories).map(([cat, catLists]) => (
            <div key={cat}>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">{cat}</p>
              <div className="space-y-3">
                {catLists.map(list => {
                  const isOpen = expandedKey === list.key;
                  const draft = drafts[list.key];
                  const hasDraft = !!draft;
                  const opts = (hasDraft ? draft.options : list.options) || [];
                  return (
                    <div key={list.key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button onClick={() => setExpandedKey(isOpen ? null : list.key)}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <ListChecks className="w-4 h-4 text-emerald-700" />
                          </div>
                          <div className="min-w-0 text-left">
                            <p className="text-sm font-semibold text-slate-900 truncate">{list.label}</p>
                            <p className="text-xs text-slate-400">{opts.length} option{opts.length !== 1 ? 's' : ''}{hasDraft ? ' · unsaved changes' : ''}</p>
                          </div>
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                      </button>

                      {isOpen && (
                        <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                          <div className="space-y-2">
                            {opts.map((opt, idx) => {
                              const labelVal = hasDraft ? draft.options[idx].label : opt.label;
                              const isCritical = hasDraft ? draft.options[idx].critical : opt.critical;
                              return (
                                <div key={idx} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-2 py-1.5">
                                  <div className="flex flex-col flex-shrink-0">
                                    <button onClick={() => moveOption(list.key, idx, -1)} disabled={idx === 0} className="text-slate-300 hover:text-emerald-600 disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                                    <button onClick={() => moveOption(list.key, idx, 1)} disabled={idx === opts.length - 1} className="text-slate-300 hover:text-emerald-600 disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                                  </div>
                                  <input value={labelVal}
                                    onChange={(e) => { ensureDraft(list.key); updateOption(list.key, idx, 'label', e.target.value); }}
                                    className="flex-1 min-w-0 text-sm px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-500" />
                                  <button onClick={() => { ensureDraft(list.key); updateOption(list.key, idx, 'critical', !isCritical); }}
                                    title="Mark as critical (red dot)"
                                    className={`flex-shrink-0 px-2 py-1.5 text-xs font-medium rounded-md border transition ${isCritical ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-200 text-slate-400 hover:text-slate-600'}`}>
                                    {isCritical ? '● Critical' : 'Mark critical'}
                                  </button>
                                  <button onClick={() => removeOption(list.key, idx)} title="Remove option"
                                    className="flex-shrink-0 p-1.5 text-red-500 hover:bg-red-50 rounded-md transition">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <button onClick={() => addOption(list.key)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
                              <Plus className="w-4 h-4" /> Add Option
                            </button>
                            {hasDraft && (
                              <button onClick={() => save(list.key)} disabled={savingKey === list.key}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
                                <Check className="w-4 h-4" /> {savingKey === list.key ? 'Saving…' : 'Save Changes'}
                              </button>
                            )}
                            {hasDraft && (
                              <button onClick={() => setDrafts(prev => { const n = { ...prev }; delete n[list.key]; return n; })}
                                className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium">
                                Cancel
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-3 flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            Renaming a label updates it everywhere instantly. The internal <code className="text-slate-600">value</code> is auto-generated for new options and stays stable so existing crew records keep working.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}