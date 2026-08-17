import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap, Users, AlertTriangle, CheckCircle2, Clock, Calendar,
  Search, ShieldCheck, BookOpen,
} from 'lucide-react';
import { format, isFuture } from 'date-fns';
import { complianceDaysUntil } from '@/utils/complianceDate';
import TrainingManager from '@/components/TrainingManager';
import { CardGridSkeleton } from '@/components/StateViews';

const CATEGORIES = [
  { id: 'cscs_card', label: 'CSCS Card', short: 'CSCS' },
  { id: 'cpcs_card', label: 'CPCS Card', short: 'CPCS' },
  { id: 'npors_card', label: 'NPORS Card', short: 'NPORS' },
  { id: 'first_aid_cert', label: 'First Aid', short: 'FA' },
  { id: 'driver_license', label: 'Driver License', short: 'DRV' },
  { id: 'dbs_certificate', label: 'DBS', short: 'DBS' },
  { id: 'forklift', label: 'Forklift', short: 'FL' },
];

const STATUS = {
  valid: { label: 'Valid', cls: 'bg-emerald-500 text-white', icon: CheckCircle2 },
  expiring: { label: 'Expiring', cls: 'bg-amber-500 text-white', icon: Clock },
  expired: { label: 'Expired', cls: 'bg-red-500 text-white', icon: AlertTriangle },
  booked: { label: 'Booked', cls: 'bg-blue-500 text-white', icon: Calendar },
  gap: { label: 'Gap', cls: 'bg-white text-red-500 border-2 border-dashed border-red-400', icon: AlertTriangle },
  not_required: { label: 'N/A', cls: 'bg-slate-100 text-slate-300', icon: null },
};

export default function TrainingMatrixHub() {
  const [view, setView] = useState('matrix');

  return (
    <div className="space-y-4">
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
      {view === 'matrix' ? <MatrixView /> : <TrainingManager />}
    </div>
  );
}

function MatrixView() {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');

  const { data: staff = [], isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: compliance = [] } = useQuery({ queryKey: ['compliance-items-staff'], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }) });
  const { data: bookings = [] } = useQuery({ queryKey: ['training-bookings'], queryFn: () => base44.entities.TrainingBooking.list('-created_date', 500) });
  const { data: courses = [] } = useQuery({ queryKey: ['training-courses'], queryFn: () => base44.entities.TrainingCourse.list('-start_date', 200) });

  const courseCategoryMap = useMemo(() => {
    const m = {};
    courses.forEach(c => { m[c.id] = c.category; });
    return m;
  }, [courses]);

  const teamName = (id) => { const t = teams.find(t => t.id === id); if (!t) return '—'; const p = teams.find(p => p.id === t.parent_team_id); return p ? `${p.name} — ${t.name}` : t.name; };

  const getQualStatus = (staffMember, categoryId) => {
    const team = teams.find(t => t.id === staffMember.team_id);
    const required = team?.required_qualifications || [];
    if (!required.includes(categoryId)) return 'not_required';

    const items = compliance.filter(c =>
      (c.reference_id === staffMember.id || c.reference_name === staffMember.name) &&
      c.qualification_type === categoryId
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

    const hasBooking = bookings.some(b =>
      b.staff_id === staffMember.id && b.status === 'booked' &&
      courseCategoryMap[b.course_id] === categoryId
    );
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
      CATEGORIES.forEach(cat => {
        const st = getQualStatus(m, cat.id);
        if (st === 'gap') hasGap = true;
        if (st === 'expiring') hasExpiring = true;
      });
      if (hasGap) gaps++;
      if (hasExpiring) expiring++;
      if (!hasGap && !hasExpiring) qualified++;
    });
    const upcoming = courses.filter(c => isFuture(new Date(c.start_date + 'T00:00:00')) || c.start_date === format(new Date(), 'yyyy-MM-dd'));
    return { total: activeStaff.length, qualified, gaps, expiring, upcoming: upcoming.length };
  }, [staff, teams, compliance, bookings, courses]);

  if (isLoading) return <CardGridSkeleton count={4} />;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <StatTile icon={Users} label="Total Crew" value={stats.total} gradient="stat-gradient-brand" />
        <StatTile icon={CheckCircle2} label="Fully Qualified" value={stats.qualified} gradient="stat-gradient-emerald" />
        <StatTile icon={AlertTriangle} label="Training Gaps" value={stats.gaps} gradient="stat-gradient-rose" />
        <StatTile icon={Clock} label="Expiring Soon" value={stats.expiring} gradient="stat-gradient-amber" />
        <StatTile icon={Calendar} label="Upcoming Courses" value={stats.upcoming} gradient="stat-gradient-blue" />
      </div>

      {/* Filters */}
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
      </div>

      {/* Matrix — Desktop table */}
      <div className="insight-card rounded-2xl p-4 overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="w-5 h-5 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-900">Training Matrix</h3>
          <span className="text-xs text-slate-400">· {filtered.length} crew shown</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide py-2 pr-3 sticky left-0 bg-white">Crew Member</th>
                {CATEGORIES.map(c => (
                  <th key={c.id} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wide py-2 px-1 min-w-[60px]">
                    {c.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                  <td className="py-2 pr-3 sticky left-0 bg-white">
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
                  {CATEGORIES.map(c => {
                    const st = getQualStatus(m, c.id);
                    const cfg = STATUS[st];
                    const Icon = cfg.icon;
                    return (
                      <td key={c.id} className="text-center py-2 px-1">
                        <div className={'inline-flex items-center justify-center w-7 h-7 rounded-lg ' + cfg.cls} title={`${c.label}: ${cfg.label}`}>
                          {Icon ? <Icon className="w-3.5 h-3.5" /> : <span className="text-[10px]">—</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

      {/* Training Gaps */}
      <TrainingGapsSection staff={filtered} teams={teams} getQualStatus={getQualStatus} />

      {/* Upcoming Courses */}
      <UpcomingCoursesSection courses={courses} bookings={bookings} />
    </div>
  );
}

function TrainingGapsSection({ staff, teams, getQualStatus }) {
  const gaps = useMemo(() => {
    return staff.map(m => {
      const missing = CATEGORIES.filter(c => getQualStatus(m, c.id) === 'gap');
      const expiring = CATEGORIES.filter(c => getQualStatus(m, c.id) === 'expiring');
      const expired = CATEGORIES.filter(c => getQualStatus(m, c.id) === 'expired');
      return { staff: m, missing, expiring, expired };
    }).filter(g => g.missing.length > 0 || g.expiring.length > 0 || g.expired.length > 0);
  }, [staff, teams]);

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
      <div className="space-y-2">
        {gaps.map(({ staff: m, missing, expiring, expired }) => (
          <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-[10px]">{m.name.charAt(0)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{m.name}</p>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {missing.map(c => (
                  <span key={c.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200">{c.short} needed</span>
                ))}
                {expired.map(c => (
                  <span key={c.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-700">{c.short} expired</span>
                ))}
                {expiring.map(c => (
                  <span key={c.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">{c.short} expiring</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpcomingCoursesSection({ courses, bookings }) {
  const upcoming = useMemo(() => {
    return courses
      .filter(c => isFuture(new Date(c.start_date + 'T00:00:00')) || c.start_date === format(new Date(), 'yyyy-MM-dd'))
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .slice(0, 5);
  }, [courses]);

  if (upcoming.length === 0) return null;

  return (
    <div className="insight-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5 text-blue-500" />
        <h3 className="text-sm font-bold text-slate-900">Upcoming Courses</h3>
      </div>
      <div className="space-y-2">
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