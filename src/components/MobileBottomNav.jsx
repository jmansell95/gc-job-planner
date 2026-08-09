import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, ScanLine, Home, User, Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

/**
 * Mobile Bottom Navigation — persistent thumb-reach bar for field teams.
 * Stays docked at the bottom of the screen on mobile (lg:hidden) so field
 * staff can jump to their schedule, scanner, home, notifications, or profile
 * without scrolling back to the top header.
 *
 * Only renders on mobile screens. Hidden on desktop where the sidebar
 * provides full navigation.
 */
export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();
  const notifCount = notifications.count;

  const items = [
    { id: 'home', label: 'Home', icon: Home, path: '/admin', section: 'overview' },
    { id: 'schedule', label: 'Schedule', icon: Calendar, path: '/staff-schedule' },
    { id: 'scan', label: 'Scan', icon: ScanLine, path: '/scanner', highlight: true },
    { id: 'alerts', label: 'Alerts', icon: Bell, path: null, badge: notifCount },
    { id: 'profile', label: 'Profile', icon: User, path: '/staff-profile' },
  ];

  const isActive = (item) => {
    if (item.path === '/admin') return location.pathname === '/admin';
    if (item.path === '/staff-schedule') return location.pathname === '/staff-schedule';
    if (item.path === '/scanner') return location.pathname === '/scanner';
    if (item.path === '/staff-profile') return location.pathname === '/staff-profile';
    return false;
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200 safe-area-bottom"
      style={{ boxShadow: '0 -4px 24px -8px rgba(15, 23, 42, 0.12)' }}
    >
      <div className="flex items-stretch justify-around px-1 h-14">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          const showBadge = item.badge > 0;

          if (item.highlight) {
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center flex-1 relative active:scale-95 transition"
                aria-label={item.label}
              >
                <div className="w-11 h-11 -mt-4 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-lg ring-4 ring-white">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-semibold text-[#2E5A1A] mt-0.5">{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.path) navigate(item.path);
              }}
              className={`flex flex-col items-center justify-center flex-1 relative active:scale-95 transition ${
                active ? 'text-[#2E5A1A]' : 'text-slate-400'
              }`}
              aria-label={item.label}
            >
              <Icon className={`w-5 h-5 ${active ? 'fill-[#2E5A1A]/10' : ''}`} />
              <span className="text-[10px] font-semibold mt-0.5">{item.label}</span>
              {showBadge && (
                <span className="absolute top-1 right-[calc(50%-16px)] min-w-[15px] h-4 px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#2E5A1A] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}