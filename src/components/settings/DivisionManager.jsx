import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Building2, Plus, Pencil, Trash2, Users, Database, Zap, Check, X, Loader2,
  AlertTriangle, ChevronDown, Search, ArrowRight, Layers, ShieldCheck, Navigation,
} from 'lucide-react';
import DivisionEditor from '@/components/settings/DivisionEditor';
import { resolveNavItems } from '@/utils/divisionNav';

const DIVISION_TYPES = [
  { value: 'geotechnical', label: 'Geotechnical', color: '#2E5A1A', hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'investigation', 'compliance', 'billing', 'settings'] },
  { value: 'environmental', label: 'Environmental', color: '#0d9488', hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'compliance', 'billing', 'settings'] },
  { value: 'surveys', label: 'Surveys', color: '#2563eb', hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'compliance', 'billing', 'settings'] },
  { value: 'structural', label: 'Structural', color: '#7c3aed', hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'compliance', 'billing', 'settings'] },
  { value: 'renewables', label: 'Renewables', color: '#d97706', hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'compliance', 'billing', 'settings'] },
  { value: 'general', label: 'General', color: '#475569', hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'compliance', 'billing', 'settings'] },
];

const ALL_HUBS = ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'investigation', 'compliance', 'billing', 'settings'];

const STATUS_STYLES = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', label: 'Active', dot: 'bg-emerald-500' },
  setup: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', label: 'Setup', dot: 'bg-amber-500' },
  on_hold: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200', label: 'On Hold', dot: 'bg-slate-400' },
};

export default function DivisionManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState('divisions');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const [staffSearch, setStaffSearch] = useState('');

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

  // Staff count per division
  const divisionStaffCounts = useMemo(() => {
    const counts = {};
    for (const s of staff) {
      if (s.division_id) counts[s.division_id] = (counts[s.division_id] || 0) + 1;
    }
    return counts;
  }, [staff]);

  const filteredStaff = useMemo(() => {
    const q = staffSearch.toLowerCase().trim();
    if (!q) return staff;
    return staff.filter(s => (s.name || '').toLowerCase().includes(q) || (s.job_title || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q));
  }, [staff, staffSearch]);

  const tabs = [
    { id: 'divisions', label: 'Divisions', icon: Building2 },
    { id: 'staff', label: 'Staff Assignment', icon: Users },
    { id: 'migration', label: 'Migration', icon: Database },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="insight-card rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md flex-shrink-0">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
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

      {/* ═══ Divisions tab ═══ */}
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
              {divisions.map(d => {
                const st = STATUS_STYLES[d.status || 'setup'] || STATUS_STYLES.setup;
                const staffCount = divisionStaffCounts[d.id] || 0;
                const hubCount = (d.enabled_hubs || []).length;
                const navCount = resolveNavItems(d).length;
                const typeLabel = (DIVISION_TYPES.find(t => t.value === d.division_type) || {}).label || d.division_type;
                return (
                  <div key={d.id} className="insight-card relative rounded-2xl overflow-hidden">
                    <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${d.color || '#2E5A1A'}, ${d.color || '#2E5A1A'}99)` }} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md" style={{ background: `linear-gradient(135deg, ${d.color || '#2E5A1A'}, ${d.color || '#2E5A1A'}cc)` }}>
                            <Building2 className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-extrabold text-slate-900 truncate">{d.name}</h3>
                            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{d.code} {'\u00B7'} {typeLabel}</p>
                            {d.tagline && <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{d.tagline}</p>}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.text} ring-1 ${st.ring} flex-shrink-0`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                        </span>
                      </div>

                      {d.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{d.description}</p>}

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-slate-50 rounded-xl p-2.5 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 tabular-nums leading-none">{staffCount}</p>
                            <p className="text-[9px] text-slate-400 uppercase font-bold">Staff</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2.5 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 tabular-nums leading-none">{hubCount}</p>
                            <p className="text-[9px] text-slate-400 uppercase font-bold">Hubs</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2.5 flex items-center gap-1.5">
                          <Navigation className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 tabular-nums leading-none">{navCount}</p>
                            <p className="text-[9px] text-slate-400 uppercase font-bold">Nav</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {(d.enabled_hubs || []).slice(0, 6).map(h => (
                          <span key={h} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">{h}</span>
                        ))}
                        {(d.enabled_hubs || []).length > 6 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">+{(d.enabled_hubs || []).length - 6}</span>
                        )}
                      </div>

                      <div className="flex gap-1.5 pt-3 border-t border-slate-100">
                        <button onClick={() => setEditing(d)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => setDeleting(d)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition">
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Staff Assignment tab ═══ */}
      {tab === 'staff' && (
        <div className="insight-card rounded-2xl p-4">
          {/* Division summary chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {divisions.map(d => (
              <span key={d.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color || '#2E5A1A' }} />
                {d.name}
                <span className="text-slate-400 tabular-nums">{divisionStaffCounts[d.id] || 0}</span>
              </span>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={staffSearch}
              onChange={e => setStaffSearch(e.target.value)}
              placeholder="Search staff by name, title or email..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10"
            />
          </div>

          <p className="text-xs text-slate-500 mb-2">Assign each staff member to a division. This controls which division's data they see across the platform.</p>
          <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
            {filteredStaff.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">No staff match "{staffSearch}"</div>
            ) : filteredStaff.map(s => {
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

      {/* ═══ Migration tab ═══ */}
      {tab === 'migration' && (
        <div className="insight-card rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-slate-900">Tag Existing Data</h3>
              <p className="text-sm text-slate-500 mt-1">
                This one-time migration creates the default <strong>Geotechnical</strong> division (if it doesn't exist) and tags every existing Staff, Job, Vehicle, Rota and Timesheet record to it — so all your current data is correctly scoped to the Geotechnical division. It also syncs each linked user's division so RLS isolation works correctly.
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
                        <p className="text-sm font-bold text-slate-800 tabular-nums">{v.tagged !== undefined ? `${v.tagged} / ${v.total} tagged` : `${v.synced} synced`}</p>
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

      {/* Delete confirmation modal */}
      {deleting && (
        <DeleteDivisionModal
          division={deleting}
          staffCount={divisionStaffCounts[deleting.id] || 0}
          onCancel={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); invalidate(); }}
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

function DeleteDivisionModal({ division, staffCount, onCancel, onDeleted }) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const doDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.Division.delete(division.id);
      toast({ title: 'Division deleted' });
      onDeleted();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancel}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Delete "{division.name}"?</h3>
            <p className="text-xs text-slate-500">This action cannot be undone.</p>
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600">{staffCount} staff member{staffCount === 1 ? '' : 's'} currently assigned</span>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Records keep their <code>division_id</code> tag but the division card disappears from the switcher and Enterprise Dashboard. Staff assigned here will become "unassigned" until reassigned.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={doDelete} disabled={deleting} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold shadow-md hover:bg-rose-700 disabled:opacity-60 transition">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete Division
          </button>
        </div>
      </div>
    </div>
  );
}

// DivisionEditor is now imported from '@/components/settings/DivisionEditor'