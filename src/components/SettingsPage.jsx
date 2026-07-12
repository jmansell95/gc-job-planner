import React, { useState, useEffect } from 'react';
import { Settings, Menu } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StaffManager from '@/components/StaffManager';
import VehicleManager from '@/components/VehicleManager';
import ContractorManager from '@/components/ContractorManager';
import ClientManager from '@/components/ClientManager';
import AbsenceManager from '@/components/AbsenceManager';
import EmailAlertsSettings from '@/components/EmailAlertsSettings';
import GlobalBrandingSettings from '@/components/GlobalBrandingSettings';
import CostSettings from '@/components/CostSettings';
import SupplierManager from '@/components/SupplierManager';
import OvertimeRatesManager from '@/components/OvertimeRatesManager';
import AutomationCenter from '@/components/AutomationCenter';
import JobTypeManager from '@/components/JobTypeManager';
import SiteAssetManager from '@/components/SiteAssetManager';
import BillingRulesManager from '@/components/BillingRulesManager';
import CostPresetManager from '@/components/CostPresetManager';
import SettingsNav, { allSettingsItems } from '@/components/SettingsNav';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export default function SettingsPage({ initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'staff');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);

  const active = allSettingsItems.find(t => t.id === activeTab);
  const Icon = active?.icon;

  const handleSelect = (id) => {
    setActiveTab(id);
    setMobileNavOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'staff': return <StaffManager />;
      case 'vehicles': return <VehicleManager />;
      case 'clients': return <ClientManager />;
      case 'contractors': return <ContractorManager />;
      case 'suppliers': return <SupplierManager />;
      case 'absences': return <AbsenceManager />;
      case 'costs': return <CostSettings />;
      case 'overtime': return <OvertimeRatesManager />;
      case 'email-alerts': return <EmailAlertsSettings />;
      case 'global-branding': return <GlobalBrandingSettings />;
      case 'automations': return <AutomationCenter />;
      case 'job-types': return <JobTypeManager />;
      case 'assets': return <SiteAssetManager />;
      case 'billing': return <BillingRulesManager />;
      case 'presets': return <CostPresetManager />;
      default: return null;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <PageHeader title="Settings" icon={Settings} />
        <button onClick={() => setMobileNavOpen(true)} className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-sm">
          <Menu className="w-4 h-4" />
          Sections
        </button>
      </div>

      <div className="flex gap-6 items-start">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-4 bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <SettingsNav activeId={activeTab} onChange={handleSelect} />
          </div>
        </aside>

        {/* Mobile drawer */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-80 max-w-[85vw] p-4 overflow-y-auto">
            <SheetHeader className="mb-3">
              <SheetTitle className="text-left">Settings</SheetTitle>
            </SheetHeader>
            <SettingsNav activeId={activeTab} onChange={handleSelect} />
          </SheetContent>
        </Sheet>

        {/* Content */}
        <div className="flex-1 min-w-0">
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
      </div>
    </div>
  );
}