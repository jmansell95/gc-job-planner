import React, { useState, useEffect } from 'react';
import { Settings, Menu } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StaffCommand from '@/components/StaffCommand';
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
import CrewTypeCommand from '@/components/CrewTypeCommand';
import AssetPandaSettings from '@/components/AssetPandaSettings';
import RateCardManager from '@/components/RateCardManager';
import DropdownConfigManager from '@/components/DropdownConfigManager';
import SettingsHubOverview from '@/components/SettingsHubOverview';
import SettingsNav, { accessibleSettingsItems } from '@/components/SettingsNav';
import ComplianceManager from '@/components/ComplianceManager';
import LogQualityControl from '@/components/investigation/LogQualityControl';
import AuditTrailHub from '@/components/audit/AuditTrailHub';
import TimesheetManager from '@/components/TimesheetManager';
import BillingPage from '@/components/BillingPage';
import AGSImportSettings from '@/components/AGSImportSettings';
import SafetyCultureSettings from '@/components/SafetyCultureSettings';
import PermissionGroupManager from '@/components/PermissionGroupManager';
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

  useEffect(() => {
    if (!profile || items.length === 0) return;
    if (!items.find(i => i.id === activeTab)) setActiveTab(items[0].id);
  }, [profile, role, activeTab, items]);

  const active = items.find(t => t.id === activeTab);

  const handleSelect = (id) => {
    setActiveTab(id);
    setNavOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'hub': return <SettingsHubOverview onNavigate={setActiveTab} />;
      case 'staff': return <StaffCommand />;
      case 'teams': return <CrewTypeCommand />;
      case 'access-levels': return <PermissionGroupManager />;
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
      case 'audit-trail': return <AuditTrailHub />;
      case 'timesheets': return <TimesheetManager />;
      case 'invoicing': return <BillingPage onSelectJob={onSelectJob} />;
      case 'ags-import': return <AGSImportSettings />;
      case 'safety-culture': return <SafetyCultureSettings />;
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
          <button onClick={() => setNavOpen(true)} className="lg:hidden inline-flex items-center gap-2.5 px-3.5 py-2 bg-white/15 ring-1 ring-white/25 text-white rounded-lg hover:bg-white/25 transition text-sm font-medium backdrop-blur-sm">
            <Menu className="w-4 h-4" />
            <span>{active?.label || 'All Settings'}</span>
          </button>
        }
      />

      <div className="flex gap-5">
        {/* Persistent sidebar — desktop only */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-4 bg-white rounded-xl border border-slate-200 shadow-sm p-3 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <SettingsNav activeId={activeTab} onChange={handleSelect} role={role} />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>
      </div>

      {/* Mobile navigation drawer */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-80 max-w-[85vw] p-4 overflow-y-auto">
          <SheetHeader className="mb-3">
            <SheetTitle className="text-left">Settings Menu</SheetTitle>
          </SheetHeader>
          <SettingsNav activeId={activeTab} onChange={handleSelect} role={role} />
        </SheetContent>
      </Sheet>
    </div>
  );
}