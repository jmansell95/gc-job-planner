import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Atomic "Start Using Rig" booking — the heart of the Field Hub.
 *
 * When a field staff member scans a rig QR and taps "Start Shift", this
 * function:
 *   1. Clears any existing rig assignment for that staff member today
 *      (auto-removes them from the old rig so the fleet stays accurate).
 *   2. Creates or updates a RotaAssignment linking staff + rig + job.
 *   3. For vehicles, flips the live "Driving Now" operator status.
 *
 * Uses asServiceRole because RotaAssignment.create is admin-only via RLS,
 * but this function authenticates the user first and acts on their behalf.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { asset_id, job_id } = body;
    if (!asset_id) return Response.json({ error: 'asset_id is required' }, { status: 400 });

    // Match staff profile by user_id or email (same logic as getMyStaffProfile)
    const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
    let staff = null;
    if (user.id) staff = allStaff.find((s: any) => s.user_id && s.user_id === user.id);
    if (!staff && user.email) {
      const lc = user.email.toLowerCase();
      staff = allStaff.find((s: any) => s.email && s.email.toLowerCase() === lc);
    }
    if (!staff) return Response.json({ error: 'No staff profile linked to your account' }, { status: 404 });

    // Fetch the asset
    const assets = await base44.asServiceRole.entities.SiteAsset.filter({ id: asset_id });
    const asset = assets[0];
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });

    // Compliance gate — expired assets can't be booked
    if (asset.compliance_status === 'expired') {
      return Response.json({ error: 'Asset compliance expired — log a new inspection to reactivate' }, { status: 400 });
    }
    if (!asset.is_active) {
      return Response.json({ error: 'Asset is inactive and cannot be booked' }, { status: 400 });
    }

    // Compute today's date and week_start in local time
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;
    const dayOfWeek = now.getDay() || 7; // 0=Sun → 7
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek - 1));
    const wy = monday.getFullYear();
    const wm = String(monday.getMonth() + 1).padStart(2, '0');
    const wd = String(monday.getDate()).padStart(2, '0');
    const weekStart = `${wy}-${wm}-${wd}`;

    const isVehicle = asset.asset_type === 'vehicle';
    const isRig = asset.asset_type === 'rig';

    // 1. Clear any existing rig assignment for this staff today (the old rig)
    const todayAssignments = await base44.asServiceRole.entities.RotaAssignment.filter({
      staff_id: staff.id,
      assigned_date: today,
    });

    let clearedOldRig = false;
    let oldRigName = null;
    for (const a of todayAssignments) {
      if (a.rig_asset_id && a.rig_asset_id !== asset_id) {
        const oldRigAssets = await base44.asServiceRole.entities.SiteAsset.filter({ id: a.rig_asset_id });
        oldRigName = oldRigAssets[0]?.name || null;
        await base44.asServiceRole.entities.RotaAssignment.update(a.id, {
          rig_asset_id: null,
          status: 'completed',
          completed_at: new Date().toISOString(),
        });
        clearedOldRig = true;
      }
    }

    // 2. Determine the job_id — use provided, or fall back to today's existing job
    let effectiveJobId = job_id;
    if (!effectiveJobId) {
      const jobAssignment = todayAssignments.find((a: any) => a.job_id && a.assignment_type === 'job');
      if (jobAssignment) effectiveJobId = jobAssignment.job_id;
    }
    if (!effectiveJobId) {
      return Response.json({ error: 'No job specified and no existing job assignment found for today' }, { status: 400 });
    }

    // 3. Create or update the rota assignment
    let assignment = todayAssignments.find((a: any) => a.job_id === effectiveJobId && a.assignment_type === 'job');
    if (assignment) {
      await base44.asServiceRole.entities.RotaAssignment.update(assignment.id, {
        rig_asset_id: isRig ? asset_id : null,
        vehicle_id: isVehicle ? asset_id : null,
        status: 'assigned',
      });
    } else {
      assignment = await base44.asServiceRole.entities.RotaAssignment.create({
        staff_id: staff.id,
        assigned_date: today,
        week_start: weekStart,
        job_id: effectiveJobId,
        assignment_type: 'job',
        status: 'assigned',
        rig_asset_id: isRig ? asset_id : null,
        vehicle_id: isVehicle ? asset_id : null,
      });
    }

    // 4. For vehicles, update the live operator status
    if (isVehicle) {
      const jobs = await base44.asServiceRole.entities.Job.filter({ id: effectiveJobId });
      const job = jobs[0];
      await base44.asServiceRole.entities.Vehicle.update(asset_id, {
        current_operator_id: staff.id,
        current_operator_name: staff.name,
        operator_updated_at: new Date().toISOString(),
        current_job_id: effectiveJobId,
        current_job_name: job?.name || '',
      });
    }

    // 5. Get job name for the response
    const jobs = await base44.asServiceRole.entities.Job.filter({ id: effectiveJobId });
    const jobName = jobs[0]?.name || '';
    const jobLocation = jobs[0]?.location || '';

    return Response.json({
      success: true,
      assignment_id: assignment.id,
      staff_name: staff.name,
      asset_name: asset.name,
      job_name: jobName,
      job_location: jobLocation,
      cleared_old_rig: clearedOldRig,
      old_rig_name: oldRigName,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}