/**
 * Badge definitions for the frontend — mirrors base44/shared/incentiveEngine.ts.
 * Used by the UI to render badge icons, colours, locked/unlocked states,
 * progress toward earning, and detailed "how to earn" criteria.
 */

export const POINT_WEIGHTS = {
  per_metre: 1,
  per_on_time: 10,
  per_vehicle_check: 5,
  per_safety_log: 5,
  per_day_worked: 15,
  per_borehole: 8,
};

export const TIER_STYLES = {
  bronze: {
    bg: 'bg-gradient-to-br from-amber-100 to-orange-200',
    border: 'border-amber-300',
    text: 'text-amber-800',
    glow: 'shadow-amber-200/50',
    label: 'Bronze',
    hex: '#cd7f32',
    gradient: 'from-amber-400 to-orange-600',
  },
  silver: {
    bg: 'bg-gradient-to-br from-slate-100 to-slate-200',
    border: 'border-slate-300',
    text: 'text-slate-700',
    glow: 'shadow-slate-200/50',
    label: 'Silver',
    hex: '#c0c0c0',
    gradient: 'from-slate-300 to-slate-500',
  },
  gold: {
    bg: 'bg-gradient-to-br from-yellow-100 to-amber-200',
    border: 'border-yellow-400',
    text: 'text-amber-900',
    glow: 'shadow-yellow-200/60',
    label: 'Gold',
    hex: '#ffd700',
    gradient: 'from-yellow-400 to-amber-500',
  },
  platinum: {
    bg: 'bg-gradient-to-br from-cyan-50 to-indigo-100',
    border: 'border-cyan-300',
    text: 'text-indigo-800',
    glow: 'shadow-cyan-200/60',
    label: 'Platinum',
    hex: '#e5e4e2',
    gradient: 'from-cyan-300 to-indigo-400',
  },
};

export const CATEGORY_STYLES = {
  drilling: { label: 'Drilling', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: 'Drill' },
  punctuality: { label: 'Punctuality', color: 'text-blue-700', bg: 'bg-blue-50', icon: 'Sunrise' },
  safety: { label: 'Safety', color: 'text-rose-700', bg: 'bg-rose-50', icon: 'ShieldCheck' },
  team: { label: 'Team', color: 'text-violet-700', bg: 'bg-violet-50', icon: 'Users' },
  special: { label: 'Special', color: 'text-amber-700', bg: 'bg-amber-50', icon: 'Star' },
};

/**
 * Each badge carries:
 * - key: unique identifier matching the backend engine
 * - name, description: short display text
 * - criteria: detailed "how to earn" explanation shown in the detail modal
 * - metric: the IncentiveScore field used to track progress toward this badge
 * - threshold: the target value for that metric
 * - period: 'weekly' (resets each week) or 'lifetime' (permanent once earned)
 * - category, tier, icon, is_lifetime: display attributes
 */
