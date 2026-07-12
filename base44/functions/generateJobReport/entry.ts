import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId } = await req.json();
    if (!jobId) return Response.json({ error: 'jobId is required' }, { status: 400 });

    // Resolve the caller's role — only admins and managers see cost/financial data in reports
    let systemRole = null;
    const isAdmin = user.role === 'admin';
    if (!isAdmin) {
      try {
        const staffList = await base44.entities.Staff.filter({ email: user.email });
        if (staffList.length > 0) systemRole = staffList[0].system_role || null;
      } catch (_) {}
    }
    const canViewCostings = isAdmin || systemRole === 'admin' || systemRole === 'manager';

    const job = await base44.entities.Job.get(jobId).catch(() => null);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    // Fetch all related data in parallel
    const [rotas, costItems, assignments, milestones, documents, photos, complianceItems] = await Promise.all([
      base44.entities.RotaAssignment.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobCostItem.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobAssetAssignment.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobMilestone.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobDocument.filter({ job_id: jobId }).catch(() => []),
      base44.entities.SitePhoto.filter({ job_id: jobId }).catch(() => []),
      base44.entities.ComplianceItem.filter({ reference_id: jobId }).catch(() => []),
    ]);

    // Fetch related staff
    const staffIds = [...new Set(rotas.map(r => r.staff_id).filter(Boolean))];
    const staff = await Promise.all(staffIds.map(id => base44.entities.Staff.get(id).catch(() => null)));
    const validStaff = staff.filter(Boolean);

    // Fetch client/contractor
    const client = job.client_id ? await base44.entities.Client.get(job.client_id).catch(() => null) : null;
    const contractor = job.contractor_id ? await base44.entities.Contractor.get(job.contractor_id).catch(() => null) : null;

    // Fetch assets
    const assetIds = [...new Set(assignments.map(a => a.asset_id).filter(Boolean))];
    const assets = await Promise.all(assetIds.map(id => base44.entities.SiteAsset.get(id).catch(() => null)));
    const validAssets = assets.filter(Boolean);

    // --- Calculate costs ---
    const labourByStaff = {};
    rotas.forEach(r => {
      const member = validStaff.find(s => s.id === r.staff_id);
      if (!member) return;
      const isDriller = member.job_role === 'cp_driller' || member.job_role === 'rotary_driller';
      let cost = 0;
      if (isDriller && r.meterage && member.meterage_rate) cost = r.meterage * member.meterage_rate;
      else if (member.day_rate) cost = member.day_rate;
      labourByStaff[r.staff_id] = (labourByStaff[r.staff_id] || 0) + cost;
    });
    const totalLabour = Object.values(labourByStaff).reduce((a, b) => a + b, 0);
    const totalEquip = costItems.reduce((a, c) => a + (c.unit_cost || 0) * (c.quantity || 1), 0);
    const netCost = job.actual_cost || (totalLabour + totalEquip);
    const markupPct = job.markup_percentage || 0;
    const markupAmt = netCost * (markupPct / 100);
    const subtotal = netCost + markupAmt;
    const vatRate = job.vat_rate ?? 20;
    const vatAmt = subtotal * (vatRate / 100);
    const clientPrice = subtotal + vatAmt;
    const profit = clientPrice - netCost;
    const margin = clientPrice > 0 ? (profit / clientPrice) * 100 : 0;

    const fmtGBP = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB');
    const fmtDate = (d) => {
      if (!d) return '—';
      const date = new Date(d + 'T00:00:00');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
    };
    const esc = (s) => (s || '').toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const jobTypeLabels = {groundworks:'Groundworks',cp_drilling:'CP Drilling',rotary_drilling:'Rotary Drilling',enabling_works:'Enabling Works',depot:'Depot'};
    const statusLabels = {planning:'Planning',in_progress:'In Progress',completed:'Completed',on_hold:'On Hold',cancelled:'Cancelled'};
    const roleLabels = {groundworker:'Groundworker',cp_driller:'CP Driller',rotary_driller:'Rotary Driller',enabling_crew:'Enabling Crew',depot:'Depot',supervisor:'Supervisor'};
    const fmtJobType = (t) => jobTypeLabels[t] || esc(t).replace(/_/g,' ');
    const fmtStatus = (t) => statusLabels[t] || esc(t).replace(/_/g,' ');
    const fmtRole = (r) => roleLabels[r] || esc(r).replace(/_/g,' ');

    const genDate = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // --- Staff table rows ---
    const staffRows = validStaff.map(s => {
      const shifts = rotas.filter(r => r.staff_id === s.id).length;
      const labour = labourByStaff[s.id] || 0;
      return canViewCostings
        ? `<tr><td>${esc(s.name)}</td><td>${fmtRole(s.job_role)}</td><td>${esc(s.worker_type).replace(/_/g,' ')}</td><td>${shifts}</td><td>${fmtGBP(labour)}</td></tr>`
        : `<tr><td>${esc(s.name)}</td><td>${fmtRole(s.job_role)}</td><td>${esc(s.worker_type).replace(/_/g,' ')}</td><td>${shifts}</td></tr>`;
    }).join('');

    // --- Equipment cost rows ---
    const equipRows = costItems.map(c => {
      const lineCost = (c.unit_cost || 0) * (c.quantity || 1);
      return `<tr><td>${esc(c.description)}</td><td>${esc(c.category).replace(/_/g,' ')}</td><td>${c.quantity || 1} ${esc(c.unit_label || '')}</td><td>${fmtGBP(c.unit_cost)}</td><td>${fmtGBP(lineCost)}</td></tr>`;
    }).join('');

    // --- Asset rows ---
    const assetRows = assignments.map(a => {
      const asset = validAssets.find(as => as.id === a.asset_id);
      return `<tr><td>${esc(a.asset_name)}</td><td>${esc(a.asset_type)}</td><td>${esc(a.role).replace(/_/g,' ')}</td><td>${esc(a.status)}</td><td>${asset ? esc(asset.serial_number || '—') : '—'}</td></tr>`;
    }).join('');

    // --- Milestone rows ---
    const milestoneRows = milestones.map(m => {
      return `<tr><td>${esc(m.title)}</td><td>${fmtDate(m.target_date)}</td><td>${m.completed ? '✓ Done' : 'Pending'}</td></tr>`;
    }).join('');

    // --- Cost summary block (admins and managers only) ---
    const costBlock = canViewCostings ? `
      <div class="cost-card">
        <h3>Cost & Profitability Summary</h3>
        <div class="cost-grid">
          <div class="cost-row"><span>Labour Cost</span><strong>${fmtGBP(totalLabour)}</strong></div>
          <div class="cost-row"><span>Equipment Cost</span><strong>${fmtGBP(totalEquip)}</strong></div>
          <div class="cost-row total"><span>Net Cost</span><strong>${fmtGBP(netCost)}</strong></div>
          <div class="cost-row"><span>Markup (${markupPct}%)</span><strong>${fmtGBP(markupAmt)}</strong></div>
          <div class="cost-row"><span>VAT (${vatRate}%)</span><strong>${fmtGBP(vatAmt)}</strong></div>
          <div class="cost-row total highlight"><span>Client Price</span><strong>${fmtGBP(clientPrice)}</strong></div>
          <div class="cost-row"><span>Gross Profit</span><strong>${fmtGBP(profit)}</strong></div>
          <div class="cost-row"><span>Margin</span><strong>${margin.toFixed(1)}%</strong></div>
        </div>
      </div>` : '';

    const clientInfo = client ? `
      <div class="info-card">
        <h3>Client</h3>
        <p><strong>${esc(client.name)}</strong></p>
        ${client.contact_name ? `<p>${esc(client.contact_name)}</p>` : ''}
        ${client.contact_phone ? `<p>${esc(client.contact_phone)}</p>` : ''}
        ${client.email ? `<p>${esc(client.email)}</p>` : ''}
      </div>` : '';

    const staffTable = validStaff.length > 0 ? `
      <h2 class="section-title">Staff Assignments</h2>
      <table><thead><tr><th>Name</th><th>Role</th><th>Type</th><th>Shifts</th>${canViewCostings ? '<th>Labour Cost</th>' : ''}</tr></thead>
      <tbody>${staffRows}</tbody></table>` : '';

    const equipTable = (canViewCostings && costItems.length > 0) ? `
      <h2 class="section-title">Equipment & Costs</h2>
      <table><thead><tr><th>Description</th><th>Category</th><th>Qty</th><th>Unit Cost</th><th>Line Cost</th></tr></thead>
      <tbody>${equipRows}</tbody></table>` : '';

    const assetTable = assignments.length > 0 ? `
      <h2 class="section-title">Site Assets</h2>
      <table><thead><tr><th>Asset</th><th>Type</th><th>Role</th><th>Status</th><th>Serial</th></tr></thead>
      <tbody>${assetRows}</tbody></table>` : '';

    const milestoneTable = milestones.length > 0 ? `
      <h2 class="section-title">Milestones</h2>
      <table><thead><tr><th>Milestone</th><th>Target Date</th><th>Status</th></tr></thead>
      <tbody>${milestoneRows}</tbody></table>` : '';

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1e293b;padding:24px;max-width:900px;margin:0 auto}
      .header{background:linear-gradient(135deg,#064e3b 0%,#065f46 100%);color:white;border-radius:12px;padding:24px 28px;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
      .header h1{font-size:24px;font-weight:700;margin-bottom:4px}
      .header .sub{font-size:13px;opacity:0.85}
      .status-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(255,255,255,0.2);margin-top:8px}
      .header-right{text-align:right;font-size:12px;opacity:0.9}
      .info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px}
      .info-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
      .info-card h3{font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:6px}
      .info-card p{font-size:13px;color:#334155;margin-bottom:2px}
      .cost-card{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 20px;margin-bottom:20px}
      .cost-card h3{font-size:14px;font-weight:700;color:#065f46;margin-bottom:12px}
      .cost-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
      .cost-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #d1fae5;font-size:13px}
      .cost-row.total{font-weight:700;border-bottom:2px solid #6ee7b7;padding-top:8px}
      .cost-row.highlight{color:#065f46;font-size:15px}
      .cost-row strong{font-weight:600}
      .section-title{font-size:16px;font-weight:700;color:#1e293b;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
      table{width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);margin-bottom:8px}
      th{background:#065f46;color:white;padding:9px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em}
      td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}
      tr:nth-child(even) td{background:#f8fafb}
      tr:last-child td{border-bottom:none}
      .notes{background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:13px}
      .notes h3{font-size:11px;text-transform:uppercase;color:#92400e;margin-bottom:6px}
      .footer{margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
      .footer-brand{font-weight:600;color:#065f46}
      @media print{body{padding:12px}.header,.cost-card,th,tr:nth-child(even) td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <div class="header">
      <div>
        <h1>${esc(job.name)}</h1>
        <p class="sub">${esc(job.location)}</p>
        <span class="status-badge">${fmtStatus(job.status)}</span>
      </div>
      <div class="header-right">
        <p>Ref: ${esc(job.job_reference || '—')}</p>
        <p>Type: ${fmtJobType(job.job_type)}</p>
        <p>${fmtDate(job.start_date)} → ${fmtDate(job.end_date)}</p>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <h3>Project Manager</h3>
        <p>${esc(job.project_manager || '—')}</p>
      </div>
      <div class="info-card">
        <h3>Site Contact</h3>
        <p>${esc(job.site_contact_name || '—')}</p>
        <p>${esc(job.site_contact_phone || '')}</p>
      </div>
      ${clientInfo}
    </div>

    ${job.notes ? `<div class="notes"><h3>Job Notes</h3><p>${esc(job.notes)}</p></div>` : ''}

    ${costBlock}

    ${staffTable}
    ${equipTable}
    ${assetTable}
    ${milestoneTable}

    <div class="footer"><span>Generated ${genDate} · ${rotas.length} assignments · ${validStaff.length} staff · ${costItems.length} cost items</span><span class="footer-brand">GC Job Planner</span></div>
    </body></html>`;

    return Response.json({
      html: htmlContent,
      fileName: `${job.name.replace(/[^a-z0-9]/gi, '_')}_report.html`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});