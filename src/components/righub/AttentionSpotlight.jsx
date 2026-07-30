import React, { useMemo } from 'react';
import { Cog, Wrench, Package, Truck, Anchor, Plug, AlertTriangle, ChevronRight } from 'lucide-react';
import { daysUntil } from '@/utils/rigRollup';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };

/**
 * Horizontal scroll strip of the most urgent assets — expired, expiring soon,
 * service due, or missing compliance data. Clicking a card opens the asset.
 */
export default function AttentionSpotlight({ assets, onOpenAsset }) {
  const urgent = useMemo(() => {
    return assets.map(a => {
      const d = daysUntil(a.compliance_expiry_date);
      const sd = daysUntil(a.next_service_date);
      let urgency = -1;
      let reason = '';
      let tone = 'slate';
      if (a.compliance_status === 'expired' || (d !== null && d < 0)) {
        urgency = 1000 + Math.abs(d || 0);
        reason = d !== null && d < 0 ? `${Math.abs(d)}d overdue` : 'Expired';
        tone = 'red';
      } else if (a.compliance_status === 'expiring' || (d !== null && d <= 30)) {
        urgency = 500 - (d || 0);
        reason = `Due in ${d}d`;
        tone = 'amber';
      } else if (sd !== null && sd <= 30) {
        urgency = 300 - (sd || 0);
        reason = `Service in ${sd}d`;
        tone = 'amber';
      } else if (d === null && sd === null && a.compliance_status !== 'compliant') {
        urgency = 100;
        reason = 'No compliance data';
        tone = 'slate';
      }
      return { asset: a, urgency, reason, tone };
    })
      .filter(x => x.urgency >= 0)
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 8);
  }, [assets]);

  if (urgent.length === 0) return null;

  const cardTone = {
    red: 'border-red-200 bg-red-50/70',
    amber: 'border-amber-200 bg-amber-50/70',
    slate: 'border-slate-200 bg-white',
  };
  const iconBg = { red: 'bg-red-100 text-red-600', amber: 'bg-amber-100 text-amber-600', slate: 'bg-slate-100 text-slate-500' };
  const badgeTone = { red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700', slate: 'bg-slate-100 text-slate-600' };

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-sm">
          <AlertTriangle className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Needs Attention</h3>
        <span className="text-xs text-slate-400">{urgent.length} item{urgent.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 px-1 scroll-smooth">
        {urgent.map(({ asset, reason, tone }) => {
          const Icon = TYPE_ICON[asset.asset_type] || Wrench;
          return (
            <button key={asset.id} onClick={() => onOpenAsset(asset)}
              className={`flex-shrink-0 w-52 rounded-xl border ${cardTone[tone]} p-3 text-left hover:shadow-md transition group`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg[tone]}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-sm font-semibold text-slate-900 truncate flex-1">{asset.name}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${badgeTone[tone]}`}>
                  {reason}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}