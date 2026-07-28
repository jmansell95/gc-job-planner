import React from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, Clock, Calendar, Wind, Wrench, Mountain, Zap, User, Ban } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const delayTypeMeta = {
  ground_conditions: { label: 'Ground Conditions', icon: Mountain, color: 'bg-amber-100 text-amber-700' },
  utility_clash: { label: 'Utility Clash', icon: Zap, color: 'bg-orange-100 text-orange-700' },
  weather: { label: 'Weather', icon: Wind, color: 'bg-blue-100 text-blue-700' },
  mechanical_failure: { label: 'Mechanical Failure', icon: Wrench, color: 'bg-red-100 text-red-700' },
  access_issue: { label: 'Access Issue', icon: Ban, color: 'bg-purple-100 text-purple-700' },
  client_request: { label: 'Client Request', icon: User, color: 'bg-teal-100 text-teal-700' },
  third_party: { label: 'Third Party', icon: AlertTriangle, color: 'bg-slate-100 text-slate-700' },
  other: { label: 'Other', icon: AlertTriangle, color: 'bg-slate-100 text-slate-700' },
};

export default function PortalSiteStatus({ delays }) {
  if (!delays || delays.length === 0) return null;

  const totalDays = delays.reduce((sum, d) => sum + (d.impacted_days || 0), 0);
  const totalHours = delays.reduce((sum, d) => sum + (d.impacted_hours || 0), 0);
  const latest = delays[0];

  let latestDateLabel = '';
  try {
    latestDateLabel = latest.reported_at ? format(parseISO(latest.reported_at), 'dd MMM yyyy') : '';
  } catch { latestDateLabel = ''; }

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }}
      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Header — live pulse indicator */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-gradient-to-r from-amber-50 to-white">
        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
          <Activity className="w-4 h-4" />
        </div>
        <h2 className="font-semibold text-slate-900">Live Site Status</h2>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Updated
        </span>
      </div>

      {/* Impact summary — total delay to the project timeline */}
      <div className="px-5 py-4 bg-amber-50/40 border-b border-slate-100">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-2xl font-bold text-amber-700 leading-tight">
                {totalDays > 0 ? `+${totalDays} day${totalDays !== 1 ? 's' : ''}` : ''}
                {totalHours > 0 ? ` ${totalHours}h` : ''}
                {totalDays === 0 && totalHours === 0 ? 'Minor impact' : ''}
              </p>
              <p className="text-xs text-amber-600/80">Cumulative schedule impact</p>
            </div>
          </div>
          {latestDateLabel && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              Latest: {latestDateLabel}
            </div>
          )}
        </div>
      </div>

      {/* Delay event feed */}
      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
        {delays.map((d, i) => {
          const meta = delayTypeMeta[d.delay_type] || delayTypeMeta.other;
          const Icon = meta.icon;
          const impactLabel = [
            d.impacted_days > 0 ? `${d.impacted_days}d` : '',
            d.impacted_hours > 0 ? `${d.impacted_hours}h` : '',
          ].filter(Boolean).join(' ') || 'Tracked';

          let dateLabel = '';
          try {
            dateLabel = d.reported_at ? format(parseISO(d.reported_at), 'dd MMM') : '';
          } catch { dateLabel = ''; }

          return (
            <div key={i} className="px-5 py-3.5 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">{impactLabel}</span>
                </div>
                <p className="text-sm text-slate-600">{d.description}</p>
                {d.staff_name && <p className="text-xs text-slate-400 mt-1">Reported by {d.staff_name}{dateLabel ? ` · ${dateLabel}` : ''}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Your project manager is actively managing these impacts. The above reflects approved adjustments to the work schedule.
        </p>
      </div>
    </motion.div>
  );
}