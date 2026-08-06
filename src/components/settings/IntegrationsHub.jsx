import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Database, Satellite, Radio, Users, Landmark, ShieldAlert, FileUp,
  ShieldCheck, FileSpreadsheet, Cloud, MapPin, MessageCircle, CreditCard,
  Link2, Link2Off, ArrowRight, Loader2, Search,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10";

// All integrations in the platform — existing + new. Each links to its
// dedicated settings page where the admin enters API keys & webhooks.
const INTEGRATIONS = [
  // --- Existing (already have settings pages) ---
  { id: 'geotab-sync', name: 'Geotab GPS', category: 'Fleet & Vehicles', icon: Satellite, color: 'bg-blue-100 text-blue-600', settingKey: 'geotab_config', connectedField: 'username', desc: 'Live vehicle locations, speed, ignition & odometer via Geotab API + webhook' },
  { id: 'holman-sync', name: 'Holman Fleet', category: 'Fleet & Vehicles', icon: Radio, color: 'bg-cyan-100 text-cyan-600', settingKey: 'holman_config', connectedField: 'api_key', desc: 'MOT, service dates & mileage from Holman fleet management' },
  { id: 'dvla-ves', name: 'DVLA Vehicle Enquiry', category: 'Fleet & Vehicles', icon: Search, color: 'bg-violet-100 text-violet-600', settingKey: 'dvla_ves_config', connectedField: 'api_key', desc: 'Official DVLA APIs — make, model, MOT status + full test history, tax status, colour & emissions by registration plate' },
  { id: 'asset-panda', name: 'Asset Panda', category: 'Assets & Inventory', icon: Database, color: 'bg-emerald-100 text-emerald-600', settingKey: 'asset_panda_config', connectedField: 'token', desc: 'Live stock levels, warehouse locations & asset matching' },
  { id: 'bob-hr', name: 'Bob HR (Hibob)', category: 'People & HR', icon: Users, color: 'bg-violet-100 text-violet-600', settingKey: 'bob_hr_config', connectedField: 'username', desc: 'Bidirectional time-off sync with Bob HR + webhook receiver' },
  { id: 'concur-sync', name: 'SAP Concur', category: 'Finance', icon: Landmark, color: 'bg-indigo-100 text-indigo-600', settingKey: 'concur_config', connectedField: 'client_id', desc: 'Push approved expenses & timesheets, pull GL codes, lock synced records' },
  { id: 'safety-culture', name: 'SafetyCulture', category: 'Safety & Compliance', icon: ShieldAlert, color: 'bg-rose-100 text-rose-600', settingKey: 'safety_culture_config', connectedField: 'api_token', desc: 'Sync site safety audits & inspection forms from iAuditor' },
  { id: 'ags-import', name: 'KeyLogBook', category: 'Geotechnical Data', icon: FileUp, color: 'bg-amber-100 text-amber-600', settingKey: 'keylogbook_config', connectedField: 'webhook_secret', desc: 'Real-time borehole & AGS data from KeyLogBook webhook' },
  { id: 'cis-verification', name: 'HMRC CIS', category: 'Finance', icon: ShieldCheck, color: 'bg-teal-100 text-teal-600', settingKey: 'cis_config', connectedField: 'api_key', desc: 'Verify subcontractors against HMRC CIS register' },
  { id: 'payroll-export', name: 'Payroll Export', category: 'Finance', icon: FileSpreadsheet, color: 'bg-slate-100 text-slate-600', settingKey: 'payroll_config', connectedField: 'provider', desc: 'Export approved weekly timesheets to Sage / Xero / CSV' },
  // --- New (roadmap integrations) ---
  { id: 'met-office', name: 'Met Office Weather', category: 'Operations', icon: Cloud, color: 'bg-sky-100 text-sky-600', settingKey: 'met_office_config', connectedField: 'api_key', desc: 'Daily weather data per site postcode — flag weather-delayed days', isNew: true },
  { id: 'google-maps', name: 'Google Maps', category: 'Operations', icon: MapPin, color: 'bg-red-100 text-red-600', settingKey: 'google_maps_config', connectedField: 'api_key', desc: 'Geocoding for job sites + travel route optimisation', isNew: true },
  { id: 'whatsapp', name: 'WhatsApp Business', category: 'Communication', icon: MessageCircle, color: 'bg-green-100 text-green-600', settingKey: 'whatsapp_config', connectedField: 'api_token', desc: 'Push critical alerts to crew via WhatsApp Business API', isNew: true },
  { id: 'accounting-sync', name: 'Xero / Sage', category: 'Finance', icon: FileSpreadsheet, color: 'bg-purple-100 text-purple-600', settingKey: 'accounting_config', connectedField: 'provider', desc: 'Push invoices & purchase costs to Xero or Sage accounting', isNew: true },
  { id: 'payment-gateway', name: 'Stripe Payments', category: 'Finance', icon: CreditCard, color: 'bg-indigo-100 text-indigo-600', settingKey: 'stripe_config', connectedField: 'secret_key', desc: 'Accept client invoice payments via Stripe in the client portal', isNew: true },
];

