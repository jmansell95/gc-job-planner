import React from 'react';
import { X, ArrowLeft } from 'lucide-react';
import GeotabSettings from '@/components/settings/GeotabSettings';
import HolmanSettings from '@/components/settings/HolmanSettings';
import AssetPandaSettings from '@/components/AssetPandaSettings';
import AGSImportSettings from '@/components/AGSImportSettings';
import OpenGroundSettings from '@/components/settings/OpenGroundSettings';
import BobHRSettings from '@/components/settings/BobHRSettings';
import ConcurSyncSettings from '@/components/settings/ConcurSyncSettings';
import SafetyCultureSettings from '@/components/SafetyCultureSettings';
import CISSettings from '@/components/settings/CISSettings';
import PayrollExportSettings from '@/components/settings/PayrollExportSettings';
import ZapierWebhookSettings from '@/components/settings/ZapierWebhookSettings';
import MetOfficeSettings from '@/components/settings/MetOfficeSettings';
import GoogleMapsSettings from '@/components/settings/GoogleMapsSettings';
import WhatsAppSettings from '@/components/settings/WhatsAppSettings';
import AccountingSyncSettings from '@/components/settings/AccountingSyncSettings';
import PaymentGatewaySettings from '@/components/settings/PaymentGatewaySettings';
import Microsoft365Hub from '@/components/settings/Microsoft365Hub';

const COMPONENT_MAP = {
  'geotab-sync': { comp: GeotabSettings, name: 'Geotab GPS' },
  'holman-sync': { comp: HolmanSettings, name: 'Holman Fleet' },
  'asset-panda': { comp: AssetPandaSettings, name: 'Asset Panda' },
  'ags-import': { comp: AGSImportSettings, name: 'KeyLogBook' },
  'openground-sync': { comp: OpenGroundSettings, name: 'OpenGround' },
  'bob-hr': { comp: BobHRSettings, name: 'Bob HR (Hibob)' },
  'concur-sync': { comp: ConcurSyncSettings, name: 'SAP Concur' },
  'safety-culture': { comp: SafetyCultureSettings, name: 'SafetyCulture' },
  'cis-verification': { comp: CISSettings, name: 'HMRC CIS' },
  'payroll-export': { comp: PayrollExportSettings, name: 'Payroll Export' },
  'zapier-webhooks': { comp: ZapierWebhookSettings, name: 'Zapier / Make Webhooks' },
  'met-office': { comp: MetOfficeSettings, name: 'Met Office Weather' },
  'google-maps': { comp: GoogleMapsSettings, name: 'Google Maps' },
  'whatsapp': { comp: WhatsAppSettings, name: 'WhatsApp Business' },
  'accounting-sync': { comp: AccountingSyncSettings, name: 'Xero / Sage' },
  'payment-gateway': { comp: PaymentGatewaySettings, name: 'Stripe Payments' },
  'microsoft-365': { comp: Microsoft365Hub, name: 'Microsoft 365' },
};

export default function IntegrationConfigDrawer({ integrationId, onClose }) {
  if (!integrationId) return null;
  const entry = COMPONENT_MAP[integrationId];
  if (!entry) return null;

  const SettingsComp = entry.comp;

  return (
    <div className="fixed inset-0 z-[70] bg-blue-950/60 backdrop-blur-md flex items-stretch sm:items-center sm:justify-end sm:p-4" onClick={onClose}>
      <div
        className="bg-white shadow-2xl w-full sm:max-w-3xl h-full sm:h-[calc(100dvh-2rem)] sm:rounded-2xl overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center gap-3 z-10">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <h3 className="text-base font-extrabold text-slate-900 flex-1 truncate">{entry.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition flex-shrink-0">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-5">
          <SettingsComp />
        </div>
      </div>
    </div>
  );
}