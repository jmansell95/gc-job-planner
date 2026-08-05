import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, ShieldCheck, Search, AlertCircle } from 'lucide-react';

const QUAL_TYPES = [
  { key: 'cscs_card', label: 'CSCS', short: 'CSCS' },
  { key: 'cpcs_card', label: 'CPCS', short: 'CPCS' },
  { key: 'npors_card', label: 'NPORS', short: 'NPORS' },
  { key: 'first_aid_cert', label: 'First Aid', short: 'FA' },
  { key: 'driver_license', label: 'Driving Licence', short: 'DL' },
  { key: 'dbs_certificate', label: 'DBS', short: 'DBS' },
  { key: 'forklift', label: 'Forklift', short: 'FLT' },
  { key: 'other', label: 'Other', short: 'OTH' },
];

function parseDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}$/.test(str)) return new Date(str + '-01T00:00:00');
  return new Date(str + 'T00:00:00');
}

function getStatus(complianceItem) {
  if (!complianceItem) return 'missing';
  if (complianceItem.status_override === 'not_required') return 'na';
  if (complianceItem.status_override === 'missing') return 'missing';
  if (!complianceItem.expiry_date) return 'unknown';
  const d = parseDate(complianceItem.expiry_date);
  if (!d || isNaN(d.getTime())) return 'unknown';
  const days = Math.floor((d - new Date()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'compliant';
}

const STATUS_STYLES = {
  compliant: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: '✓' },
  expiring: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: '⚠' },
  expired: { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500', label: '✗' },
  missing: { bg: 'bg-slate-100', text: 'text-slate-400', dot: 'bg-slate-300', label: '—' },
  unknown: { bg: 'bg-slate-50', text: 'text-slate-400', dot: 'bg-slate-300', label: '?' },
  na: { bg: 'bg-slate-50', text: 'text-slate-300', dot: 'bg-slate-200', label: 'N/A' },
};

export default function SkillsMatrix() {
  const [search, setSearch] = useState('');

  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff-skills-matrix'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });
  const { data: complianceItems = [], isLoading: compLoading } = useQuery({
    queryKey: ['compliance-items-staff-matrix'],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
  });

  // Build lookup: staffId + qualType -> compliance item
  const itemMap = useMemo(() => {
    const map = {};
    for (const c of complianceItems) {
      const key = `${c.reference_id || c.reference_name}|${c.qualification_type || 'other'}`;
      map[key] = c;
    }
    return map;
  }, [complianceItems]);

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staff;
    const q = search.toLowerCase();
    return staff.filter(s => (s.name || '').toLowerCase().includes(q) || (s.job_title || '').toLowerCase().includes(q));
  }, [staff, search]);

  // Compute summary stats
  const stats = useMemo(() => {
    let compliant = 0, expiring = 0, expired = 0, missing = 0;
    for (const s of staff) {
      for (const qt of QUAL_TYPES) {
        const item = itemMap[`${s.id}|${qt.key}`];
        const status = getStatus(item);
        if (status === 'compliant') compliant++;
        else if (status === 'expiring') expiring++;
        else if (status === 'expired') expired++;
        else if (status === 'missing') missing++;
      }
    }
    return { compliant, expiring, expired, missing };
  }, [staff, itemMap]);

  if (staffLoading || compLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
          <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Compliant</p>
          <p className="text-xl font-bold text-emerald-700 tabular-nums">{stats.compliant}</p>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">Expiring</p>
          <p className="text-xl font-bold text-amber-700 tabular-nums">{stats.expiring}</p>
        </div>
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2">
          <p className="text-[10px] font-medium text-rose-600 uppercase tracking-wide">Expired</p>
          <p className="text-xl font-bold text-rose-700 tabular-nums">{stats.expired}</p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Missing</p>
          <p className="text-xl font-bold text-slate-600 tabular-nums">{stats.missing}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff or job title..."
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10"
        />
      </div>

      {/* Matrix */}
      {filteredStaff.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No staff found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2.5 font-semibold text-slate-700 text-xs whitespace-nowrap sticky left-0 bg-slate-50 z-10">
                  Staff Member
                </th>
                {QUAL_TYPES.map(qt => (
                  <th key={qt.key} className="px-2 py-2.5 text-center font-semibold text-slate-600 text-xs whitespace-nowrap" title={qt.label}>
                    {qt.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                  <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-inherit z-10 border-r border-slate-100">
                    <p className="font-medium text-slate-800 text-xs">{s.name}</p>
                    {s.job_title && <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{s.job_title}</p>}
                  </td>
                  {QUAL_TYPES.map(qt => {
                    const item = itemMap[`${s.id}|${qt.key}`];
                    const status = getStatus(item);
                    const style = STATUS_STYLES[status];
                    return (
                      <td key={qt.key} className="px-2 py-2 text-center">
                        <div
                          className={`w-7 h-7 rounded-lg ${style.bg} ${style.text} flex items-center justify-center text-xs font-bold mx-auto`}
                          title={item ? `${qt.label}: ${item.title || ''}${item.expiry_date ? ` (exp ${item.expiry_date})` : ''}` : `${qt.label}: not recorded`}
                        >
                          {style.label}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_STYLES).filter(([k]) => k !== 'na').map(([key, style]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-4 h-4 rounded ${style.bg} ${style.text} flex items-center justify-center text-[10px] font-bold`}>
              {style.label}
            </span>
            <span className="text-slate-500 capitalize">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}