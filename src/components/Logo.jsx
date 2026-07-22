import React from 'react';

/**
 * Ground Control brand logo.
 * Emblem = transparent PNG (leaf motif). Wordmark + tagline are rendered as
 * crisp text so the typography stays sharp at any size and on any background.
 *
 *   - "icon"   : emblem only
 *   - "lockup" : emblem + "Ground Control" wordmark
 *   - "full"   : emblem + wordmark + tagline (default)
 *
 * `height` is the emblem height in px.
 */
const EMBLEM_URL = 'https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/cfab7be4d_generated_image.png';

export function BrandWordmark({ size = 'base', tone = 'dark', className = '' }) {
  const wordSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';
  const tagSize = size === 'sm' ? 'text-[8px]' : size === 'lg' ? 'text-[10px]' : 'text-[9px]';
  const wordColor = tone === 'light' ? 'text-white' : 'text-[#2E5A1A]';
  const tagColor = tone === 'light' ? 'text-white/70' : 'text-[#5A8C1E]';
  return (
    <span className={`inline-flex flex-col leading-none ${className}`}>
      <span className={`font-display font-extrabold tracking-tight ${wordSize} ${wordColor}`}>
        Ground<span className="text-[#8DC63F]">Control</span>
      </span>
      <span className={`font-display font-medium uppercase tracking-[0.18em] ${tagSize} ${tagColor} mt-0.5`}>
        Caring for our Environment
      </span>
    </span>
  );
}

export default function Logo({ variant = 'full', height = 36, tone = 'dark', className = '', showText = true }) {
  const emblem = (
    <img
      src={EMBLEM_URL}
      alt="Ground Control"
      style={{ height, width: height }}
      className={`object-contain flex-shrink-0 ${className}`}
    />
  );

  if (variant === 'icon') return emblem;

  const gap = height >= 40 ? 'gap-3' : 'gap-2.5';
  const wordSize = height >= 44 ? 'lg' : height <= 28 ? 'sm' : 'base';

  return (
    <div className={`inline-flex items-center ${gap} ${className}`}>
      {emblem}
      {showText && <BrandWordmark size={wordSize} tone={tone} />}
    </div>
  );
}

/**
 * Compact circular brand mark — just the emblem.
 */
export function LogoMark({ size = 36, className = '' }) {
  return (
    <img
      src={EMBLEM_URL}
      alt="Ground Control"
      style={{ width: size, height: size }}
      className={`object-contain flex-shrink-0 ${className}`}
    />
  );
}

export { EMBLEM_URL };