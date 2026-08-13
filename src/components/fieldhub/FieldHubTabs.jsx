import React from 'react';
import { ScanLine, Wrench, CalendarDays, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Field Hub Tabs — premium segmented navigation dock for the mobile scanner hub.
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
    <div className="flex bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 gap-1">
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
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
              active
                ? 'bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Icon className={`w-4 h-4 ${active ? 'scale-110' : ''} transition-transform`} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}