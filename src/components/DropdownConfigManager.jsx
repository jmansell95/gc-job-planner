import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  Plus, Trash2, ChevronDown, ChevronUp, ListChecks, AlertCircle, Check,
  Search, Hash, ShieldAlert, History, Loader2,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { Skeleton } from '@/components/StateViews';
import { useConfigLists } from '@/hooks/useConfigLists';
import DropdownUsagePanel from '@/components/dropdowns/DropdownUsagePanel';

const fmtRel = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'today';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return ''; }
};

export default function DropdownConfigManager() {
  const { lists, isLoading, invalidate } = useConfigLists();
  const { user: authUser } = useAuth();
  const [expandedKey, setExpandedKey] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Per-option record counts — fetched on card expand (not on page load).
  const { data: usage, isFetching: usageLoading } = useQuery({
    queryKey: ['configlist-usage', expandedKey],
    queryFn: async () => {
      const res = await base44.functions.invoke('getConfigListUsage', { key: expandedKey });
      return res.data;
    },
    enabled: !!expandedKey,
    retry: 1,
  });

  const categories = useMemo(() => {
    const cats = {};
    lists.forEach((l) => {
      const c = l.category || 'Other';
      if (!cats[c]) cats[c] = [];
      cats[c].push(l);
    });
    return cats;
  }, [lists]);

  const categoryNames = useMemo(() => ['All', ...Object.keys(categories).sort()], [categories]);

  const filteredLists = useMemo(() => {
    const q = search.toLowerCase().trim();
    return lists.filter((l) => {
      if (activeCategory !== 'All' && (l.category || 'Other') !== activeCategory) return false;
      if (!q) return true;
      if (l.label?.toLowerCase().includes(q)) return true;
      if (l.key?.toLowerCase().includes(q)) return true;
      return (l.options || []).some((o) => o.label?.toLowerCase().includes(q));
    });
  }, [lists, search, activeCategory]);

  const grouped = useMemo(() => {
    const g = {};
    filteredLists.forEach((l) => {
      const c = l.category || 'Other';
      if (!g[c]) g[c] = [];
      g[c].push(l);
    });
    return g;
  }, [filteredLists]);

  const getDraft = (key) => {
    if (drafts[key]) return drafts[key];
    const list = lists.find((l) => l.key === key);
    return { options: list ? JSON.parse(JSON.stringify(list.options || [])) : [] };
  };

  const ensureDraft = (key) => {
    if (!drafts[key]) {
      const list = lists.find((l) => l.key === key);
      setDrafts((prev) => ({ ...prev, [key]: { options: list ? JSON.parse(JSON.stringify(list.options || [])) : [] } }));
    }
  };

  const addOption = (key) => {
    ensureDraft(key);
    const draft = drafts[key];
    setDrafts((prev) => ({ ...prev, [key]: { ...draft, options: [...draft.options, { value: `custom_${Date.now()}`, label: 'New Option', critical: false }] } }));
  };

  const updateOption = (key, idx, field, value) => {
    ensureDraft(key);
    const draft = drafts[key];
    setDrafts((prev) => ({ ...prev, [key]: { ...draft, options: draft.options.map((o, i) => (i === idx ? { ...o, [field]: value } : o)) } }));
  };

  const removeOption = (key, idx) => {
    ensureDraft(key);
    const draft = drafts[key];
    setDrafts((prev) => ({ ...prev, [key]: { ...draft, options: draft.options.filter((_, i) => i !== idx) } }));
  };

  const moveOption = (key, idx, dir) => {
    ensureDraft(key);
    const draft = drafts[key];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= draft.options.length) return;
    const opts = [...draft.options];
    [opts[idx], opts[newIdx]] = [opts[newIdx], opts[idx]];
    setDrafts((prev) => ({ ...prev, [key]: { ...draft, options: opts } }));
  };

  const save = async (key) => {
    setSavingKey(key);
    const draft = drafts[key];
    const existing = lists.find((l) => l.key === key);
    try {
      const editorName = authUser?.full_name || authUser?.email || 'Admin';
      if (existing?.id) {
        await base44.entities.ConfigList.update(existing.id, { options: draft.options, last_edited_by: editorName });
      } else {
        await base44.entities.ConfigList.create({ key, ...draft, label: existing?.label || key, category: existing?.category || 'Other', is_system: existing?.is_system || false, last_edited_by: editorName });
      }
      invalidate();
      setDrafts((prev) => { const n = { ...prev }; delete n[key]; return n; });
    } catch (e) {
      console.error('Save failed:', e);
    }
    setSavingKey(null);
  };

  return (
    <div>
      <SettingsSectionHeader icon={ListChecks} title="Dropdown Manager" description="Add, rename, reorder or remove the options in every dropdown across the app. Each card shows where it's used, a preview, and how many records use each option." />

      {/* Search + category filter */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm py-2 mb-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by dropdown name, key, or option…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categoryNames.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${activeCategory === cat ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-400">No dropdowns match your search.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, catLists]) => (
            <div key={cat}>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">{cat}</p>
              <div className="space-y-3">
                {catLists.map((list) => {
                  const isOpen = expandedKey === list.key;
                  const hasDraft = !!drafts[list.key];
                  const opts = (hasDraft ? drafts[list.key].options : list.options) || [];
                  const criticalCount = opts.filter((o) => o.critical).length;
                  const lastEditedBy = list.last_edited_by;
                  const updated = list.updated_date;
                  return (
                    <div key={list.key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button onClick={() => setExpandedKey(isOpen ? null : list.key)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <ListChecks className="w-4 h-4 text-emerald-700" />
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-900 truncate">{list.label}</p>
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-mono">
                                <Hash className="w-2.5 h-2.5" />{list.key}
                              </span>
                              {criticalCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold">
                                  <ShieldAlert className="w-2.5 h-2.5" />{criticalCount} critical
                                </span>
                              )}
                              {hasDraft && <span className="text-[10px] text-amber-600 font-bold">· unsaved</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                              <span>{opts.length} option{opts.length !== 1 ? 's' : ''}</span>
                              {(lastEditedBy || updated) && (
                                <span className="flex items-center gap-1">
                                  <span>·</span>
                                  <History className="w-2.5 h-2.5" />
                                  {updated && fmtRel(updated)}{lastEditedBy ? ` by ${lastEditedBy}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                      </button>

                      {isOpen && (
                        <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                          {/* Usage map + preview + data-impact summary */}
                          <div className="mb-4">
                            {usageLoading && !usage ? (
                              <div className="flex items-center justify-center py-4 text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading usage…
                              </div>
                            ) : (
                              <DropdownUsagePanel listKey={list.key} options={opts} usage={usage} />
                            )}
                          </div>

                          {/* Option editor with per-option usage counts */}
                          <div className="space-y-2">
                            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Options</p>
                            {opts.map((opt, idx) => {
                              const labelVal = hasDraft ? drafts[list.key].options[idx].label : opt.label;
                              const isCritical = hasDraft ? drafts[list.key].options[idx].critical : opt.critical;
                              const count = usage?.counts?.[opt.value];
                              return (
                                <div key={idx} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-2 py-1.5">
                                  <div className="flex flex-col flex-shrink-0">
                                    <button onClick={() => moveOption(list.key, idx, -1)} disabled={idx === 0} className="text-slate-300 hover:text-emerald-600 disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                                    <button onClick={() => moveOption(list.key, idx, 1)} disabled={idx === opts.length - 1} className="text-slate-300 hover:text-emerald-600 disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                                  </div>
                                  <input value={labelVal}
                                    onChange={(e) => { ensureDraft(list.key); updateOption(list.key, idx, 'label', e.target.value); }}
                                    className="flex-1 min-w-0 text-sm px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-500" />
                                  {count != null && (
                                    <span className="flex-shrink-0 px-1.5 py-1 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold tabular-nums" title={`${count} record${count !== 1 ? 's' : ''} use this value`}>
                                      {count}
                                    </span>
                                  )}
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
                                {savingKey === list.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {savingKey === list.key ? 'Saving…' : 'Save Changes'}
                              </button>
                            )}
                            {hasDraft && (
                              <button onClick={() => setDrafts((prev) => { const n = { ...prev }; delete n[list.key]; return n; })}
                                className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium">
                                Cancel
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-3 flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            Renaming a label updates it everywhere instantly. The internal <code className="text-slate-600">value</code> is auto-generated for new options and stays stable so existing records keep working.
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