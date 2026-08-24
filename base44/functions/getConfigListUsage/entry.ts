import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Curated mapping of ConfigList key -> { entity, field } whose records store the
// option values. Used by the Dropdown Manager to show a per-option data-impact
// audit (how many existing records use each value) before an admin edits a list.
// Keys not listed here return mapped:false so the UI shows "—" instead of counts.
const USAGE_MAP = {
  asset_types: { entity: 'SiteAsset', field: 'asset_type' },
  rig_types: { entity: 'SiteAsset', field: 'rig_type' },
  stock_levels: { entity: 'SiteAsset', field: 'stock_level' },
  compliance_statuses: { entity: 'SiteAsset', field: 'compliance_status' },
  worker_types: { entity: 'Staff', field: 'worker_type' },
  team_categories: { entity: 'Team', field: 'category' },
  team_job_types: { entity: 'Team', field: 'job_type' },
  job_statuses: { entity: 'Job', field: 'status' },
  revenue_methods: { entity: 'Job', field: 'revenue_method' },
  delivery_types: { entity: 'DeliveryLog', field: 'delivery_type' },
  strata_types: { entity: 'InvestigationLog', field: 'strata_descriptor' },
  sample_types: { entity: 'InvestigationLog', field: 'sample_type' },
  pit_stability_options: { entity: 'InvestigationLog', field: 'pit_stability_rating' },
  service_encounter_types: { entity: 'InvestigationLog', field: 'service_encounter_type' },
  reinstatement_types: { entity: 'InvestigationLog', field: 'reinstatement_type' },
  fluid_loss_options: { entity: 'InvestigationLog', field: 'drilling_fluid_loss' },
  fluid_return_options: { entity: 'InvestigationLog', field: 'fluid_return_quality' },
  obstruction_types: { entity: 'InvestigationLog', field: 'obstruction_type' },
  mixer_types: { entity: 'InvestigationLog', field: 'mixer_type' },
  sensor_types: { entity: 'InvestigationLog', field: 'sensor_type' },
  help_categories: { entity: 'HelpTopic', field: 'category' },
  cost_item_categories: { entity: 'JobCostItem', field: 'category' },
  rate_card_categories: { entity: 'RateCardItem', field: 'category' },
  rate_card_sources: { entity: 'RateCardItem', field: 'source' },
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const key = body?.key;
    if (!key) return Response.json({ error: 'key is required' }, { status: 400 });

    const mapping = USAGE_MAP[key];
    if (!mapping) {
      return Response.json({ key, mapped: false, counts: {}, total: 0 });
    }

    // Pull records (service role bypasses RLS so the audit sees every record)
    // and tally how many use each option value. Capped at 10k records — enough
    // for an audit snapshot on these config-driven entities.
    const records = await base44.asServiceRole.entities[mapping.entity].list('-created_date', 10000);
    const counts: Record<string, number> = {};
    let total = 0;
    for (const r of records) {
      const v = r[mapping.field];
      if (v === null || v === undefined || v === '') continue;
      counts[v] = (counts[v] || 0) + 1;
      total++;
    }
    return Response.json({
      key,
      mapped: true,
      entity: mapping.entity,
      field: mapping.field,
      counts,
      total,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}