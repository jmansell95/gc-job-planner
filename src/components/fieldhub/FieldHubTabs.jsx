import React from 'react';
import { ScanLine, Wrench, CalendarDays, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Field Hub Tabs — the primary navigation dock for the mobile scanner hub.
 * Three tabs for field staff: Scan (default), My Gear, My Today.
 * Super admins get a fourth "Manage" tab linking to the admin dashboard.
 */
const TABS = [
  { key: 'scan', label: 'Scan', Icon: ScanLine },
  { key: 'mygear', label: 'My Gear', Icon: Wrench },
  { key: 'mytoday', label: 'My Today', Icon: CalendarDays },
];

export default function FieldHubTabs({ activeTab, onChange, isAdmin }) {
  const navigate = useNavigate();
  const tabs = isAdmin ? [...TABS, { key: 'manage', label: 'Manage', Icon: LayoutDashboard }] : TABS;

  return (
    <div className="flex bg-slate-100/80 rounded-xl p-1 gap-1">
      {tabs.map(tab => {
        const Icon = tab.Icon;
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => {
              if (tab.key === 'manage') { navigate('/admin'); return; }
              onChange(tab.key);
            }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-lg text-[11px] font-bold transition active:scale-95 ${
              active ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}