import React, { useState } from 'react';
import { Settings, Users, Truck, HardHat, Building2, CalendarX, Mail, PoundSterling, Package, Timer, Zap } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
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

const tabs = [
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'vehicles', label: 'Vehicles', icon: Truck },
  { id: 'clients', label: 'Clients', icon: Building2 },
  { id: 'contractors', label: 'Contractors', icon: HardHat },
  { id: 'suppliers', label: 'Suppliers', icon: Package },
  { id: 'absences', label: 'Absences', icon: CalendarX },
  { id: 'costs', label: 'Costs', icon: PoundSterling },
  { id: 'overtime', label: 'Overtime', icon: Timer },
  { id: 'email-alerts', label: 'Email Alerts', icon: Mail },
  { id: 'automations', label: 'Automations', icon: Zap },
];

const tabDescriptions = {
  staff: 'Manage staff, app access and shift times',
  vehicles: 'Track vehicles, MOTs and service dates',
  clients: 'Manage client contacts',
  contractors: 'Manage contractor contacts',
  suppliers: 'Manage hire & purchase suppliers',
  absences: 'Approve leave and recurring days off',
  costs: 'Overtime thresholds and markup defaults',
  overtime: 'Overtime multipliers by day',
  'email-alerts': 'Configure automated email alerts',
  automations: 'View and toggle background automations',
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('staff');
  const active = tabs.find(t => t.id === activeTab);

  return (
    <div>
      <PageHeader title="Settings" icon={Settings} />

      {/* Polished navigation bar */}
      <div className="sticky top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 mb-6 pt-1">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/70 shadow-sm p-1.5">
          <div className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition flex-shrink-0 whitespace-nowrap border active:scale-[0.97] ${
                    isActive
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm shadow-emerald-200/60'
                      : 'bg-transparent text-slate-600 border-transparent hover:border-emerald-300 hover:text-emerald-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
    </div>
  );
}