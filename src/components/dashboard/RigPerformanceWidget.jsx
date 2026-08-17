import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Drill, TrendingUp, Ruler, Users, Loader2, Wrench, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const fmtGBP = (v) => {
  if (v == null || isNaN(v)) return '£0';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
};

/**
 * Rig Performance Widget — shows today's meterage and revenue per rig,
 * with the crew working on each rig. "This rig earnt £X today."
 *
 * Revenue calculation:
 *  - meterage_rate jobs: assignment.meterage × job.meterage_rate
 *  - day_rate jobs: job.unit_price (if set) or rig day rate from RateCardItem
 *  - flat_fee: job.client_charge
 */
export default function RigPerformanceWidget({ divisionId, onRigClick }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['rig-perf-assignments', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }),
  });
  const { data: rigs = [] } = useQuery({ queryKey: ['rigs-all'], queryFn: () => base44.entities.SiteAsset.filter({ is_rig: true }) });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: allStaff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: rateCards = [] } = useQuery({
    queryKey: ['rate-cards-rig-day'],
    queryFn: () => base44.entities.RateCardItem.filter({ category: 'plant' }),
  });

  const rigStats = useMemo(() => {
    const rigAssignments = assignments.filter(a => a.rig_asset_id);
    const byRig = {};
    rigAssignments.forEach(a => {
      if (!byRig[a.rig_asset_id]) byRig[a.rig_asset_id] = { assignments: [], totalMeterage: 0, totalRevenue: 0 };
      byRig[a.rig_asset_id].assignments.push(a);
      const job = jobs.find(j => j.id === a.job_id);
      // Calculate revenue for this assignment
      let rev = 0;
      if (job) {
        if (job.revenue_method === 'meterage_rate' && job.meterage_rate && a.meterage) {
          rev = a.meterage * job.meterage_rate;
        } else if (job.revenue_method === 'day_rate' && job.unit_price) {
          rev = job.unit_price;
        } else if (job.revenue_method === 'flat_fee' && job.client_charge) {
          rev = job.client_charge;
        } else if (job.meterage_rate && a.meterage) {
          // Fallback: if job has meterage_rate even without explicit revenue_method
          rev = a.meterage * job.meterage_rate;
        }
      }
      byRig[a.rig_asset_id].totalRevenue += rev;
      byRig[a.rig_asset_id].totalMeterage += Number(a.meterage) || 0;
    });

    return Object.entries(byRig).map(([rigId, data]) => {
      const rig = rigs.find(r => r.id === rigId);
      const crew = data.assignments.map(a => allStaff.find(s => s.id === a.staff_id)).filter(Boolean);
      const job = jobs.find(j => j.id === data.assignments[0]?.job_id);
      return {
        rigId,
        rig,
        crew,
        job,
        meterage: data.totalMeterage,
        revenue: data.totalRevenue,
        assignmentCount: data.assignments.length,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [assignments, jobs, rigs, allStaff]);

  const totalRevenue = rigStats.reduce((sum, r) => sum + r.revenue, 0);
  const totalMeterage = rigStats.reduce((sum, r) => sum + r.meterage, 0);
  const activeRigCount = rigStats.length;

  if (isLoading) {
    return (
      <div className="insight-card rounded-2xl p-5 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (activeRigCount === 0) {
    return (
      <div className="insight-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center">
            <Drill className="w-4 h-4 text-[#2E5A1A]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Rig Performance</h3>
            <p className="text-[11px] text-slate-400">No rigs deployed today</p>
          </div>
        </div>
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Wrench className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">No drilling crews are out today.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <Drill className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Rig Performance Today</h3>
              <p className="text-[11px] text-white/70">{format(new Date(), 'EEE dd MMM')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums leading-none">{fmtGBP(totalRevenue)}</p>
            <p className="text-[10px] text-white/70 mt-0.5">{totalMeterage.toFixed(1)}m drilled · {activeRigCount} rig{activeRigCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Rig cards */}
      <div className="divide-y divide-slate-100">
        {rigStats.map((stat, i) => (
          <motion.button
            key={stat.rigId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onRigClick?.(stat.rigId)}
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition active:scale-[0.99] text-left"
          >
            {/* Rig icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
              <Drill className="w-5 h-5 text-slate-600" />
            </div>

            {/* Rig name + crew */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{stat.rig?.name || 'Unknown Rig'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {stat.crew.length > 0 ? (
                  <>
                    <Users className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-500 truncate">{stat.crew.map(c => c.name).join(', ')}</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">No crew assigned</span>
                )}
              </div>
              {stat.job && (
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{stat.job.name}</p>
              )}
            </div>

            {/* Revenue + meterage */}
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1 justify-end">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <p className="text-sm font-bold text-emerald-700 tabular-nums">{fmtGBP(stat.revenue)}</p>
              </div>
              {stat.meterage > 0 && (
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <Ruler className="w-3 h-3 text-amber-500" />
                  <p className="text-xs font-semibold text-amber-600 tabular-nums">{stat.meterage.toFixed(1)}m</p>
                </div>
              )}
            </div>
            {onRigClick && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
          </motion.button>
        ))}
      </div>
    </div>
  );
}