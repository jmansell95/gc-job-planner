import React from 'react';
import { CalendarClock, CalendarDays, LayoutGrid } from 'lucide-react';

// Bottom tab bar — fixed to the screen bottom, gives crews instant switching
// between Today / Upcoming / More without vertical scrolling.
export default function StaffTabBar({ activeTab, onChange, counts = {} }) {
  const tabs = [
    { key: 'today', label: 'Today', icon: CalendarClock, badge: counts.today },
    { key: 'upcoming', label: 'Upcoming', icon: CalendarDays, badge: counts.upcoming },
    { key: 'more', label: 'More', icon: LayoutGrid },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 safe-area-bottom">
      <div className="max-w-6xl mx-auto flex items-stretch justify-around">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const showBadge = tab.badge != null && tab.badge > 0;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              type="button"
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3.5 transition touch-manipulation ${
                isActive ? 'text-[#2E5A1A]' : 'text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon className={`w-7 h-7 ${isActive ? 'stroke-[2.5]' : ''}`} />
                {showBadge && (
                  <span className={`absolute -top-1.5 -right-2.5 min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    isActive ? 'bg-[#2E5A1A] text-white' : 'bg-slate-300 text-white'
                  }`}>
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-sm font-semibold ${isActive ? 'text-[#2E5A1A]' : 'text-slate-400'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-[#2E5A1A] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}