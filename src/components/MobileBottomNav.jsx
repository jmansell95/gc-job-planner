import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Calendar, ScanLine, Truck, Briefcase, Grid3x3, ShieldCheck,
  Boxes, Car, PoundSterling, Users, Sparkles, User, HelpCircle,
} from 'lucide-react';
import { useDivision } from '@/contexts/DivisionContext';
import { useAIHub } from '@/components/ai/AIHub';
import { getNavConfigs } from '@/utils/divisionNav';

/**
 * Icon mapping — maps the string icon name in the nav registry to the actual
 * lucide-react component. This keeps the registry serialisable (plain strings)
 * while the component handles the render-time lookup.
 */
const ICON_MAP = {
  Home, Calendar, ScanLine, Truck, Briefcase, Grid3x3, ShieldCheck,
  Boxes, Car, PoundSterling, Users, Sparkles, User, HelpCircle,
};

/**
 * Mobile Bottom Navigation — division-aware persistent thumb-reach bar.
 *
 * Reads the active division's `nav_items` config (or falls back to the
 * division type default) and renders the configured items. Each division
 * can have a completely different set of nav items — configured in
 * Settings → Divisions → Edit → Navigation.
 *
 * When no division is active (Enterprise Overview), the nav is hidden —
 * the Enterprise Dashboard is the top-level hub above all divisions.
 *
 * Only renders on mobile screens. Hidden on desktop where the sidebar
 * provides full navigation.
 */
export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeDivision } = useDivision();
  const { openHub } = useAIHub();

  // Resolve nav items for the active division
  const items = activeDivision ? getNavConfigs(activeDivision) : [];

  // Don't render on enterprise overview (no division selected)
  if (!activeDivision || items.length === 0) return null;

  const isActive = (item) => {
    if (!item.path) return false;
    if (item.path === '/enterprise') return location.pathname === '/enterprise';
    if (item.path === '/admin') return location.pathname === '/admin';
    return location.pathname === item.path;
  };

  return (
    <nav
      className="xl:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200 safe-area-bottom"
      style={{ boxShadow: '0 -4px 24px -8px rgba(15, 23, 42, 0.12)' }}
    >
      <div className="flex items-stretch justify-around px-1 h-14">
        {items.map((item) => {
          const Icon = ICON_MAP[item.icon] || Home;
          const active = isActive(item);

          if (item.highlight) {
            return (
              <button
                key={item.id}
                onClick={() => item.path && navigate(item.path)}
                className="flex flex-col items-center justify-center flex-1 relative active:scale-95 transition"
                aria-label={item.label}
              >
                <div
                  className="w-11 h-11 -mt-4 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white"
                  style={{ background: `linear-gradient(135deg, ${activeDivision.color || '#2E5A1A'}, ${activeDivision.color || '#2E5A1A'}cc)` }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span
                  className="text-[10px] font-semibold mt-0.5"
                  style={{ color: activeDivision.color || '#2E5A1A' }}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.isAIHub) {
                  openHub();
                  return;
                }
                if (item.path) navigate(item.path);
              }}
              className={`flex flex-col items-center justify-center flex-1 relative active:scale-95 transition ${
                active ? '' : 'text-slate-400'
              }`}
              style={active ? { color: activeDivision.color || '#2E5A1A' } : {}}
              aria-label={item.label}
            >
              <Icon className={`w-5 h-5 ${active ? '' : ''}`} style={active ? { fill: (activeDivision.color || '#2E5A1A') + '1a' } : {}} />
              <span className="text-[10px] font-semibold mt-0.5">{item.label}</span>
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: activeDivision.color || '#2E5A1A' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}