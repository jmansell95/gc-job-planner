import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, TrendingUp, TrendingDown, Award } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { format } from 'date-fns';

export default function AuditScoreTrendsWidget() {
  const { data: reports = [] } = useQuery({ queryKey: ['safety-reports-all'], queryFn: () => base44.entities.SafetyReport.list('-conducted_at', 100) });

  const audits = useMemo(() => reports.filter(r => r.report_type === 'safetyculture_audit' || r.audit_template_name), [reports]);

  const stats = useMemo(() => {
    const total = audits.length;
    const passed = audits.filter(a => a.pass_fail === 'pass').length;
    const failed = audits.filter(a => a.pass_fail === 'fail').length;
    const pending = audits.filter(a => a.pass_fail === 'pending').length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const avgScore = audits.filter(a => a.score_percentage != null).reduce((s, a) => s + a.score_percentage, 0);
    const scoredCount = audits.filter(a => a.score_percentage != null).length;
    const avgPct = scoredCount > 0 ? Math.round(avgScore / scoredCount) : 0;
    return { total, passed, failed, pending, passRate, avgPct };
  }, [audits]);

  // Group by template name
  const byTemplate = useMemo(() => {
    const map = {};
    audits.forEach(a => {
      const key = a.audit_template_name || 'Uncategorised';
      if (!map[key]) map[key] = { total: 0, passed: 0, failed: 0, scores: [] };
      map[key].total++;
      if (a.pass_fail === 'pass') map[key].passed++;
      if (a.pass_fail === 'fail') map[key].failed++;
      if (a.score_percentage != null) map[key].scores.push(a.score_percentage);
    });
    return Object.entries(map).map(([name, data]) => ({
      name,
      ...data,
      passRate: data.total > 0 ? Math.round((data.passed / data.total) * 100) : 0,
      avgScore: data.scores.length > 0 ? Math.round(data.scores.reduce((s, x) => s + x, 0) / data.scores.length) : 0,
    })).sort((a, b) => b.total - a.total);
  }, [audits]);

  // Recent trend (last 10 audits by score)
  const recentTrend = useMemo(() => {
    return audits
      .filter(a => a.score_percentage != null && a.conducted_at)
      .sort((a, b) => new Date(a.conducted_at) - new Date(b.conducted_at))
      .slice(-10);
  }, [audits]);

  const trendDirection = recentTrend.length >= 2
    ? recentTrend[recentTrend.length - 1].score_percentage - recentTrend[0].score_percentage
    : 0;

  return (
    <WidgetShell widgetId="audit-score-trends" title="Audit Score Trends" icon={ShieldCheck} subtitle={`${stats.total} audits · ${stats.passRate}% pass rate`}>
      <div className="space-y-3">
        {/* Top stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{stats.passRate}%</p>
            <p className="text-[10px] text-emerald-600 font-medium uppercase">Pass Rate</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-blue-700 tabular-nums">{stats.avgPct}%</p>
            <p className="text-[10px] text-blue-600 font-medium uppercase">Avg Score</p>
          </div>
          <div className={`rounded-lg p-2.5 text-center ${stats.failed > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
            <p className={`text-lg font-bold tabular-nums ${stats.failed > 0 ? 'text-rose-700' : 'text-slate-600'}`}>{stats.failed}</p>
            <p className="text-[10px] font-medium uppercase text-slate-500">Failed</p>
          </div>
        </div>

        {/* Trend indicator */}
        {recentTrend.length >= 2 && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${trendDirection > 0 ? 'bg-emerald-50' : trendDirection < 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
            {trendDirection > 0 ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : trendDirection < 0 ? <TrendingDown className="w-4 h-4 text-rose-600" /> : <Award className="w-4 h-4 text-slate-500" />}
            <p className="text-xs text-slate-600">
              {trendDirection > 0 ? 'Improving' : trendDirection < 0 ? 'Declining' : 'Stable'} trend
              {trendDirection !== 0 && <span className="font-semibold ml-1">({trendDirection > 0 ? '+' : ''}{Math.round(trendDirection)}%)</span>}
            </p>
          </div>
        )}

        {/* By template */}
        {byTemplate.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">By Audit Type</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {byTemplate.slice(0, 6).map(t => (
                <div key={t.name} className="flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-700 truncate">{t.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="h-1 w-16 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${t.passRate >= 80 ? 'bg-emerald-500' : t.passRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${t.passRate}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400">{t.total} audit{t.total !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="font-semibold text-slate-700 tabular-nums">{t.avgScore}%</p>
                    <p className="text-[10px] text-slate-400">{t.passRate}% pass</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {audits.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <ShieldCheck className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs text-slate-500">No SafetyCulture audits synced yet. Connect SafetyCulture to start tracking audit scores.</p>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}