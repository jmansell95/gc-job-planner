import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * activateBillingContract — locks a draft JobBillingContract by:
 *  1. Snapshotting all matching rate card items (our_company + project-specific)
 *     into rate_snapshot JSON so future rate card edits never retroactively
 *     change this contract's billing.
 *  2. Superseding any previously active contract version for the same job.
 *  3. Flipping status draft → active with activated_at / created_by metadata.
 *
 * Admin-only — protects financial integrity.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json();
    const { contract_id } = body;
    if (!contract_id) return Response.json({ error: 'contract_id is required' }, { status: 400 });

    // Load the draft contract
    const contract = await base44.asServiceRole.entities.JobBillingContract.get(contract_id);
    if (!contract) return Response.json({ error: 'Contract not found' }, { status: 404 });
    if (contract.status === 'active') return Response.json({ error: 'Contract is already active' }, { status: 400 });
    if (contract.status === 'void' || contract.status === 'superseded')
      return Response.json({ error: `Cannot activate a ${contract.status} contract` }, { status: 400 });

    const jobId = contract.job_id;
    const projectId = contract.project_id;

    // ── Build rate snapshot ──
    // Pull our_company rate card items, plus any project-specific rates if linked.
    // Filter to active items only and capture the fields the financial engine
    // needs so the frozen snapshot is self-contained.
    const allRateItems = await base44.asServiceRole.entities.RateCardItem.list('-created_date', 500);
    let snapshotItems = allRateItems.filter(i => i.is_active !== false && i.rate_card_source !== 'supplier');
    if (projectId) {
      // Include project-specific rate card items too
      const projectItems = allRateItems.filter(i => i.is_active !== false && i.project_id === projectId);
      snapshotItems = [...snapshotItems, ...projectItems];
    }

    const rateSnapshot = snapshotItems.map(i => ({
      id: i.id,
      category: i.category,
      subcategory: i.subcategory || null,
      description: i.description,
      price: i.price ?? null,
      price_text: i.price_text || null,
      cost_price: i.cost_price ?? null,
      unit: i.unit || null,
      men: i.men ?? null,
      sort_order: i.sort_order || 0,
    }));

    // ── Supersede any existing active version for this job ──
    const existingContracts = await base44.asServiceRole.entities.JobBillingContract.filter({ job_id: jobId });
    const previousActive = existingContracts.find(c => c.status === 'active' && c.id !== contract_id);

    if (previousActive) {
      await base44.asServiceRole.entities.JobBillingContract.update(previousActive.id, {
        status: 'superseded',
        superseded_at: new Date().toISOString(),
        superseded_by_version: contract.version || 1,
      });
    }

    // ── Activate the draft ──
    const activated = await base44.asServiceRole.entities.JobBillingContract.update(contract_id, {
      status: 'active',
      activated_at: new Date().toISOString(),
      created_by_id: user.id,
      created_by_name: user.full_name || user.email,
      rate_snapshot: JSON.stringify({
        snapshot_date: new Date().toISOString(),
        total_items: rateSnapshot.length,
        items: rateSnapshot,
      }),
    });

    return Response.json({
      ok: true,
      contract: activated,
      snapshot_items: rateSnapshot.length,
      superseded_version: previousActive ? previousActive.version : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}