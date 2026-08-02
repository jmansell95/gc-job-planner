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
import BusinessConfigManager from '@/components/BusinessConfigManager';
import AutomationCenter from '@/components/AutomationCenter';
import JobTypeManager from '@/components/JobTypeManager';
import BillingRulesManager from '@/components/BillingRulesManager';
import EquipmentLibraryManager from '@/components/EquipmentLibraryManager';
import CrewTypeCommand from '@/components/CrewTypeCommand';
import AssetPandaSettings from '@/components/AssetPandaSettings';
import AssetManifestManager from '@/components/assetpanda/AssetManifestManager';
import RateCardManager from '@/components/RateCardManager';
import DropdownConfigManager from '@/components/DropdownConfigManager';
import SettingsHubOverview from '@/components/SettingsHubOverview';
import SettingsNav, { accessibleSettingsItems } from '@/components/SettingsNav';
import ComplianceManager from '@/components/ComplianceManager';
import ComplianceRulesSettings from '@/components/ComplianceRulesSettings';
import LogQualityControl from '@/components/investigation/LogQualityControl';
import AuditTrailHub from '@/components/audit/AuditTrailHub';
import TimesheetManager from '@/components/TimesheetManager';
import BillingPage from '@/components/BillingPage';
import FinancialDataExchange from '@/components/billing/FinancialDataExchange';
import AGSImportSettings from '@/components/AGSImportSettings';
import SafetyCultureSettings from '@/components/SafetyCultureSettings';
import DemoDataManager from '@/components/DemoDataManager';
import SystemLogicGuide from '@/components/SystemLogicGuide';
import PermissionGroupManager from '@/components/PermissionGroupManager';
import ExpensePresetManager from '@/components/settings/ExpensePresetManager';
import ConcurSyncSettings from '@/components/settings/ConcurSyncSettings';
import SubconMarkupRules from '@/components/settings/SubconMarkupRules';
import GLCodeMapping from '@/components/settings/GLCodeMapping';
import BillingContractManager from '@/components/settings/BillingContractManager';
import FinancialAuditLogViewer from '@/components/settings/FinancialAuditLogViewer';
import BobHRSettings from '@/components/settings/BobHRSettings';
import PayrollExportSettings from '@/components/settings/PayrollExportSettings';
import CISSettings from '@/components/settings/CISSettings';
import HolmanSettings from '@/components/settings/HolmanSettings';
import GeotabSettings from '@/components/settings/GeotabSettings';
import JobAlertSettings from '@/components/settings/JobAlertSettings';
import SettingsAccessGuard from '@/components/settings/SettingsAccessGuard';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import ErrorBoundary from '@/components/ErrorBoundary';
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
  const { lockdownMap, isPageAccessible, isLoading: lockdownLoading } = useSettingsAccess();

  // Filter nav items by both the existing role-based access AND the lockdown config.
  const items = accessibleSettingsItems(role, profile).filter(i => isPageAccessible(i.id, role));

  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);

  useEffect(() => {
    if (!profile || items.length === 0 || lockdownLoading) return;
    if (!items.find(i => i.id === activeTab)) setActiveTab(items[0].id);
  }, [profile, role, activeTab, items, lockdownLoading]);

  const active = items.find(t => t.id === activeTab);
  const activeLockdown = active ? lockdownMap[active.id] : null;
  const isLockedOut = active && activeLockdown?.locked && !isPageAccessible(active.id, role);

  const handleSelect = (id) => {
    setActiveTab(id);
    setNavOpen(false);
  };

  const renderContent = () => {
    // If this page is locked down and the user doesn't have access, show the guard.
    if (isLockedOut) {
      return <SettingsAccessGuard pageLabel={active.label} lockedBy={activeLockdown.lockedBy} lockedAt={activeLockdown.lockedAt} />;
    }
   
    switch (activeTab) {
      case 'hub': return <SettingsHubOverview onNavigate={setActiveTab} />;
      case 'staff': return <StaffCommand />;
      case 'teams': return <CrewTypeCommand />;
      case 'access-levels': return <PermissionGroupManager profile={profile} />;
      case 'asset-panda': return <AssetPandaSettings />;
      case 'asset-manifests': return <AssetManifestManager />;
      case 'vehicles': return <VehicleManager />;
      case 'clients': return <ClientManager />;
      case 'contractors': return <ContractorManager />;
      case 'suppliers': return <SupplierManager />;
      case 'absences': return <AbsenceManager />;
      case 'overtime': return <OvertimeRatesManager />;
      case 'business-rules': return <BusinessConfigManager />;
      case 'email-alerts': return <EmailAlertsSettings />;
      case 'global-branding': return <GlobalBrandingSettings />;
      case 'automations': return <AutomationCenter />;
      case 'job-types': return <JobTypeManager />;
      case 'dropdowns': return <DropdownConfigManager />;
      case 'rate-card': return <RateCardManager />;
      case 'billing': return <BillingRulesManager />;
      case 'equipment-library': return <EquipmentLibraryManager />;
      case 'compliance': return <ComplianceManager />;
      case 'compliance-rules': return <ComplianceRulesSettings />;
      case 'log-qc': return <LogQualityControl />;
      case 'audit-trail': return <AuditTrailHub />;
      case 'timesheets': return <TimesheetManager />;
      case 'invoicing': return <BillingPage onSelectJob={onSelectJob} />;
      case 'data-exchange': return <FinancialDataExchange />;
      case 'ags-import': return <AGSImportSettings />;
      case 'safety-culture': return <SafetyCultureSettings />;
      case 'demo-data': return <DemoDataManager />;
      case 'system-guide': return <SystemLogicGuide />;
      case 'expense-presets': return <ExpensePresetManager />;
      case 'concur-sync': return <ConcurSyncSettings />;
      case 'subcon-markup': return <SubconMarkupRules />;
      case 'gl-mapping': return <GLCodeMapping />;
      case 'billing-contracts': return <BillingContractManager />;
      case 'financial-audit': return <FinancialAuditLogViewer />;
      case 'bob-hr': return <BobHRSettings />;
      case 'payroll-export': return <PayrollExportSettings />;
      case 'cis-verification': return <CISSettings />;
      case 'job-alerts': return <JobAlertSettings />;
      case 'holman-sync': return <HolmanSettings />;
      case 'geotab-sync': return <GeotabSettings />;
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
            <SettingsNav activeId={activeTab} onChange={handleSelect} role={role} lockdownMap={lockdownMap} profile={profile} />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <ErrorBoundary key={activeTab}>
            {renderContent()}
          </ErrorBoundary>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-80 max-w-[85vw] p-4 overflow-y-auto">
          <SheetHeader className="mb-3">
            <SheetTitle className="text-left">Settings Menu</SheetTitle>
          </SheetHeader>
          <SettingsNav activeId={activeTab} onChange={handleSelect} role={role} lockdownMap={lockdownMap} profile={profile} />
        </SheetContent>
      </Sheet>
    </div>
  );
}