import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, CheckCircle2, Clock, AlertTriangle, Tablet, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Quick-view stat card showing the review progress of investigation logs
// for a job. Shown on the job Overview tab so managers see QC status at a
// glance, with a one-click OpenGround export button.
export default function LogReviewQuickStat({ job }) {
  const { toast } = useToast();
  const [exporting, setExporting] = React.useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['job-log-review-stat', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });

  const pending = logs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const approved = logs.filter(l => l.manager_review_status === 'approved').length;
  const queried = logs.filter(l => l.manager_review_status === 'queried').length;
  const agsImported = logs.filter(l => l.source === 'ags_import').length;
  const total = logs.length;
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      const fileName = `${(job.name || job.id).replace(/[^a-zA-Z0-9-_]/g, '_')}_OpenGround_${new Date().toISOString().slice(0, 10)}.ags`;
      const response = await base44.functions.invoke('generateJobAGSExport', { job_id: job.id });
      const text = typeof response.data === 'string' ? response.data : await response.data?.text();
      if (!text) throw new Error('Empty export');
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'AGS file downloaded for OpenGround' });
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Export failed', variant: 'destructive' });
    }
    setExporting(false);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 animate-pulse">
        <div className="h-4 w-24 bg-slate-100 rounded mb-3" />
        <div className="h-8 w-full bg-slate-100 rounded" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center"><ShieldCheck className="w-3.5 h-3.5 text-slate-400" /></div>
          <h3 className="font-semibold text-slate-900 text-sm">Log Review</h3>
        </div>
        <p className="text-xs text-slate-400">No site logs recorded yet.</p>
      </div>
    );
  }

  const statusColor = pct === 100 ? 'emerald' : pending > 0 ? 'amber' : 'slate';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${statusColor === 'emerald' ? 'bg-emerald-50' : statusColor === 'amber' ? 'bg-amber-50' : 'bg-slate-100'}`}>
          <ShieldCheck className={`w-3.5 h-3.5 ${statusColor === 'emerald' ? 'text-emerald-600' : statusColor === 'amber' ? 'text-amber-600' : 'text-slate-500'}`} />
        </div>
        <h3 className="font-semibold text-slate-900 text-sm">Log Review</h3>
        {agsImported > 0 && (
          <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
            <Tablet className="w-2.5 h-2.5" /> {agsImported} KeyLogBook
          </span>
        )}
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{total} Logs</span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${statusColor === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs font-bold ${statusColor === 'emerald' ? 'text-emerald-700' : 'text-amber-700'}`}>{pct}%</span>
      </div>

      {/* Breakdown chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
          <CheckCircle2 className="w-2.5 h-2.5" /> {approved} Approved
        </span>
        {pending > 0 && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> {pending} Pending
          </span>
        )}
        {queried > 0 && (
          <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" /> {queried} Queried
          </span>
        )}
      </div>

      {/* Export button — only enabled when there are approved logs */}
      <button onClick={handleExport} disabled={approved === 0 || exporting}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {exporting ? 'Building…' : 'Export to OpenGround'}
      </button>
      {approved === 0 && (
        <p className="text-[11px] text-slate-400 mt-1.5 text-center">Approve logs in Log QC to enable export</p>
      )}
    </div>
  );
}