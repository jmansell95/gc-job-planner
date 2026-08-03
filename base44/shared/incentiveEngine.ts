/**
 * Shared incentive engine — badge definitions, point weights, and scoring logic.
 * Imported by the calculateWeeklyIncentives backend function.
 *
 * The frontend has its own copy in src/utils/incentiveBadges.js for display,
 * kept in sync with these definitions.
 */

export const POINT_WEIGHTS = {
  per_metre: 1,
  per_on_time: 10,
  per_vehicle_check: 5,
  per_safety_log: 5,
  per_day_worked: 15,
  per_borehole: 8,
};

export interface WeeklyScore {
  total_metres: number;
  total_hours: number;
  days_worked: number;
  on_time_arrivals: number;
  safety_logs_submitted: number;
  vehicle_checks_completed: number;
  boreholes_worked: number;
  total_points: number;
  rank_in_crew?: number;
}

export interface AllTimeStats {
  totalMetres: number;
  totalBoreholes: number;
}

export interface BadgeDefinition {
  key: string;
  name: string;
  description: string;
  category: 'drilling' | 'punctuality' | 'safety' | 'team' | 'special';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  icon: string;
  is_lifetime: boolean;
  check: (score: WeeklyScore, allTime: AllTimeStats) => boolean;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // === DRILLING PERFORMANCE ===
  {
    key: 'first_borehole',
    name: 'First Strike',
    description: 'Logged your first borehole',
    category: 'drilling',
    tier: 'bronze',
    icon: 'Drill',
    is_lifetime: true,
    check: (_s, a) => a.totalBoreholes >= 1,
  },
  {
    key: 'metre_50',
    name: 'Half Century',
    description: 'Drilled 50m in a week',
    category: 'drilling',
    tier: 'silver',
    icon: 'Ruler',
    is_lifetime: false,
    check: (s) => s.total_metres >= 50,
  },
  {
    key: 'metre_100',
    name: 'Centurion',
    description: 'Drilled 100m in a week',
    category: 'drilling',
    tier: 'gold',
    icon: 'Ruler',
    is_lifetime: false,
    check: (s) => s.total_metres >= 100,
  },
  {
    key: 'metre_200',
    name: 'Double Ton',
    description: 'Drilled 200m in a week',
    category: 'drilling',
    tier: 'platinum',
    icon: 'Ruler',
    is_lifetime: false,
    check: (s) => s.total_metres >= 200,
  },
  {
    key: 'milestone_500',
    name: '500 Club',
    description: '500m drilled all-time',
    category: 'drilling',
    tier: 'gold',
    icon: 'Trophy',
    is_lifetime: true,
    check: (_s, a) => a.totalMetres >= 500,
  },
  {
    key: 'milestone_1000',
    name: 'Kilometre Crusher',
    description: '1,000m drilled all-time',
    category: 'drilling',
    tier: 'platinum',
    icon: 'Trophy',
    is_lifetime: true,
    check: (_s, a) => a.totalMetres >= 1000,
  },
  {
    key: 'borehole_explorer',
    name: 'Explorer',
    description: 'Worked on 3+ boreholes in a week',
    category: 'drilling',
    tier: 'silver',
    icon: 'Compass',
    is_lifetime: false,
    check: (s) => s.boreholes_worked >= 3,
  },
  {
    key: 'borehole_master',
    name: 'Borehole Master',
    description: 'Worked on 5+ boreholes in a week',
    category: 'drilling',
    tier: 'gold',
    icon: 'Compass',
    is_lifetime: false,
    check: (s) => s.boreholes_worked >= 5,
  },

