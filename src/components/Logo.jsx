import React from 'react';

/**
 * Brand logos for the Land & Water Solutions enterprise platform.
 *
 * Hierarchy:
 *  - Land & Water Solutions (parent enterprise) — LandWaterLogo
 *  - Ground Control (geotechnical division) — Logo / LogoFull
 *
 * All emblems are transparent PNGs designed to render on dark green backgrounds
 * without a white background card.
 */

// Ground Control division emblem — transparent, light emerald/white for dark backgrounds
const EMBLEM_URL = 'https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/674888cf4_generated_image.png';

// Land & Water Solutions parent enterprise emblem — transparent
const PARENT_EMBLEM_URL = 'https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/dd9caa0ce_generated_image.png';

export { EMBLEM_URL, PARENT_EMBLEM_URL };

/**
 * Ground Control division logo — emblem only, transparent background.
 */
export default function Logo({ height = 36, className = '' }) {
  return (
    <img
      src={EMBLEM_URL}
      alt="Ground Control"
      style={{ height, width: 'auto' }}
      className={'object-contain flex-shrink-0 ' + className}
    />
  );
}

export function LogoMark({ size = 36, className = '' }) {
  return (
    <img
      src={EMBLEM_URL}
      alt="Ground Control"
      style={{ width: size, height: 'auto' }}
      className={'object-contain flex-shrink-0 ' + className}
    />
  );
}

/**
 * Ground Control full lockup — emblem + wordmark. For sidebars and headers
 * on dark backgrounds.
 */
export function LogoFull({ height = 36, className = '', tone = 'light' }) {
  const textColor = tone === 'light' ? 'text-white' : 'text-slate-900';
  return (
    <div className={'flex items-center gap-2.5 ' + className}>
      <img
        src={EMBLEM_URL}
        alt="Ground Control"
        style={{ height, width: 'auto' }}
        className="object-contain flex-shrink-0"
      />
      <div className="flex flex-col leading-none">
        <span className={'font-extrabold tracking-tight ' + textColor} style={{ fontSize: Math.round(height * 0.5) }}>
          Ground Control
        </span>
      </div>
    </div>
  );
}

/**
 * Land & Water Solutions parent enterprise logo — emblem + wordmark.
 * Used at the enterprise level (Enterprise Dashboard, Enterprise Header).
 */
export function LandWaterLogo({ height = 36, className = '', tone = 'light', showText = true }) {
  const textColor = tone === 'light' ? 'text-white' : 'text-slate-900';
  const subColor = tone === 'light' ? 'text-white/60' : 'text-slate-500';
  return (
    <div className={'flex items-center gap-2.5 ' + className}>
      <img
        src={PARENT_EMBLEM_URL}
        alt="Land & Water Solutions"
        style={{ height, width: 'auto' }}
        className="object-contain flex-shrink-0"
      />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={'font-extrabold tracking-tight ' + textColor} style={{ fontSize: Math.round(height * 0.42) }}>
            Land &amp; Water
          </span>
          <span className={'font-medium tracking-[0.18em] uppercase ' + subColor} style={{ fontSize: Math.round(height * 0.28) }}>
            Solutions
          </span>
        </div>
      )}
    </div>
  );
}