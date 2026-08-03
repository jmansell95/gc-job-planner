import React from 'react';
import { CalendarClock, CalendarDays, LayoutGrid } from 'lucide-react';

// Polished bottom tab bar — active pill indicator, refined spacing, smooth transitions.
export default function StaffTabBar({ activeTab, onChange, counts = {} }) {
  const tabs = [
    { key: 'today', label: 'Today', icon: CalendarClock, badge: counts.today },
    { key: 'upcoming', label: 'Upcoming', icon: CalendarDays, badge: counts.upcoming },
    { key: 'more', label: 'More', icon: LayoutGrid },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 safe-area-bottom">
      <div className="max-w-6xl mx-auto flex items-stretch justify-around px-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const showBadge = tab.badge != null && tab.badge > 0;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              type="button"
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition touch-manipulation ${
                isActive ? 'text-[#2E5A1A]' : 'text-slate-400'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-[#2E5A1A] rounded-full" />
              )}
              <div className="relative">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${isActive ? 'bg-[#2E5A1A]/10' : ''}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                </div>
                {showBadge && (
                  <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ring-2 ring-white ${
                    isActive ? 'bg-[#2E5A1A] text-white' : 'bg-slate-300 text-white'
                  }`}>
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-semibold ${isActive ? 'text-[#2E5A1A]' : 'text-slate-400'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}