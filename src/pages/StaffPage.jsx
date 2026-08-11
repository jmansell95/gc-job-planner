import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CalendarX, CalendarDays, Star, UserCheck, UsersRound, Building2, HardHat, Package, Clock, Contact } from 'lucide-react';
import SettingsPage from '@/components/SettingsPage';
import PageHeader from '@/components/PageHeader';
import TabBar from '@/components/TabBar';
import MissingRatesBanner from '@/components/staff/MissingRatesBanner';
import StaffDirectoryGrid from '@/components/staff/StaffDirectoryGrid';
import StaffCostAnalytics from '@/components/staff/StaffCostAnalytics';
import StaffUtilizationWidget from '@/components/dashboard/StaffUtilizationWidget';

export default function StaffPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('staff');

  const tabs = [
    { id: 'staff', label: 'Crew Members', icon: Users },
    { id: 'directory', label: 'Directory', icon: Users },
    { id: 'cost-analytics', label: 'Cost Analytics', icon: Clock },
    { id: 'utilization', label: 'Utilization', icon: Users },
    { id: 'teams', label: 'Crew Types', icon: UsersRound },
    { id: 'timesheets', label: 'Timesheets', icon: Clock },
    { id: 'clients', label: 'Clients', icon: Building2 },
    { id: 'contractors', label: 'Sub-contractors', icon: HardHat },
    { id: 'suppliers', label: 'Suppliers', icon: Package },
    { id: 'absences', label: 'Absences', icon: CalendarX },
    { id: 'holiday-accrual', label: 'Holiday Accrual', icon: CalendarDays },
    { id: 'staff-reviews', label: 'Performance Reviews', icon: Star },
    { id: 'timesheet-delegation', label: 'Approval Delegation', icon: UserCheck },
    { id: 'access-levels', label: 'Permission Groups', icon: UserCheck },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Users}
        title="People & Team Management"
        subtitle="Manage crew members, timesheets, clients, subcontractors and suppliers"
      />
      <MissingRatesBanner />
      {tab === 'directory' && <StaffDirectoryGrid onSelect={(s) => navigate('/admin', { state: { section: 'staff-detail', staff: s } })} />}
      {tab === 'cost-analytics' && <StaffCostAnalytics />}
      {tab === 'utilization' && (
        <StaffUtilizationWidget onNavigate={(section) => navigate('/admin', { state: { section } })} />
      )}
      {tab !== 'directory' && tab !== 'cost-analytics' && tab !== 'utilization' && (
      <TabBar tabs={tabs} activeTab={tab} onChange={setTab} />
      )}
      {tab !== 'directory' && tab !== 'cost-analytics' && tab !== 'utilization' && tabs.map(t => tab === t.id && (
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