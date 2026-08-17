import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { complianceDaysUntil } from '@/utils/complianceDate';

/**
 * CompetencyGate — checks whether a staff member holds the required
 * qualifications for a job's team. Used in the rota builder and job
 * assignment flows to block or warn about non-compliant assignments.
 *
 * Props:
 *   staffId       — the staff member being assigned
 *   teamId        — the team they're being assigned to (provides required_qualifications)
 *   teams         — array of Team entities (optional; fetched if not passed)
 *   compact       — render a compact inline badge instead of a full panel
 */
export default function CompetencyGate({ staffId, teamId, teams: passedTeams, compact = false }) {
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
    enabled: !passedTeams,
  });
  const teamList = passedTeams || teams;
  const { data: compliance = [] } = useQuery({
    queryKey: ['compliance-items-staff'],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
  });

  const result = useMemo(() => {
    const team = teamList.find(t => t.id === teamId);
    if (!team) return { checked: false, missing: [], expiring: [], valid: [] };
    const required = team.required_qualifications || [];
    if (required.length === 0) return { checked: true, missing: [], expiring: [], valid: [], noRequirements: true };

    const staffItems = compliance.filter(c =>
      (c.reference_id === staffId || c.reference_name === staffId)
    );

    const missing = [];
    const expiring = [];
    const valid = [];

    for (const qualType of required) {
      const items = staffItems.filter(c => c.qualification_type === qualType);
      let foundValid = false;
      let foundExpiring = false;
      for (const item of items) {
        if (item.status_override === 'not_required') { foundValid = true; break; }
        if (item.status_override === 'missing') continue;
        const days = complianceDaysUntil(item.expiry_date);
        if (days === null) { foundValid = true; break; }
        if (days < 0) continue;
        if (days <= 30) { foundExpiring = true; }
        else { foundValid = true; break; }
      }
      if (foundValid) valid.push(qualType);
      else if (foundExpiring) expiring.push(qualType);
      else missing.push(qualType);
    }

    return { checked: true, missing, expiring, valid, noRequirements: false };
  }, [teamList, teamId, compliance, staffId]);

  if (!result.checked) return null;

  if (result.noRequirements) {
    if (compact) return <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium"><ShieldCheck className="w-3 h-3" />No specific certs required</span>;
    return null;
  }

  const hasGaps = result.missing.length > 0;
  const hasExpiring = result.expiring.length > 0;
  const isCompliant = !hasGaps && !hasExpiring;

  if (compact) {
    if (isCompliant) return <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />Compliant</span>;
    if (hasGaps) return <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" />{result.missing.length} missing</span>;
    return <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" />{result.expiring.length} expiring</span>;
  }

  return (
    <div className={'rounded-xl border p-3 ' + (hasGaps ? 'border-red-200 bg-red-50' : hasExpiring ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50')}>
      <div className="flex items-center gap-2 mb-2">
        {isCompliant ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
        <p className="text-xs font-bold text-slate-800">
          {isCompliant ? 'Compliance Verified' : hasGaps ? 'Compliance Block — Missing Certifications' : 'Compliance Warning — Expiring Soon'}
        </p>
      </div>
      {result.missing.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {result.missing.map(q => (
            <span key={q} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
              <X className="w-2.5 h-2.5" />{q.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
      {result.expiring.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.expiring.map(q => (
            <span key={q} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              {q.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
      {isCompliant && (
        <p className="text-[10px] text-emerald-600 font-medium">All required certifications are valid and in date.</p>
      )}
    </div>
  );
}