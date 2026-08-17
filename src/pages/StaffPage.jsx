import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, CalendarX, Clock, UsersRound, Building2, GraduationCap, UserCheck, AlertTriangle, HardHat } from 'lucide-react';
import SettingsPage from '@/components/SettingsPage';
import PageHeader from '@/components/PageHeader';
import TabBar from '@/components/TabBar';
import HubStatsBar from '@/components/dashboard/HubStatsBar';
import MissingRatesBanner from '@/components/staff/MissingRatesBanner';
import StaffDirectoryGrid from '@/components/staff/StaffDirectoryGrid';
import StaffCostAnalytics from '@/components/staff/StaffCostAnalytics';
import StaffUtilizationWidget from '@/components/dashboard/StaffUtilizationWidget';
import TrainingMatrixHub from '@/components/staff/TrainingMatrixHub';

// Map legacy tab IDs to the new grouped structure so existing navigation doesn't break
const TAB_MAP = {
  'staff': { tab: 'staff', subTab: 'staff' },
  'staff-reviews': { tab: 'staff', subTab: 'staff-reviews' },
  'teams': { tab: 'teams' },
  'timesheets': { tab: 'timesheets', subTab: 'timesheets' },
  'timesheet-delegation': { tab: 'timesheets', subTab: 'timesheet-delegation' },
  'holiday-accrual': { tab: 'timesheets', subTab: 'holiday-accrual' },
  'absences': { tab: 'absences' },
  'clients': { tab: 'contacts', subTab: 'clients' },
  'contractors': { tab: 'contacts', subTab: 'contractors' },
  'suppliers': { tab: 'contacts', subTab: 'suppliers' },
  'access-levels': { tab: 'staff', subTab: 'staff' },
  'training': { tab: 'training' },
  'directory': { tab: 'directory' },
  'cost-analytics': { tab: 'cost-analytics' },
  'utilization': { tab: 'utilization' },
};

const TABS = [
  {
    id: 'staff', label: 'Crew Members', icon: Users,
    subTabs: [
      { id: 'staff', label: 'Crew Members' },
      { id: 'staff-reviews', label: 'Performance Reviews' },
    ],
  },
  { id: 'teams', label: 'Crew Types', icon: UsersRound },
  { id: 'training', label: 'Training', icon: GraduationCap },
  {
    id: 'timesheets', label: 'Timesheets', icon: Clock,
    subTabs: [
      { id: 'timesheets', label: 'Timesheets' },
      { id: 'timesheet-delegation', label: 'Approval Delegation' },
      { id: 'holiday-accrual', label: 'Holiday Accrual' },
    ],
  },
  { id: 'absences', label: 'Absences', icon: CalendarX },
  {
    id: 'contacts', label: 'Contacts', icon: Building2,
    subTabs: [
      { id: 'clients', label: 'Clients' },
      { id: 'contractors', label: 'Sub-contractors' },
      { id: 'suppliers', label: 'Suppliers' },
    ],
  },
];

const STANDALONE_VIEWS = ['directory', 'cost-analytics', 'utilization'];

export default function StaffPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initial = location.state?.initialTab || 'staff';
  const mapped = TAB_MAP[initial] || { tab: 'staff', subTab: 'staff' };
  const [tab, setTab] = useState(mapped.tab);
  const [subTab, setSubTab] = useState(mapped.subTab || null);

  const { data: allStaff = [] } = useQuery({
    queryKey: ['staff-page-hub'],
    queryFn: () => base44.entities.Staff.list('-created_date', 500),
  });

  const staffStats = useMemo(() => {
    const active = allStaff.filter(s => s.is_active !== false).length;
    const subcontractors = allStaff.filter(s => s.worker_type === 'subcontractor').length;
    const agency = allStaff.filter(s => s.worker_type === 'agency').length;
    return { total: allStaff.length, active, subcontractors, agency };
  }, [allStaff]);

  const isStandaloneView = STANDALONE_VIEWS.includes(tab);
  const activeTab = TABS.find(t => t.id === tab);
  const hasSubTabs = activeTab?.subTabs?.length > 0;
  const renderTab = hasSubTabs ? (subTab || activeTab.subTabs[0].id) : tab;

  const handleTabChange = (t) => {
    setTab(t);
    const at = TABS.find(x => x.id === t);
    setSubTab(at?.subTabs?.[0]?.id || null);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Users}
        title="People & Team Management"
        subtitle="Manage crew members, timesheets, clients, subcontractors and suppliers"
      />
      <MissingRatesBanner />

      {/* Staff KPI Bar — workforce overview */}
      {staffStats.total > 0 && (
        <HubStatsBar tiles={[
          { icon: Users, label: 'Total People', value: staffStats.total, sublabel: 'All records', color: 'brand' },
          { icon: UserCheck, label: 'Active', value: staffStats.active, sublabel: 'Currently employed', color: 'emerald' },
          { icon: HardHat, label: 'Subcontractors', value: staffStats.subcontractors, sublabel: 'External crews', color: 'amber' },
          { icon: UsersRound, label: 'Agency', value: staffStats.agency, sublabel: 'Temp labour', color: 'blue' },
        ]} />
      )}

      {tab === 'directory' && (
        <StaffDirectoryGrid onSelect={(s) => navigate('/admin', { state: { section: 'staff-detail', staff: s } })} />
      )}
      {tab === 'cost-analytics' && <StaffCostAnalytics />}
      {tab === 'utilization' && (
        <StaffUtilizationWidget onNavigate={(section) => navigate('/admin', { state: { section } })} />
      )}

      {!isStandaloneView && (
        <>
          <TabBar tabs={TABS} activeTab={tab} onChange={handleTabChange} />

          {hasSubTabs && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeTab.subTabs.map(st => (
                <button
                  key={st.id}
                  onClick={() => setSubTab(st.id)}
                  className={'px-3 py-1.5 rounded-lg text-xs font-semibold transition ' +
                    (renderTab === st.id
                      ? 'bg-[#2E5A1A] text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}
                >
                  {st.label}
                </button>
              ))}
            </div>
          )}

          {tab === 'training' ? (
            <TrainingMatrixHub />
          ) : (
            <SettingsPage
              key={renderTab}
              initialTab={renderTab}
              standalone
              onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })}
            />
          )}
        </>
      )}
    </div>
  );
}