import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  findBestPOAMatch,
  loadAllRateCardItems,
  isLockValidForDate,
} from '../../shared/poaResolver.ts';
import { tokenize, scoreMatch } from '../../shared/projectRateMatcher.ts';

// ============================================================
// lockPOAPrice — the contracts team locks in a price for a POA
// rate card item, and the system retroactively stamps all
// unpriced cost logs that match it.
// ============================================================
//
// Payload:
//   rate_card_item_id: string    — the POA RateCardItem to price
//   scope: 'global' | 'project' | 'job'
//   project_id?: string           — required when scope='project'
//   job_id?: string               — required when scope='job'
//   agreed_price: number          — the agreed GBP price
//   agreed_price_text?: string    — text price fallback
//   quantity?: number             — default 1
//   client_reference?: string     — PO / quote ref
//   effective_date?: string       — ISO date
//   expiry_date?: string           — ISO date
//   notes?: string
//   agreed_by_name?: string       — defaults to current user
//
// Returns:
//   { ok, lock_id, stamped_records, stamped_value_gbp }

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const {
      rate_card_item_id,
      scope,
      project_id,
      job_id,
      agreed_price,
      agreed_price_text,
      quantity,
      client_reference,
      effective_date,
      expiry_date,
      notes,
      agreed_by_name,
    } = body;

    if (!rate_card_item_id) {
      return Response.json({ error: 'rate_card_item_id is required' }, { status: 400 });
    }
    if (!scope || !['global', 'project', 'job'].includes(scope)) {
      return Response.json({ error: 'scope must be global, project, or job' }, { status: 400 });
    }
    if (scope === 'project' && !project_id) {
      return Response.json({ error: 'project_id is required for project scope' }, { status: 400 });
    }
    if (scope === 'job' && !job_id) {
      return Response.json({ error: 'job_id is required for job scope' }, { status: 400 });
    }
    if (agreed_price == null || (typeof agreed_price !== 'number' && !agreed_price_text)) {
      return Response.json({ error: 'agreed_price (number) or agreed_price_text is required' }, { status: 400 });
    }

    // Load the rate card item
    const rci = await base44.asServiceRole.entities.RateCardItem.get(rate_card_item_id);
    if (!rci) return Response.json({ error: 'Rate card item not found' }, { status: 404 });

    const priceNum = typeof agreed_price === 'number' ? agreed_price : parseFloat(String(agreed_price));
    const qty = Number(quantity) || 1;

    // Create the POA lock record
    const lock = await base44.asServiceRole.entities.POAPriceLock.create({
      rate_card_item_id,
      rate_card_item_description: rci.description,
      rate_card_source: rci.rate_card_source || 'our_company',
      project_id: scope === 'project' ? project_id : null,
      job_id: scope === 'job' ? job_id : null,
      agreed_price: isNaN(priceNum) ? 0 : priceNum,
      agreed_price_text: agreed_price_text || null,
      unit: rci.unit || null,
      quantity: qty,
      scope,
      status: 'agreed',
      agreed_by_name: agreed_by_name || user.full_name || user.email || 'Contracts Team',
      agreed_at: new Date().toISOString(),
      client_reference: client_reference || null,
      effective_date: effective_date || null,
      expiry_date: expiry_date || null,
      notes: notes || null,
      stamped_records: 0,
      stamped_value_gbp: 0,
    });

    // If global scope, update the rate card item price directly (no longer POA)
    if (scope === 'global' && !isNaN(priceNum)) {
      await base44.asServiceRole.entities.RateCardItem.update(rate_card_item_id, {
        price: priceNum,
        price_text: null,
      });
    }

    // ── Retroactive stamping ──
    // Find unpriced cost logs matching this POA item and stamp them.
    let stampedRecords = 0;
    let stampedValue = 0;

    // Determine which jobs to stamp
    let jobIds: string[] = [];
    if (scope === 'job') {
      jobIds = [job_id];
    } else if (scope === 'project') {
      const jobs = await base44.asServiceRole.entities.Job.filter({ project_id });
      jobIds = (jobs || []).map((j: any) => j.id);
    }
    // For global scope, we stamp logs across ALL jobs — but that's expensive.
    // Instead, we query unpriced logs directly (charge_amount = 0 or null)
    // and match them against the POA item description.

    // ── Stamp InvestigationLogs ──
    const stampInvestigationLogs = async (jid: string | null) => {
      const filter: any = jid ? { job_id: jid } : {};
      const logs = await base44.asServiceRole.entities.InvestigationLog.filter(filter, '-created_date', 500);
      const unpriced = (logs || []).filter(
        (l: any) => !Number(l.charge_amount) || Number(l.charge_amount) === 0
      );
      for (const log of unpriced) {
        const score = scoreMatch(log.description || '', rci);
        if (score >= 0.6) {
          const logQty =
            Number(log.units_completed) ||
            ((Number(log.depth_to) || 0) - (Number(log.depth_from) || 0)) ||
            1;
          const total = round2(priceNum * logQty);
          try {
            await base44.asServiceRole.entities.InvestigationLog.update(log.id, {
              chargeable: true,
              charge_amount: total,
              charge_breakdown: JSON.stringify({
                source: 'poa_lock',
                poa_lock_id: lock.id,
                rate_card_item_id,
                unit_price: priceNum,
                quantity: logQty,
                total,
                locked_by: agreed_by_name || user.full_name || 'Contracts Team',
              }),
              billing_status: 'auto',
            });
            stampedRecords++;
            stampedValue += total;
          } catch (_) { /* non-fatal */ }
        }
      }
    };

    // ── Stamp Timesheets ──
    const stampTimesheets = async (jid: string | null) => {
      const filter: any = jid ? { job_id: jid } : {};
      const logs = await base44.asServiceRole.entities.Timesheet.filter(filter, '-created_date', 500);
      const unpriced = (logs || []).filter(
        (l: any) => !Number(l.charge_amount) || Number(l.charge_amount) === 0
      );
      for (const log of unpriced) {
        const score = scoreMatch(log.task_description || '', rci);
        if (score >= 0.6) {
          const total = round2(priceNum * qty);
          try {
            await base44.asServiceRole.entities.Timesheet.update(log.id, {
              chargeable: true,
              charge_amount: total,
              charge_breakdown: JSON.stringify({
                source: 'poa_lock',
                poa_lock_id: lock.id,
                rate_card_item_id,
                unit_price: priceNum,
                quantity: qty,
                total,
                locked_by: agreed_by_name || user.full_name || 'Contracts Team',
              }),
            });
            stampedRecords++;
            stampedValue += total;
          } catch (_) { /* non-fatal */ }
        }
      }
    };

    if (jobIds.length > 0) {
      for (const jid of jobIds) {
        await stampInvestigationLogs(jid);
        await stampTimesheets(jid);
      }
    } else if (scope === 'global') {
      // Global: stamp across all jobs (query unpriced logs without job filter)
      await stampInvestigationLogs(null);
      await stampTimesheets(null);
    }

    // Update the lock with stamping stats
    await base44.asServiceRole.entities.POAPriceLock.update(lock.id, {
      stamped_records: stampedRecords,
      stamped_value_gbp: round2(stampedValue),
    });

    return Response.json({
      ok: true,
      lock_id: lock.id,
      scope,
      stamped_records: stampedRecords,
      stamped_value_gbp: round2(stampedValue),
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}