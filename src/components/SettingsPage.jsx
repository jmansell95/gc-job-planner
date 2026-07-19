import React, { useState, useEffect } from 'react';
import { Settings, Menu, ChevronDown } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StaffManager from '@/components/StaffManager';
import VehicleManager from '@/components/VehicleManager';
import ContractorManager from '@/components/ContractorManager';
import ClientManager from '@/components/ClientManager';
import AbsenceManager from '@/components/AbsenceManager';
import EmailAlertsSettings from '@/components/EmailAlertsSettings';
import GlobalBrandingSettings from '@/components/GlobalBrandingSettings';
import SupplierManager from '@/components/SupplierManager';
import OvertimeRatesManager from '@/components/OvertimeRatesManager';
import AutomationCenter from '@/components/AutomationCenter';
import JobTypeManager from '@/components/JobTypeManager';
import SiteAssetManager from '@/components/SiteAssetManager';
import BillingRulesManager from '@/components/BillingRulesManager';
import EquipmentLibraryManager from '@/components/EquipmentLibraryManager';
import TeamManager from '@/components/TeamManager';
import AssetPandaSettings from '@/components/AssetPandaSettings';
import RateCardManager from '@/components/RateCardManager';
import DropdownConfigManager from '@/components/DropdownConfigManager';
import SettingsHubOverview from '@/components/SettingsHubOverview';
import SettingsNav, { allSettingsItems } from '@/components/SettingsNav';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export default function SettingsPage({ initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'hub');
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);

  const active = allSettingsItems.find(t => t.id === activeTab);
  const Icon = active?.icon;

  const handleSelect = (id) => {
    setActiveTab(id);
    setNavOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'hub': return <SettingsHubOverview onNavigate={setActiveTab} />;
      case 'staff': return <StaffManager />;
      case 'teams': return <TeamManager />;
      case 'asset-panda': return <AssetPandaSettings />;
      case 'vehicles': return <VehicleManager />;
      case 'clients': return <ClientManager />;
      case 'contractors': return <ContractorManager />;
      case 'suppliers': return <SupplierManager />;
      case 'absences': return <AbsenceManager />;
      case 'overtime': return <OvertimeRatesManager />;
      case 'email-alerts': return <EmailAlertsSettings />;
      case 'global-branding': return <GlobalBrandingSettings />;
      case 'automations': return <AutomationCenter />;
      case 'job-types': return <JobTypeManager />;
      case 'dropdowns': return <DropdownConfigManager />;
      case 'assets': return <SiteAssetManager />;
      case 'rate-card': return <RateCardManager />;
      case 'billing': return <BillingRulesManager />;
      case 'equipment-library': return <EquipmentLibraryManager />;
      default: return null;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <PageHeader title="Settings" icon={Settings} />
        <button onClick={() => setNavOpen(true)}
          className="flex items-center gap-2.5 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-emerald-300 transition">
          <Menu className="w-4 h-4 text-emerald-700" />
          <span>{active?.label || 'All Settings'}</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-80 max-w-[85vw] p-4 overflow-y-auto">
          <SheetHeader className="mb-3">
            <SheetTitle className="text-left">Settings Menu</SheetTitle>
          </SheetHeader>
          <SettingsNav activeId={activeTab} onChange={handleSelect} />
        </SheetContent>
      </Sheet>

      {active && (
        <div className="flex items-center gap-2 mb-4">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-emerald-700" />
            </div>
          )}
          <p className="text-sm text-slate-500">{active.desc}</p>
        </div>
      )}
      {renderContent()}
    </div>
  );
}