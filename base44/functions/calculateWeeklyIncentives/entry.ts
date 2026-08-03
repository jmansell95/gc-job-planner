import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  BADGE_DEFINITIONS,
  calculatePoints,
  getEarnedBadges,
  POINT_WEIGHTS,
} from '../../shared/incentiveEngine.ts';

function getWeekStart(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetStaffId = body.staff_id || null;
    const weekStart = body.week_start || getWeekStart();
    const isAdmin = user.role === 'admin';

    // If calculating for ALL staff, require admin
    if (!targetStaffId && !isAdmin) {
      return Response.json({ error: 'Admin only — specify a staff_id to calculate for yourself' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    // --- Fetch staff ---
    let staffList;
    if (targetStaffId) {
      const staff = await svc.entities.Staff.get(targetStaffId);
      staffList = staff ? [staff] : [];
    } else {
      staffList = await svc.entities.Staff.list('-created_date', 500);
    }
    const activeStaff = staffList.filter((s: any) => s.is_active !== false && s.id);

    if (activeStaff.length === 0) {
      return Response.json({ message: 'No active staff found', calculated: 0 });
    }

    // --- Fetch teams for team_name ---
    const teams = await svc.entities.Team.list('-created_date', 200);
    const teamMap = new Map(teams.map((t: any) => [t.id, t.name]));

    // --- Fetch data for the week ---
    // InvestigationLogs for drilling + safety + boreholes
    const allLogs = await svc.entities.InvestigationLog.list('-created_date', 1000);
    const weekLogs = allLogs.filter((l: any) => l.date && l.date >= weekStart);

    // Timesheets for days worked + hours + on-time arrivals
    const allTimesheets = await svc.entities.Timesheet.list('-created_date', 1000);
    const weekTimesheets = allTimesheets.filter((t: any) => t.week_start === weekStart);

    // SafetyReports for safety logs
    let safetyReports: any[] = [];
    try {
      safetyReports = await svc.entities.SafetyReport.list('-created_date', 500);
    } catch (_) {}
    const weekSafetyReports = safetyReports.filter((r: any) => {
      const d = r.created_date || r.reported_at || r.date;
      return d && d.slice(0, 10) >= weekStart;
    });

    // VehicleMaintenanceBookings reported by staff (proxy for vehicle checks)
    let vehicleBookings: any[] = [];
    try {
      vehicleBookings = await svc.entities.VehicleMaintenanceBooking.list('-created_date', 500);
    } catch (_) {}
    const weekVehicleBookings = vehicleBookings.filter((v: any) => {
      const d = v.created_date || v.reported_at || v.booking_date;
      return d && d.slice(0, 10) >= weekStart;
    });

    // --- Existing achievements (to avoid re-awarding lifetime badges) ---
    const existingAchievements = await svc.entities.Achievement.list('-created_date', 2000);
    const lifetimeBadgeKeys = new Set(
      existingAchievements
        .filter((a: any) => a.is_lifetime)
        .map((a: any) => `${a.staff_id}:${a.badge_key}`)
    );

    // --- Existing incentive scores for this week (to update vs create) ---
    const existingScores = await svc.entities.IncentiveScore.filter({ week_start: weekStart }, '-total_points', 500);
    const scoreMap = new Map(existingScores.map((s: any) => [s.staff_id, s]));

    // --- Calculate per-staff scores ---
    const scoresToUpdate: any[] = [];
    const achievementsToCreate: any[] = [];
    const now = new Date().toISOString();

    for (const staff of activeStaff) {
      const sid = staff.id;

      // Drilling metres + boreholes from InvestigationLogs
      const staffLogs = weekLogs.filter((l: any) => l.staff_id === sid);
      const totalMetres = staffLogs.reduce((sum: number, l: any) => {
        if (l.depth_to != null && l.depth_from != null) return sum + (l.depth_to - l.depth_from);
        return sum;
      }, 0);
      const boreholeSet = new Set(staffLogs.map((l: any) => l.borehole_ref).filter(Boolean));
      const boreholesWorked = boreholeSet.size;

      // Safety logs: InvestigationLogs with safety-related types + SafetyReports
      const safetyLogTypes = ['site_setup', 'reinstatement', 'inspection_pit', 'borehole_decommissioning'];
      const staffSafetyLogs = staffLogs.filter((l: any) => safetyLogTypes.includes(l.log_type)).length;
      const staffSafetyReports = weekSafetyReports.filter((r: any) => r.staff_id === sid || r.reported_by_id === sid).length;
      const safetyLogsSubmitted = staffSafetyLogs + staffSafetyReports;

      // Vehicle checks: site_setup logs + maintenance bookings reported by staff
      const vehicleChecksFromLogs = staffLogs.filter((l: any) => l.log_type === 'site_setup').length;
      const vehicleChecksFromBookings = weekVehicleBookings.filter((v: any) => v.reported_by_staff_id === sid).length;
      const vehicleChecksCompleted = vehicleChecksFromLogs + vehicleChecksFromBookings;

      // Days worked + hours from weekly summary timesheets
      const staffWeeklySummaries = weekTimesheets.filter((t: any) => t.staff_id === sid && t.is_weekly_summary);
      const weekMinutes = staffWeeklySummaries.reduce((sum: number, t: any) => sum + (t.weekly_total_minutes || 0), 0);
      const totalHours = Math.round(weekMinutes / 60);

      // Days worked: count of daily summary entries for the week
      const staffDailySummaries = weekTimesheets.filter((t: any) => t.staff_id === sid && t.is_summary && !t.is_weekly_summary);
      const daysWorked = new Set(staffDailySummaries.map((t: any) => t.date).filter(Boolean)).size;

      // On-time arrivals: days with a submitted/approved timesheet (proxy for showing up on time)
      const onTimeArrivals = new Set(
        weekTimesheets
          .filter((t: any) => t.staff_id === sid && ['submitted', 'approved'].includes(t.status) && t.date)
          .map((t: any) => t.date)
      ).size;

      // All-time stats
      const allStaffLogs = allLogs.filter((l: any) => l.staff_id === sid);
      const allTimeMetres = allStaffLogs.reduce((sum: number, l: any) => {
        if (l.depth_to != null && l.depth_from != null) return sum + (l.depth_to - l.depth_from);
        return sum;
      }, 0);
      const allTimeBoreholes = new Set(allStaffLogs.map((l: any) => l.borehole_ref).filter(Boolean)).size;

      const weeklyScore = {
        total_metres: Math.round(totalMetres * 10) / 10,
        total_hours: totalHours,
        days_worked: daysWorked,
        on_time_arrivals: onTimeArrivals,
        safety_logs_submitted: safetyLogsSubmitted,
        vehicle_checks_completed: vehicleChecksCompleted,
        boreholes_worked: boreholesWorked,
        total_points: 0,
      };
      weeklyScore.total_points = calculatePoints(weeklyScore);

      // Determine earned badges
      const earnedBadges = getEarnedBadges(weeklyScore as any, { totalMetres: allTimeMetres, totalBoreholes: allTimeBoreholes });

      const badgesThisWeek: string[] = [];
      for (const badge of earnedBadges) {
        if (badge.is_lifetime) {
          // Don't re-award lifetime badges
          if (lifetimeBadgeKeys.has(`${sid}:${badge.key}`)) continue;
        }
        achievementsToCreate.push({
          staff_id: sid,
          staff_name: staff.name,
          team_id: staff.team_id,
          badge_key: badge.key,
          badge_name: badge.name,
          badge_description: badge.description,
          badge_category: badge.category,
          badge_tier: badge.tier,
          badge_icon: badge.icon,
          week_start: badge.is_lifetime ? null : weekStart,
          is_lifetime: badge.is_lifetime,
          awarded_at: now,
          points_value: weeklyScore.total_points,
        });
        badgesThisWeek.push(badge.key);
      }

      // Build score record
      const scoreRecord = {
        staff_id: sid,
        staff_name: staff.name,
        team_id: staff.team_id,
        team_name: teamMap.get(staff.team_id) || null,
        week_start: weekStart,
        total_metres: weeklyScore.total_metres,
        total_hours: weeklyScore.total_hours,
        days_worked: weeklyScore.days_worked,
        on_time_arrivals: weeklyScore.on_time_arrivals,
        safety_logs_submitted: weeklyScore.safety_logs_submitted,
        vehicle_checks_completed: weeklyScore.vehicle_checks_completed,
        boreholes_worked: weeklyScore.boreholes_worked,
        total_points: weeklyScore.total_points,
        all_time_metres: Math.round(allTimeMetres * 10) / 10,
        all_time_boreholes: allTimeBoreholes,
        badges_earned: badgesThisWeek,
        calculated_at: now,
      };

      const existing = scoreMap.get(sid);
      if (existing) {
        await svc.entities.IncentiveScore.update(existing.id, scoreRecord);
      } else {
        await svc.entities.IncentiveScore.create(scoreRecord);
      }
      scoresToUpdate.push({ staff_id: sid, total_points: weeklyScore.total_points, team_id: staff.team_id });
    }

    // --- Calculate crew rankings ---
    // Group by team_id, sort by total_points, assign rank
    const byTeam = new Map<string, any[]>();
    for (const s of scoresToUpdate) {
      const tid = s.team_id || '_solo';
      if (!byTeam.has(tid)) byTeam.set(tid, []);
      byTeam.get(tid)!.push(s);
    }

    for (const [tid, members] of byTeam) {
      members.sort((a, b) => b.total_points - a.total_points);
      for (let i = 0; i < members.length; i++) {
        const rank = i + 1;
        const sid = members[i].staff_id;
        const existing = scoreMap.get(sid);
        if (existing) {
          await svc.entities.IncentiveScore.update(existing.id, { rank_in_crew: rank });
        }
      }
    }

    // --- Create achievements (bulk) ---
    if (achievementsToCreate.length > 0) {
      await svc.entities.Achievement.bulkCreate(achievementsToCreate);
    }

    return Response.json({
      message: 'Incentives calculated',
      week_start: weekStart,
      staff_calculated: activeStaff.length,
      badges_awarded: achievementsToCreate.length,
      point_weights: POINT_WEIGHTS,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}