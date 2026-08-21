import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, XCircle, GraduationCap, Users, ChevronDown, ChevronUp, ShieldX } from 'lucide-react';
import { complianceDaysUntil } from '@/utils/complianceDate';
import { Skeleton, EmptyState } from '@/components/StateViews';

// All qualification/training types including the extra site-safety ones
export const ALL_QUALIFICATIONS = [
  { value: 'cscs_card', label: 'CSCS Card', critical: true },
  { value: 'cpcs_card', label: 'CPCS Card' },
  { value: 'npors_card', label: 'NPORS Card' },
  { value: 'first_aid_cert', label: 'First Aid Certificate' },
  { value: 'driver_license', label: 'Driver License' },
  { value: 'dbs_certificate', label: 'DBS Certificate' },
  { value: 'forklift', label: 'Forklift Training' },
  { value: 'sts_triple', label: 'STS Triple (STS)' },
  { value: 'confined_space', label: 'Confined Space' },
  { value: 'asbestos_awareness', label: 'Asbestos Awareness' },
  { value: 'manual_handling', label: 'Manual Handling' },
  { value: 'working_at_height', label: 'Working at Height' },
  { value: 'other', label: 'Other' },
];

const QUAL_LABELS = Object.fromEntries(ALL_QUALIFICATIONS.map(q => [q.value, q.label]));
const CRITICAL_QUALS = new Set(ALL_QUALIFICATIONS.filter(q => q.critical).map(q => q.value));

