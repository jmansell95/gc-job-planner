import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

// ============================================================
// sendWeeklyProgressReport — sends a weekly progress report
// email to the client contact for each portal-enabled job.
// ============================================================
// For each job with portal_enabled=true:
//   • Compiles a progress summary (status, milestones, photos,
//     billing status, upcoming schedule)
//   • Emails it to the client contact email
//
// Payload: { job_id } — send for one job
//          { all: true } — send for all portal-enabled jobs
//
// Runs as a scheduled automation (weekly) or manually from settings.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const baseUrl = await getAppBaseUrl(base44);

    // Load portal-enabled jobs
    let jobs = [];
    if (body.job_id) {
      const job = await base44.asServiceRole.entities.Job.get(body.job_id).catch(() => null);
      if (job) jobs = [job];
    } else {
      const allJobs = await base44.asServiceRole.entities.Job.list('-updated_date', 500);
      jobs = allJobs.filter(j => j.portal_enabled && j.status !== 'completed' && j.status !== 'cancelled');
    }

    if (jobs.length === 0) {
      return Response.json({ ok: true, sent: 0, message: 'No portal-enabled jobs to report on.' });
    }

    let sent = 0;
    const errors = [];

    for (const job of jobs) {
      try {
        // Load client for contact email
        let clientEmail = '';
        let clientName = '';
        if (job.client_id) {
          const client = await base44.asServiceRole.entities.Client.get(job.client_id).catch(() => null);
          if (client) {
            clientEmail = client.contact_email || client.email || '';
            clientName = client.name || '';
          }
        }
        if (!clientEmail) continue; // skip if no client email

        // Load milestones
        const milestones = await base44.asServiceRole.entities.JobMilestone.filter({ job_id: job.id }).catch(() => []);

        // Load recent photos
        const photos = await base44.asServiceRole.entities.SitePhoto.filter({ job_id: job.id }).catch(() => []);
        const recentPhotos = photos
          .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''))
          .slice(0, 3);

        // Load recent rotas (this week)
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
        const weekStartStr = weekStart.toISOString().slice(0, 10);
        const rotas = await base44.asServiceRole.entities.RotaAssignment.filter({ job_id: job.id, week_start: weekStartStr }).catch(() => []);

        // Load invoices
        const invoices = await base44.asServiceRole.entities.Invoice.filter({ job_id: job.id }).catch(() => []);

        // Build the report
        const statusLabel = (job.status || 'planning').replace(/_/g, ' ');
        const progressPct = job.meterage_target && job.meterage
          ? Math.min(100, Math.round((Number(job.meterage) / Number(job.meterage_target)) * 100))
          : 0;

        let milestoneHtml = '';
        if (milestones.length > 0) {
          milestoneHtml = '<h3 style="color:#1c4a12;margin:20px 0 8px;font-size:14px">Milestones</h3><ul style="margin:0;padding-left:18px;font-size:13px;color:#475569">';
          for (const m of milestones.slice(0, 5)) {
            const done = m.status === 'completed' || m.completed;
            milestoneHtml += `<li style="margin:4px 0">${done ? '✅' : '⬜'} ${escapeHtml(m.title || m.name || 'Milestone')}${m.due_date ? ' — due ' + m.due_date : ''}</li>`;
          }
          milestoneHtml += '</ul>';
        }

        let photoHtml = '';
        if (recentPhotos.length > 0) {
          photoHtml = '<h3 style="color:#1c4a12;margin:20px 0 8px;font-size:14px">Recent Site Photos</h3><div style="display:flex;gap:8px;flex-wrap:wrap">';
          for (const p of recentPhotos) {
            if (p.photo_url) {
              photoHtml += `<img src="${escapeHtml(p.photo_url)}" style="width:120px;height:90px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0" alt="Site photo" />`;
            }
          }
          photoHtml += '</div>';
        }

        const invoiceTotal = invoices.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
        const paidTotal = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (Number(i.gross_total) || 0), 0);

        const portalLink = job.portal_token
          ? linkBlock(baseUrl, `/client-portal/${job.portal_token}`, 'View Full Project Portal')
          : '';

        const bodyHtml = `
          <p style="margin:0 0 16px">Hi ${escapeHtml(clientName)},</p>
          <p style="margin:0 0 16px">Here's your weekly progress update for <strong>${escapeHtml(job.name)}</strong>.</p>

          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
            <tr><td style="padding:6px 0;color:#64748b;width:120px">Status</td><td style="padding:6px 0;font-weight:600;color:#1e293b;text-transform:capitalize">${escapeHtml(statusLabel)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Location</td><td style="padding:6px 0;color:#1e293b">${escapeHtml(job.location || '—')}</td></tr>
            ${job.start_date && job.end_date ? `<tr><td style="padding:6px 0;color:#64748b">Schedule</td><td style="padding:6px 0;color:#1e293b">${job.start_date} → ${job.end_date}</td></tr>` : ''}
            ${progressPct > 0 ? `<tr><td style="padding:6px 0;color:#64748b">Progress</td><td style="padding:6px 0;color:#1e293b">${progressPct}% (${job.meterage}m of ${job.meterage_target}m target)</td></tr>` : ''}
            <tr><td style="padding:6px 0;color:#64748b">Crew This Week</td><td style="padding:6px 0;color:#1e293b">${rotas.length} shift${rotas.length === 1 ? '' : 's'} scheduled</td></tr>
            ${invoiceTotal > 0 ? `<tr><td style="padding:6px 0;color:#64748b">Billing</td><td style="padding:6px 0;color:#1e293b">£${invoiceTotal.toLocaleString('en-GB')} total · £${paidTotal.toLocaleString('en-GB')} paid</td></tr>` : ''}
          </table>

          ${milestoneHtml}
          ${photoHtml}

          ${job.notes ? `<h3 style="color:#1c4a12;margin:20px 0 8px;font-size:14px">Notes</h3><p style="font-size:13px;color:#475569;margin:0">${escapeHtml(job.notes)}</p>` : ''}

          ${portalLink}
        `;

        const subject = `Weekly Progress: ${job.name} — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: clientEmail,
          subject,
          body: styledHtml(bodyHtml, { accent_color: '#2E5A1A', banner_title: `Project Update — ${job.name}`, show_banner: true, footer_text: 'GC Mission Control' }),
        });
        sent++;
      } catch (e) {
        errors.push({ job: job.name, error: e.message });
      }
    }

    return Response.json({
      ok: true,
      sent,
      checked: jobs.length,
      errors: errors.length > 0 ? errors : undefined,
      message: sent > 0 ? `${sent} progress report${sent === 1 ? '' : 's'} sent.` : 'No reports sent (no client emails configured).',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}