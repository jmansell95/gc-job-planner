import React, { useState } from 'react';
import { Settings, Users, Truck, HardHat, Building2, ChevronRight, CalendarX, Mail, PoundSterling, Package, Timer } from 'lucide-react';
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
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('staff');

  return (
    <div>
      <PageHeader title="Settings" icon={Settings} />

      {/* Tab Bar */}
      <div className="flex flex-nowrap gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 border-b border-slate-200 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition flex-shrink-0 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'staff' && <StaffManager />}
      {activeTab === 'vehicles' && <VehicleManager />}
      {activeTab === 'clients' && <ClientManager />}
      {activeTab === 'contractors' && <ContractorManager />}
      {activeTab === 'suppliers' && <SupplierManager />}
      {activeTab === 'absences' && <AbsenceManager />}
      {activeTab === 'costs' && <CostSettings />}
      {activeTab === 'overtime' && <OvertimeRatesManager />}
      {activeTab === 'email-alerts' && <EmailAlertsSettings />}
    </div>
  );
}