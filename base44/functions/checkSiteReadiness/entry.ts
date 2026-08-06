import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// ---------------------------------------------------------------------------
// Site Readiness Gate — Field Excellence Safety Checks
// ---------------------------------------------------------------------------
// Returns a checklist of safety gates that must be cleared before a crew
// can start work on site. Each gate has a status (green / amber / red) and
// a human-readable detail string.
//
// Gates checked:
//   1. RAMS — a current, signed-off RAMS document exists for the job
//   2. Briefing — the daily briefing has been signed on the rota assignment
//   3. Weather — today's weather verdict is not 'stop'
//   4. Equipment — all assigned assets have valid compliance (no overdue)
//
// The frontend SiteReadinessGate widget calls this function and displays
// the checklist. When all gates are green, the crew is "Cleared to Start".
// ---------------------------------------------------------------------------

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { job_id, rota_assignment_id } = body;
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const TODAY = new Date().toISOString().slice(0, 10);
    const gates = [];

    // 1. RAMS — current signed-off RAMS document exists
    const jobDocs = await base44.asServiceRole.entities.JobDocument.filter({ job_id });
    const currentRams = jobDocs.find(
      d => d.category === 'rams' && d.is_current_version !== false && d.signed_off_at
    );
    gates.push({
      key: 'rams',
      label: 'RAMS Signed Off',
      status: currentRams ? 'green' : 'red',
      detail: currentRams
        ? `Approved by ${currentRams.signed_off_by || 'manager'} · ${new Date(currentRams.signed_off_at).toLocaleDateString('en-GB')}`
        : 'No current signed-off RAMS document',
      action: currentRams ? null : 'upload_rams',
    });

    // 2. Briefing — daily briefing signed on the rota assignment
    if (rota_assignment_id) {
      const rota = await base44.asServiceRole.entities.RotaAssignment.get(rota_assignment_id);
      gates.push({
        key: 'briefing',
        label: 'Daily Briefing Signed',
        status: rota?.briefing_signed ? 'green' : 'red',
        detail: rota?.briefing_signed
          ? `Signed at ${new Date(rota.briefing_signed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
          : 'Daily briefing not yet signed off',
        action: rota?.briefing_signed ? null : 'open_briefing',
      });
    }

    // 3. Weather — today's drilling verdict
    const weatherLogs = await base44.asServiceRole.entities.WeatherLog.filter({ job_id });
    const todayWeather = weatherLogs.find(w => w.log_date === TODAY);
    if (todayWeather) {
      gates.push({
        key: 'weather',
        label: 'Weather Safe to Work',
        status: todayWeather.drilling_verdict === 'stop' ? 'red' : todayWeather.drilling_verdict === 'caution' ? 'amber' : 'green',
        detail: todayWeather.drilling_verdict === 'stop'
          ? `STOP — ${todayWeather.verdict_reasons || 'Unsafe conditions'}`
          : todayWeather.drilling_verdict === 'caution'
            ? `Caution — ${todayWeather.verdict_reasons || 'Reduced operations'}`
            : 'Conditions good',
        action: null,
      });
    }

    // 4. Equipment — assigned assets have no overdue compliance
    const assetAssignments = await base44.asServiceRole.entities.JobAssetAssignment.filter({ job_id });
    if (assetAssignments.length > 0) {
      const today = new Date();
      const overdueAssets = assetAssignments.filter(a => {
        if (!a.compliance_expiry) return false;
        return new Date(a.compliance_expiry) < today;
      });
      gates.push({
        key: 'equipment',
        label: 'Equipment Compliant',
        status: overdueAssets.length === 0 ? 'green' : 'red',
        detail: overdueAssets.length === 0
          ? `${assetAssignments.length} item${assetAssignments.length !== 1 ? 's' : ''} assigned, all compliant`
          : `${overdueAssets.length} item${overdueAssets.length !== 1 ? 's' : ''} with expired compliance`,
        action: overdueAssets.length > 0 ? 'view_assets' : null,
      });
    }

    const allClear = gates.length > 0 && gates.every(g => g.status === 'green');
    const blockingCount = gates.filter(g => g.status === 'red').length;
    const cautionCount = gates.filter(g => g.status === 'amber').length;

    return Response.json({
      status: 'success',
      data: {
        job_id,
        gates,
        all_clear: allClear,
        blocking_count: blockingCount,
        caution_count: cautionCount,
        total_gates: gates.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}