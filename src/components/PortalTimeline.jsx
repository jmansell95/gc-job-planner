import React from 'react';
import { CheckCircle2, Camera, Target, HardHat, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';

/**
 * Builds a chronological activity feed from the portal payload.
 * Events: completed milestones, completed shifts, photos added (when a date
 * is inferable from caption), and "on site today" markers.
 */
function buildEvents(data) {
  const events = [];
  const seen = new Set();

  // Completed shifts from the schedule
  if (data.schedule) {
    Object.entries(data.schedule).forEach(([date, entries]) => {
      entries.forEach((e) => {
        if (e.status === 'completed') {
          const key = `shift|${date}|${e.staff_name}`;
          if (!seen.has(key)) {
            seen.add(key);
            events.push({
              date,
              icon: HardHat,
              tone: 'emerald',
              title: `Shift completed — ${e.staff_name}`,
              meta: e.role ? e.role.replace(/_/g, ' ') : '',
              tag: e.meterage > 0 ? `${e.meterage}m drilled` : ''
            });
          }
        }
      });
    });
  }

  // Completed milestones
  if (data.milestones) {
    data.milestones.forEach((m) => {
      if (m.completed && m.completed_date) {
        const key = `ms|${m.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          events.push({
            date: m.completed_date,
            icon: Target,
            tone: 'blue',
            title: `Milestone reached — ${m.name}`,
            meta: '',
            tag: ''
          });
        }
      }
    });
  }

  // Photos (use caption date if present, otherwise skip — no reliable date)
  if (data.photos) {
    data.photos.forEach((p, i) => {
      const m = p.caption && p.caption.match(/\b(\d{1,2}[\/\- ]\d{1,2}[\/\- ]\d{2,4})\b/);
      if (m) {
        const d = new Date(m[1].replace(/[-]/g, '/'));
        if (!isNaN(d.getTime())) {
          events.push({
            date: format(d, 'yyyy-MM-dd'),
            icon: Camera,
            tone: 'amber',
            title: 'Site photo added',
            meta: p.uploaded_by ? `by ${p.uploaded_by}` : '',
            tag: p.caption ? p.caption.slice(0, 40) : ''
          });
        }
      }
    });
  }

  return events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

const toneStyles = {
  emerald: { dot: 'bg-emerald-500', iconBg: 'bg-emerald-100', iconText: 'text-emerald-700' },
  blue: { dot: 'bg-blue-500', iconBg: 'bg-blue-100', iconText: 'text-blue-700' },
  amber: { dot: 'bg-amber-500', iconBg: 'bg-amber-100', iconText: 'text-amber-700' }
};

export default function PortalTimeline({ data }) {
  const events = buildEvents(data);
  if (events.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Activity Timeline</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{events.length}</span>
      </div>
      <div className="p-5">
        <div className="relative">
          {events.slice(0, 12).map((ev, i) => {
            const Icon = ev.icon;
            const t = toneStyles[ev.tone] || toneStyles.emerald;
            const isLast = i === Math.min(events.length, 12) - 1;
            return (
              <div key={i} className="flex items-start gap-3 relative pb-4 last:pb-0">
                {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-slate-200" />}
                <div className={`w-8 h-8 rounded-full ${t.iconBg} flex items-center justify-center flex-shrink-0 relative z-10`}>
                  <Icon className={`w-4 h-4 ${t.iconText}`} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-slate-900">{ev.title}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    {ev.date && <span className="text-xs text-slate-400">{format(parseISO(ev.date), 'dd MMM yyyy')}</span>}
                    {ev.meta && <span className="text-xs text-slate-400">· {ev.meta}</span>}
                    {ev.tag && <span className="text-xs font-medium text-slate-500">· {ev.tag}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {events.length > 12 && (
          <p className="text-xs text-slate-400 text-center mt-3">Showing latest 12 activities</p>
        )}
      </div>
    </div>
  );
}