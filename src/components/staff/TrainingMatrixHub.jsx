import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap, Users, AlertTriangle, CheckCircle2, Clock, Calendar,
  Search, ShieldCheck, BookOpen, Plus, Trash2, X, Settings, GripVertical,
  IdCard, Car, Award, CreditCard, FileText, Loader2, UserPlus,
} from 'lucide-react';
import { format, isFuture } from 'date-fns';
import { complianceDaysUntil } from '@/utils/complianceDate';
import TrainingManager from '@/components/TrainingManager';
import QualificationDetailSheet from '@/components/staff/QualificationDetailSheet';
import AssignTrainingModal from '@/components/staff/AssignTrainingModal';
import { CardGridSkeleton } from '@/components/StateViews';
import { useToast } from '@/components/ui/use-toast';

const ICON_MAP = { IdCard, Car, Award, CreditCard, FileText, ShieldCheck, GraduationCap };

const STATUS = {
  valid: { label: 'Valid', cls: 'bg-emerald-500 text-white', icon: CheckCircle2, hover: 'hover:bg-emerald-600' },
  expiring: { label: 'Expiring', cls: 'bg-amber-500 text-white', icon: Clock, hover: 'hover:bg-amber-600' },
  expired: { label: 'Expired', cls: 'bg-red-500 text-white', icon: AlertTriangle, hover: 'hover:bg-red-600' },
  booked: { label: 'Booked', cls: 'bg-blue-500 text-white', icon: Calendar, hover: 'hover:bg-blue-600' },
  gap: { label: 'Gap', cls: 'bg-white text-red-500 border-2 border-dashed border-red-400', icon: AlertTriangle, hover: 'hover:bg-red-50' },
  not_required: { label: 'N/A', cls: 'bg-slate-100 text-slate-300', icon: null, hover: '' },
};

const DEFAULT_CATEGORIES = [
  { label: 'CSCS Card', short_code: 'CSCS', qualification_type: 'cscs_card', requires_front_back: true, is_card: true, icon: 'IdCard', sort_order: 0, is_active: true },
  { label: 'CPCS Card', short_code: 'CPCS', qualification_type: 'cpcs_card', requires_front_back: true, is_card: true, icon: 'IdCard', sort_order: 1, is_active: true },
  { label: 'NPORS Card', short_code: 'NPORS', qualification_type: 'npors_card', requires_front_back: true, is_card: true, icon: 'IdCard', sort_order: 2, is_active: true },
  { label: 'First Aid', short_code: 'FA', qualification_type: 'first_aid_cert', requires_front_back: false, is_card: false, icon: 'ShieldCheck', sort_order: 3, is_active: true },
  { label: 'Driver License', short_code: 'DRV', qualification_type: 'driver_license', requires_front_back: true, is_card: true, icon: 'Car', sort_order: 4, is_active: true },
  { label: 'DBS', short_code: 'DBS', qualification_type: 'dbs_certificate', requires_front_back: false, is_card: false, icon: 'FileText', sort_order: 5, is_active: true },
  { label: 'Forklift', short_code: 'FL', qualification_type: 'forklift', requires_front_back: false, is_card: false, icon: 'Award', sort_order: 6, is_active: true },
];

