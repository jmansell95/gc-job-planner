import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Truck, UserCircle2 } from 'lucide-react';

// Mobile bottom tab bar — renders only on < lg viewports (lg:hidden) and
// hides itself on public/auth/portal routes. Tapping a tab navigates;
// browser history is preserved so back returns through the previous stack.
const HIDDEN_PREFIXES = ['/login', '/register', '/forgot', '/reset', '/client-portal', '/help'];

export default function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  if (HIDDEN_PREFIXES.some(p => path.startsWith(p))) return null;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { id: 'schedule', label: 'Schedule', icon: CalendarDays, path: '/staff-schedule' },
    { id: 'deliveries', label: 'Deliveries', icon: Truck, path: '/deliveries' },
    { id: 'profile', label: 'Profile', icon: UserCircle2, path: '/staff-profile' },
  ];

  const isActive = (tabPath) => {
    if (tabPath === '/admin') return path === '/admin' || path === '/';
    return path.startsWith(tabPath);
  };

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-[0_-2px_12px_rgba(15,23,42,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="grid grid-cols-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          return (
            <button key={tab.id} type="button" onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center gap-0.5 py-2.5 transition active:scale-95"
              style={{ minHeight: 44, paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px) * 0)' }}>
              <Icon className={`w-[22px] h-[22px] transition-colors ${active ? 'text-emerald-600' : 'text-slate-400'}`} strokeWidth={active ? 2.4 : 2} />
              <span className={`text-[11px] font-medium leading-none transition-colors ${active ? 'text-emerald-700' : 'text-slate-500'}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}