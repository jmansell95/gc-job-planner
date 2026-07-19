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

    // Fetch all related data in parallel — now includes hotel bookings, deliveries & rate card items
    const [rotas, costItems, assignments, milestones, documents, photos, complianceItems, investigationLogs, hotelBookings, deliveries, rateCardItems, timesheets] = await Promise.all([
      base44.entities.RotaAssignment.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobCostItem.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobAssetAssignment.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobMilestone.filter({ job_id: jobId }).catch(() => []),
      base44.entities.JobDocument.filter({ job_id: jobId }).catch(() => []),
      base44.entities.SitePhoto.filter({ job_id: jobId }).catch(() => []),
      base44.entities.ComplianceItem.filter({ reference_id: jobId }).catch(() => []),
      base44.entities.InvestigationLog.filter({ job_id: jobId }).catch(() => []),
      base44.entities.HotelBooking.filter({ job_id: jobId }).catch(() => []),
      base44.entities.DeliveryLog.filter({ job_id: jobId }).catch(() => []),
      base44.entities.RateCardItem.list('-created_date', 500).catch(() => []),
      base44.entities.Timesheet.filter({ job_id: jobId }).catch(() => []),
    ]);

    // Fetch related staff
    const staffIds = [...new Set(rotas.map(r => r.staff_id).filter(Boolean))];
    const staff = await Promise.all(staffIds.map(id => base44.entities.Staff.get(id).catch(() => null)));
    const validStaff = staff.filter(Boolean);

    // Fetch labour staff (from labour cost items)
    const labourStaffIds = [...new Set(costItems.filter(c => c.category === 'labour' && c.staff_id).map(c => c.staff_id))];
    const labourStaff = await Promise.all(labourStaffIds.map(id => base44.entities.Staff.get(id).catch(() => null)));
    const validLabourStaff = [...validStaff, ...labourStaff.filter(Boolean)];

    // Fetch client/contractor
    const client = job.client_id ? await base44.entities.Client.get(job.client_id).catch(() => null) : null;
    const contractor = job.contractor_id ? await base44.entities.Contractor.get(job.contractor_id).catch(() => null) : null;

    // Fetch assets
    const assetIds = [...new Set(assignments.map(a => a.asset_id).filter(Boolean))];
    const assets = await Promise.all(assetIds.map(id => base44.entities.SiteAsset.get(id).catch(() => null)));
    const validAssets = assets.filter(Boolean);

    // --- Rate card lookup map ---
    const rateCardMap = {};
    (rateCardItems || []).forEach(r => { rateCardMap[r.id] = r; });

    // --- Calculate costs ---
    const equipmentItems = costItems.filter(c => c.category !== 'labour');
    const labourItems = costItems.filter(c => c.category === 'labour');
    const totalEquip = equipmentItems.reduce((a, c) => a + (c.unit_cost || 0) * (c.quantity || 1), 0);
    const totalLabour = labourItems.reduce((a, c) => a + (c.unit_cost || 0) * (c.quantity || 1), 0);

    // --- Hotel costs ---
    const hotelRows = (hotelBookings || []).map(b => {
      const checkIn = b.check_in_date ? new Date(b.check_in_date + 'T00:00:00') : null;
      const checkOut = b.check_out_date ? new Date(b.check_out_date + 'T00:00:00') : null;
      const nights = checkIn && checkOut ? Math.max(0, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24))) : 0;
      const rooms = Number(b.room_count) || 1;
      const perNight = Number(b.cost_per_night) || 0;
      const total = perNight * rooms * nights;
      return { ...b, nights, rooms, perNight, total };
    });
    const totalHotel = hotelRows.reduce((s, h) => s + h.total, 0);

    // --- Delivery charges ---
    const chargeableDeliveries = (deliveries || []).filter(d => d.chargeable !== false);
    const totalDelivery = chargeableDeliveries.reduce((s, d) => s + (Number(d.charge_amount) || 0), 0);

    // --- Task charges (from timesheets) ---
    const taskCharges = (timesheets || []).filter(t => t.chargeable && !t.is_break).reduce((s, t) => s + (Number(t.charge_amount) || 0), 0);

    // --- Revenue calculation ---
    const method = job.revenue_method || 'none';
    let revenueNet = 0;
    let revenueLabel = '';
    let revenueBreakdown = [];

    if (method === 'meterage_rate') {
      const meterage = Number(job.meterage) || 0;
      const rate = Number(job.meterage_rate) || 0;
      revenueNet = meterage * rate;
      revenueLabel = 'Meterage revenue';
      revenueBreakdown = [{ label: `${meterage}m × £${rate}/m`, value: revenueNet }];
    } else if (method === 'day_rate') {
      revenueLabel = 'Day-rate revenue';
      const dayRateItems = (rateCardItems || []).filter(r => r.category === 'labour' && r.rate_card_source === 'our_company' && r.unit === 'day' && r.price != null);
      const plannedDays = job.start_date && job.end_date ? Math.max(1, Math.round((new Date(job.end_date + 'T00:00:00') - new Date(job.start_date + 'T00:00:00')) / (1000 * 60 * 60 * 24)) + 1) : 0;
      // Sum matching crew day rates from rig assignments
      const rigAssignments = assignments.filter(a => a.asset_type === 'rig');
      let dayRateTotal = 0;
      const rows = [];
      rigAssignments.forEach(a => {
        const rate = dayRateItems.find(r => {
          if (a.rig_type === 'rotary') return /rotary crew/i.test(r.description);
          if (a.rig_type === 'cp') return /^cable percussive crew$/i.test(r.description.trim());
          return false;
        });
        if (rate) {
          const line = rate.price * plannedDays;
          dayRateTotal += line;
          rows.push({ label: `${a.asset_name || 'Rig'}: ${rate.description} × ${plannedDays} days`, value: line });
        }
      });
      // Add explicit labour cost items (extra crew)
      labourItems.forEach(c => {
        const line = (Number(c.unit_cost) || 0) * (Number(c.quantity) || 1);
        dayRateTotal += line;
        rows.push({ label: `${c.description} (${c.responsible_person || '—'})`, value: line });
      });
      revenueNet = dayRateTotal;
      revenueBreakdown = rows.length ? rows : [{ label: 'No crew rates matched', value: 0 }];
    } else if (method === 'unit_rate') {
      const unitPrice = Number(job.unit_price) || 0;
      const unitsDone = investigationLogs.reduce((s, l) => s + (Number(l.units_completed) || 0), 0);
      revenueNet = unitsDone * unitPrice;
      revenueLabel = 'Unit-rate revenue';
      revenueBreakdown = [{ label: `${unitsDone} units × £${unitPrice}`, value: revenueNet }];
    } else if (method === 'flat_fee') {
      revenueNet = Number(job.client_charge) || 0;
      revenueLabel = 'Agreed flat fee';
      revenueBreakdown = [{ label: 'Project fee', value: revenueNet }];
    } else {
      // 'none' — markup-on-cost model
      const totalCostNet = totalEquip + totalLabour + totalHotel + totalDelivery + taskCharges;
      const markupPct = job.markup_percentage || 0;
      const markupAmt = totalCostNet * (markupPct / 100);
      revenueNet = totalCostNet + markupAmt;
      revenueLabel = 'Cost + markup';
      revenueBreakdown = [
        { label: 'Equipment (net)', value: totalEquip },
        { label: 'Labour (net)', value: totalLabour },
        { label: 'Hotel (net)', value: totalHotel },
        { label: 'Deliveries (net)', value: totalDelivery },
        ...(taskCharges > 0 ? [{ label: 'Task charges', value: taskCharges }] : []),
        { label: `Markup (${markupPct}%)`, value: markupAmt },
      ];
    }

    const vatRate = job.vat_rate ?? 20;
    const revenueVat = revenueNet * (vatRate / 100);
    const revenueGross = revenueNet + revenueVat;

    // For non-markup methods, the "cost" is the internal cost; profit = revenue - cost
    const totalInternalCost = totalEquip + totalLabour + totalHotel + totalDelivery + taskCharges;
    const profit = revenueNet - totalInternalCost;
    const margin = revenueNet > 0 ? (profit / revenueNet) * 100 : 0;

    const fmtGBP = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB');
    const fmtDate = (d) => {
      if (!d) return '—';
      const date = new Date(d + 'T00:00:00');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
    };
    const esc = (s) => (s || '').toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const jobTypeLabels = {groundworks:'Groundworks',cp_drilling:'CP Drilling',rotary_drilling:'Rotary Drilling',enabling_works:'Enabling Works',depot:'Depot'};
    const statusLabels = {planning:'Planning',in_progress:'In Progress',decommissioning:'Decommissioning',completed:'Completed',on_hold:'On Hold',cancelled:'Cancelled'};
    const roleLabels = {groundworker:'Groundworker',cp_driller:'CP Driller',rotary_driller:'Rotary Driller',enabling_crew:'Enabling Crew',depot:'Depot',supervisor:'Supervisor'};
    const fmtJobType = (t) => jobTypeLabels[t] || esc(t).replace(/_/g,' ');
    const fmtStatus = (t) => statusLabels[t] || esc(t).replace(/_/g,' ');
    const fmtRole = (r) => roleLabels[r] || esc(r).replace(/_/g,' ');

    const strataLabels = {topsoil:'Topsoil',made_ground:'Made Ground',clay_soft:'Soft Clay',clay_firm:'Firm Clay',clay_stiff:'Stiff Clay',sand_loose:'Loose Sand',sand_medium_dense:'Medium Dense Sand',sand_dense:'Dense Sand',gravel:'Gravel',silt:'Silt',peat:'Peat',chalk:'Chalk',mudstone:'Mudstone',sandstone:'Sandstone',limestone:'Limestone',granite:'Granite',concrete:'Concrete',tarmac:'Tarmac',other:'Other'};
    const pitStabilityLabels = {stable:'Stable',minor_slumping:'Minor slumping',collapse:'Collapse',not_assessed:'Not assessed'};
    const serviceLabels = {none:'None',gas:'Gas',water:'Water',electric:'Electric',telecom:'Telecom',drainage:'Drainage',unknown:'Unknown'};
    const reinstatementLabels = {none:'None',backfilled:'Backfilled',granular_fill:'Granular fill',concrete:'Concrete',tarmac:'Tarmac',left_open:'Left open',other:'Other'};
    const reviewLabels = {pending:'Pending',approved:'Approved',queried:'Queried'};
    const fmtStrata = (t) => strataLabels[t] || '—';
    const fmtNum = (n) => n != null ? Number(n).toFixed(n % 1 === 0 ? 0 : 1) : '—';

    const genDate = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // --- Meterage calculation (drilling jobs billed per metre) ---
    const meterageRate = Number(job.meterage_rate) || 0;
    const boreholeProgressLogs = investigationLogs.filter(l => l.log_type === 'borehole_progress' || l.log_type === 'sample_collection');
    const loggedMeterage = boreholeProgressLogs.reduce((sum, l) => {
      if (l.depth_from != null && l.depth_to != null) return sum + (l.depth_to - l.depth_from);
      return sum;
    }, 0);
    const totalMeters = (job.meterage != null && job.meterage !== '') ? Number(job.meterage) : loggedMeterage;
    const meterageRevenue = totalMeters * meterageRate;
    const meterageTarget = Number(job.meterage_target) || 0;

    const boreholeMeterage = {};
    boreholeProgressLogs.forEach(l => {
      const ref = l.borehole_ref || 'Unspecified';
      if (!boreholeMeterage[ref]) boreholeMeterage[ref] = 0;
      if (l.depth_from != null && l.depth_to != null) boreholeMeterage[ref] += (l.depth_to - l.depth_from);
    });
    const boreholeMeterageRows = Object.entries(boreholeMeterage)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ref, depth]) => `<tr><td>${esc(ref)}</td><td>${depth.toFixed(1)}m</td><td>${meterageRate > 0 ? fmtGBP(depth * meterageRate) : '—'}</td></tr>`)
      .join('');

    // --- Staff table rows ---
    const staffRows = validStaff.map(s => {
      const shifts = rotas.filter(r => r.staff_id === s.id).length;
      return `<tr><td>${esc(s.name)}</td><td>${fmtRole(s.job_role)}</td><td>${esc(s.worker_type).replace(/_/g,' ')}</td><td>${shifts}</td></tr>`;
    }).join('');

    // --- Equipment cost rows (with rate card link info) ---
    const equipRows = equipmentItems.map(c => {
      const lineCost = (c.unit_cost || 0) * (c.quantity || 1);
      const rc = c.rate_card_item_id ? rateCardMap[c.rate_card_item_id] : null;
      const rcBadge = rc ? `<span style="display:inline-block;padding:1px 6px;border-radius:8px;font-size:9px;background:#d1fae5;color:#065f46;font-weight:600">RC</span>` : '';
      return `<tr><td>${esc(c.description)} ${rcBadge}</td><td>${esc(c.category).replace(/_/g,' ')}</td><td>${c.quantity || 1} ${esc(c.unit_label || '')}</td><td>${fmtGBP(c.unit_cost)}</td><td>${fmtGBP(lineCost)}</td></tr>`;
    }).join('');

    // --- Labour / Extra Crew rows ---
    const labourRows = labourItems.map(c => {
      const lineCost = (c.unit_cost || 0) * (c.quantity || 1);
      const rc = c.rate_card_item_id ? rateCardMap[c.rate_card_item_id] : null;
      const rcBadge = rc ? `<span style="display:inline-block;padding:1px 6px;border-radius:8px;font-size:9px;background:#d1fae5;color:#065f46;font-weight:600">RC</span>` : '';
      const staffName = c.staff_id ? (validLabourStaff.find(s => s.id === c.staff_id)?.name || c.responsible_person || '—') : (c.responsible_person || '—');
      const dates = c.start_date && c.end_date ? `${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}` : '—';
      return `<tr><td>${esc(c.description)} ${rcBadge}</td><td>${esc(staffName)}</td><td>${dates}</td><td>${c.quantity || 1} ${esc(c.unit_label || '')}</td><td>${fmtGBP(c.unit_cost)}</td><td>${fmtGBP(lineCost)}</td></tr>`;
    }).join('');

    // --- Hotel rows ---
    const hotelRowsHtml = hotelRows.map(h => {
      return `<tr><td>${esc(h.hotel_name)}</td><td>${esc(h.assigned_staff_names?.join(', ') || '—')}</td><td>${fmtDate(h.check_in_date)} → ${fmtDate(h.check_out_date)}</td><td>${h.nights}</td><td>${h.rooms}</td><td>${fmtGBP(h.perNight)}</td><td>${fmtGBP(h.total)}</td></tr>`;
    }).join('');

    // --- Delivery rows ---
    const deliveryRows = chargeableDeliveries.map(d => {
      const typeLabel = { site_delivery: 'Site Delivery', supplier_collection: 'Supplier Collection', item_handover: 'Handover' }[d.delivery_type] || d.delivery_type;
      return `<tr><td>${esc(typeLabel)}</td><td>${esc(d.items || '—')}</td><td>${fmtDate(d.scheduled_date)}</td><td>${esc(d.driver_staff_name || '—')}</td><td>${d.chargeable !== false ? fmtGBP(d.charge_amount) : 'No charge'}</td><td>${esc(d.status)}</td></tr>`;
    }).join('');

    // --- Asset rows ---
    const assetRows = assignments.map(a => {
      const asset = validAssets.find(as => as.id === a.asset_id);
      return `<tr><td>${esc(a.asset_name)}</td><td>${esc(a.asset_type)}</td><td>${esc(a.role).replace(/_/g,' ')}</td><td>${esc(a.status)}</td><td>${asset ? esc(asset.serial_number || '—') : '—'}</td></tr>`;
    }).join('');

    // --- Milestone rows ---
    const milestoneRows = milestones.map(m => {
      return `<tr><td>${esc(m.name)}</td><td>${fmtDate(m.target_date)}</td><td>${m.completed ? '✓ Done' : 'Pending'}</td></tr>`;
    }).join('');

    // --- Billing Summary block (admins and managers only) ---
    const billingSummary = canViewCostings ? `
      <div class="cost-card billing-summary">
        <h3>📋 Billing Summary — Invoice Checklist</h3>
        <div class="billing-section">
          <h4>Revenue (${esc(revenueLabel)})</h4>
          <div class="cost-grid">
            ${revenueBreakdown.map(r => `<div class="cost-row"><span>${esc(r.label)}</span><strong>${fmtGBP(r.value)}</strong></div>`).join('')}
            <div class="cost-row total highlight"><span>Revenue (net)</span><strong>${fmtGBP(revenueNet)}</strong></div>
            <div class="cost-row"><span>VAT (${vatRate}%)</span><strong>${fmtGBP(revenueVat)}</strong></div>
            <div class="cost-row total highlight"><span>Revenue (gross)</span><strong>${fmtGBP(revenueGross)}</strong></div>
          </div>
        </div>
        <div class="billing-section">
          <h4>Internal Costs (for margin tracking)</h4>
          <div class="cost-grid">
            <div class="cost-row"><span>Equipment</span><strong>${fmtGBP(totalEquip)}</strong></div>
            <div class="cost-row"><span>Labour / Extra Crew</span><strong>${fmtGBP(totalLabour)}</strong></div>
            <div class="cost-row"><span>Hotel</span><strong>${fmtGBP(totalHotel)}</strong></div>
            <div class="cost-row"><span>Deliveries</span><strong>${fmtGBP(totalDelivery)}</strong></div>
            ${taskCharges > 0 ? `<div class="cost-row"><span>Task charges</span><strong>${fmtGBP(taskCharges)}</strong></div>` : ''}
            <div class="cost-row total"><span>Total internal cost</span><strong>${fmtGBP(totalInternalCost)}</strong></div>
            <div class="cost-row"><span>Gross profit</span><strong>${fmtGBP(profit)}</strong></div>
            <div class="cost-row"><span>Margin</span><strong>${margin.toFixed(1)}%</strong></div>
          </div>
        </div>
        <div class="billing-checklist">
          <h4>✅ Invoice Checklist</h4>
          <ul>
            <li>${equipmentItems.length} equipment/plant/material item(s) — total ${fmtGBP(totalEquip)}</li>
            <li>${labourItems.length} labour/extra crew item(s) — total ${fmtGBP(totalLabour)}</li>
            <li>${hotelRows.length} hotel booking(s) — total ${fmtGBP(totalHotel)}</li>
            <li>${chargeableDeliveries.length} chargeable delivery/ies — total ${fmtGBP(totalDelivery)}</li>
            ${taskCharges > 0 ? `<li>Task charges from timesheets — total ${fmtGBP(taskCharges)}</li>` : ''}
            ${totalMeters > 0 ? `<li>Meterage: ${totalMeters.toFixed(1)}m drilled${meterageRate > 0 ? ` @ ${fmtGBP(meterageRate)}/m = ${fmtGBP(meterageRevenue)}` : ''}</li>` : ''}
            <li><strong>Total to invoice (gross): ${fmtGBP(revenueGross)}</strong></li>
          </ul>
        </div>
      </div>` : '';

    // --- Cost summary block (legacy, admins and managers only) ---
    const costBlock = canViewCostings ? `
      <div class="cost-card">
        <h3>Cost & Profitability Summary</h3>
        <div class="cost-grid">
          <div class="cost-row"><span>Equipment Cost</span><strong>${fmtGBP(totalEquip)}</strong></div>
          <div class="cost-row"><span>Labour Cost</span><strong>${fmtGBP(totalLabour)}</strong></div>
          <div class="cost-row"><span>Hotel Cost</span><strong>${fmtGBP(totalHotel)}</strong></div>
          <div class="cost-row"><span>Delivery Charges</span><strong>${fmtGBP(totalDelivery)}</strong></div>
          <div class="cost-row total"><span>Total Internal Cost</span><strong>${fmtGBP(totalInternalCost)}</strong></div>
          <div class="cost-row"><span>VAT (${vatRate}%)</span><strong>${fmtGBP(revenueVat)}</strong></div>
          <div class="cost-row total highlight"><span>Client Price (gross)</span><strong>${fmtGBP(revenueGross)}</strong></div>
          <div class="cost-row"><span>Gross Profit</span><strong>${fmtGBP(profit)}</strong></div>
          <div class="cost-row"><span>Margin</span><strong>${margin.toFixed(1)}%</strong></div>
        </div>
      </div>` : '';

    // --- Meterage block (drilling jobs billed per metre) ---
    const meterageBlock = (meterageRate > 0 || meterageTarget > 0 || loggedMeterage > 0) ? `
      <div class="cost-card" style="background:#eff6ff;border-color:#bfdbfe">
        <h3 style="color:#1e40af">Meterage Summary</h3>
        <div class="cost-grid">
          <div class="cost-row"><span>Total Drilled</span><strong>${totalMeters.toFixed(1)}m</strong></div>
          <div class="cost-row"><span>Rate / metre</span><strong>${meterageRate > 0 ? fmtGBP(meterageRate) : '—'}</strong></div>
          <div class="cost-row total highlight" style="color:#1e40af"><span>Meterage Revenue</span><strong>${fmtGBP(meterageRevenue)}</strong></div>
          ${meterageTarget > 0 ? `<div class="cost-row"><span>Target</span><strong>${meterageTarget}m</strong></div>` : ''}
          ${meterageTarget > 0 ? `<div class="cost-row"><span>Progress</span><strong>${((totalMeters / meterageTarget) * 100).toFixed(0)}%</strong></div>` : ''}
          <div class="cost-row"><span>Source</span><strong>${(job.meterage != null && job.meterage !== '') ? 'Manual override' : 'From borehole logs'}</strong></div>
        </div>
      </div>${boreholeMeterageRows ? `
      <h2 class="section-title">Per-Borehole Meterage</h2>
      <table><thead><tr><th>Borehole Ref</th><th>Depth Drilled</th><th>Revenue</th></tr></thead>
      <tbody>${boreholeMeterageRows}</tbody></table>` : ''}` : '';

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
      <table><thead><tr><th>Name</th><th>Role</th><th>Type</th><th>Shifts</th></tr></thead>
      <tbody>${staffRows}</tbody></table>` : '';

    const equipTable = (canViewCostings && equipmentItems.length > 0) ? `
      <h2 class="section-title">Equipment, Plant & Materials</h2>
      <table><thead><tr><th>Description</th><th>Category</th><th>Qty</th><th>Unit Cost</th><th>Line Cost</th></tr></thead>
      <tbody>${equipRows}</tbody>
      <tfoot><tr><td colspan="4" style="text-align:right;font-weight:700">Total Equipment</td><td style="font-weight:700">${fmtGBP(totalEquip)}</td></tr></tfoot></table>` : '';

    const labourTable = (canViewCostings && labourItems.length > 0) ? `
      <h2 class="section-title">Labour / Extra Crew</h2>
      <table><thead><tr><th>Description</th><th>Staff Member</th><th>Dates</th><th>Qty</th><th>Unit Cost</th><th>Line Cost</th></tr></thead>
      <tbody>${labourRows}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700">Total Labour</td><td style="font-weight:700">${fmtGBP(totalLabour)}</td></tr></tfoot></table>` : '';

    const hotelTable = (canViewCostings && hotelRows.length > 0) ? `
      <h2 class="section-title">Hotel Bookings</h2>
      <table><thead><tr><th>Hotel</th><th>Staff</th><th>Dates</th><th>Nights</th><th>Rooms</th><th>Per Night</th><th>Total</th></tr></thead>
      <tbody>${hotelRowsHtml}</tbody>
      <tfoot><tr><td colspan="6" style="text-align:right;font-weight:700">Total Hotel</td><td style="font-weight:700">${fmtGBP(totalHotel)}</td></tr></tfoot></table>` : '';

    const deliveryTable = (canViewCostings && chargeableDeliveries.length > 0) ? `
      <h2 class="section-title">Deliveries & Collections</h2>
      <table><thead><tr><th>Type</th><th>Items</th><th>Date</th><th>Driver</th><th>Charge</th><th>Status</th></tr></thead>
      <tbody>${deliveryRows}</tbody>
      <tfoot><tr><td colspan="4" style="text-align:right;font-weight:700">Total Delivery Charges</td><td style="font-weight:700">${fmtGBP(totalDelivery)}</td><td></td></tr></tfoot></table>` : '';

    const assetTable = assignments.length > 0 ? `
      <h2 class="section-title">Site Assets</h2>
      <table><thead><tr><th>Asset</th><th>Type</th><th>Role</th><th>Status</th><th>Serial</th></tr></thead>
      <tbody>${assetRows}</tbody></table>` : '';

    const milestoneTable = milestones.length > 0 ? `
      <h2 class="section-title">Milestones</h2>
      <table><thead><tr><th>Milestone</th><th>Target Date</th><th>Status</th></tr></thead>
      <tbody>${milestoneRows}</tbody></table>` : '';

    // --- Geotechnical Investigation Logs ---
    const sortedLogs = investigationLogs.sort((a, b) => {
      const d = (a.date || '').localeCompare(b.date || '');
      if (d !== 0) return d;
      return (a.depth_from || 0) - (b.depth_from || 0);
    });

    const isDrillingType = job.job_type === 'cp_drilling' || job.job_type === 'rotary_drilling';
    const approvedLogs = sortedLogs.filter(l => l.manager_review_status === 'approved');
    const pendingLogs = sortedLogs.filter(l => (l.manager_review_status || 'pending') === 'pending');

    // Borehole log rows
    const boreholeLogs = sortedLogs.filter(l => l.log_type === 'borehole_progress' || l.log_type === 'sample_collection');
    const boreholeRows = boreholeLogs.map(l => {
      const blows = l.spt_blows && l.spt_blows.length > 0 ? l.spt_blows.join(' / ') : '—';
      return `<tr>
        <td>${esc(l.borehole_ref || '—')}</td>
        <td>${l.depth_from != null ? fmtNum(l.depth_from) : '—'}</td>
        <td>${l.depth_to != null ? fmtNum(l.depth_to) : '—'}</td>
        <td>${fmtStrata(l.strata_descriptor)}</td>
        <td>${esc(l.strata_description_detail || '—')}</td>
        <td>${blows}</td>
        <td>${l.spt_n_value != null ? l.spt_n_value : '—'}</td>
        <td>${l.groundwater_strike_depth != null ? fmtNum(l.groundwater_strike_depth) + 'm' : '—'}</td>
        <td>${l.coring_recovery != null ? l.coring_recovery + '%' : '—'}</td>
        <td>${l.coring_rqd != null ? l.coring_rqd + '%' : '—'}</td>
        <td>${l.sample_id ? esc(l.sample_id) + ' (' + esc(l.sample_type || '') + ')' : '—'}</td>
        <td><span class="review-${l.manager_review_status || 'pending'}">${reviewLabels[l.manager_review_status || 'pending']}</span></td>
      </tr>`;
    }).join('');

    // Trial pit / groundworks rows
    const pitLogs = sortedLogs.filter(l => l.log_type === 'pit_excavation' || l.log_type === 'installation' || l.log_type === 'site_setup' || l.log_type === 'reinstatement');
    const pitRows = pitLogs.map(l => {
      const service = l.service_encounter_type && l.service_encounter_type !== 'none'
        ? `${serviceLabels[l.service_encounter_type] || l.service_encounter_type}${l.service_encounter_gps ? ' (' + esc(l.service_encounter_gps) + ')' : ''}`
        : 'None';
      const photos = (l.photo_urls || l.verification_photo_urls || '').split(',').filter(Boolean).length;
      return `<tr>
        <td>${esc(l.borehole_ref || '—')}</td>
        <td>${l.log_type === 'pit_excavation' ? 'Trial Pit' : l.log_type === 'installation' ? 'Installation' : l.log_type === 'reinstatement' ? 'Reinstatement' : 'Site Setup'}</td>
        <td>${esc(l.dimensions || (l.depth_from != null && l.depth_to != null ? fmtNum(l.depth_from) + '-' + fmtNum(l.depth_to) + 'm' : '—'))}</td>
        <td>${pitStabilityLabels[l.pit_stability_rating] || '—'}</td>
        <td>${service}</td>
        <td>${l.cbr_value != null ? l.cbr_value + '%' : '—'}</td>
        <td>${l.vane_strength != null ? l.vane_strength + ' kPa' : '—'}</td>
        <td>${reinstatementLabels[l.reinstatement_type] || '—'}</td>
        <td>${esc(l.backfill_material || '—')}</td>
        <td>${photos > 0 ? photos + ' photo' + (photos > 1 ? 's' : '') : '—'}</td>
        <td>${esc(l.description || l.strata_description_detail || '—')}</td>
        <td><span class="review-${l.manager_review_status || 'pending'}">${reviewLabels[l.manager_review_status || 'pending']}</span></td>
      </tr>`;
    }).join('');

    const boreholeTable = boreholeLogs.length > 0 ? `
      <h2 class="section-title">Geotechnical Borehole Log</h2>
      <table><thead><tr><th>Borehole</th><th>From (m)</th><th>To (m)</th><th>Strata</th><th>Description</th><th>SPT Blows</th><th>N-Value</th><th>Water Strike</th><th>Recovery</th><th>RQD</th><th>Sample</th><th>Review</th></tr></thead>
      <tbody>${boreholeRows}</tbody></table>` : '';

    const pitTable = pitLogs.length > 0 ? `
      <h2 class="section-title">Trial Pit & Groundworks Log</h2>
      <table><thead><tr><th>Ref</th><th>Type</th><th>Dimensions</th><th>Stability</th><th>Services</th><th>CBR</th><th>Vane</th><th>Reinstatement</th><th>Backfill</th><th>Photos</th><th>Description</th><th>Review</th></tr></thead>
      <tbody>${pitRows}</tbody></table>` : '';

    const qcSummary = sortedLogs.length > 0 ? `
      <div class="info-card" style="background:#f0f9ff;border-color:#bae6fd;margin-bottom:20px">
        <h3 style="color:#0369a1">Geotechnical Data Quality</h3>
        <p>${sortedLogs.length} total log entries · ${approvedLogs.length} approved · ${pendingLogs.length} pending review · ${sortedLogs.filter(l => l.manager_review_status === 'queried').length} queried</p>
      </div>` : '';

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
      .billing-summary{background:linear-gradient(135deg,#f0fdf4 0%,#ecfeff 100%);border:2px solid #6ee7b7}
      .billing-summary h3{font-size:16px;color:#065f46}
      .billing-section{margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #d1fae5}
      .billing-section h4{font-size:12px;font-weight:700;color:#047857;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.03em}
      .billing-checklist{background:white;border-radius:8px;padding:12px 16px;border:1px solid #bbf7d0}
      .billing-checklist h4{font-size:12px;font-weight:700;color:#065f46;margin-bottom:8px}
      .billing-checklist ul{list-style:none;padding:0}
      .billing-checklist li{padding:4px 0;font-size:12px;color:#334155;border-bottom:1px solid #f1f5f9}
      .billing-checklist li:last-child{border-bottom:none;font-weight:700;color:#065f46;font-size:13px;padding-top:8px}
      .cost-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
      .cost-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #d1fae5;font-size:13px}
      .cost-row.total{font-weight:700;border-bottom:2px solid #6ee7b7;padding-top:8px}
      .cost-row.highlight{color:#065f46;font-size:15px}
      .cost-row strong{font-weight:600}
      .section-title{font-size:16px;font-weight:700;color:#1e293b;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
      table{width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);margin-bottom:8px}
      th{background:#065f46;color:white;padding:9px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em}
      td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}
      tfoot td{background:#f0fdf4;font-weight:700;border-top:2px solid #6ee7b7}
      tr:nth-child(even) td{background:#f8fafb}
      tr:last-child td{border-bottom:none}
      .notes{background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:13px}
      .notes h3{font-size:11px;text-transform:uppercase;color:#92400e;margin-bottom:6px}
      .footer{margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
      .footer-brand{font-weight:600;color:#065f46}
      .review-pending{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#fef3c7;color:#92400e}
      .review-approved{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#d1fae5;color:#065f46}
      .review-queried{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#fee2e2;color:#991b1b}
      @media print{body{padding:12px}.header,.cost-card,th,tr:nth-child(even) td,.review-pending,.review-approved,.review-queried,tfoot td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
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

    ${billingSummary}
    ${costBlock}
    ${meterageBlock}

    ${staffTable}
    ${equipTable}
    ${labourTable}
    ${hotelTable}
    ${deliveryTable}
    ${assetTable}
    ${milestoneTable}

    ${qcSummary}
    ${boreholeTable}
    ${pitTable}

    <div class="footer"><span>Generated ${genDate} · ${rotas.length} assignments · ${validStaff.length} staff · ${costItems.length} cost items · ${hotelRows.length} hotel bookings · ${chargeableDeliveries.length} deliveries</span><span class="footer-brand">GC Job Planner — Billing Export</span></div>
    </body></html>`;

    return Response.json({
      html: htmlContent,
      fileName: `${job.name.replace(/[^a-z0-9]/gi, '_')}_billing_report.html`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});