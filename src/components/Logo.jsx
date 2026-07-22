import React from 'react';

/**
 * Ground Control brand logo.
 *
 * A single transparent PNG — the same one used on the main sidebar navigation —
 * contains the full lockup (emblem, wordmark and tagline). Every variant renders
 * that same image so the logo is identical across the entire site.
 */
const EMBLEM_URL = 'https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/993ce8312_GC_Logo-removebg-preview.png';

export default function Logo({ height = 36, className = '' }) {
  return (
    <img
      src={EMBLEM_URL}
      alt="Ground Control"
      style={{ height, width: 'auto' }}
      className={`object-contain flex-shrink-0 ${className}`}
    />
  );
}

export function LogoMark({ size = 36, className = '' }) {
  return (
    <img
      src={EMBLEM_URL}
      alt="Ground Control"
      style={{ width: size, height: 'auto' }}
      className={`object-contain flex-shrink-0 ${className}`}
    />
  );
}

export { EMBLEM_URL };