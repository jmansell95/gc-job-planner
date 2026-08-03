import React from 'react';
import {
  Drill, Ruler, Trophy, Compass, Sunrise, CalendarCheck, Clock,
  ShieldCheck, ClipboardCheck, Anchor, Medal, Star, Zap, Award, Lock,
} from 'lucide-react';
import { TIER_STYLES, CATEGORY_STYLES, BADGE_DEFINITIONS, getBadgeDef, getBadgeProgress } from '@/utils/incentiveBadges';

const ICON_MAP = {
  Drill, Ruler, Trophy, Compass, Sunrise, CalendarCheck, Clock,
  ShieldCheck, ClipboardCheck, Anchor, Medal, Star, Zap, Award,
};

function BadgeIcon({ name, className }) {
  const Cmp = ICON_MAP[name] || Award;
  return <Cmp className={className} />;
}

/** Progress ring overlay for locked badges with trackable progress */
function ProgressRing({ pct, size }) {
  const dim = size === 'sm' ? 64 : 80;
  const stroke = 3;
  const radius = (dim - stroke * 2) / 2 - 4;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg className="absolute inset-0" width={dim} height={dim} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-200" opacity={0.5} />
      <circle
        cx={dim / 2} cy={dim / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke}
        className="text-emerald-500"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

/** Single badge card — earned or locked. Clickable to open detail modal. */
export function BadgeCard({ badge, earned = true, size = 'md', achievement, score, onClick }) {
  const tier = TIER_STYLES[badge.tier] || TIER_STYLES.bronze;
  const cardSize = size === 'sm' ? 'w-16 h-16' : 'w-20 h-20';
  const iconSize = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7';
  const progress = !earned ? getBadgeProgress(badge, score) : null;
  const showProgress = progress && progress.pct > 0 && !progress.isComplete;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center flex-shrink-0 group focus:outline-none"
    >
      <div
        className={`relative ${cardSize} rounded-2xl border-2 ${tier.border} ${tier.bg} flex items-center justify-center transition-all group-hover:scale-105 group-active:scale-95 ${
          earned ? `shadow-lg ${tier.glow}` : 'opacity-40 grayscale group-hover:opacity-60 group-hover:grayscale-0'
        } ${onClick ? 'cursor-pointer' : ''}`}
      >
        <BadgeIcon name={badge.icon} className={`${iconSize} ${tier.text}`} />
        {earned && badge.tier !== 'bronze' && (
          <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-white shadow-sm" style={{ color: tier.hex }}>
            {tier.label}
          </span>
        )}
        {!earned && !showProgress && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center ring-2 ring-white">
            <Lock className="w-2.5 h-2.5 text-slate-400" />
          </span>
        )}
        {showProgress && <ProgressRing pct={progress.pct} size={size} />}
      </div>
      <p className={`text-[10px] font-semibold text-center mt-1.5 leading-tight truncate w-16 ${earned ? 'text-slate-700' : 'text-slate-400'}`}>
        {badge.name}
      </p>
    </button>
  );
}

/** Horizontal scrollable row of earned badges */
export function EarnedBadgeRow({ achievements = [], max = 12, onBadgeClick }) {
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
        const def = getBadgeDef(a.badge_key) || { icon: a.badge_icon, name: a.badge_name, tier: a.badge_tier, category: a.badge_category, description: a.badge_description };
        return (
          <BadgeCard
            key={a.id || i}
            badge={{ ...def, ...a }}
            earned
            size="sm"
            achievement={a}
            onClick={onBadgeClick ? () => onBadgeClick({ badge: def, achievement: a }) : undefined}
          />
        );
      })}
    </div>
  );
}

/** Full badge grid — shows all possible badges, earned ones highlighted, locked ones greyed */
export function BadgeCollection({ earnedKeys = new Set(), category = null, achievements = [], score, onBadgeClick }) {
  const badges = category ? BADGE_DEFINITIONS.filter(b => b.category === category) : BADGE_DEFINITIONS;
  const achievementMap = new Map(achievements.map(a => [a.badge_key, a]));

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
      {badges.map((badge, i) => {
        const isEarned = earnedKeys.has(badge.key);
        const ach = achievementMap.get(badge.key);
        return (
          <BadgeCard
            key={badge.key + i}
            badge={badge}
            earned={isEarned}
            size="sm"
            achievement={ach}
            score={score}
            onClick={onBadgeClick ? () => onBadgeClick({ badge, achievement: ach, score }) : undefined}
          />
        );
      })}
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