function getStatus(qualType, complianceItems) {
  // Find matching compliance item by qualification_type (normal types) or title contains (extra types)
  const matches = complianceItems.filter(c => {
    if (c.qualification_type === qualType) return true;
    // Extra site-safety types that aren't in the enum are stored as 'other' with a matching title
    if (qualType === 'sts_triple' || qualType === 'confined_space' || qualType === 'asbestos_awareness' || qualType === 'manual_handling' || qualType === 'working_at_height') {
      return c.qualification_type === 'other' && c.title && c.title.toLowerCase().includes(qualType.replace(/_/g, ' '));
    }
    return false;
  });
  if (matches.length === 0) return { status: 'missing', label: 'Missing', Icon: XCircle, color: 'text-red-600 bg-red-50' };
  // Check expiry on the most recent
  const sorted = matches.sort((a, b) => (b.expiry_date || '').localeCompare(a.expiry_date || ''));
  const item = sorted[0];
  if (item.status_override === 'missing') return { status: 'missing', label: 'Missing', Icon: XCircle, color: 'text-red-600 bg-red-50' };
  if (item.status_override === 'not_required') return { status: 'ok', label: 'Not Required', Icon: CheckCircle2, color: 'text-slate-400 bg-slate-50' };
  if (!item.expiry_date) return { status: 'ok', label: 'On File', Icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' };
  const days = complianceDaysUntil(item.expiry_date);
  if (days === null) return { status: 'ok', label: 'On File', Icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' };
  if (days < 0) return { status: 'expired', label: 'Expired', Icon: ShieldX, color: 'text-red-600 bg-red-50' };
  if (days <= 30) return { status: 'expiring', label: `${days}d left`, Icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' };
  return { status: 'ok', label: 'Valid', Icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' };
}

export default function TrainingGapAnalysis() {
  const [expandedTeam, setExpandedTeam] = useState(null);

  const { data: teams = [], isLoading: teamsLoading } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: staff = [], isLoading: staffLoading } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: compliance = [], isLoading: complianceLoading } = useQuery({
    queryKey: ['compliance-gap-analysis'],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' })
  });
  const { data: bookings = [] } = useQuery({ queryKey: ['training-bookings-gap'], queryFn: () => base44.entities.TrainingBooking.list('-created_date', 500) });

  const isLoading = teamsLoading || staffLoading || complianceLoading;

  // Only teams with required qualifications
  const teamsWithReqs = teams.filter(t => (t.required_qualifications || []).length > 0);

  // Build per-team gap analysis
  const teamGaps = useMemo(() => {
    return teamsWithReqs.map(team => {
      const teamStaff = staff.filter(s => s.team_id === team.id && s.is_active !== false);
      const reqs = team.required_qualifications || [];
      const staffGaps = teamStaff.map(s => {
        const myCompliance = compliance.filter(c => c.reference_id === s.id || c.reference_name === s.name);
        const upcomingTraining = bookings.filter(b => b.staff_id === s.id && (b.status === 'booked' || b.status === 'attended'));
        const qualStatuses = reqs.map(q => ({
          qual: q,
          ...getStatus(q, myCompliance),
          inTraining: upcomingTraining.some(b => {
            const course = bookings.find(c => c.id === b.course_id);
            return false; // course category would need lookup; keep simple
          }),
        }));
        const missing = qualStatuses.filter(q => q.status === 'missing');
        const expired = qualStatuses.filter(q => q.status === 'expired');
        const expiring = qualStatuses.filter(q => q.status === 'expiring');
        return { staff: s, qualStatuses, missing, expired, expiring, hasGap: missing.length > 0 || expired.length > 0 };
      });
      const gapCount = staffGaps.filter(sg => sg.hasGap).length;
      return { team, staffGaps, gapCount, totalStaff: teamStaff.length };
    });
  }, [teamsWithReqs, staff, compliance, bookings]);

  const totalGaps = teamGaps.reduce((sum, tg) => sum + tg.gapCount, 0);
  const totalStaffAtRisk = teamGaps.reduce((sum, tg) => sum + tg.gapCount, 0);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    );
  }

  if (teamsWithReqs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200">
        <EmptyState
          icon={GraduationCap}
          title="No required qualifications set"
          message="Go to Settings → Crews and set required qualifications for each crew. Staff missing those qualifications will appear here as training gaps."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Crews Tracked</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{teamsWithReqs.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-red-600 uppercase">Staff at Risk</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{totalStaffAtRisk}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-amber-600 uppercase">Quals Required</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{new Set(teamsWithReqs.flatMap(t => t.required_qualifications)).size}</p>
        </div>
      </div>

      {/* Per-team gap cards */}
      {teamGaps.map(({ team, staffGaps, gapCount, totalStaff }) => {
        const isExpanded = expandedTeam === team.id;
        const allQuals = team.required_qualifications || [];
        return (
          <div key={team.id} className={`bg-white rounded-2xl border overflow-hidden transition ${gapCount > 0 ? 'border-red-200' : 'border-emerald-200'}`}>
            <button onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
              className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-50 transition">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${gapCount > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                {gapCount > 0 ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900">{team.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {allQuals.length} required qual{allQuals.length !== 1 ? 's' : ''} · {totalStaff} staff
                  {gapCount > 0 && <span className="text-red-600 font-medium"> · {gapCount} with gaps</span>}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {allQuals.map(q => (
                    <span key={q} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
                      {QUAL_LABELS[q] || q}
                    </span>
                  ))}
                </div>
              </div>
              {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100 p-4 space-y-3">
                {staffGaps.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-3">No active staff in this crew.</p>
                ) : (
                  staffGaps.map(({ staff: s, qualStatuses, missing, expired, expiring, hasGap }) => (
                    <div key={s.id} className={`rounded-xl p-3 border ${hasGap ? 'border-red-100 bg-red-50/40' : 'border-slate-100 bg-slate-50/40'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-xs">{s.name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{s.name}</p>
                            <p className="text-xs text-slate-400 truncate">
                              {s.worker_type?.replace(/_/g, ' ')}
                              {s.date_of_birth && <span className="text-slate-300"> · DOB {new Date(s.date_of_birth + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                            </p>
                          </div>
                        </div>
                        {hasGap ? (
                          <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0">
                            {missing.length + expired.length} gap{(missing.length + expired.length) !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3 inline mr-0.5" /> Compliant
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {qualStatuses.map(qs => {
                          const Icon = qs.Icon;
                          return (
                            <span key={qs.qual} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${qs.color}`}>
                              <Icon className="w-3 h-3" />
                              {QUAL_LABELS[qs.qual] || qs.qual}
                              <span className="opacity-70">· {qs.label}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}