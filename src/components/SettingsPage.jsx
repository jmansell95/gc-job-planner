import React, { useState, useEffect } from 'react';
import { Settings, Users, Truck, HardHat, Building2, CalendarX, Mail, PoundSterling, Package, Timer, Zap, Tag, Wrench, Banknote } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PillTabs from '@/components/PillTabs';
import StaffManager from '@/components/StaffManager';
import VehicleManager from '@/components/VehicleManager';
import ContractorManager from '@/components/ContractorManager';
import ClientManager from '@/components/ClientManager';
import AbsenceManager from '@/components/AbsenceManager';
import EmailAlertsSettings from '@/components/EmailAlertsSettings';
import CostSettings from '@/components/CostSettings';
import SupplierManager from '@/components/SupplierManager';
import OvertimeRatesManager from '@/components/OvertimeRatesManager';
import AutomationCenter from '@/components/AutomationCenter';
import JobTypeManager from '@/components/JobTypeManager';
import SiteAssetManager from '@/components/SiteAssetManager';
import BillingRulesManager from '@/components/BillingRulesManager';

const tabs = [
  { id: 'staff', label: 'Crew', icon: Users },
  { id: 'vehicles', label: 'Vehicles', icon: Truck },
  { id: 'clients', label: 'Clients', icon: Building2 },
  { id: 'contractors', label: 'Contractors', icon: HardHat },
  { id: 'suppliers', label: 'Suppliers', icon: Package },
  { id: 'absences', label: 'Absences', icon: CalendarX },
  { id: 'costs', label: 'Costs', icon: PoundSterling },
  { id: 'overtime', label: 'Overtime', icon: Timer },
  { id: 'email-alerts', label: 'Email Alerts', icon: Mail },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'assets', label: 'Assets', icon: Wrench },
  { id: 'job-types', label: 'Job Types', icon: Tag },
  { id: 'billing', label: 'Billing Rules', icon: Banknote },
];

const tabDescriptions = {
  staff: 'Manage crew, app access and shift times',
  vehicles: 'Track vehicles, MOTs and service dates',
  clients: 'Manage client contacts',
  contractors: 'Manage contractor contacts',
  suppliers: 'Manage hire & purchase suppliers',
  absences: 'Approve leave and recurring days off',
  costs: 'Overtime thresholds and markup defaults',
  overtime: 'Overtime multipliers by day',
  'email-alerts': 'Configure automated email alerts',
  automations: 'View and toggle background automations',
  'job-types': 'Manage job types and colours',
  assets: 'Rigs, machinery & trailers — linked to GC Compliance Manager',
  billing: 'Delivery, task & consumable pricing rules',
};

export default function SettingsPage({ initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'staff');
  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);
  const active = tabs.find(t => t.id === activeTab);

  return (
    <div>
      <PageHeader title="Settings" icon={Settings} />

      <PillTabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />

      <p className="text-sm text-slate-500 mb-5 -mt-2">{active?.description}</p>

      {activeTab === 'staff' && <StaffManager />}
      {activeTab === 'vehicles' && <VehicleManager />}
      {activeTab === 'clients' && <ClientManager />}
      {activeTab === 'contractors' && <ContractorManager />}
      {activeTab === 'suppliers' && <SupplierManager />}
      {activeTab === 'absences' && <AbsenceManager />}
      {activeTab === 'costs' && <CostSettings />}
      {activeTab === 'overtime' && <OvertimeRatesManager />}
      {activeTab === 'email-alerts' && <EmailAlertsSettings />}
      {activeTab === 'automations' && <AutomationCenter />}
      {activeTab === 'job-types' && <JobTypeManager />}
      {activeTab === 'assets' && <SiteAssetManager />}
      {activeTab === 'billing' && <BillingRulesManager />}
    </div>
  );
}