export const BADGE_DEFINITIONS = [
  // DRILLING
  { key: 'first_borehole', name: 'First Strike', description: 'Logged your first borehole', category: 'drilling', tier: 'bronze', icon: 'Drill', is_lifetime: true,
    criteria: 'Record an investigation log on any borehole — your very first one. This is a one-time lifetime badge.', metric: 'all_time_boreholes', threshold: 1, period: 'lifetime' },
  { key: 'metre_50', name: 'Half Century', description: 'Drilled 50m in a week', category: 'drilling', tier: 'silver', icon: 'Ruler', is_lifetime: false,
    criteria: 'Drill a total of 50 metres across all boreholes in a single week. Metres come from your investigation logs (depth intervals).', metric: 'total_metres', threshold: 50, period: 'weekly' },
  { key: 'metre_100', name: 'Centurion', description: 'Drilled 100m in a week', category: 'drilling', tier: 'gold', icon: 'Ruler', is_lifetime: false,
    criteria: 'Drill a total of 100 metres across all boreholes in a single week.', metric: 'total_metres', threshold: 100, period: 'weekly' },
  { key: 'metre_200', name: 'Double Ton', description: 'Drilled 200m in a week', category: 'drilling', tier: 'platinum', icon: 'Ruler', is_lifetime: false,
    criteria: 'Drill a total of 200 metres across all boreholes in a single week. A rare achievement for high-output crews.', metric: 'total_metres', threshold: 200, period: 'weekly' },
  { key: 'milestone_500', name: '500 Club', description: '500m drilled all-time', category: 'drilling', tier: 'gold', icon: 'Trophy', is_lifetime: true,
    criteria: 'Drill a cumulative total of 500 metres across your entire time with the company. This is a permanent lifetime milestone.', metric: 'all_time_metres', threshold: 500, period: 'lifetime' },
  { key: 'milestone_1000', name: 'Kilometre Crusher', description: '1,000m drilled all-time', category: 'drilling', tier: 'platinum', icon: 'Trophy', is_lifetime: true,
    criteria: 'Drill a cumulative total of 1,000 metres across your entire time with the company. The ultimate drilling milestone.', metric: 'all_time_metres', threshold: 1000, period: 'lifetime' },
  { key: 'borehole_explorer', name: 'Explorer', description: 'Worked on 3+ boreholes in a week', category: 'drilling', tier: 'silver', icon: 'Compass', is_lifetime: false,
    criteria: 'Log work on at least 3 different boreholes in a single week. Variety counts as much as volume.', metric: 'boreholes_worked', threshold: 3, period: 'weekly' },
  { key: 'borehole_master', name: 'Borehole Master', description: 'Worked on 5+ boreholes in a week', category: 'drilling', tier: 'gold', icon: 'Compass', is_lifetime: false,
    criteria: 'Log work on at least 5 different boreholes in a single week.', metric: 'boreholes_worked', threshold: 5, period: 'weekly' },

  // PUNCTUALITY
  { key: 'early_bird', name: 'Early Bird', description: 'On-time arrival 3 days in a week', category: 'punctuality', tier: 'bronze', icon: 'Sunrise', is_lifetime: false,
    criteria: 'Record an on-time arrival (submitted timesheet with a travel-to or on-site entry) on at least 3 days in a single week.', metric: 'on_time_arrivals', threshold: 3, period: 'weekly' },
  { key: 'reliable_rocker', name: 'Reliable Rocker', description: 'On-time arrival 5 days in a week', category: 'punctuality', tier: 'silver', icon: 'Sunrise', is_lifetime: false,
    criteria: 'Record an on-time arrival on at least 5 days in a single week. Consistency is key.', metric: 'on_time_arrivals', threshold: 5, period: 'weekly' },
  { key: 'perfect_week', name: 'Perfect Week', description: 'Worked all 5 days', category: 'punctuality', tier: 'gold', icon: 'CalendarCheck', is_lifetime: false,
    criteria: 'Worked all 5 working days in a single week (Monday–Friday). No missed days.', metric: 'days_worked', threshold: 5, period: 'weekly' },
  { key: 'hard_worker', name: 'Hard Worker', description: 'Worked 40+ hours in a week', category: 'punctuality', tier: 'silver', icon: 'Clock', is_lifetime: false,
    criteria: 'Log 40 or more total hours in a single week across all jobs and tasks.', metric: 'total_hours', threshold: 40, period: 'weekly' },

  // SAFETY
  { key: 'safety_champion', name: 'Safety Champion', description: 'Submitted 3+ safety logs in a week', category: 'safety', tier: 'silver', icon: 'ShieldCheck', is_lifetime: false,
    criteria: 'Submit at least 3 safety-related logs in a single week (site setup, reinstatement, or inspection logs).', metric: 'safety_logs_submitted', threshold: 3, period: 'weekly' },
  { key: 'safety_guardian', name: 'Safety Guardian', description: 'Submitted 5+ safety logs in a week', category: 'safety', tier: 'gold', icon: 'ShieldCheck', is_lifetime: false,
    criteria: 'Submit at least 5 safety-related logs in a single week. The highest weekly safety standard.', metric: 'safety_logs_submitted', threshold: 5, period: 'weekly' },
  { key: 'check_mate', name: 'Check Mate', description: 'Completed 3+ vehicle/equipment checks', category: 'safety', tier: 'bronze', icon: 'ClipboardCheck', is_lifetime: false,
    criteria: 'Complete at least 3 vehicle or equipment checks in a single week (tracked from site setup logs and maintenance reports).', metric: 'vehicle_checks_completed', threshold: 3, period: 'weekly' },
  { key: 'check_pro', name: 'Check Pro', description: 'Completed 5+ vehicle/equipment checks', category: 'safety', tier: 'silver', icon: 'ClipboardCheck', is_lifetime: false,
    criteria: 'Complete at least 5 vehicle or equipment checks in a single week.', metric: 'vehicle_checks_completed', threshold: 5, period: 'weekly' },

  // TEAM
  { key: 'crew_anchor', name: 'Crew Anchor', description: 'Top scorer on your crew this week', category: 'team', tier: 'gold', icon: 'Anchor', is_lifetime: false,
    criteria: 'Finish the week as the #1 points scorer on your crew. Points are weighted across metres, punctuality, safety, and more.', metric: 'rank_in_crew', threshold: 1, period: 'weekly', invertProgress: true },
  { key: 'crew_pillar', name: 'Crew Pillar', description: 'Top 3 scorer on your crew this week', category: 'team', tier: 'silver', icon: 'Medal', is_lifetime: false,
    criteria: 'Finish the week in the top 3 points scorers on your crew.', metric: 'rank_in_crew', threshold: 3, period: 'weekly', invertProgress: true },

  // SPECIAL
  { key: 'points_100', name: 'Century Score', description: '100+ incentive points in a week', category: 'special', tier: 'silver', icon: 'Star', is_lifetime: false,
    criteria: 'Earn 100 or more total incentive points in a single week. Points = metres×1 + on-time×10 + checks×5 + safety×5 + days×15 + boreholes×8.', metric: 'total_points', threshold: 100, period: 'weekly' },
  { key: 'points_200', name: 'Double Century', description: '200+ incentive points in a week', category: 'special', tier: 'gold', icon: 'Star', is_lifetime: false,
    criteria: 'Earn 200 or more total incentive points in a single week.', metric: 'total_points', threshold: 200, period: 'weekly' },
  { key: 'points_300', name: 'Triple Century', description: '300+ incentive points in a week', category: 'special', tier: 'platinum', icon: 'Zap', is_lifetime: false,
    criteria: 'Earn 300 or more total incentive points in a single week. The pinnacle of weekly performance.', metric: 'total_points', threshold: 300, period: 'weekly' },
];

export function getBadgeDef(key) {
  return BADGE_DEFINITIONS.find(b => b.key === key);
}

/**
 * Compute progress toward a badge given an IncentiveScore record.
 * Returns { current, target, pct, isComplete }.
 * For rank-based badges (invertProgress), lower is better.
 */
export function getBadgeProgress(badge, score) {
  if (!badge || !badge.metric || !score) return null;
  const current = score[badge.metric];
  if (current == null) return null;

  if (badge.invertProgress) {
    // Rank-based: current rank vs threshold (lower is better)
    const target = badge.threshold;
    const isComplete = current <= target && current > 0;
    const pct = current > 0 ? Math.min(100, Math.round((target / current) * 100)) : 0;
    return { current, target, pct, isComplete, display: current === 0 ? '—' : `#${current}` };
  }

  const target = badge.threshold;
  const isComplete = current >= target;
  const pct = Math.min(100, Math.round((current / target) * 100));
  return { current, target, pct, isComplete, display: String(current) };
}