import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, AlertTriangle, FileText, Calendar } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import ModernBadge from '@/components/ui/ModernBadge';
import { useMittiStatus } from '@/hooks/useSafetyCultureStatus';

/**
 * Phase 6 — Safety: Safety Dashboard widget.
 *
 * Shows safety stats — days since last incident, open reports,
 * recent safety culture audits, and compliance briefing status.
 */
export default function SafetyDashboardWidget() {
  const { isConnected: scConnected } = useMittiStatus();
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['safety-reports-dashboard'],
    queryFn: () => base44.entities.SafetyReport.list('-created_date', 50),
  });

  const { data: briefings = [] } = useQuery({
    queryKey: ['safety-briefings-recent'],
    queryFn: () => base44.entities.BriefingSignature.list('-signed_at', 50),
  });

  const stats = useMemo(() => {
    // When Mitti is not connected, zero out all Mitti-derived
    // stats so stale demo/orphan records don't surface as live data.
    if (!scConnected) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const recentBriefings = briefings.filter(b => b.signed_at && b.signed_at >= sevenDaysAgo).length;
      return { open: 0, closed: 0, incidents: 0, daysSinceIncident: null, recentBriefings };
    }
    const open = reports.filter(r => r.status === 'open').length;
    const closed = reports.filter(r => r.status === 'closed').length;
    const incidents = reports.filter(r => r.type === 'incident' || r.severity === 'high').length;

    // Days since last incident
    const lastIncident = reports
      .filter(r => r.type === 'incident' || r.severity === 'high')
      .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''))[0];
    const daysSinceIncident = lastIncident?.created_date
      ? Math.floor((Date.now() - new Date(lastIncident.created_date).getTime()) / 86400000)
      : null;

    // Briefings in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const recentBriefings = briefings.filter(b => b.signed_at && b.signed_at >= sevenDaysAgo).length;

    return { open, closed, incidents, daysSinceIncident, recentBriefings };
  }, [reports, briefings, scConnected]);

  const recentReports = reports.slice(0, 5);

  return (
    <WidgetShell icon={ShieldCheck} title="Safety Dashboard" subtitle="Incidents, reports & briefing compliance">
      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-slate-50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{stats.daysSinceIncident !== null ? stats.daysSinceIncident : '—'}</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Days Safe</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-rose-600 tabular-nums">{stats.open}</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Open</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-slate-600 tabular-nums">{stats.closed}</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Closed</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-blue-600 tabular-nums">{stats.recentBriefings}</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Briefings</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse bg-slate-100 rounded-lg" />
      ) : !scConnected ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mb-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Mitti not connected</p>
          <p className="text-xs text-slate-400 mt-0.5">Safety stats will appear once the integration is configured</p>
        </div>
      ) : recentReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No safety reports</p>
          <p className="text-xs text-slate-400 mt-0.5">All clear — keep it up</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {recentReports.map(r => (
            <div key={r.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/50 transition">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                r.status === 'open' ? 'bg-rose-50' : 'bg-slate-50'
              }`}>
                <AlertTriangle className={`w-4 h-4 ${r.status === 'open' ? 'text-rose-600' : 'text-slate-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{r.type || 'Safety Report'}</p>
                <p className="text-[11px] text-slate-400 truncate">{r.content?.slice(0, 60) || 'No description'}</p>
              </div>
              <ModernBadge variant={r.status === 'open' ? 'danger' : 'neutral'} size="xs">
                {r.status || 'unknown'}
              </ModernBadge>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}