export default function IntegrationsHub({ onNavigate }) {
  const [configStatus, setConfigStatus] = useState({});

  // Batch-fetch all AppSetting records to determine connection status
  const { data: allSettings = [] } = useQuery({
    queryKey: ['all-integration-configs'],
    queryFn: () => base44.entities.AppSetting.filter({
      key: { $in: INTEGRATIONS.map(i => i.settingKey) },
    }, '-created_date', 50),
  });

  useEffect(() => {
    const status = {};
    for (const setting of allSettings) {
      status[setting.key] = setting.value || {};
    }
    setConfigStatus(status);
  }, [allSettings]);

  const isConnected = (integ) => {
    const cfg = configStatus[integ.settingKey];
    if (!cfg) return false;
    return !!(cfg[integ.connectedField]);
  };

  const connectedCount = INTEGRATIONS.filter(isConnected).length;
  const newCount = INTEGRATIONS.filter(i => i.isNew).length;

  // Group by category
  const categories = [...new Set(INTEGRATIONS.map(i => i.category))];
  const grouped = categories.map(cat => ({
    category: cat,
    items: INTEGRATIONS.filter(i => i.category === cat),
  }));

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Link2}
        title="Integrations Hub"
        description={`All external system connections in one place. ${connectedCount} of ${INTEGRATIONS.length} integrations configured. Enter API keys and webhook details when you're ready to link each service — nothing syncs until you save credentials and hit the sync button.`}
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">{connectedCount}</p>
          <p className="text-[11px] text-slate-400 uppercase font-medium">Connected</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-400 tabular-nums">{INTEGRATIONS.length - connectedCount}</p>
          <p className="text-[11px] text-slate-400 uppercase font-medium">Not Connected</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-600 tabular-nums">{newCount}</p>
          <p className="text-[11px] text-slate-400 uppercase font-medium">New (Roadmap)</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-600 tabular-nums">{INTEGRATIONS.length}</p>
          <p className="text-[11px] text-slate-400 uppercase font-medium">Total</p>
        </div>
      </div>

      {/* Integration cards grouped by category */}
      {grouped.map(group => (
        <div key={group.category}>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">{group.category}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map(integ => {
              const Icon = integ.icon;
              const connected = isConnected(integ);
              return (
                <button
                  key={integ.id}
                  onClick={() => onNavigate?.(integ.id)}
                  className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-[#2E5A1A] hover:shadow-md transition group"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${integ.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-slate-800 truncate">{integ.name}</p>
                        {integ.isNew && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase">New</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{integ.desc}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        {connected ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <Link2 className="w-3 h-3" /> Configured
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                            <Link2Off className="w-3 h-3" /> Not Connected
                          </span>
                        )}
                        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-[#2E5A1A] ml-auto transition" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}