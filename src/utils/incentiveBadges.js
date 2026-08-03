/**
 * Badge definitions for the frontend — mirrors base44/shared/incentiveEngine.ts.
 * Used by the UI to render badge icons, colours, and locked/unlocked states.
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
  },
  silver: {
    bg: 'bg-gradient-to-br from-slate-100 to-slate-200',
    border: 'border-slate-300',
    text: 'text-slate-700',
    glow: 'shadow-slate-200/50',
    label: 'Silver',
    hex: '#c0c0c0',
  },
  gold: {
    bg: 'bg-gradient-to-br from-yellow-100 to-amber-200',
    border: 'border-yellow-400',
    text: 'text-amber-900',
    glow: 'shadow-yellow-200/60',
    label: 'Gold',
    hex: '#ffd700',
  },
  platinum: {
    bg: 'bg-gradient-to-br from-cyan-50 to-indigo-100',
    border: 'border-cyan-300',
    text: 'text-indigo-800',
    glow: 'shadow-cyan-200/60',
    label: 'Platinum',
    hex: '#e5e4e2',
  },
};

export const CATEGORY_STYLES = {
  drilling: { label: 'Drilling', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: 'Drill' },
  punctuality: { label: 'Punctuality', color: 'text-blue-700', bg: 'bg-blue-50', icon: 'Sunrise' },
  safety: { label: 'Safety', color: 'text-rose-700', bg: 'bg-rose-50', icon: 'ShieldCheck' },
  team: { label: 'Team', color: 'text-violet-700', bg: 'bg-violet-50', icon: 'Users' },
  special: { label: 'Special', color: 'text-amber-700', bg: 'bg-amber-50', icon: 'Star' },
};

export const BADGE_DEFINITIONS = [
  // DRILLING
  { key: 'first_borehole', name: 'First Strike', description: 'Logged your first borehole', category: 'drilling', tier: 'bronze', icon: 'Drill', is_lifetime: true },
  { key: 'metre_50', name: 'Half Century', description: 'Drilled 50m in a week', category: 'drilling', tier: 'silver', icon: 'Ruler', is_lifetime: false },
  { key: 'metre_100', name: 'Centurion', description: 'Drilled 100m in a week', category: 'drilling', tier: 'gold', icon: 'Ruler', is_lifetime: false },
  { key: 'metre_200', name: 'Double Ton', description: 'Drilled 200m in a week', category: 'drilling', tier: 'platinum', icon: 'Ruler', is_lifetime: false },
  { key: 'milestone_500', name: '500 Club', description: '500m drilled all-time', category: 'drilling', tier: 'gold', icon: 'Trophy', is_lifetime: true },
  { key: 'milestone_1000', name: 'Kilometre Crusher', description: '1,000m drilled all-time', category: 'drilling', tier: 'platinum', icon: 'Trophy', is_lifetime: true },
  { key: 'borehole_explorer', name: 'Explorer', description: 'Worked on 3+ boreholes in a week', category: 'drilling', tier: 'silver', icon: 'Compass', is_lifetime: false },
  { key: 'borehole_master', name: 'Borehole Master', description: 'Worked on 5+ boreholes in a week', category: 'drilling', tier: 'gold', icon: 'Compass', is_lifetime: false },

  // PUNCTUALITY
  { key: 'early_bird', name: 'Early Bird', description: 'On-time arrival 3 days in a week', category: 'punctuality', tier: 'bronze', icon: 'Sunrise', is_lifetime: false },
  { key: 'reliable_rocker', name: 'Reliable Rocker', description: 'On-time arrival 5 days in a week', category: 'punctuality', tier: 'silver', icon: 'Sunrise', is_lifetime: false },
  { key: 'perfect_week', name: 'Perfect Week', description: 'Worked all 5 days', category: 'punctuality', tier: 'gold', icon: 'CalendarCheck', is_lifetime: false },
  { key: 'hard_worker', name: 'Hard Worker', description: 'Worked 40+ hours in a week', category: 'punctuality', tier: 'silver', icon: 'Clock', is_lifetime: false },

  // SAFETY
  { key: 'safety_champion', name: 'Safety Champion', description: 'Submitted 3+ safety logs in a week', category: 'safety', tier: 'silver', icon: 'ShieldCheck', is_lifetime: false },
  { key: 'safety_guardian', name: 'Safety Guardian', description: 'Submitted 5+ safety logs in a week', category: 'safety', tier: 'gold', icon: 'ShieldCheck', is_lifetime: false },
  { key: 'check_mate', name: 'Check Mate', description: 'Completed 3+ vehicle/equipment checks', category: 'safety', tier: 'bronze', icon: 'ClipboardCheck', is_lifetime: false },
  { key: 'check_pro', name: 'Check Pro', description: 'Completed 5+ vehicle/equipment checks', category: 'safety', tier: 'silver', icon: 'ClipboardCheck', is_lifetime: false },

  // TEAM
  { key: 'crew_anchor', name: 'Crew Anchor', description: 'Top scorer on your crew this week', category: 'team', tier: 'gold', icon: 'Anchor', is_lifetime: false },
  { key: 'crew_pillar', name: 'Crew Pillar', description: 'Top 3 scorer on your crew this week', category: 'team', tier: 'silver', icon: 'Medal', is_lifetime: false },

  // SPECIAL
  { key: 'points_100', name: 'Century Score', description: '100+ incentive points in a week', category: 'special', tier: 'silver', icon: 'Star', is_lifetime: false },
  { key: 'points_200', name: 'Double Century', description: '200+ incentive points in a week', category: 'special', tier: 'gold', icon: 'Star', is_lifetime: false },
  { key: 'points_300', name: 'Triple Century', description: '300+ incentive points in a week', category: 'special', tier: 'platinum', icon: 'Zap', is_lifetime: false },
];

export function getBadgeDef(key) {
  return BADGE_DEFINITIONS.find(b => b.key === key);
}