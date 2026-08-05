import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Settings2, CheckCircle2, AlertCircle, XCircle, Link2, Loader2, ArrowRight } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { useNavigate } from 'react-router-dom';

// Integrations / settings areas to surface as health checks on the dashboard.
// Each checks for a config record or connection state so admins see at a glance
// what's connected and what still needs setup.
const CHECKS = [
  { key: 'geotab', label: 'Geotab GPS', entity: 'AppSetting', filter: { key: 'geotab' }, settingKey: 'geotab' },
  { key: 'holman', label: 'Holman Fleet', entity: 'AppSetting', filter: { key: 'holman' }, settingKey: 'holman' },
  { key: 'asset_panda', label: 'Asset Panda', entity: 'AssetPandaConfig', filter: {} },
  { key: 'bob_hr', label: 'Bob HR Sync', entity: 'AppSetting', filter: { key: 'bob_hr' }, settingKey: 'bob_hr' },
  { key: 'safety_culture', label: 'SafetyCulture', entity: 'SafetyCultureConfig', filter: {} },
  { key: 'whatsapp', label: 'WhatsApp Business', entity: 'AppSetting', filter: { key: 'whatsapp' }, settingKey: 'whatsapp' },
  { key: 'concur', label: 'SAP Concur', entity: 'AppSetting', filter: { key: 'concur' }, settingKey: 'concur' },
  { key: 'met_office', label: 'Met Office Weather', entity: 'AppSetting', filter: { key: 'met_office' }, settingKey: 'met_office' },
  { key: 'google_maps', label: 'Google Maps', entity: 'AppSetting', filter: { key: 'google_maps' }, settingKey: 'google_maps' },
  { key: 'stripe', label: 'Stripe Payments', entity: 'AppSetting', filter: { key: 'stripe' }, settingKey: 'stripe' },
  { key: 'keylogbook', label: 'KeyLogBook', entity: 'KeyLogBookConfig', filter: {} },
  { key: 'login_branding', label: 'Login Branding', entity: 'LoginBranding', filter: {} },
  { key: 'portal_branding', label: 'Portal Branding', entity: 'PortalBranding', filter: {} },
];

export default function ConfigurationHealthWidget() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const checks = await Promise.all(CHECKS.map(async (c) => {
        try {
          const list = await base44.entities[c.entity].filter(c.filter);
          const record = list[0];
          let connected = false;
          if (record) {
            // Heuristic: a config record exists with some meaningful content
            connected = JSON.stringify(record).length > 30;
          }
          return { ...c, status: connected ? 'connected' : 'not_setup', record };
        } catch (e) {
          return { ...c, status: 'error' };
        }
      }));
      setResults(checks);
      setLoading(false);
    })();
  }, []);

  const connected = results.filter(r => r.status === 'connected').length;
  const total = results.length;

  return (
    <WidgetShell icon={Settings2} title="Configuration Health" subtitle={`${connected}/${total} integrations & settings connected`}>
      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-emerald-600 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {/* Summary bar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all" style={{ width: `${total ? (connected / total) * 100 : 0}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-500 tabular-nums">{Math.round(total ? (connected / total) * 100 : 0)}%</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
            {results.map(r => {
              const Icon = r.status === 'connected' ? CheckCircle2 : r.status === 'not_setup' ? AlertCircle : XCircle;
              const color = r.status === 'connected' ? 'text-emerald-600' : r.status === 'not_setup' ? 'text-amber-500' : 'text-rose-500';
              return (
                <div key={r.key} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-100">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                  <span className="text-xs font-medium text-slate-700 truncate flex-1">{r.label}</span>
                  <span className={`text-[10px] font-semibold uppercase ${color}`}>{r.status === 'connected' ? 'Live' : r.status === 'not_setup' ? 'Setup' : 'Error'}</span>
                </div>
              );
            })}
          </div>

          <button onClick={() => navigate('/admin?tab=settings')}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition">
            <Link2 className="w-4 h-4" /> Open Settings <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </WidgetShell>
  );
}