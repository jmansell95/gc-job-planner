import React from 'react';

/**
 * Profile avatar — shows the uploaded profile picture or a coloured initials
 * fallback derived from the user's name. Used in the admin sidebar, profile
 * header, and anywhere a user identity chip is needed.
 */

const AVATAR_COLORS = [
  ['#10b981', '#047857'], // emerald
  ['#3b82f6', '#1d4ed8'], // blue
  ['#8b5cf6', '#6d28d9'], // violet
  ['#f59e0b', '#d97706'], // amber
  ['#f43f5e', '#be123c'], // rose
  ['#06b6d4', '#0e7490'], // cyan
  ['#6366f1', '#4338ca'], // indigo
  ['#14b8a6', '#0f766e'], // teal
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorIndex(name) {
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % AVATAR_COLORS.length;
}

export default function ProfileAvatar({ name, avatarUrl, size = 40, className = '' }) {
  const initials = getInitials(name);
  const [c1, c2] = AVATAR_COLORS[getColorIndex(name)];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Profile'}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover flex-shrink-0 ring-2 ring-white/20 ${className}`}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
      }}
      className={`rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ring-2 ring-white/20 ${className}`}
    >
      {initials}
    </div>
  );
}