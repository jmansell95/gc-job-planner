import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * refreshAllDraftAFPs — finds all AFPs in 'draft' status and re-populates
 * their line items from live field data. Designed to run on a scheduled
 * automation (weekly) so draft AFPs always show the latest field data
 * without manual refresh.
 *
 * Input:  {} (no parameters needed)
 * Output: { success, refreshed, errors }
 */

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch all draft AFPs
    const draftAfps = await base44.entities.AFP.filter({ status: 'draft' }, '-created_date', 200);

    const results = {
      success: true,
      refreshed: 0,
      errors: [],
    };

    for (const afp of draftAfps) {
      try {
        // Re-populate from field data
        const startDate = afp.period_start_date || '';
        const endDate = afp.period_end_date || new Date().toISOString().slice(0, 10);

        // Fetch field data
        const [logs, subcons, timesheets, deliveries, costs, assignments] = await Promise.all([
          base44.entities.InvestigationLog.filter({ job_id: afp.job_id }, '-created_date', 500),
          base44.entities.SubcontractorLog.filter({ job_id: afp.job_id }, '-created_date', 500),
          base44.entities.Timesheet.filter({ job_id: afp.job_id }, '-created_date', 500),
          base44.entities.DeliveryLog.filter({ job_id: afp.job_id }, '-created_date', 500),
          base44.entities.DailyCost.filter({ job_id: afp.job_id }, '-created_date', 500),
          base44.entities.JobAssetAssignment.filter({ job_id: afp.job_id }, '-created_date', 500),
        ]);

        const inRange = (date) => {
          if (!date) return false;
          const d = typeof date === 'string' ? date.slice(0, 10) : new Date(date).toISOString().slice(0, 10);
          if (startDate && d < startDate) return false;
          if (endDate && d > endDate) return false;
          return true;
        };

        const fLogs = logs.filter(l => inRange(l.date));
        const fSubcons = subcons.filter(s => inRange(s.date));
        const fTimesheets = timesheets.filter(t => inRange(t.date || t.shift_date, startDate, endDate));
        const fDeliveries = deliveries.filter(d => inRange(d.delivery_date || d.date));
        const fCosts = costs.filter(c => inRange(c.date));
        const fAssignments = assignments.filter(a => inRange(a.assigned_date) && (a.status === 'assigned' || a.status === 'on_site'));

        // Delete existing auto-populated items
        const existing = await base44.entities.AFPLineItem.filter({ afp_id: afp.id }, 'sort_order', 500);
        const autoIds = existing.filter(li => li.source !== 'manual' && !li.is_manual).map(li => li.id);
        for (const id of autoIds) {
          try { await base44.entities.AFPLineItem.delete(id); } catch (_) {}
        }

        // Create new items (simplified — same logic as populateAFPFromFieldData)
        const newItems: any[] = [];
        let sortOrder = 0;

        for (const log of fLogs) {
          const metres = Number(log.metres_drilled || 0);
          newItems.push({
            afp_id: afp.id, job_id: afp.job_id, sheet_name: 'drilling', category: 'drilling',
            item: log.description || `Drilling — ${log.borehole_ref || 'Borehole'}`,
            unit: 'm', qty: metres, rate: 0, amount: 0,
            source: 'driller_log', source_date: log.date, source_id: log.id,
            is_manual: false, dispute_status: 'none', original_amount: 0, agreed_amount: 0,
            sort_order: sortOrder++,
          });
        }

        for (const sc of fSubcons) {
          const amt = Number(sc.client_charge_net || sc.purchase_cost_net || 0);
          newItems.push({
            afp_id: afp.id, job_id: afp.job_id, sheet_name: 'plant_hire', category: 'subcontractor',
            item: sc.description || sc.work_type || 'Subcontractor Work',
            unit: sc.purchase_rate_basis || 'sum', qty: Number(sc.units_completed || sc.hours_worked || 1),
            rate: Number(sc.purchase_rate || 0), amount: amt,
            source: 'subcontractor', source_date: sc.date, source_id: sc.id,
            is_manual: false, dispute_status: 'none', original_amount: amt, agreed_amount: amt,
            sort_order: sortOrder++,
          });
        }

        for (const cost of fCosts) {
          const amt = Number(cost.amount || cost.cost || 0);
          newItems.push({
            afp_id: afp.id, job_id: afp.job_id, sheet_name: 'plant_hire', category: 'materials',
            item: cost.description || cost.category || 'Daily Cost',
            unit: 'sum', qty: 1, rate: amt, amount: amt,
            source: 'cost', source_date: cost.date, source_id: cost.id,
            is_manual: false, dispute_status: 'none', original_amount: amt, agreed_amount: amt,
            sort_order: sortOrder++,
          });
        }

        if (newItems.length > 0) {
          await base44.entities.AFPLineItem.bulkCreate(newItems);
        }

        // Update AFP totals
        const remaining = await base44.entities.AFPLineItem.filter({ afp_id: afp.id }, 'sort_order', 500);
        const total = remaining.reduce((s, li) => s + Number(li.amount || 0), 0);
        await base44.entities.AFP.update(afp.id, {
          total_claimed: total,
          original_total: total,
          agreed_total: total,
          last_populated_at: new Date().toISOString(),
          last_populated_by: 'Scheduled Auto-Refresh',
        });

        results.refreshed++;
      } catch (err) {
        results.errors.push({ afp_id: afp.id, error: err.message });
      }
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}