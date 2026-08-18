import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * runScheduledBackups — runs on a schedule and creates backups for all
 * active divisions that have a BackupSchedule due.
 *
 * For each due schedule:
 *  1. Calls backupDivision for the target division
 *  2. Prunes old snapshots beyond the retention_count
 *  3. Updates the schedule's last_run_at / last_run_status
 *
 * Runs as service role (no user session needed) so it works on a cron.
 */
export default async function(req) {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;

  try {
    // 1. Get all active backup schedules
    const schedules = await sr.entities.BackupSchedule.list('-created_date', 200);
    const now = new Date();
    const dueSchedules = [];

    for (const schedule of schedules) {
      if (!schedule.is_active) continue;
      const nextRun = schedule.next_run_at ? new Date(schedule.next_run_at) : null;
      if (!nextRun || now >= nextRun) {
        dueSchedules.push(schedule);
      }
    }

    if (dueSchedules.length === 0) {
      return Response.json({ success: true, message: 'No backups due', ran: 0 });
    }

    // 2. Get all active divisions for global schedules
    const allDivisions = await sr.entities.Division.list('-sort_order', 200);
    const activeDivisions = allDivisions.filter(d => d.is_active && d.status === 'active');

    const results = [];

    for (const schedule of dueSchedules) {
      const targetDivisions = schedule.division_id
        ? activeDivisions.filter(d => d.id === schedule.division_id)
        : activeDivisions;

      for (const division of targetDivisions) {
        try {
          // Call backupDivision via internal function invoke
          const backupResult = await sr.functions.invoke('backupDivision', {
            division_id: division.id,
            snapshot_type: 'automatic',
            trigger_reason: `Scheduled backup (${schedule.frequency})`,
          });

          results.push({
            division: division.name,
            status: 'success',
            snapshot_id: backupResult?.snapshot_id,
          });
        } catch (e) {
          results.push({
            division: division.name,
            status: 'failed',
            error: (e.message || 'Unknown error').slice(0, 200),
          });
        }
      }

      // 3. Prune old snapshots beyond retention_count
      if (schedule.retention_count && schedule.retention_count > 0) {
        try {
          const allSnapshots = await sr.entities.DivisionSnapshot.list('-created_date', 500);
          const divisionSnapshots = schedule.division_id
            ? allSnapshots.filter(s => s.division_id === schedule.division_id && s.status === 'completed')
            : allSnapshots.filter(s => s.status === 'completed');

          if (divisionSnapshots.length > schedule.retention_count) {
            const toDelete = divisionSnapshots.slice(schedule.retention_count);
            for (const snap of toDelete) {
              try { await sr.entities.DivisionSnapshot.delete(snap.id); } catch {}
            }
          }
        } catch {}
      }

      // 4. Update schedule with next run time
      const nextRun = calculateNextRun(schedule);
      await sr.entities.BackupSchedule.update(schedule.id, {
        last_run_at: now.toISOString(),
        last_run_status: results.some(r => r.status === 'failed') ? 'failed' : 'success',
        next_run_at: nextRun.toISOString(),
      });
    }

    return Response.json({
      success: true,
      ran: dueSchedules.length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/** Calculate the next run time based on frequency. */
function calculateNextRun(schedule) {
  const now = new Date();
  const [hours, minutes] = (schedule.backup_time || '02:00').split(':').map(Number);

  if (schedule.frequency === 'daily') {
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  if (schedule.frequency === 'weekly') {
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    const targetDay = schedule.weekly_day ?? 1; // Monday default
    const currentDay = next.getDay();
    let daysUntil = (targetDay - currentDay + 7) % 7;
    if (daysUntil === 0 && next <= now) daysUntil = 7;
    next.setDate(next.getDate() + daysUntil);
    return next;
  }

  // custom — default to next day at backup_time
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}