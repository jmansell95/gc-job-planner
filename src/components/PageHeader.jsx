import React from 'react';

/**
 * Unified page header used across all admin pages.
 * Renders a hero-gradient banner with icon, title, subtitle,
 * optional action buttons, and optional stat tiles.
 */
export default function PageHeader({ icon: Icon, title, subtitle, actions, stats }) {
  return (
    <div className="hero-gradient relative overflow-hidden rounded-2xl shadow-lg mb-4">
      <div className="relative px-4 md:px-5 py-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white truncate">{title}</h1>
              {subtitle && <p className="text-xs text-white/70 truncate">{subtitle}</p>}
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0 [&>button]:whitespace-nowrap">
              {actions}
            </div>
          )}
        </div>
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3">
            {stats.map((s, i) => {
              const SIcon = s.icon;
              const Wrapper = s.onClick ? 'button' : 'div';
              return (
                <Wrapper
                  key={i}
                  onClick={s.onClick}
                  className={`bg-white/10 backdrop-blur-sm rounded-xl p-2.5 ring-1 ring-white/15 text-left transition ${s.onClick ? 'hover:bg-white/20 active:scale-[0.98] cursor-pointer' : ''} ${s.active ? 'ring-2 ring-white/60' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {SIcon && <SIcon className="w-3.5 h-3.5 text-white/70" />}
                    <span className="text-[10px] uppercase text-white/60 font-semibold truncate">{s.label}</span>
                  </div>
                  <p className="text-xl font-bold text-white tabular-nums leading-none">{s.value}</p>
                </Wrapper>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}