  // === PUNCTUALITY ===
  {
    key: 'early_bird',
    name: 'Early Bird',
    description: 'On-time arrival 3 days in a week',
    category: 'punctuality',
    tier: 'bronze',
    icon: 'Sunrise',
    is_lifetime: false,
    check: (s) => s.on_time_arrivals >= 3,
  },
  {
    key: 'reliable_rocker',
    name: 'Reliable Rocker',
    description: 'On-time arrival 5 days in a week',
    category: 'punctuality',
    tier: 'silver',
    icon: 'Sunrise',
    is_lifetime: false,
    check: (s) => s.on_time_arrivals >= 5,
  },
  {
    key: 'perfect_week',
    name: 'Perfect Week',
    description: 'Worked all 5 days',
    category: 'punctuality',
    tier: 'gold',
    icon: 'CalendarCheck',
    is_lifetime: false,
    check: (s) => s.days_worked >= 5,
  },
  {
    key: 'hard_worker',
    name: 'Hard Worker',
    description: 'Worked 40+ hours in a week',
    category: 'punctuality',
    tier: 'silver',
    icon: 'Clock',
    is_lifetime: false,
    check: (s) => s.total_hours >= 40,
  },

  // === SAFETY & COMPLIANCE ===
  {
    key: 'safety_champion',
    name: 'Safety Champion',
    description: 'Submitted 3+ safety logs in a week',
    category: 'safety',
    tier: 'silver',
    icon: 'ShieldCheck',
    is_lifetime: false,
    check: (s) => s.safety_logs_submitted >= 3,
  },
  {
    key: 'safety_guardian',
    name: 'Safety Guardian',
    description: 'Submitted 5+ safety logs in a week',
    category: 'safety',
    tier: 'gold',
    is_lifetime: false,
    check: (s) => s.safety_logs_submitted >= 5,
  },
  {
    key: 'check_mate',
    name: 'Check Mate',
    description: 'Completed 3+ vehicle/equipment checks',
    category: 'safety',
    tier: 'bronze',
    icon: 'ClipboardCheck',
    is_lifetime: false,
    check: (s) => s.vehicle_checks_completed >= 3,
  },
  {
    key: 'check_pro',
    name: 'Check Pro',
    description: 'Completed 5+ vehicle/equipment checks',
    category: 'safety',
    tier: 'silver',
    icon: 'ClipboardCheck',
    is_lifetime: false,
    check: (s) => s.vehicle_checks_completed >= 5,
  },

  // === TEAM PLAYER ===
  {
    key: 'crew_anchor',
    name: 'Crew Anchor',
    description: 'Top scorer on your crew this week',
    category: 'team',
    tier: 'gold',
    icon: 'Anchor',
    is_lifetime: false,
    check: (s) => s.rank_in_crew === 1 && s.total_points > 0,
  },
  {
    key: 'crew_pillar',
    name: 'Crew Pillar',
    description: 'Top 3 scorer on your crew this week',
    category: 'team',
    tier: 'silver',
    icon: 'Medal',
    is_lifetime: false,
    check: (s) => s.rank_in_crew != null && s.rank_in_crew <= 3 && s.rank_in_crew > 1 && s.total_points > 0,
  },

  // === SPECIAL ===
  {
    key: 'points_100',
    name: 'Century Score',
    description: '100+ incentive points in a week',
    category: 'special',
    tier: 'silver',
    icon: 'Star',
    is_lifetime: false,
    check: (s) => s.total_points >= 100,
  },
  {
    key: 'points_200',
    name: 'Double Century',
    description: '200+ incentive points in a week',
    category: 'special',
    tier: 'gold',
    icon: 'Star',
    is_lifetime: false,
    check: (s) => s.total_points >= 200,
  },
  {
    key: 'points_300',
    name: 'Triple Century',
    description: '300+ incentive points in a week',
    category: 'special',
    tier: 'platinum',
    icon: 'Zap',
    is_lifetime: false,
    check: (s) => s.total_points >= 300,
  },
];

export function calculatePoints(score: WeeklyScore): number {
  return Math.round(
    (score.total_metres || 0) * POINT_WEIGHTS.per_metre +
    (score.on_time_arrivals || 0) * POINT_WEIGHTS.per_on_time +
    (score.vehicle_checks_completed || 0) * POINT_WEIGHTS.per_vehicle_check +
    (score.safety_logs_submitted || 0) * POINT_WEIGHTS.per_safety_log +
    (score.days_worked || 0) * POINT_WEIGHTS.per_day_worked +
    (score.boreholes_worked || 0) * POINT_WEIGHTS.per_borehole
  );
}

export function getEarnedBadges(score: WeeklyScore, allTime: AllTimeStats): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter(b => b.check(score, allTime));
}