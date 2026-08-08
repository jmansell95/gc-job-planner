import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * generateJobPack — generates an ISO-compliant auditor's pack for a job.
 * Fetches all related data, builds a structured HTML document with a
 * document control header and table of contents, and stores the pack
 * metadata in the JobPack entity.
 *
 * Returns the HTML content (for client-side PDF rendering) and the
 * JobPack record ID (for version tracking).
 *
 * Payload: { jobId, packType, generatedByName }
 *   packType: 'full_auditor_pack' | 'client_progress' | 'billing_export' | 'geotechnical_report' | 'compliance_pack'
 */

const PACK_TYPE_LABELS: Record<string, string> = {
  full_auditor_pack: 'Full Auditor Pack',
  client_progress: 'Client Progress Report',
  billing_export: 'Billing Export',
  geotechnical_report: 'Geotechnical Investigation Report',
  compliance_pack: 'Compliance Pack',
};

const PACK_SECTIONS: Record<string, string[]> = {
  full_auditor_pack: ['overview', 'personnel', 'borehole_logs', 'trial_pit_logs', 'lab_results', 'photos', 'compliance', 'equipment', 'billing', 'deliveries', 'milestones', 'timeline'],
  client_progress: ['overview', 'progress', 'schedule', 'milestones', 'photos', 'team'],
  billing_export: ['overview', 'billing', 'cost_items', 'deliveries', 'hotel', 'meterage'],
  geotechnical_report: ['overview', 'borehole_logs', 'trial_pit_logs', 'lab_results', 'samples', 'monitoring_wells', 'calibrations'],
  compliance_pack: ['overview', 'compliance', 'equipment', 'calibrations', 'staff_compliance'],
};

