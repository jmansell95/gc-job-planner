import React from 'react';

/**
 * Ground Control brand logo.
 * Uses the uploaded brand logo asset. Variants:
 *   - "full"  : logo + "Ground Control" wordmark + tagline (default)
 *   - "icon"  : just the circular leaf motif
 *   - "lockup": logo + wordmark only (no tagline)
 *
 * `size` is the height of the logo image in px (icon height scales with it).
 * `invert` can be used to force a white tint overlay for dark backgrounds.
 */
const LOGO_URL = 'https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/01db80967_GCLogo.jpg';

export default function Logo({ variant = 'full', height = 36, className = '', showText = true }) {
  if (variant === 'icon') {
    return (
      <img
        src={LOGO_URL}
        alt="Ground Control"
        style={{ height }}
        className={`object-contain ${className}`}
      />
    );
  }

  if (variant === 'lockup') {
    return (
      <img
        src={LOGO_URL}
        alt="Ground Control"
        style={{ height }}
        className={`object-contain ${className}`}
      />
    );
  }

  // full — just use the logo image; it already contains the wordmark + tagline
  return (
    <img
      src={LOGO_URL}
      alt="Ground Control — Caring for our Environment"
      style={{ height }}
      className={`object-contain ${className}`}
    />
  );
}

/**
 * Compact circular brand mark — just the leaf icon portion.
 * Useful in tight spaces like mobile headers.
 */
export function LogoMark({ size = 36, className = '' }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full overflow-hidden bg-white flex-shrink-0 ring-1 ring-black/5 ${className}`}
    >
      <img
        src={LOGO_URL}
        alt="Ground Control"
        className="w-full h-full object-cover"
      />
    </div>
  );
}

export { LOGO_URL };