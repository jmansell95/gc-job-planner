import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const jobId = body?.job_id;

    if (!jobId) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    // Fetch all asset assignments for this job
    const assignments = await base44.asServiceRole.entities.JobAssetAssignment.filter({ job_id: jobId });

    if (assignments.length === 0) {
      return Response.json({
        job_id: jobId,
        total_assets: 0,
        compliant_count: 0,
        non_compliant_count: 0,
        has_non_compliant: false,
        assets: [],
        non_compliant_assets: [],
      });
    }

    // Fetch all site assets to check live compliance status
    const allAssets = await base44.asServiceRole.entities.SiteAsset.list();
    const assetMap = {};
    allAssets.forEach(a => { assetMap[a.id] = a; });

    const today = new Date().toISOString().split('T')[0];

    const results = assignments.map(a => {
      const asset = assetMap[a.asset_id];
      const liveStatus = asset?.compliance_status || a.compliance_status || 'unknown';
      const expiry = asset?.compliance_expiry_date || null;

      // Auto-derive status from expiry date if possible
      let effectiveStatus = liveStatus;
      if (expiry && liveStatus !== 'expired') {
        if (expiry < today) {
          effectiveStatus = 'expired';
        } else {
          const daysUntil = Math.ceil((new Date(expiry) - new Date(today)) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 30) {
            effectiveStatus = 'expiring';
          } else {
            effectiveStatus = 'compliant';
          }
        }
      }

      return {
        assignment_id: a.id,
        asset_id: a.asset_id,
        asset_name: a.asset_name || asset?.name || 'Unknown',
        asset_type: a.asset_type || asset?.asset_type,
        rig_type: a.rig_type || asset?.rig_type,
        role: a.role,
        assignment_status: a.status,
        compliance_status: effectiveStatus,
        compliance_expiry: expiry,
        is_compliant: effectiveStatus === 'compliant',
      };
    });

    const nonCompliant = results.filter(r => !r.is_compliant);

    return Response.json({
      job_id: jobId,
      total_assets: results.length,
      compliant_count: results.length - nonCompliant.length,
      non_compliant_count: nonCompliant.length,
      has_non_compliant: nonCompliant.length > 0,
      assets: results,
      non_compliant_assets: nonCompliant,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});