import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Building2, Plus, Pencil, Trash2, Users, Database, Zap, Check, X, Loader2, AlertTriangle, ChevronDown,
} from 'lucide-react';

const DIVISION_TYPES = [
  { value: 'geotechnical', label: 'Geotechnical', color: '#2E5A1A', hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'investigation', 'compliance', 'billing', 'settings'] },
  { value: 'environmental', label: 'Environmental', color: '#0d9488', hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'compliance', 'billing', 'settings'] },
  { value: 'surveys', label: 'Surveys', color: '#2563eb', hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'compliance', 'billing', 'settings'] },
  { value: 'structural', label: 'Structural', color: '#7c3aed', hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'compliance', 'billing', 'settings'] },
  { value: 'renewables', label: 'Renewables', color: '#d97706', hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'compliance', 'billing', 'settings'] },
  { value: 'general', label: 'General', color: '#475569', hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'compliance', 'billing', 'settings'] },
];

const ALL_HUBS = ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'investigation', 'compliance', 'billing', 'settings'];

export default function DivisionManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState('divisions'); // divisions | staff | migration
  const [editing, setEditing] = useState(null); // division being edited or 'new'
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);

  const { data: divisions = [], isLoading } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-division-mgr'],
    queryFn: () => base44.entities.Staff.list('-created_date', 500),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['divisions'] });
    queryClient.invalidateQueries({ queryKey: ['staff-division-mgr'] });
    queryClient.invalidateQueries({ queryKey: ['staff'] });
  };

  const runMigration = async () => {
    setMigrating(true);
    setMigrationResult(null);
    try {
      const res = await base44.functions.invoke('migrateToDivisions', {});
      setMigrationResult(res.data);
      toast({ title: 'Migration complete', description: 'All existing data tagged to the Geotechnical division.' });
      invalidate();
    } catch (e) {
      toast({ title: 'Migration failed', description: e.message, variant: 'destructive' });
    } finally {
      setMigrating(false);
    }
  };

  const tabs = [
    { id: 'divisions', label: 'Divisions', icon: Building2 },
    { id: 'staff', label: 'Staff Assignment', icon: Users },
    { id: 'migration', label: 'Migration', icon: Database },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="insight-card rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Division Manager</h2>
            <p className="text-sm text-slate-500">Create divisions, link staff, and tag existing data. Each division is an isolated workspace sharing the same core platform.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-x-auto no-scrollbar">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${tab === t.id ? 'command-gradient text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Divisions tab */}
      {tab === 'divisions' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl command-gradient text-white text-sm font-semibold shadow-md hover:shadow-lg transition">
              <Plus className="w-4 h-4" /> New Division
            </button>
          </div>
          {isLoading ? (
            <div className="h-40 animate-pulse bg-slate-100 rounded-2xl" />
          ) : divisions.length === 0 ? (
            <div className="insight-card rounded-2xl p-8 text-center">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">No divisions yet</p>
              <p className="text-xs text-slate-400 mt-1">Create your first division, or run the migration to auto-create the Geotechnical division.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {divisions.map(d => (
                <div key={d.id} className="insight-card relative rounded-2xl p-4 overflow-hidden">
                  <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: d.color || '#2E5A1A' }} />
                  <div className="pl-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: d.color || '#2E5A1A' }}>
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-900 truncate">{d.name}</h3>
                        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{d.code} · {d.division_type}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => setEditing(d)} className="p-1.5 rounded-lg hover:bg-slate-100 transition"><Pencil className="w-4 h-4 text-slate-400" /></button>
                      <button onClick={async () => {
                        if (!confirm(`Delete division "${d.name}"? Records will keep their division_id but the division card disappears.`)) return;
                        try { await base44.entities.Division.delete(d.id); toast({ title: 'Division deleted' }); invalidate(); }
                        catch (e) { toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }); }
                      }} className="p-1.5 rounded-lg hover:bg-rose-50 transition"><Trash2 className="w-4 h-4 text-rose-400" /></button>
                    </div>
                  </div>
                  {d.description && <p className="pl-2 mt-2 text-xs text-slate-500 line-clamp-2">{d.description}</p>}
                  <div className="pl-2 mt-2 flex flex-wrap gap-1">
                    {(d.enabled_hubs || []).map(h => (
                      <span key={h} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">{h}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Staff Assignment tab */}
      {tab === 'staff' && (
        <div className="insight-card rounded-2xl p-4">
          <p className="text-sm text-slate-500 mb-3">Assign each staff member to a division. This controls which division's data they see across the platform.</p>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {staff.map(s => {
              const div = divisions.find(d => d.id === s.division_id);
              return (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                    {(s.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                    <p className="text-xs text-slate-400 truncate">{s.job_title || s.email || 'No title'}</p>
                  </div>
                  <DivisionSelect
                    divisions={divisions}
                    value={s.division_id || ''}
                    onChange={async (newId) => {
                      try {
                        await base44.entities.Staff.update(s.id, { division_id: newId || null });
                        if (s.user_id) { try { await base44.entities.User.update(s.user_id, { division_id: newId || null }); } catch {} }
                        toast({ title: 'Division updated' });
                        invalidate();
                      } catch (e) { toast({ title: 'Update failed', description: e.message, variant: 'destructive' }); }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Migration tab */}
      {tab === 'migration' && (
        <div className="insight-card rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-slate-900">Tag Existing Data</h3>
              <p className="text-sm text-slate-500 mt-1">
                This one-time migration creates the default <strong>Geotechnical</strong> division (if it doesn't exist) and tags every existing Staff, Job, Vehicle, Rota and Timesheet record to it — so all your current data is correctly scoped to the Geotechnical division.
              </p>
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Run this once after adding the <code>division_id</code> fields. It only affects records that don't already have a division assigned — safe to re-run.</p>
              </div>
              <button
                onClick={runMigration}
                disabled={migrating}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl command-gradient text-white text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-60 transition">
                {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {migrating ? 'Running Migration…' : 'Run Migration'}
              </button>
              {migrationResult && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm font-bold text-emerald-800">Migration Complete</p>
                  </div>
                  <p className="text-xs text-emerald-700 mb-2">
                    {migrationResult.divisionCreated ? 'Created' : 'Using'} division: <strong>{migrationResult.divisionName}</strong>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(migrationResult.counts || {}).map(([k, v]) => (
                      <div key={k} className="bg-white rounded-lg p-2 border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">{k}</p>
                        <p className="text-sm font-bold text-slate-800 tabular-nums">{v.tagged} / {v.total} tagged</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create modal */}
      {editing && (
        <DivisionEditor
          division={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate(); }}
        />
      )}
    </div>
  );
}

function DivisionSelect({ divisions, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, [open]);
  const current = divisions.find(d => d.id === value);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition min-w-[130px]">
        {current ? (
          <>
            <span className="w-2 h-2 rounded-full" style={{ background: current.color || '#2E5A1A' }} />
            <span className="truncate flex-1 text-left">{current.name}</span>
          </>
        ) : (
          <span className="text-slate-400 flex-1 text-left">Unassigned</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 py-1 max-h-60 overflow-y-auto" onClick={e => e.stopPropagation()}>
          <button onClick={() => { onChange(''); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 text-left">
            <span className="w-2 h-2 rounded-full bg-slate-300" /> Unassigned
          </button>
          {divisions.map(d => (
            <button key={d.id} onClick={() => { onChange(d.id); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 text-left">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color || '#2E5A1A' }} />
              <span className="truncate">{d.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DivisionEditor({ division, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(() => ({
    name: division?.name || '',
    code: division?.code || '',
    division_type: division?.division_type || 'general',
    description: division?.description || '',
    color: division?.color || '#475569',
    is_active: division?.is_active !== false,
    status: division?.status || 'setup',
    sort_order: division?.sort_order || 0,
    enabled_hubs: division?.enabled_hubs || [...ALL_HUBS],
  }));
  const [saving, setSaving] = useState(false);

  const setHubsFromType = (type) => {
    const preset = DIVISION_TYPES.find(t => t.value === type);
    setForm(f => ({ ...f, division_type: type, color: preset?.color || f.color, enabled_hubs: division ? f.enabled_hubs : (preset?.hubs || f.enabled_hubs) }));
  };

  const toggleHub = (h) => {
    setForm(f => {
      const hubs = f.enabled_hubs.includes(h) ? f.enabled_hubs.filter(x => x !== h) : [...f.enabled_hubs, h];
      return { ...f, enabled_hubs: hubs };
    });
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: 'Name and code are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, code: form.code.toUpperCase().trim() };
      if (division) {
        await base44.entities.Division.update(division.id, payload);
        toast({ title: 'Division updated' });
      } else {
        await base44.entities.Division.create(payload);
        toast({ title: 'Division created' });
      }
      onSaved();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900">{division ? 'Edit Division' : 'New Division'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Geotechnical"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Code</label>
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="GEO" maxLength={6}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 outline-none text-sm uppercase" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Division Type</label>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {DIVISION_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setHubsFromType(t.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition ${form.division_type === t.value ? 'border-[#2E5A1A] bg-emerald-50 text-[#2E5A1A]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} /> {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 outline-none text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Brand Colour</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                <input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                <option value="setup">Setup</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Enabled Hubs</label>
            <p className="text-[11px] text-slate-400 mt-0.5">Which hubs show in this division's sidebar. Geotechnical includes Investigation; others typically don't.</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ALL_HUBS.map(h => (
                <button key={h} type="button" onClick={() => toggleHub(h)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${form.enabled_hubs.includes(h) ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {h}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg command-gradient text-white text-sm font-bold shadow-md disabled:opacity-60 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {division ? 'Save Changes' : 'Create Division'}
          </button>
        </div>
      </div>
    </div>
  );
}