export default function TrainingMatrixHub() {
  const [view, setView] = useState('matrix');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit">
          <button onClick={() => setView('matrix')}
            className={'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ' +
              (view === 'matrix' ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <ShieldCheck className="w-3.5 h-3.5" /> Matrix
          </button>
          <button onClick={() => setView('courses')}
            className={'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ' +
              (view === 'courses' ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <BookOpen className="w-3.5 h-3.5" /> Courses
          </button>
        </div>
        {view === 'matrix' && <MatrixActions />}
      </div>
      {view === 'matrix' ? <MatrixView /> : <TrainingManager />}
    </div>
  );
}

/** Placeholder for top-level actions — rendered inside MatrixView where data lives. */
function MatrixActions() { return null; }

function MatrixView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [showManage, setShowManage] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null); // { staff, category }
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assignPreselect, setAssignPreselect] = useState({ ids: [], category: null });

  const { data: staff = [], isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: compliance = [] } = useQuery({ queryKey: ['compliance-items-staff'], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }) });
  const { data: bookings = [] } = useQuery({ queryKey: ['training-bookings'], queryFn: () => base44.entities.TrainingBooking.list('-created_date', 500) });
  const { data: courses = [] } = useQuery({ queryKey: ['training-courses'], queryFn: () => base44.entities.TrainingCourse.list('-start_date', 200) });
  const { data: requirements = [] } = useQuery({ queryKey: ['training-requirements'], queryFn: () => base44.entities.TrainingRequirement.list('sort_order', 100) });

  useEffect(() => {
    if (requirements.length === 0) {
      (async () => {
        try {
          await base44.entities.TrainingRequirement.bulkCreate(DEFAULT_CATEGORIES);
          queryClient.invalidateQueries({ queryKey: ['training-requirements'] });
        } catch (e) { /* ignore */ }
      })();
    }
  }, [requirements.length]);

  const categories = useMemo(() => {
    return requirements.filter(r => r.is_active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [requirements]);

  const courseCategoryMap = useMemo(() => {
    const m = {}; courses.forEach(c => { m[c.id] = c.category; }); return m;
  }, [courses]);

  const teamName = (id) => { const t = teams.find(t => t.id === id); if (!t) return '—'; const p = teams.find(p => p.id === t.parent_team_id); return p ? `${p.name} — ${t.name}` : t.name; };

  const getQualStatus = (staffMember, qualType) => {
    const team = teams.find(t => t.id === staffMember.team_id);
    const required = team?.required_qualifications || [];
    if (!required.includes(qualType)) return 'not_required';
    const items = compliance.filter(c =>
      (c.reference_id === staffMember.id || c.reference_name === staffMember.name) &&
      c.qualification_type === qualType
    );
    for (const item of items) {
      if (item.status_override === 'not_required') return 'not_required';
      if (item.status_override === 'missing') continue;
      const days = complianceDaysUntil(item.expiry_date);
      if (days === null) return 'valid';
      if (days < 0) continue;
      if (days <= 30) return 'expiring';
      return 'valid';
    }
    const hasBooking = bookings.some(b => b.staff_id === staffMember.id && b.status === 'booked' && courseCategoryMap[b.course_id] === qualType);
    if (hasBooking) return 'booked';
    return 'gap';
  };

  const filtered = useMemo(() => staff.filter(m => {
    const ms = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase());
    const mt = teamFilter === 'all' || m.team_id === teamFilter;
    return ms && mt && m.is_active !== false;
  }), [staff, search, teamFilter]);

  const stats = useMemo(() => {
    const activeStaff = staff.filter(s => s.is_active !== false);
    let gaps = 0, expiring = 0, qualified = 0;
    activeStaff.forEach(m => {
      let hasGap = false, hasExpiring = false;
      categories.forEach(cat => {
        const st = getQualStatus(m, cat.qualification_type);
        if (st === 'gap') hasGap = true;
        if (st === 'expiring') hasExpiring = true;
      });
      if (hasGap) gaps++;
      if (hasExpiring) expiring++;
      if (!hasGap && !hasExpiring) qualified++;
    });
    const upcoming = courses.filter(c => isFuture(new Date(c.start_date + 'T00:00:00')) || c.start_date === format(new Date(), 'yyyy-MM-dd'));
    return { total: activeStaff.length, qualified, gaps, expiring, upcoming: upcoming.length };
  }, [staff, teams, compliance, bookings, courses, categories]);

  const allSelected = filtered.length > 0 && filtered.every(m => selectedStaffIds.includes(m.id));
  const toggleAll = () => {
    if (allSelected) setSelectedStaffIds([]);
    else setSelectedStaffIds(filtered.map(m => m.id));
  };
  const toggleOne = (id) => {
    setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const openAssign = (ids, category = null) => {
    setAssignPreselect({ ids, category });
    setShowAssign(true);
  };

  if (isLoading) return <CardGridSkeleton count={4} />;

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <StatTile icon={Users} label="Total Crew" value={stats.total} gradient="stat-gradient-brand" />
        <StatTile icon={CheckCircle2} label="Fully Qualified" value={stats.qualified} gradient="stat-gradient-emerald" />
        <StatTile icon={AlertTriangle} label="Training Gaps" value={stats.gaps} gradient="stat-gradient-rose" />
        <StatTile icon={Clock} label="Expiring Soon" value={stats.expiring} gradient="stat-gradient-amber" />
        <StatTile icon={Calendar} label="Upcoming Courses" value={stats.upcoming} gradient="stat-gradient-blue" />
      </div>

      {/* Filters + actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search crew…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/10 focus:border-[#2E5A1A]" />
        </div>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/10 focus:border-[#2E5A1A] bg-white">
          <option value="all">All Crews</option>
          {teams.map(t => <option key={t.id} value={t.id}>{teamName(t.id)}</option>)}
        </select>
        <button onClick={() => openAssign([])}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#2E5A1A] text-white text-sm font-semibold hover:bg-[#1c4a12] transition shadow-sm">
          <UserPlus className="w-4 h-4" /> Assign Training
        </button>
        <button onClick={() => setShowManage(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition bg-white">
          <Settings className="w-4 h-4" /> Manage
        </button>
      </div>

      {/* Bulk action bar */}
      {selectedStaffIds.length > 0 && (
        <div className="sticky top-2 z-30 flex items-center gap-3 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl shadow-lg animate-slide-up">
          <span className="text-xs font-bold">{selectedStaffIds.length} selected</span>
          <div className="h-4 w-px bg-white/30" />
          <button onClick={() => openAssign(selectedStaffIds)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            <UserPlus className="w-3.5 h-3.5" /> Book Selected
          </button>
          <button onClick={() => setSelectedStaffIds([])}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white px-2 py-1.5 rounded-lg transition">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      )}

      {/* Matrix */}
      <div className="insight-card rounded-2xl p-4 overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="w-5 h-5 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-900">Training Matrix</h3>
          <span className="text-xs text-slate-400">· {filtered.length} crew · {categories.length} categories</span>
          <span className="text-[10px] text-slate-400 ml-auto hidden sm:block">Click a cell to update · Tick to bulk-assign</span>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm font-semibold text-slate-600">No training categories configured</p>
            <p className="text-xs text-slate-400 mt-1">Click "Manage" to add training categories for your matrix.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-2 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <button onClick={toggleAll}
                        className={'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ' + (allSelected ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300 bg-white hover:border-slate-400')}>
                        {allSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </button>
                    </div>
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide py-2 pr-3 sticky left-8 bg-white z-10 min-w-[180px]">Crew Member</th>
                  {categories.map(c => {
                    const Icon = ICON_MAP[c.icon] || Award;
                    return (
                      <th key={c.id} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wide py-2 px-1 min-w-[60px]">
                        <div className="flex flex-col items-center gap-0.5">
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          {c.short_code}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const isChecked = selectedStaffIds.includes(m.id);
                  return (
                    <tr key={m.id} className={'border-b border-slate-50 transition ' + (isChecked ? 'bg-[#2E5A1A]/5' : 'hover:bg-slate-50/50')}>
                      <td className="py-2 pr-2 sticky left-0 bg-white z-10">
                        <button onClick={() => toggleOne(m.id)}
                          className={'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ' + (isChecked ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300 bg-white hover:border-slate-400')}>
                          {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </button>
                      </td>
                      <td className="py-2 pr-3 sticky left-8 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-[10px]">{m.name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{m.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{teamName(m.team_id)}</p>
                          </div>
                        </div>
                      </td>
                      {categories.map(c => {
                        const st = getQualStatus(m, c.qualification_type);
                        const cfg = STATUS[st];
                        const Icon = cfg.icon;
                        const isGap = st === 'gap' || st === 'expired';
                        return (
                          <td key={c.id} className="text-center py-2 px-1">
                            <button
                              onClick={() => setSelectedCell({ staff: m, category: c })}
                              title={`${c.label}: ${cfg.label} — click to update`}
                              className={'inline-flex items-center justify-center w-7 h-7 rounded-lg transition ' + cfg.cls + ' ' + (isGap ? 'animate-pulse' : '') + ' hover:scale-110 hover:shadow-md cursor-pointer'}
                            >
                              {Icon ? <Icon className="w-3.5 h-3.5" /> : <span className="text-[10px]">—</span>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-slate-100">
          {Object.entries(STATUS).filter(([k]) => k !== 'not_required').map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className={'w-4 h-4 rounded ' + v.cls} />
              <span className="text-[10px] font-medium text-slate-500">{v.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-slate-100" />
            <span className="text-[10px] font-medium text-slate-500">Not Required</span>
          </div>
        </div>
      </div>

      {/* Side-by-side: Needs Attention + Upcoming Courses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TrainingGapsSection staff={filtered} teams={teams} categories={categories} getQualStatus={getQualStatus} onBookTraining={openAssign} />
        <UpcomingCoursesSection courses={courses} bookings={bookings} onBookTraining={openAssign} />
      </div>

      {/* Modals & Sheets */}
      {selectedCell && (
        <QualificationDetailSheet
          open={!!selectedCell}
          onOpenChange={(v) => { if (!v) setSelectedCell(null); }}
          staff={selectedCell.staff}
          category={selectedCell.category}
          complianceItems={compliance}
          bookings={bookings}
          courses={courses}
          onBookTraining={(ids, cat) => { setSelectedCell(null); openAssign(ids, cat); }}
        />
      )}
      {showAssign && (
        <AssignTrainingModal
          preselectedStaffIds={assignPreselect.ids}
          preselectedCategory={assignPreselect.category}
          staff={staff}
          courses={courses}
          onClose={() => setShowAssign(false)}
        />
      )}
      {showManage && (
        <ManageCategoriesModal requirements={requirements} onClose={() => setShowManage(false)} />
      )}
    </div>
  );
}

function ManageCategoriesModal({ requirements, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: '', short_code: '', qualification_type: '', requires_front_back: false,
    is_card: false, icon: 'Award', sort_order: requirements.length, is_active: true,
  });

  const sorted = [...requirements].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.label.trim() || !form.short_code.trim() || !form.qualification_type.trim()) {
      toast({ title: 'All fields required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.TrainingRequirement.create({
        ...form,
        short_code: form.short_code.toUpperCase(),
        sort_order: parseInt(form.sort_order) || 0,
      });
      queryClient.invalidateQueries({ queryKey: ['training-requirements'] });
      toast({ title: 'Training category added' });
      setForm({ label: '', short_code: '', qualification_type: '', requires_front_back: false, is_card: false, icon: 'Award', sort_order: requirements.length, is_active: true });
      setShowForm(false);
    } catch (err) {
      toast({ title: 'Could not save', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (req) => {
    if (!confirm(`Delete "${req.label}" from the training matrix? Existing compliance items will be retained but this column will no longer appear.`)) return;
    try {
      await base44.entities.TrainingRequirement.delete(req.id);
      queryClient.invalidateQueries({ queryKey: ['training-requirements'] });
      toast({ title: 'Category deleted' });
    } catch (err) {
      toast({ title: 'Could not delete', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggle = async (req) => {
    try {
      await base44.entities.TrainingRequirement.update(req.id, { is_active: !req.is_active });
      queryClient.invalidateQueries({ queryKey: ['training-requirements'] });
    } catch (err) {
      toast({ title: 'Could not update', description: err.message, variant: 'destructive' });
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10';
  const labelClass = 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2E5A1A] flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Training Categories</h3>
              <p className="text-xs text-slate-500">Add, remove and manage the columns in your training matrix</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-2 mb-4">
          {sorted.map(req => {
            const Icon = ICON_MAP[req.icon] || Award;
            return (
              <div key={req.id} className={'flex items-center gap-3 p-3 rounded-xl border transition ' + (req.is_active === false ? 'border-slate-100 bg-slate-50/50 opacity-60' : 'border-slate-200 bg-white')}>
                <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                <div className={'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ' + (req.is_card ? 'bg-violet-50' : 'bg-emerald-50')}>
                  <Icon className={'w-4 h-4 ' + (req.is_card ? 'text-violet-600' : 'text-emerald-600')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{req.label}</p>
                  <p className="text-[10px] text-slate-400">{req.short_code} · {req.qualification_type}{req.is_card ? ' · Card type' : ''}</p>
                </div>
                <button onClick={() => handleToggle(req)} className={'text-[10px] font-bold px-2 py-1 rounded-lg ' + (req.is_active === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700')}>
                  {req.is_active === false ? 'Hidden' : 'Active'}
                </button>
                <button onClick={() => handleDelete(req)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <div className="text-center py-6 text-slate-400">
              <p className="text-sm font-medium">No categories yet</p>
              <p className="text-xs mt-0.5">Add your first training category below</p>
            </div>
          )}
        </div>

        {showForm ? (
          <form onSubmit={handleSave} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">New Training Category</p>
              <button type="button" onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Label *</label>
                <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Confined Space" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Short Code *</label>
                <input value={form.short_code} onChange={e => setForm({ ...form, short_code: e.target.value.toUpperCase().slice(0, 4) })} placeholder="e.g. CS" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Qualification Type Key *</label>
              <input value={form.qualification_type} onChange={e => setForm({ ...form, qualification_type: e.target.value.toLowerCase().replace(/\s+/g, '_') })} placeholder="e.g. confined_space" className={inputClass} />
              <p className="text-[10px] text-slate-400 mt-1">Must match the key used in compliance items and courses.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Icon</label>
                <select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className={inputClass}>
                  <option value="Award">Award</option>
                  <option value="IdCard">ID Card</option>
                  <option value="Car">Car</option>
                  <option value="ShieldCheck">Shield</option>
                  <option value="CreditCard">Credit Card</option>
                  <option value="FileText">File</option>
                  <option value="GraduationCap">Graduation Cap</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Sort Order</label>
                <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                <input type="checkbox" checked={form.is_card} onChange={e => setForm({ ...form, is_card: e.target.checked, requires_front_back: e.target.checked ? true : form.requires_front_back })} className="w-4 h-4 accent-[#2E5A1A]" />
                Card type (shows front/back)
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                <input type="checkbox" checked={form.requires_front_back} onChange={e => setForm({ ...form, requires_front_back: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
                Requires front/back images
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">
                {saving ? 'Saving…' : 'Add Category'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">Cancel</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm font-semibold text-slate-500 hover:border-[#2E5A1A] hover:text-[#2E5A1A] hover:bg-[#2E5A1A]/5 transition">
            <Plus className="w-4 h-4" /> Add Training Category
          </button>
        )}
      </div>
    </div>
  );
}

function TrainingGapsSection({ staff, teams, categories, getQualStatus, onBookTraining }) {
  const gaps = useMemo(() => {
    return staff.map(m => {
      const missing = categories.filter(c => getQualStatus(m, c.qualification_type) === 'gap');
      const expiring = categories.filter(c => getQualStatus(m, c.qualification_type) === 'expiring');
      const expired = categories.filter(c => getQualStatus(m, c.qualification_type) === 'expired');
      return { staff: m, missing, expiring, expired };
    }).filter(g => g.missing.length > 0 || g.expiring.length > 0 || g.expired.length > 0);
  }, [staff, teams, categories]);

  if (gaps.length === 0) {
    return (
      <div className="insight-card rounded-2xl p-5 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-700">All crew are fully qualified</p>
        <p className="text-xs text-slate-400 mt-0.5">No training gaps or expiring qualifications detected.</p>
      </div>
    );
  }

  return (
    <div className="insight-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        <h3 className="text-sm font-bold text-slate-900">Needs Attention</h3>
        <span className="text-xs text-slate-400">· {gaps.length} crew members</span>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {gaps.map(({ staff: m, missing, expiring, expired }) => (
          <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-[10px]">{m.name.charAt(0)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{m.name}</p>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {missing.map(c => (
                  <span key={c.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200">{c.short_code} needed</span>
                ))}
                {expired.map(c => (
                  <span key={c.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-700">{c.short_code} expired</span>
                ))}
                {expiring.map(c => (
                  <span key={c.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">{c.short_code} expiring</span>
                ))}
              </div>
            </div>
            <button onClick={() => onBookTraining([m.id])}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-[#2E5A1A] text-white hover:bg-[#1c4a12] transition flex-shrink-0">
              <UserPlus className="w-3 h-3" /> Book
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpcomingCoursesSection({ courses, bookings, onBookTraining }) {
  const upcoming = useMemo(() => {
    return courses
      .filter(c => isFuture(new Date(c.start_date + 'T00:00:00')) || c.start_date === format(new Date(), 'yyyy-MM-dd'))
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .slice(0, 6);
  }, [courses]);

  if (upcoming.length === 0) {
    return (
      <div className="insight-card rounded-2xl p-5 text-center">
        <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-700">No upcoming courses</p>
        <p className="text-xs text-slate-400 mt-0.5">Switch to the Courses tab to schedule one.</p>
      </div>
    );
  }

  return (
    <div className="insight-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5 text-blue-500" />
        <h3 className="text-sm font-bold text-slate-900">Upcoming Courses</h3>
        <span className="text-xs text-slate-400">· next {upcoming.length}</span>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {upcoming.map(c => {
          const count = bookings.filter(b => b.course_id === c.id).length;
          return (
            <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-50/50 border border-blue-100">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate">{c.title}</p>
                <p className="text-[10px] text-slate-400">{format(new Date(c.start_date + 'T00:00'), 'dd MMM yyyy')}{c.venue ? ` · ${c.venue}` : ''}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">{count} booked</span>
              <button onClick={() => onBookTraining([], c.category)}
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-white text-[#2E5A1A] border border-[#2E5A1A]/20 hover:bg-[#2E5A1A]/5 transition flex-shrink-0">
                <UserPlus className="w-3 h-3" /> Assign
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, gradient }) {
  return (
    <div className={`${gradient} rounded-xl p-3 text-white relative overflow-hidden shadow-sm`}>
      <Icon className="absolute right-2 top-2 w-6 h-6 opacity-20" />
      <div className="relative">
        <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-extrabold tabular-nums mt-0.5">{value}</p>
      </div>
    </div>
  );
}