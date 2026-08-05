import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Download, Loader2, Image as ImageIcon, CheckCircle2, Calendar, MapPin, TrendingUp, Users } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';

/**
 * Client-Facing Progress Reports — branded PDF progress reports with photos,
 * milestones, and financial summaries. Generates a printable, client-ready
 * report for any job with portal access enabled.
 */
export default function ClientProgressReport({ jobId, onClose }) {
  const [generating, setGenerating] = useState(false);

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['client-report-job', jobId],
    queryFn: () => base44.entities.Job.get(jobId),
    enabled: !!jobId,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['client-report-milestones', jobId],
    queryFn: () => base44.entities.JobMilestone.filter({ job_id: jobId }, '-due_date', 50),
    enabled: !!jobId,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['client-report-photos', jobId],
    queryFn: () => base44.entities.SitePhoto.filter({ job_id: jobId }, '-created_date', 20),
    enabled: !!jobId,
  });

  const { data: rotas = [] } = useQuery({
    queryKey: ['client-report-rotas', jobId],
    queryFn: () => base44.entities.RotaAssignment.filter({ job_id: jobId, assignment_type: 'job' }, '-assigned_date', 50),
    enabled: !!jobId,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['client-report-docs', jobId],
    queryFn: () => base44.entities.JobDocument.filter({ job_id: jobId, client_visible: true }, '-created_date', 20),
    enabled: !!jobId,
  });

  const { data: client } = useQuery({
    queryKey: ['client-report-client', job?.client_id],
    queryFn: () => base44.entities.Client.get(job.client_id),
    enabled: !!job?.client_id,
  });

  const completedMilestones = milestones.filter(m => m.is_completed);
  const progressPct = milestones.length > 0
    ? Math.round((completedMilestones.length / milestones.length) * 100)
    : 0;

  const daysElapsed = job?.start_date ? differenceInCalendarDays(new Date(), parseISO(job.start_date)) : 0;
  const daysTotal = job?.start_date && job?.end_date
    ? differenceInCalendarDays(parseISO(job.end_date), parseISO(job.start_date))
    : 0;
  const schedulePct = daysTotal > 0 ? Math.min(100, Math.round((daysElapsed / daysTotal) * 100)) : 0;

  const meteragePct = job?.meterage_target && job?.meterage
    ? Math.min(100, Math.round((job.meterage / job.meterage_target) * 100))
    : 0;

  const generatePDF = () => {
    setGenerating(true);
    const win = window.open('', '_blank');

    const photoGallery = photos.slice(0, 6).map((p, i) =>
      `<div style="display:inline-block;width:30%;margin:1%;vertical-align:top;">
        <img src="${p.photo_url || ''}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;" />
        <p style="font-size:9px;color:#64748b;margin-top:4px;">${p.caption || format(parseISO(p.created_date || new Date()), 'dd MMM yyyy')}</p>
      </div>`
    ).join('');

    const milestoneRows = milestones.map(m => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">
          ${m.is_completed ? '✅' : '⬜'} ${m.title || m.name || 'Milestone'}
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11px;">
          ${m.due_date ? format(parseISO(m.due_date), 'dd MMM yyyy') : '—'}
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;">
          ${m.is_completed ? '<span style="color:#059669;font-weight:600;">Complete</span>' : '<span style="color:#f59e0b;">In Progress</span>'}
        </td>
      </tr>
    `).join('');

    const teamList = [...new Set(rotas.map(r => r.staff_name))].slice(0, 10).join(', ');

    win.document.write(`
      <html><head><title>${job?.name || 'Job'} — Progress Report</title>
      <style>
        @page { margin: 20mm; }
        body { font-family: Inter, Arial, sans-serif; color: #1e293b; line-height: 1.5; }
        .header { background: linear-gradient(135deg, #2E5A1A, #1c4a12); color: white; padding: 24px 30px; border-radius: 12px; margin-bottom: 24px; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
        .header .meta { font-size: 12px; opacity: 0.9; margin-top: 6px; }
        .section { margin-bottom: 20px; }
        .section h2 { color: #2E5A1A; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; }
        .stats { display: flex; gap: 12px; margin-bottom: 20px; }
        .stat { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
        .stat .label { font-size: 10px; color: #64748b; text-transform: uppercase; }
        .stat .value { font-size: 22px; font-weight: 800; color: #2E5A1A; margin-top: 4px; }
        .stat .bar { height: 6px; background: #e2e8f0; border-radius: 3px; margin-top: 8px; overflow: hidden; }
        .stat .fill { height: 100%; background: #2E5A1A; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f1f5f9; padding: 8px; text-align: left; font-weight: 600; color: #475569; }
        .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
        .photos { margin-top: 10px; }
      </style></head><body>

      <div class="header">
        <h1>${job?.name || 'Job'} — Progress Report</h1>
        <div class="meta">
          ${job?.location ? `📍 ${job.location}` : ''} ·
          ${job?.start_date ? `Start: ${format(parseISO(job.start_date), 'dd MMM yyyy')}` : ''} ·
          ${job?.end_date ? `End: ${format(parseISO(job.end_date), 'dd MMM yyyy')}` : ''} ·
          Status: ${(job?.status || '').replace(/_/g, ' ').toUpperCase()}
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="label">Schedule</div>
          <div class="value">${schedulePct}%</div>
          <div class="bar"><div class="fill" style="width:${schedulePct}%"></div></div>
        </div>
        <div class="stat">
          <div class="label">Milestones</div>
          <div class="value">${progressPct}%</div>
          <div class="bar"><div class="fill" style="width:${progressPct}%"></div></div>
        </div>
        ${job?.meterage_target ? `
        <div class="stat">
          <div class="label">Meterage</div>
          <div class="value">${meteragePct}%</div>
          <div class="bar"><div class="fill" style="width:${meteragePct}%"></div></div>
        </div>` : ''}
      </div>

      <div class="section">
        <h2>Project Overview</h2>
        <p style="font-size: 13px; color: #475569;">${job?.notes || 'No project description available.'}</p>
        ${client ? `<p style="font-size: 12px; color: #64748b; margin-top: 8px;"><strong>Client:</strong> ${client.name || ''}</p>` : ''}
      </div>

      ${milestones.length > 0 ? `
      <div class="section">
        <h2>Milestones (${completedMilestones.length}/${milestones.length} complete)</h2>
        <table>
          <thead><tr><th>Milestone</th><th>Due Date</th><th>Status</th></tr></thead>
          <tbody>${milestoneRows}</tbody>
        </table>
      </div>` : ''}

      ${teamList ? `
      <div class="section">
        <h2>Team Assigned</h2>
        <p style="font-size: 13px;">${teamList}</p>
      </div>` : ''}

      ${photos.length > 0 ? `
      <div class="section">
        <h2>Site Photos</h2>
        <div class="photos">${photoGallery}</div>
      </div>` : ''}

      ${documents.length > 0 ? `
      <div class="section">
        <h2>Documents</h2>
        <p style="font-size: 12px; color: #64748b;">${documents.length} client-visible document(s) available on the portal.</p>
      </div>` : ''}

      <div class="footer">
        Generated by GC Mission Control · ${format(new Date(), 'dd MMMM yyyy HH:mm')} ·
        ${client ? `Prepared for ${client.name || ''}` : ''}
      </div>

      </body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); setGenerating(false); }, 800);
  };

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-10 h-10 text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">Job not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="mesh-bg px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold tracking-tight">{job.name} — Progress Report</h3>
              <div className="flex items-center gap-3 mt-1 text-xs text-white/80">
                {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                {job.start_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(parseISO(job.start_date), 'dd MMM yyyy')}</span>}
              </div>
            </div>
            <button
              onClick={generatePDF}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-[#2E5A1A] rounded-lg text-sm font-semibold hover:bg-white/90 transition disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {generating ? 'Generating…' : 'Generate PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Progress stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="insight-card rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Schedule</p>
          <p className="text-2xl font-bold text-[#2E5A1A] mt-1">{schedulePct}%</p>
          <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-[#2E5A1A] rounded-full" style={{ width: `${schedulePct}%` }} />
          </div>
        </div>
        <div className="insight-card rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Milestones</p>
          <p className="text-2xl font-bold text-[#2E5A1A] mt-1">{progressPct}%</p>
          <p className="text-xs text-slate-400 mt-1">{completedMilestones.length}/{milestones.length} done</p>
        </div>
        {job.meterage_target ? (
          <div className="insight-card rounded-2xl p-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Meterage</p>
            <p className="text-2xl font-bold text-[#2E5A1A] mt-1">{meteragePct}%</p>
            <p className="text-xs text-slate-400 mt-1">{job.meterage || 0}/{job.meterage_target}m</p>
          </div>
        ) : (
          <div className="insight-card rounded-2xl p-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Days Elapsed</p>
            <p className="text-2xl font-bold text-[#2E5A1A] mt-1">{daysElapsed}</p>
            <p className="text-xs text-slate-400 mt-1">of {daysTotal} total</p>
          </div>
        )}
        <div className="insight-card rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Crew Days</p>
          <p className="text-2xl font-bold text-[#2E5A1A] mt-1">{rotas.length}</p>
          <p className="text-xs text-slate-400 mt-1">shifts logged</p>
        </div>
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="insight-card rounded-2xl p-4">
          <h4 className="text-sm font-bold text-slate-800 mb-3">Milestones</h4>
          <div className="space-y-2">
            {milestones.slice(0, 10).map(m => (
              <div key={m.id} className="flex items-center gap-2.5 text-sm">
                {m.is_completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                )}
                <span className={m.is_completed ? 'text-slate-600 line-through' : 'text-slate-800 font-medium'}>
                  {m.title || m.name || 'Milestone'}
                </span>
                {m.due_date && (
                  <span className="text-xs text-slate-400 ml-auto">{format(parseISO(m.due_date), 'dd MMM')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo preview */}
      {photos.length > 0 && (
        <div className="insight-card rounded-2xl p-4">
          <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-slate-500" /> Site Photos ({photos.length})
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {photos.slice(0, 6).map(p => (
              <div key={p.id} className="aspect-square rounded-lg overflow-hidden border border-slate-200">
                <img src={p.photo_url} alt={p.caption || ''} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="insight-card rounded-2xl p-4">
        <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-slate-500" /> Project Summary
        </h4>
        <p className="text-sm text-slate-600 leading-relaxed">{job.notes || 'No project summary available.'}</p>
        {client && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500">Client:</span>
            <span className="font-medium text-slate-700">{client.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}