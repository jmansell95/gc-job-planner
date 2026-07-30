import React from 'react';
import { Phone, X, Wrench, ShieldCheck, Truck } from 'lucide-react';

// Centralised list of useful fleet numbers. Holman covers breakdowns,
// windscreens, MOTs, services and general maintenance.
const USEFUL_NUMBERS = [
  {
    label: 'Holman Fleet Support',
    number: '0344 800 5626',
    description: 'Breakdowns, windscreen repairs, MOTs, servicing & all vehicle maintenance.',
    icon: Wrench,
    accent: 'bg-[#2E5A1A]',
  },
  {
    label: 'Holman Breakdown Recovery',
    number: '0344 800 5626',
    description: 'Roadside assistance & vehicle recovery — same line, option 1.',
    icon: Truck,
    accent: 'bg-blue-600',
  },
  {
    label: 'Holman Windscreen & Glass',
    number: '0344 800 5626',
    description: 'Windscreen chip repair & replacement — same line, option 2.',
    icon: ShieldCheck,
    accent: 'bg-violet-600',
  },
];

export default function UsefulNumbersModal({ open, onClose, onLogBooking }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom">
        {/* Header */}
        <div className="hero-gradient text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Useful Numbers</h3>
              <p className="text-white/70 text-xs">Tap a number to call</p>
            </div>
          </div>
          <button onClick={onClose} type="button" aria-label="Close"
            className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Numbers */}
        <div className="p-4 space-y-3">
          {USEFUL_NUMBERS.map((n) => {
            const Icon = n.icon;
            const tel = n.number.replace(/\s/g, '');
            return (
              <a key={n.label} href={`tel:${tel}`} type="button"
                className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-[#2E5A1A]/40 hover:shadow-md transition group">
                <div className={`w-11 h-11 rounded-xl ${n.accent} text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{n.label}</p>
                  <p className="text-xs text-slate-500 leading-snug">{n.description}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="font-mono font-bold text-[#2E5A1A] text-sm">{n.number}</span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                    <Phone className="w-2.5 h-2.5" /> Call
                  </span>
                </div>
              </a>
            );
          })}
        </div>

        {/* Footer action — log the call afterwards */}
        {onLogBooking && (
          <div className="px-4 pb-4">
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