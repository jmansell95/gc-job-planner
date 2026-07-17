import React from 'react';
import { ShieldCheck, Clock, Hotel, CheckCircle2, AlertTriangle, Ruler } from 'lucide-react';
import { format } from 'date-fns';

const chipBase = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap';

// Gap in minutes between two HH:MM times
function gapMinutes(endTime, startTime) {
  if (!endTime || !startTime) return null;
  const [eh, em] = endTime.split(':').map(Number);
  const [sh, sm] = startTime.split(':').map(Number);
  return sh * 60 + sm - (eh * 60 + em);
}

export default function TodayPrepStrip({ todaysSorted = [], jobs = [], myCompliance = [], myHotelBookings = [], staffId }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const items = [];

  // Pending briefings across today's jobs
  const pendingBriefings = todaysSorted.filter(a => (a.status || 'assigned') !== 'completed' && !a.briefing_signed).length;
  if (pendingBriefings > 0) {
    items.push({ icon: ShieldCheck, label: `${pendingBriefings} briefing${pendingBriefings > 1 ? 's' : ''} pending`, tone: 'amber' });
  }

  // Tight transitions between consecutive jobs today
  let tightGap = null;
  for (let i = 0; i < todaysSorted.length - 1; i++) {
    const gap = gapMinutes(todaysSorted[i].end_time, todaysSorted[i + 1].start_time);
    if (gap != null && gap >= 0 && gap < 30) {
      tightGap = gap;
      break;
    }
  }
  if (tightGap != null) {
    items.push({ icon: Clock, label: `Tight turnaround: ${tightGap} min gap`, tone: 'red' });
  }

  // Hotel check-in today
  const hotelToday = myHotelBookings.some(h => h.check_in_date === todayStr);
  if (hotelToday) {
    items.push({ icon: Hotel, label: 'Hotel check-in today', tone: 'blue' });
  }

  // Expiring/expired compliance (next 30 days)
  const now = new Date();
  const expiring = myCompliance.filter(c => {
    if (!c.expiry_date || c.status_override !== 'auto') return false;
    const d = new Date(c.expiry_date.length <= 7 ? c.expiry_date + '-01' : c.expiry_date + 'T00:00:00');
    const days = Math.round((d - now) / (1000 * 60 * 60 * 24));
    return days < 30;
  });
  if (expiring.length > 0) {
    items.push({ icon: AlertTriangle, label: `${expiring.length} compliance expiring`, tone: 'amber' });
  }

  // Driller meterage pending — started job with no meterage logged
  const startedNoMeterage = todaysSorted.some(a => {
    if (a.status !== 'started') return false;
    const job = jobs.find(j => j.id === a.job_id);
    const isDriller = job?.job_type === 'cp_drilling' || job?.job_type === 'rotary_drilling';
    return isDriller && (!a.meterage || a.meterage === 0);
  });
  if (startedNoMeterage) {
    items.push({ icon: Ruler, label: 'Record meterage', tone: 'amber' });
  }

  if (items.length === 0) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <p className="text-sm font-semibold text-emerald-800">All set — no prep items outstanding for today.</p>
      </div>
    );
  }

  const toneClasses = {
    amber: 'bg-amber-50 text-amber-800 border border-amber-200',
    red: 'bg-red-50 text-red-800 border border-red-200',
    blue: 'bg-blue-50 text-blue-800 border border-blue-200',
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Today's Prep</p>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <span key={i} className={`${chipBase} ${toneClasses[item.tone]}`}>
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {item.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}