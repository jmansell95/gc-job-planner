import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Phone, X, Wrench, ShieldCheck, Truck, Mail, ExternalLink, Loader2, Building2 } from 'lucide-react';

const SERVICE_LABELS = {
  mot: 'MOT', service: 'Service', breakdown: 'Breakdown', windscreen: 'Windscreen',
  tyre_repair: 'Tyre', repair: 'Repair', fuel_card: 'Fuel Card', inspection: 'Inspection', risk_master: 'Risk Master',
};

/**
 * UsefulNumbersModal — now pulls live from Supplier records flagged as
 * maintenance providers. Shows emergency mobile, technical email and portal
 * link for each provider, with click-to-call quick actions.
 */
export default function UsefulNumbersModal({ open, onClose, onLogBooking }) {
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['maintenance-providers'],
    queryFn: () => base44.entities.Supplier.filter({ is_maintenance_provider: true }),
    enabled: open,
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="hero-gradient text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Maintenance Providers</h3>
              <p className="text-white/70 text-xs">Tap to call · send alert · jump to portal</p>
            </div>
          </div>
          <button onClick={onClose} type="button" aria-label="Close"
            className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provider list */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No maintenance providers yet.</p>
              <p className="text-xs text-slate-400 mt-1">Add suppliers in Settings → Suppliers and tick "Maintenance Provider".</p>
            </div>
          ) : (
            providers.map((p) => {
              const callNumber = (p.emergency_mobile || p.contact_phone || '').replace(/\s/g, '');
              return (
                <div key={p.id} className="rounded-2xl border border-slate-200 p-3.5 hover:shadow-md transition">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-sm">{p.name}</p>
                      {p.contact_name && <p className="text-xs text-slate-500">{p.contact_name}</p>}
                      {p.maintenance_services?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {p.maintenance_services.map(s => (
                            <span key={s} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{SERVICE_LABELS[s] || s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {callNumber && (
                      <a href={`tel:${callNumber}`}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${p.emergency_mobile ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                        <Phone className="w-3.5 h-3.5" /> {p.emergency_mobile || p.contact_phone}
                      </a>
                    )}
                    {p.technical_email && (
                      <a href={`mailto:${p.technical_email}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
                        <Mail className="w-3.5 h-3.5" /> Email
                      </a>
                    )}
                    {p.portal_login_url && (
                      <a href={p.portal_login_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-violet-50 text-violet-700 hover:bg-violet-100 transition">
                        <ExternalLink className="w-3.5 h-3.5" /> Portal
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer action — log the call afterwards */}
        {onLogBooking && (
          <div className="px-4 pb-4 flex-shrink-0">
            <button onClick={() => { onClose(); onLogBooking(); }} type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">
              <Wrench className="w-4 h-4" /> Log this call as a booking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}