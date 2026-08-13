import React from 'react';
import { CalendarClock, CalendarDays, LayoutGrid, ScanLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Polished bottom tab bar with a center scanner FAB for quick access.
export default function StaffTabBar({ activeTab, onChange, counts = {} }) {
  const navigate = useNavigate();
  const tabs = [
    { key: 'today', label: 'Today', icon: CalendarClock, badge: counts.today },
    { key: 'upcoming', label: 'Upcoming', icon: CalendarDays, badge: counts.upcoming },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 safe-area-bottom">
      <div className="max-w-6xl mx-auto flex items-stretch justify-around px-2 relative">
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

        {/* Center Scanner FAB */}
        <button
          onClick={() => navigate('/scanner')}
          type="button"
          className="flex flex-col items-center justify-center gap-1 px-2 touch-manipulation"
        >
          <div className="w-14 h-14 -mt-6 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white flex items-center justify-center shadow-lg shadow-[#2E5A1A]/30 ring-4 ring-white active:scale-95 transition">
            <ScanLine className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-semibold text-[#2E5A1A]">Scan</span>
        </button>

        {/* More tab */}
        <button
          onClick={() => onChange('more')}
          type="button"
          className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition touch-manipulation ${
            activeTab === 'more' ? 'text-[#2E5A1A]' : 'text-slate-400'
          }`}
        >
          {activeTab === 'more' && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-[#2E5A1A] rounded-full" />
          )}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${activeTab === 'more' ? 'bg-[#2E5A1A]/10' : ''}`}>
            <LayoutGrid className={`w-5 h-5 ${activeTab === 'more' ? 'stroke-[2.5]' : ''}`} />
          </div>
          <span className={`text-[11px] font-semibold ${activeTab === 'more' ? 'text-[#2E5A1A]' : 'text-slate-400'}`}>
            More
          </span>
        </button>
      </div>
    </nav>
  );
}