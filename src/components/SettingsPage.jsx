import React, { useState } from 'react';
import { Settings, Users, Truck, HardHat, Building2, ChevronRight, CalendarX } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StaffManager from '@/components/StaffManager';
import VehicleManager from '@/components/VehicleManager';
import ContractorManager from '@/components/ContractorManager';
import ClientManager from '@/components/ClientManager';
import AbsenceManager from '@/components/AbsenceManager';

const tabs = [
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'vehicles', label: 'Vehicles', icon: Truck },
  { id: 'clients', label: 'Clients', icon: Building2 },
  { id: 'contractors', label: 'Contractors', icon: HardHat },
  { id: 'absences', label: 'Absences', icon: CalendarX },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('staff');

  return (
    <div>
      <PageHeader title="Settings" icon={Settings} />

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-emerald-700 text-white'
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
      {activeTab === 'absences' && <AbsenceManager />}
    </div>
  );
}