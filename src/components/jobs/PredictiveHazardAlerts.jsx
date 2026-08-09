import React, { useMemo } from 'react';
import { AlertTriangle, Zap, Droplets, Flame, Waves, Construction, MapPin, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

/**
 * Predictive Hazard Alerts — surfaces potential site hazards proactively
 * based on the job's location, historical investigation data, and known risks.
 * Shown on the job detail page and staff dashboard so crews are aware before
 * they start work.
 *
 * Hazard sources:
 *  - Historical service encounters from InvestigationLogs on this job/site
 *  - Flood risk (from the job's flood risk data if available)
 *  - Nearby utilities (from previous trial pit / borehole logs)
 *  - Groundwater strikes recorded in nearby boreholes
 *  - Obstruction types encountered historically
 */
export default function PredictiveHazardAlerts({ job, compact = false }) {
  const { data: logs = [] } = useQuery({
    queryKey: ['investigation-logs-hazards', job?.id],
    queryFn: () => job?.id ? base44.entities.InvestigationLog.filter({ job_id: job.id }) : [],
    enabled: !!job?.id
  });

  const { data: nearbyJobs = [] } = useQuery({
    queryKey: ['nearby-jobs-hazards', job?.site_lat, job?.site_lng],
    queryFn: () => base44.entities.Job.list(),
    enabled: !!job?.site_lat && !!job?.site_lng
  });

  const hazards = useMemo(() => {
    const alerts = [];

    // 1. Service encounters on this job
    const serviceEncounters = logs.filter(l => l.service_encounter_type && l.service_encounter_type !== 'none');
    if (serviceEncounters.length > 0) {
      const types = [...new Set(serviceEncounters.map(l => l.service_encounter_type))];
      alerts.push({
        id: 'services-this-job',
        severity: 'high',
        icon: Zap,
        title: `${types.length} Underground Service${types.length > 1 ? 's' : ''} Encountered`,
        detail: `Previously hit: ${types.join(', ')}. Verify service plans before excavation.`,
        tone: 'amber'
      });
    }

    // 2. Groundwater strikes
    const gwStrikes = logs.filter(l => l.groundwater_strike_depth != null);
    if (gwStrikes.length > 0) {
      const shallowest = Math.min(...gwStrikes.map(l => l.groundwater_strike_depth));
      alerts.push({
        id: 'groundwater',
        severity: shallowest < 2 ? 'high' : 'medium',
        icon: Droplets,
        title: `Groundwater at ${shallowest.toFixed(1)}m`,
        detail: `${gwStrikes.length} water strike${gwStrikes.length > 1 ? 's' : ''} recorded. Plan for dewatering or casing.`,
        tone: 'blue'
      });
    }

    // 3. Refusal / obstructions
    const refusals = logs.filter(l => l.refusal_encountered);
    if (refusals.length > 0) {
      const obstructionTypes = [...new Set(refusals.map(l => l.obstruction_type).filter(t => t && t !== 'none'))];
      alerts.push({
        id: 'refusal',
        severity: 'medium',
        icon: Construction,
        title: `${refusals.length} Refusal${refusals.length > 1 ? 's' : ''} Recorded`,
        detail: obstructionTypes.length > 0 ? `Obstructions: ${obstructionTypes.join(', ')}` : 'Previous drilling hit refusal — expect difficult ground.',
        tone: 'rose'
      });
    }

    // 4. Nearby jobs (within ~500m) with hazards — proximity-based prediction
    if (job?.site_lat && job?.site_lng && nearbyJobs.length > 0) {
      const nearby = nearbyJobs.filter(j => {
        if (j.id === job.id) return false;
        if (!j.site_lat || !j.site_lng) return false;
        const dist = Math.sqrt(
          Math.pow((j.site_lat - job.site_lat) * 111000, 2) +
          Math.pow((j.site_lng - job.site_lng) * 111000 * Math.cos(job.site_lat * Math.PI / 180), 2)
        );
        return dist < 500;
      });
      if (nearby.length > 0) {
        alerts.push({
          id: 'nearby-sites',
          severity: 'low',
          icon: MapPin,
          title: `${nearby.length} Nearby Site${nearby.length > 1 ? 's' : ''}`,
          detail: 'Investigations within 500m — check shared ground conditions and utility records.',
          tone: 'slate'
        });
      }
    }

    // 5. Made ground indicator
    const madeGround = logs.filter(l => l.strata_descriptor === 'made_ground');
    if (madeGround.length > 0) {
      alerts.push({
        id: 'made-ground',
        severity: 'medium',
        icon: ShieldAlert,
        title: 'Made Ground Detected',
        detail: `${madeGround.length} log${madeGround.length > 1 ? 's' : ''} show made ground. Watch for contamination, buried obstructions, and variable bearing capacity.`,
        tone: 'amber'
      });
    }

    return alerts;
  }, [logs, nearbyJobs, job]);

  if (hazards.length === 0) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
        <ShieldAlert className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <p className="text-xs font-medium text-emerald-700">No known hazards flagged for this site yet.</p>
      </div>
    );
  }

  const toneClasses = {
    amber: 'bg-amber-50/70 border-amber-200 text-amber-700',
    blue: 'bg-blue-50/70 border-blue-200 text-blue-700',
    rose: 'bg-rose-50/70 border-rose-200 text-rose-700',
    slate: 'bg-slate-50/70 border-slate-200 text-slate-600',
  };

  const severityIcon = {
    high: 'text-rose-500',
    medium: 'text-amber-500',
    low: 'text-slate-400',
  };

  return (
    <div className={`space-y-2 ${compact ? '' : 'mb-4'}`}>
      {!compact && (
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Predictive Hazard Alerts</p>
        </div>
      )}
      {hazards.map(h => {
        const Icon = h.icon;
        return (
          <div key={h.id} className={`flex items-start gap-2.5 p-3 rounded-xl border ${toneClasses[h.tone]}`}>
            <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${severityIcon[h.severity]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900">{h.title}</p>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{h.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}