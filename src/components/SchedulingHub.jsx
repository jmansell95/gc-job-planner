import React, { useState, useEffect } from 'react';
import WeeklyRotaBuilder from '@/components/WeeklyRotaBuilder';
import CalendarView from '@/components/CalendarView';
import { Calendar, CalendarDays, CalendarClock } from 'lucide-react';
import { useSchedulingAssistant } from '@/components/SchedulingAssistantChat';

// Unified scheduling hub — combines the weekly rota builder and the calendar
// view behind a single sidebar entry. `initialTab` lets legacy "rota" /
// "calendar" deep links land on the right tab.
export default function SchedulingHub({ initialTab = 'rota' }) {
  const [tab, setTab] = useState(initialTab);
  const { openChat } = useSchedulingAssistant();
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  const tabs = [
    { id: 'rota', label: 'Rota Builder', icon: Calendar },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5 bg-white rounded-xl border border-slate-200 p-1.5 w-fit shadow-sm">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} type="button"
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-[#2E5A1A] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>
        <button onClick={openChat} type="button"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2E5A1A] text-white text-sm font-medium hover:bg-[#1c4a12] active:scale-[0.98] transition shadow-sm touch-manipulation select-none">
          <CalendarClock className="w-4 h-4" />
          Schedule Assistant
        </button>
      </div>
      {tab === 'rota' && <WeeklyRotaBuilder />}
      {tab === 'calendar' && <CalendarView />}
    </div>
  );
}