function esc(s: any): string {
  return (s || '').toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(d: string): string {
  if (!d) return '—';
  const date = new Date(d.includes('T') ? d : d + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}

function fmtGBP(n: number): string {
  return '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB');
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId, packType = 'full_auditor_pack', generatedByName } = await req.json();
    if (!jobId) return Response.json({ error: 'jobId is required' }, { status: 400 });

    const job = await base44.entities.Job.get(jobId).catch(() => null);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    // Fetch all related data in parallel
    const [rotas, costItems, assignments, milestones, documents, photos, investigationLogs, labResults, samples, monitoringWells, calibrations, deliveries, comments, complianceItems] = await Promise.all([
      base44.entities.RotaAssignment.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobCostItem.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobAssetAssignment.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobMilestone.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobDocument.filter({ job_id: jobId }).catch(() => []),
      base44.entities.SitePhoto.filter({ job_id: jobId }).catch(() => []),
      base44.entities.InvestigationLog.filter({ job_id: jobId }).catch(() => []),
      base44.entities.LabTestResult.filter({ job_id: jobId }).catch(() => []),
      base44.entities.Sample.filter({ job_id: jobId }).catch(() => []),
      base44.entities.MonitoringWell.filter({ job_id: jobId }).catch(() => []),
      base44.entities.EquipmentCalibration.filter({ job_id: jobId }).catch(() => []),
      base44.entities.DeliveryLog.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobComment.filter({ job_id: jobId }).catch(() => []),
      base44.entities.ComplianceItem.filter({ reference_id: jobId }).catch(() => []),
    ]);

    // Fetch related staff
    const staffIds = [...new Set(rotas.map((r: any) => r.staff_id).filter(Boolean))];
    const staff = await Promise.all(staffIds.map((id: string) => base44.entities.Staff.get(id).catch(() => null)));
    const validStaff = staff.filter(Boolean);

    // Fetch client/contractor
    const client = job.client_id ? await base44.entities.Client.get(job.client_id).catch(() => null) : null;
    const contractor = job.contractor_id ? await base44.entities.Contractor.get(job.contractor_id).catch(() => null) : null;

    // Determine version — find existing packs of same type for this job
    const existingPacks = await base44.entities.JobPack.filter({ job_id: jobId, pack_type: packType }, '-created_date', 1).catch(() => []);
    const version = existingPacks.length > 0 ? (existingPacks[0].version || 0) + 1 : 1;

    // Generate document reference
    const jobRef = (job.job_reference || 'JOB' + jobId.slice(-6)).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const packTypeCode = packType.split('_').map(w => w[0]).join('').toUpperCase();
    const documentReference = `GC-${jobRef}-${packTypeCode}-v${version}`;

    const sectionsIncluded = PACK_SECTIONS[packType] || PACK_SECTIONS.full_auditor_pack;

    // Build content summary
    const contentSummary = JSON.stringify({
      boreholes: [...new Set(investigationLogs.map((l: any) => l.borehole_ref).filter(Boolean))].length,
      investigation_logs: investigationLogs.length,
      lab_results: labResults.length,
      samples: samples.length,
      monitoring_wells: monitoringWells.length,
      photos: photos.length,
      staff: validStaff.length,
      cost_items: costItems.length,
      deliveries: deliveries.length,
      milestones: milestones.length,
      documents: documents.length,
      calibrations: calibrations.length,
    });

    // Build the HTML document with TOC and document control header
    const genDate = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const packLabel = PACK_TYPE_LABELS[packType] || 'Auditor Pack';

    // Build section list for TOC
    const tocItems = sectionsIncluded.map((sec, i) => {
      const labels: Record<string, string> = {
        overview: '1. Project Overview',
        personnel: '2. Personnel & Staff Assignments',
        borehole_logs: '3. Geotechnical Borehole Logs',
        trial_pit_logs: '4. Trial Pit & Groundworks Logs',
        lab_results: '5. Laboratory Test Results',
        samples: '6. Sample Chain of Custody',
        monitoring_wells: '7. Monitoring Installations',
        calibrations: '8. Equipment Calibrations',
        photos: '9. Site Photographs',
        compliance: '10. Compliance & Sign-offs',
        equipment: '11. Equipment & Asset Register',
        billing: '12. Billing Summary',
        cost_items: '13. Cost Items',
        deliveries: '14. Deliveries & Collections',
        hotel: '15. Hotel Accommodation',
        meterage: '16. Meterage Summary',
        milestones: '17. Project Milestones',
        timeline: '18. Chronological Timeline',
        progress: '19. Progress Summary',
        schedule: '20. Work Schedule',
        team: '21. Project Team',
        staff_compliance: '22. Staff Compliance',
      };
      return `<div class="toc-item"><span class="toc-num">${(i + 1)}</span><span class="toc-label">${labels[sec] || sec}</span><span class="toc-dots">................................................</span><span class="toc-page">${i + 1}</span></div>`;
    }).join('');

    // Build section content
    const sectionContent: string[] = [];

    if (sectionsIncluded.includes('overview')) {
      sectionContent.push(`
        <div class="section" id="sec-overview">
          <h2>1. Project Overview</h2>
          <div class="info-grid">
            <div class="info-card"><h3>Project Name</h3><p>${esc(job.name)}</p></div>
            <div class="info-card"><h3>Location</h3><p>${esc(job.location)}</p></div>
            <div class="info-card"><h3>Reference</h3><p>${esc(job.job_reference || '—')}</p></div>
            <div class="info-card"><h3>Status</h3><p>${esc(job.status).replace(/_/g, ' ')}</p></div>
            <div class="info-card"><h3>Start Date</h3><p>${fmtDate(job.start_date)}</p></div>
            <div class="info-card"><h3>End Date</h3><p>${fmtDate(job.end_date)}</p></div>
            <div class="info-card"><h3>Project Manager</h3><p>${esc(job.project_manager || '—')}</p></div>
            <div class="info-card"><h3>Client</h3><p>${esc(client?.name || '—')}</p></div>
          </div>
          ${job.notes ? `<div class="notes"><h3>Project Notes</h3><p>${esc(job.notes)}</p></div>` : ''}
        </div>`);
    }

    if (sectionsIncluded.includes('personnel') && validStaff.length > 0) {
      const staffRows = validStaff.map(s => {
        const shifts = rotas.filter((r: any) => r.staff_id === s.id).length;
        return `<tr><td>${esc(s.name)}</td><td>${esc(s.job_title || s.job_role || '—')}</td><td>${esc(s.worker_type || '—').replace(/_/g, ' ')}</td><td>${shifts}</td></tr>`;
      }).join('');
      sectionContent.push(`
        <div class="section" id="sec-personnel">
          <h2>2. Personnel & Staff Assignments</h2>
          <table><thead><tr><th>Name</th><th>Role</th><th>Type</th><th>Shifts</th></tr></thead>
          <tbody>${staffRows}</tbody></table>
        </div>`);
    }

    if (sectionsIncluded.includes('borehole_logs') && investigationLogs.length > 0) {
      const boreholeLogs = investigationLogs.filter((l: any) => l.log_type === 'borehole_progress' || l.log_type === 'sample_collection');
      if (boreholeLogs.length > 0) {
        const rows = boreholeLogs.map((l: any) => {
          const blows = l.spt_blows && l.spt_blows.length > 0 ? l.spt_blows.join(' / ') : '—';
          return `<tr><td>${esc(l.borehole_ref || '—')}</td><td>${l.depth_from != null ? l.depth_from : '—'}</td><td>${l.depth_to != null ? l.depth_to : '—'}</td><td>${esc(l.strata_descriptor || '—')}</td><td>${esc(l.strata_description_detail || '—')}</td><td>${blows}</td><td>${l.spt_n_value != null ? l.spt_n_value : '—'}</td><td>${l.groundwater_strike_depth != null ? l.groundwater_strike_depth + 'm' : '—'}</td><td>${l.coring_recovery != null ? l.coring_recovery + '%' : '—'}</td><td><span class="review-${l.manager_review_status || 'pending'}">${esc((l.manager_review_status || 'pending').replace(/_/g, ' '))}</span></td></tr>`;
        }).join('');
        sectionContent.push(`
          <div class="section" id="sec-borehole_logs">
            <h2>3. Geotechnical Borehole Logs</h2>
            <table><thead><tr><th>Borehole</th><th>From (m)</th><th>To (m)</th><th>Strata</th><th>Description</th><th>SPT Blows</th><th>N-Value</th><th>Water Strike</th><th>Recovery</th><th>Review</th></tr></thead>
            <tbody>${rows}</tbody></table>
          </div>`);
      }
    }

    if (sectionsIncluded.includes('lab_results') && labResults.length > 0) {
      const rows = labResults.map((r: any) => {
        return `<tr><td>${esc(r.sample_ref || r.sample_id || '—')}</td><td>${esc(r.borehole_ref || '—')}</td><td>${esc(r.test_type.replace(/_/g, ' '))}</td><td>${r.result_value_primary != null ? r.result_value_primary : '—'}</td><td>${esc(r.result_unit || '—')}</td><td>${fmtDate(r.result_date)}</td><td>${esc(r.lab_name || '—')}</td><td><span class="review-${r.review_status || 'pending'}">${esc((r.review_status || 'pending').replace(/_/g, ' '))}</span></td></tr>`;
      }).join('');
      sectionContent.push(`
        <div class="section" id="sec-lab_results">
          <h2>5. Laboratory Test Results</h2>
          <table><thead><tr><th>Sample</th><th>Borehole</th><th>Test Type</th><th>Result</th><th>Unit</th><th>Date</th><th>Lab</th><th>Review</th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`);
    }

    if (sectionsIncluded.includes('photos') && photos.length > 0) {
      const photoItems = photos.map((p: any) => `
        <div class="photo-item">
          <img src="${esc(p.photo_url)}" alt="${esc(p.caption || 'Site photo')}" />
          <p>${esc(p.caption || 'Site photo')}</p>
          <p class="photo-meta">${fmtDate(p.uploaded_at || p.created_date)} · ${esc(p.uploaded_by || '')}</p>
        </div>`).join('');
      sectionContent.push(`
        <div class="section" id="sec-photos">
          <h2>9. Site Photographs</h2>
          <div class="photo-grid">${photoItems}</div>
        </div>`);
    }

    if (sectionsIncluded.includes('billing')) {
      const totalCost = costItems.reduce((s: number, c: any) => s + (c.unit_cost || 0) * (c.quantity || 1), 0);
      sectionContent.push(`
        <div class="section" id="sec-billing">
          <h2>12. Billing Summary</h2>
          <div class="cost-grid">
            <div class="cost-row"><span>Total Cost Items</span><strong>${fmtGBP(totalCost)}</strong></div>
            <div class="cost-row"><span>Revenue Method</span><strong>${esc(job.revenue_method || 'none').replace(/_/g, ' ')}</strong></div>
            <div class="cost-row"><span>VAT Rate</span><strong>${job.vat_rate || 20}%</strong></div>
            <div class="cost-row"><span>Markup %</span><strong>${job.markup_percentage || 0}%</strong></div>
          </div>
        </div>`);
    }

    if (sectionsIncluded.includes('milestones') && milestones.length > 0) {
      const rows = milestones.map((m: any) => `<tr><td>${esc(m.name)}</td><td>${fmtDate(m.target_date)}</td><td>${m.completed ? '✓ Completed' : 'Pending'}</td><td>${m.completed_date ? fmtDate(m.completed_date) : '—'}</td></tr>`).join('');
      sectionContent.push(`
        <div class="section" id="sec-milestones">
          <h2>17. Project Milestones</h2>
          <table><thead><tr><th>Milestone</th><th>Target Date</th><th>Status</th><th>Completed Date</th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`);
    }

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1e293b;padding:24px;max-width:900px;margin:0 auto}
      .doc-header{background:linear-gradient(135deg,#1c4a12 0%,#2E5A1A 100%);color:white;border-radius:12px;padding:24px 28px;margin-bottom:20px}
      .doc-header h1{font-size:24px;font-weight:700;margin-bottom:4px}
      .doc-header .sub{font-size:13px;opacity:0.85;margin-bottom:12px}
      .doc-control{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;background:rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;font-size:11px}
      .doc-control span{display:inline-block}
      .doc-control strong{font-weight:600}
      .toc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px 22px;margin-bottom:24px}
      .toc h2{font-size:14px;font-weight:700;color:#2E5A1A;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em}
      .toc-item{display:flex;align-items:center;gap:4px;padding:4px 0;font-size:12px}
      .toc-num{font-weight:700;color:#2E5A1A;width:20px}
      .toc-label{color:#334155}
      .toc-dots{flex:1;color:#cbd5e1;overflow:hidden}
      .toc-page{font-weight:600;color:#64748b}
      .section{margin-bottom:28px;page-break-inside:avoid}
      .section h2{font-size:16px;font-weight:700;color:#1e293b;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
      .info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px}
      .info-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
      .info-card h3{font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:4px}
      .info-card p{font-size:13px;color:#334155}
      .notes{background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:12px 0}
      .notes h3{font-size:11px;text-transform:uppercase;color:#92400e;margin-bottom:6px}
      .notes p{font-size:13px;color:#334155}
      table{width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);margin-bottom:8px}
      th{background:#2E5A1A;color:white;padding:9px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em}
      td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}
      tr:nth-child(even) td{background:#f8fafb}
      .cost-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
      .cost-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:13px}
      .cost-row strong{font-weight:600}
      .photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
      .photo-item img{width:100%;height:150px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0}
      .photo-item p{font-size:11px;color:#64748b;margin-top:4px}
      .photo-meta{font-size:10px;color:#94a3b8}
      .review-pending{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#fef3c7;color:#92400e}
      .review-approved{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#cfe8b8;color:#2E5A1A}
      .review-queried{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#fee2e2;color:#991b1b}
      .footer{margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
      .footer-brand{font-weight:600;color:#2E5A1A}
      @media print{body{padding:12px}.doc-header,th,tr:nth-child(even) td,.review-pending,.review-approved,.review-queried{-webkit-print-color-adjust:exact;print-color-adjust:exact}.section{page-break-inside:avoid}}
    </style></head><body>
    <div class="doc-header">
      <h1>${esc(job.name)}</h1>
      <p class="sub">${packLabel} · ${esc(job.location)}</p>
      <div class="doc-control">
        <span><strong>Doc Ref:</strong> ${documentReference}</span>
        <span><strong>Version:</strong> v${version}</span>
        <span><strong>Status:</strong> Issued</span>
        <span><strong>Generated:</strong> ${genDate}</span>
        <span><strong>By:</strong> ${esc(generatedByName || user.full_name || 'System')}</span>
      </div>
    </div>

    <div class="toc">
      <h2>Table of Contents</h2>
      ${tocItems}
    </div>

    ${sectionContent.join('\n')}

    <div class="footer">
      <span>Generated ${genDate} · ${validStaff.length} staff · ${investigationLogs.length} logs · ${labResults.length} lab results · ${photos.length} photos</span>
      <span class="footer-brand">GC Mission Control — ISO Audit Pack</span>
    </div>
    </body></html>`;

    // Create the JobPack record
    const jobPack = await base44.entities.JobPack.create({
      job_id: jobId,
      job_name: job.name,
      job_reference: job.job_reference || '',
      pack_type: packType,
      document_reference: documentReference,
      version,
      status: 'issued',
      generated_by_name: generatedByName || user.full_name || 'System',
      generated_at: new Date().toISOString(),
      content_summary: contentSummary,
      sections_included: sectionsIncluded,
    });

    // Log to SystemAuditLog
    await base44.functions.invoke('logSystemAudit', {
      entity_name: 'JobPack',
      entity_id: jobPack.id,
      action: 'create',
      data: { document_reference: documentReference, job_id: jobId, pack_type: packType, version },
      source: 'manual',
      actor_name: generatedByName || user.full_name || 'System',
    }).catch(() => null);

    return Response.json({
      ok: true,
      html: htmlContent,
      jobPackId: jobPack.id,
      documentReference,
      version,
      fileName: `${documentReference}_${job.name.replace(/[^a-z0-9]/gi, '_')}.html`,
      contentSummary: JSON.parse(contentSummary),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}