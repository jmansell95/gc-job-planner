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
import SettingsNav, { accessibleSettingsItems } from '@/components/SettingsNav';
import ComplianceManager from '@/components/ComplianceManager';
import LogQualityControl from '@/components/investigation/LogQualityControl';
import TimesheetManager from '@/components/TimesheetManager';
import BillingPage from '@/components/BillingPage';
import { resolveRole } from '@/utils/access';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export default function SettingsPage({ initialTab, onSelectJob }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'hub');
  const [navOpen, setNavOpen] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  const role = resolveRole(profile) || 'admin';
  const items = accessibleSettingsItems(role);

  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);

  // Guard: if the current tab isn't accessible to this role, fall back to the first accessible tab.
  useEffect(() => {
    if (!profile || items.length === 0) return;
    if (!items.find(i => i.id === activeTab)) setActiveTab(items[0].id);
  }, [profile, role, activeTab, items]);

  const active = items.find(t => t.id === activeTab);
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
      case 'compliance': return <ComplianceManager />;
      case 'log-qc': return <LogQualityControl />;
      case 'timesheets': return <TimesheetManager />;
      case 'invoicing': return <BillingPage onSelectJob={onSelectJob} />;
      default: return null;
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        icon={Settings}
        subtitle={active?.label ? `${active.label}${active.desc ? ' · ' + active.desc : ''}` : 'Configure crews, assets, billing & automation'}
        actions={
          <button onClick={() => setNavOpen(true)}
            className="inline-flex items-center gap-2.5 px-3.5 py-2 bg-white/15 ring-1 ring-white/25 text-white rounded-lg hover:bg-white/25 transition text-sm font-medium backdrop-blur-sm">
            <Menu className="w-4 h-4" />
            <span>{active?.label || 'All Settings'}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        }
      />

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-80 max-w-[85vw] p-4 overflow-y-auto">
          <SheetHeader className="mb-3">
            <SheetTitle className="text-left">Settings Menu</SheetTitle>
          </SheetHeader>
          <SettingsNav activeId={activeTab} onChange={handleSelect} role={role} />
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