import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Briefcase, Building2, Layers, ChevronRight } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';

/**
 * Workload Ownership widget — splits active jobs into Direct vs Partner
 * (e.g. Concept Engineering Consultants). Gives managers an at-a-glance
 * view of how much work flows through partner consultancies vs direct clients.
 */
export default function WorkloadOwnershipWidget({ onNavigate }) {
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });

  const partnerClientIds = new Set(clients.filter(c => c.is_partner).map(c => c.id));
  const partnerClients = clients.filter(c => c.is_partner);

  const activeJobs = jobs.filter(j => j.status === 'in_progress' || j.status === 'planning');
  const directJobs = activeJobs.filter(j => !partnerClientIds.has(j.client_id));
  const partnerJobs = activeJobs.filter(j => partnerClientIds.has(j.client_id));

  const total = activeJobs.length || 1;
  const directPct = Math.round((directJobs.length / total) * 100);
  const partnerPct = 100 - directPct;

  // Group partner jobs by client
  const partnerBreakdown = partnerClients.map(c => {
    const count = partnerJobs.filter(j => j.client_id === c.id).length;
    return { id: c.id, name: c.name, color: c.partner_color || '#2563eb', count };
  }).filter(p => p.count > 0).sort((a, b) => b.count - a.count);

  return (
    <WidgetShell icon={Layers} title="Workload Ownership" subtitle="Direct vs partner-contracted jobs">
      {/* Split bar */}
      <div className="space-y-3">
        <div className="flex h-8 rounded-lg overflow-hidden shadow-sm">
          <div
            className="flex items-center justify-center bg-gradient-to-r from-[#2E5A1A] to-[#4d7c2a] text-white text-xs font-bold transition-all"
            style={{ width: `${directPct}%` }}
            title={`${directJobs.length} direct jobs`}
          >
            {directPct > 12 && <span className="px-2">{directJobs.length} Direct</span>}
          </div>
          {partnerBreakdown.map(p => {
            const pct = Math.round((p.count / total) * 100);
            if (pct === 0) return null;
            return (
              <div
                key={p.id}
                className="flex items-center justify-center text-white text-xs font-bold transition-all"
                style={{ width: `${pct}%`, backgroundColor: p.color }}
                title={`${p.count} ${p.name} jobs`}
              >
                {pct > 10 && <span className="px-2 truncate">{p.count}</span>}
              </div>
            );
          })}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate?.('jobs')}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-[#2E5A1A]/30 hover:bg-[#2E5A1A]/5 transition text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-[#2E5A1A]" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{directJobs.length}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Direct Jobs</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2E5A1A] ml-auto transition" />
          </button>

          <button
            onClick={() => onNavigate?.('jobs')}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50/50 transition text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{partnerJobs.length}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Partner Jobs</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 ml-auto transition" />
          </button>
        </div>

        {/* Partner breakdown */}
        {partnerBreakdown.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Partner Distribution</p>
            {partnerBreakdown.map(p => (
              <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50/70 border border-slate-100/80">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-xs font-medium text-slate-700 truncate flex-1">{p.name}</span>
                <span className="text-xs font-bold text-slate-900 tabular-nums">{p.count}</span>
                <span className="text-[10px] text-slate-400 tabular-nums">{Math.round((p.count / total) * 100)}%</span>
              </div>
            ))}
          </div>
        )}

        {partnerBreakdown.length === 0 && partnerJobs.length === 0 && (
          <div className="flex items-center justify-center py-4 text-center">
            <div>
              <p className="text-sm font-semibold text-slate-700">All Direct Work</p>
              <p className="text-xs text-slate-400 mt-0.5">No partner-contracted jobs currently active</p>
            </div>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}