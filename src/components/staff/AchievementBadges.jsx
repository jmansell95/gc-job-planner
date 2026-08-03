import React from 'react';
import {
  Drill, Ruler, Trophy, Compass, Sunrise, CalendarCheck, Clock,
  ShieldCheck, ClipboardCheck, Anchor, Medal, Star, Zap, Award,
} from 'lucide-react';
import { TIER_STYLES, CATEGORY_STYLES, BADGE_DEFINITIONS, getBadgeDef } from '@/utils/incentiveBadges';

const ICON_MAP = {
  Drill, Ruler, Trophy, Compass, Sunrise, CalendarCheck, Clock,
  ShieldCheck, ClipboardCheck, Anchor, Medal, Star, Zap, Award,
};

function BadgeIcon({ name, className }) {
  const Cmp = ICON_MAP[name] || Award;
  return <Cmp className={className} />;
}

/** Single badge card — earned or locked */
export function BadgeCard({ badge, earned = true, size = 'md' }) {
  const tier = TIER_STYLES[badge.tier] || TIER_STYLES.bronze;
  const cardSize = size === 'sm' ? 'w-16 h-16' : 'w-20 h-20';
  const iconSize = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7';

  return (
    <div className="relative flex flex-col items-center flex-shrink-0">
      <div
        className={`relative ${cardSize} rounded-2xl border-2 ${tier.border} ${tier.bg} flex items-center justify-center transition-all ${earned ? `shadow-lg ${tier.glow}` : 'opacity-30 grayscale'}`}
      >
        <BadgeIcon name={badge.icon} className={`${iconSize} ${tier.text}`} />
        {earned && badge.tier !== 'bronze' && (
          <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-white shadow-sm" style={{ color: tier.hex }}>
            {tier.label}
          </span>
        )}
      </div>
      <p className={`text-[10px] font-semibold text-center mt-1.5 leading-tight ${earned ? 'text-slate-700' : 'text-slate-400'} truncate w-16`}>
        {badge.name}
      </p>
    </div>
  );
}

/** Horizontal scrollable row of earned badges */
export function EarnedBadgeRow({ achievements = [], max = 12 }) {
  if (!achievements.length) {
    return (
      <div className="text-center py-6 text-sm text-slate-400">
        No badges earned yet this week — keep grinding!
      </div>
    );
  }

  const shown = achievements.slice(0, max);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
      {shown.map((a, i) => {
        const def = getBadgeDef(a.badge_key) || { icon: a.badge_icon, name: a.badge_name, tier: a.badge_tier };
        return <BadgeCard key={a.id || i} badge={{ ...def, ...a }} earned size="sm" />;
      })}
    </div>
  );
}

/** Full badge grid — shows all possible badges, earned ones highlighted, locked ones greyed */
export function BadgeCollection({ earnedKeys = new Set(), category = null }) {
  const badges = category ? BADGE_DEFINITIONS.filter(b => b.category === category) : BADGE_DEFINITIONS;

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
      {badges.map((badge, i) => (
        <BadgeCard key={badge.key + i} badge={badge} earned={earnedKeys.has(badge.key)} size="sm" />
      ))}
    </div>
  );
}

/** Category filter pills */
export function CategoryFilter({ active, onChange }) {
  const cats = [
    { key: null, label: 'All' },
    ...Object.entries(CATEGORY_STYLES).map(([k, v]) => ({ key: k, label: v.label })),
  ];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
      {cats.map(c => (
        <button
          key={c.key || 'all'}
          onClick={() => onChange(c.key)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
            active === c.key
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}