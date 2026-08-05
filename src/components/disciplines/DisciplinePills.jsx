import React from 'react';
import { getJobDisciplines, getDisciplineConfig } from '@/utils/jobDisciplines';

/**
 * Discipline Pills — colored pill strip showing all active disciplines on a job.
 * Used on job cards and the job context view for at-a-glance multi-discipline visibility.
 *
 * Props:
 *   job: the job record
 *   size: 'sm' (card) or 'md' (detail view)
 *   showStatus: if true, shows a status dot per pill (active=green, planning=gray, completed=check)
 *   onFilter: optional callback(typeKey) — when provided, pills are clickable
 */
export default function DisciplinePills({ job, size = 'sm', showStatus = false, onFilter }) {
  const disciplines = getJobDisciplines(job);
  if (!disciplines || disciplines.length === 0) return null;

  const sizeCls = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 gap-1'
    : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <div className="flex flex-wrap gap-1.5">
      {disciplines.map((d, i) => {
        const config = getDisciplineConfig(d.type);
        const isPrimary = i === 0;
        const clickable = !!onFilter;
        const statusDot = d.status === 'active' ? 'bg-emerald-400'
          : d.status === 'planning' ? 'bg-slate-300'
          : d.status === 'completed' ? 'bg-teal-400'
          : 'bg-amber-400';

        return (
          <span
            key={`${d.type}-${i}`}
            onClick={clickable ? (e) => { e.stopPropagation(); onFilter(d.type); } : undefined}
            className={`inline-flex items-center rounded-full font-medium ${config.badge} ${sizeCls} ${clickable ? 'cursor-pointer hover:opacity-80 transition' : ''} ${isPrimary ? 'ring-2 ring-offset-0' : ''}`}
            title={d.status ? `${config.label} — ${d.status}` : config.label}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
            {showStatus && (
              <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            )}
          </span>
        );
      })}
    </div>
  );
}