import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapPin, AlertTriangle, TrendingDown, Loader2 } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';

// Geotechnical Heatmap — aggregates approved delay logs by location to reveal
// which sites repeatedly cause ground-condition / utility / weather delays.
// Gives ops leaders a "risk heatmap" before they bid work in an area.
export default function GeotechnicalHeatmapWidget() {
  const { data: delays = [], isLoading } = useQuery({
    queryKey: ['geo-heatmap-delays'],
    queryFn: () => base44.entities.JobDelayLog.filter({ manager_review_status: 'approved' })
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['geo-heatmap-jobs'],
    queryFn: () => base44.entities.Job.list()
  });

  const jobMap = {};
  jobs.forEach(j => { jobMap[j.id] = j; });

  // Aggregate by location, weighted by impacted_days
  const byLocation = {};
  delays.forEach(d => {
    const job = jobMap[d.job_id];
    const loc = job?.location || d.job_name || 'Unknown';
    if (!byLocation[loc]) byLocation[loc] = { location: loc, count: 0, days: 0, types: {} };
    byLocation[loc].count++;
    byLocation[loc].days += Number(d.impacted_days) || 0;
    const t = d.delay_type || 'other';
    byLocation[loc].types[t] = (byLocation[loc].types[t] || 0) + 1;
  });

  const rows = Object.values(byLocation).sort((a, b) => b.days - a.days);
  const maxDays = Math.max(1, ...rows.map(r => r.days));

  const riskTone = (days) => {
    if (days === 0) return { bg: 'bg-slate-100', text: 'text-slate-600', bar: 'bg-slate-300' };
    if (days <= 1) return { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-400' };
    if (days <= 3) return { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-400' };
    return { bg: 'bg-rose-50', text: 'text-rose-700', bar: 'bg-rose-500' };
  };

  return (
    <WidgetShell icon={MapPin} title="Geotechnical Risk Heatmap" subtitle="Sites with the highest approved delay impact">
      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
          No approved delay logs yet — risk heatmap builds as delays are reported.
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.slice(0, 6).map(row => {
            const tone = riskTone(row.days);
            const pct = Math.round((row.days / maxDays) * 100);
            const topType = Object.entries(row.types).sort((a, b) => b[1] - a[1])[0];
            return (
              <div key={row.location} className={`rounded-lg ${tone.bg} p-3`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-slate-800 truncate">{row.location}</span>
                  </div>
                  <span className={`text-xs font-bold ${tone.text} flex-shrink-0`}>{row.days} day{row.days !== 1 ? 's' : ''}</span>
                </div>
                <div className="w-full bg-white/60 rounded-full h-1.5 mb-1.5">
                  <div className={`${tone.bar} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>{row.count} delay{row.count !== 1 ? 's' : ''}</span>
                  {topType && <span className="capitalize">· {topType[0].replace(/_/g, ' ')}</span>}
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="text-xs text-slate-400 text-center pt-2">No risk patterns detected.</p>
          )}
        </div>
      )}
    </WidgetShell>
  );
}