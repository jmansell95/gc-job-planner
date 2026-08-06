import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Phone, Mail, ExternalLink, Wrench, ChevronDown, ChevronUp, Plus, Building2, Send,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const SERVICE_LABELS = {
  mot: 'MOT', service: 'Service', breakdown: 'Breakdown', windscreen: 'Windscreen',
  tyre_repair: 'Tyre', repair: 'Repair', fuel_card: 'Fuel Card', inspection: 'Inspection', risk_master: 'Risk Master',
};

/**
 * MaintenanceProviderDirectory — collapsible sidebar/section showing all
 * maintenance providers (Holman, tyre specialists, etc.) with click-to-call,
 * send-alert-email, and portal-jump quick actions.
 */
export default function MaintenanceProviderDirectory({ onBookWithProvider }) {
  const [expanded, setExpanded] = useState(true);
  const { toast } = useToast();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['maintenance-providers'],
    queryFn: () => base44.entities.Supplier.filter({ is_maintenance_provider: true }),
  });

  const handleSendAlert = (provider) => {
    if (!provider.technical_email) {
      toast({ title: 'No alert email', description: `${provider.name} has no technical email set.`, variant: 'destructive' });
      return;
    }
    const subject = `Maintenance Request — ${provider.name}`;
    const body = `A maintenance request is being raised.\n\nProvider: ${provider.name}\nAccount: ${provider.account_number || ''}\n\nPlease contact us to confirm scheduling.`;
    window.location.href = `mailto:${provider.technical_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (isLoading || providers.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 transition">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div className="text-left flex-1">
          <h3 className="text-sm font-bold text-slate-900">Provider Directory</h3>
          <p className="text-xs text-slate-500">{providers.length} maintenance provider{providers.length !== 1 ? 's' : ''} · click-to-call or send alert</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {providers.map(p => {
            const callNumber = (p.emergency_mobile || p.contact_phone || '').replace(/\s/g, '');
            return (
              <div key={p.id} className="rounded-xl border border-slate-200 p-3 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{p.name}</p>
                    {p.contact_name && <p className="text-[11px] text-slate-500 truncate">{p.contact_name}</p>}
                  </div>
                  {p.account_number && (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded flex-shrink-0">{p.account_number}</span>
                  )}
                </div>

                {/* Services badges */}
                {p.maintenance_services?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {p.maintenance_services.map(svc => (
                      <span key={svc} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700">
                        {SERVICE_LABELS[svc] || svc}
                      </span>
                    ))}
                  </div>
                )}

                {/* Quick action buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {callNumber && (
                    <a href={`tel:${callNumber}`} title={p.emergency_mobile ? 'Emergency mobile' : 'Phone'}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${p.emergency_mobile ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                      <Phone className="w-3 h-3" /> {p.emergency_mobile ? 'Emergency' : 'Call'}
                    </a>
                  )}
                  {p.technical_email && (
                    <button onClick={() => handleSendAlert(p)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
                      <Send className="w-3 h-3" /> Alert
                    </button>
                  )}
                  {p.portal_login_url && (
                    <a href={p.portal_login_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-violet-50 text-violet-700 hover:bg-violet-100 transition">
                      <ExternalLink className="w-3 h-3" /> Portal
                    </a>
                  )}
                  {onBookWithProvider && (
                    <button onClick={() => onBookWithProvider(p)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition ml-auto">
                      <Plus className="w-3 h-3" /> Book
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}