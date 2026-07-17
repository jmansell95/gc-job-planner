/**
 * Computes intelligent warnings for a job based on its equipment, crew, and compliance data.
 *
 * Warnings detected:
 *  - Rigs that require a multi-man crew (from the linked RateCardItem `men` field) when
 *    fewer staff are assigned to the job.
 *  - Equipment with expired or expiring compliance status.
 *  - Equipment on a job with zero staff assigned.
 *
 * @param {object} opts
 * @param {object} opts.job
 * @param {Array}  opts.costItems     — JobCostItem records for the job
 * @param {Array}  opts.rateCardItems — RateCardItem records (to resolve crew sizes)
 * @param {Array}  opts.siteAssets    — SiteAsset records (for compliance + asset type)
 * @param {number} opts.assignedStaffCount — distinct staff assigned via rota
 * @returns {Array<{severity, icon, title, message}>}
 */
export function computeJobWarnings({ job, costItems = [], rateCardItems = [], siteAssets = [], assignedStaffCount = 0 }) {
  const warnings = [];
  if (!job) return warnings;

  const rateMap = {};
  rateCardItems.forEach(r => { rateMap[r.id] = r; });
  const assetMap = {};
  siteAssets.forEach(a => { assetMap[a.id] = a; });

  // Active equipment only — off-hired items don't need a crew on site
  const activeItems = costItems.filter(c => (c.hire_status || 'active') !== 'off_hired');

  // Identify rig cost items: linked SiteAsset of type 'rig', or a labour rate card with men >= 2
  const rigItems = activeItems.filter(c => {
    if (c.category === 'contractor_supplied' || c.category === 'client_supplied') return false;
    const asset = c.site_asset_id ? assetMap[c.site_asset_id] : null;
    const rate = c.rate_card_item_id ? rateMap[c.rate_card_item_id] : null;
    const isRigAsset = !!(asset && asset.asset_type === 'rig');
    const isCrewRate = !!(rate && rate.category === 'labour' && (rate.men || 0) >= 2);
    return isRigAsset || isCrewRate;
  });

  // --- Crew requirement warning ---
  if (rigItems.length > 0) {
    const crewPerRig = rigItems.map(c => {
      const rate = c.rate_card_item_id ? rateMap[c.rate_card_item_id] : null;
      const men = (rate && rate.men) ? rate.men : (c.men || 2);
      return Math.max(2, Number(men) || 2);
    });
    const maxCrew = Math.max(...crewPerRig);

    if (assignedStaffCount === 0) {
      warnings.push({
        severity: 'critical',
        icon: 'users',
        title: `${maxCrew}-man crew required — no staff assigned`,
        message: `This job has rig${rigItems.length > 1 ? 's' : ''} that need${rigItems.length > 1 ? '' : 's'} a ${maxCrew}-man crew to operate safely, but no staff have been scheduled yet. Build the rota and assign at least ${maxCrew} crew.`
      });
    } else if (assignedStaffCount < maxCrew) {
      warnings.push({
        severity: 'warning',
        icon: 'users',
        title: `${maxCrew}-man crew required — only ${assignedStaffCount} assigned`,
        message: `Rig${rigItems.length > 1 ? 's' : ''} on this job need a ${maxCrew}-man crew, but only ${assignedStaffCount} staff ${assignedStaffCount === 1 ? 'is' : 'are'} scheduled. Assign at least ${maxCrew - assignedStaffCount} more to run the rig safely.`
      });
    }
  } else if (activeItems.length > 0 && assignedStaffCount === 0) {
    warnings.push({
      severity: 'warning',
      icon: 'users',
      title: 'Equipment added but no crew scheduled',
      message: 'This job has equipment on site but no staff have been assigned to the rota yet.'
    });
  }

  // --- Compliance warnings (per rig / owned equipment) ---
  rigItems.forEach(c => {
    const asset = c.site_asset_id ? assetMap[c.site_asset_id] : null;
    if (!asset) return;
    const name = asset.name || c.description;
    if (asset.compliance_status === 'expired') {
      warnings.push({
        severity: 'critical',
        icon: 'shield',
        title: `${name} — compliance expired`,
        message: `${name} has an expired compliance certificate and must not be deployed to site until re-certified.`
      });
    } else if (asset.compliance_status === 'expiring') {
      warnings.push({
        severity: 'warning',
        icon: 'shield',
        title: `${name} — compliance expiring`,
        message: `${name} compliance is expiring soon. Schedule a re-certification to avoid downtime.`
      });
    }
    if (asset.stock_level === 'out_of_stock' || asset.stock_level === 'needs_service') {
      warnings.push({
        severity: 'critical',
        icon: 'shield',
        title: `${name} — ${asset.stock_level === 'out_of_stock' ? 'out of stock' : 'needs service'}`,
        message: `${name} is flagged as ${asset.stock_level === 'out_of_stock' ? 'out of stock' : 'needing service'} and should not be sent to site.`
      });
    }
  });

  return warnings;
}