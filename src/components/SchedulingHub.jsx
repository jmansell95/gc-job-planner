import React, { useState, useEffect } from 'react';
import WeeklyRotaBuilder from '@/components/WeeklyRotaBuilder';
import CalendarView from '@/components/CalendarView';
import { Calendar, CalendarDays } from 'lucide-react';

// Unified scheduling hub — combines the weekly rota builder and the calendar
// view behind a single sidebar entry. `initialTab` lets legacy "rota" /
// "calendar" deep links land on the right tab.
export default function SchedulingHub({ initialTab = 'rota' }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  const tabs = [
    { id: 'rota', label: 'Rota Builder', icon: Calendar },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  ];

  return (
    <div>
      <div className="flex gap-1.5 mb-4 bg-white rounded-xl border border-slate-200 p-1.5 w-fit shadow-sm">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} type="button"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === 'rota' && <WeeklyRotaBuilder />}
      {tab === 'calendar' && <CalendarView />}
    </div>
  );
}