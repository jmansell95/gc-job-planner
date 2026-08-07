import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CalendarX, CalendarDays, Star, UserCheck, UsersRound, Building2, HardHat, Package, Clock, Contact } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SettingsPage from '@/components/SettingsPage';

export default function StaffPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('staff');

  const tabs = [
    { id: 'staff', label: 'Crew Members', icon: Users },
    { id: 'teams', label: 'Crew Types', icon: UsersRound },
    { id: 'timesheets', label: 'Timesheets', icon: Clock },
    { id: 'clients', label: 'Clients', icon: Building2 },
    { id: 'contractors', label: 'Sub-contractors', icon: HardHat },
    { id: 'suppliers', label: 'Suppliers', icon: Package },
    { id: 'absences', label: 'Absences', icon: CalendarX },
    { id: 'holiday-accrual', label: 'Holiday Accrual', icon: CalendarDays },
    { id: 'staff-reviews', label: 'Performance Reviews', icon: Star },
    { id: 'timesheet-delegation', label: 'Approval Delegation', icon: UserCheck },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Users}
        title="Staff, Teams & Contacts"
        subtitle="Crew members, crew types, timesheets, clients, sub-contractors, suppliers & HR"
      />
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-1.5 inline-flex flex-wrap gap-1">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} type="button"
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition ${active ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map(t => tab === t.id && (
        <SettingsPage
          key={t.id}
          initialTab={t.id}
          standalone
          onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })}
        />
      ))}
    </div>
  );
}