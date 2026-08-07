import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, ShieldAlert, ShieldX, Loader2, Calendar, AlertTriangle } from 'lucide-react';

/**
 * CompliancePassportGate — checks whether an asset's compliance
 * certificates (LOLER/PUWER/PAT) are valid for the duration of a
 * proposed job assignment. If any cert expires during the job,
 * the gate blocks assignment and prompts for recertification.
 *
 * Used in the RigGearPickerModal and JobAssetAssignForm to enforce
 * safety compliance before assets are added to jobs.
 */
export default function CompliancePassportGate({ assetId, jobStartDate, jobEndDate, onBlocked, compact }) {
  const { data: asset, isLoading } = useQuery({
    queryKey: ['compliance-gate-asset', assetId],
    queryFn: () => assetId ? base44.entities.SiteAsset.get(assetId) : null,
    enabled: !!assetId,
  });

  const gateStatus = useMemo(() => {
    if (!asset || isLoading) return { status: 'loading' };
    if (!jobStartDate || !jobEndDate) return { status: 'ok', message: 'No job dates specified' };

    const start = new Date(jobStartDate);
    const end = new Date(jobEndDate);
    const expiry = asset.compliance_expiry_date ? new Date(asset.compliance_expiry_date) : null;

    if (!expiry) {
      return {
        status: 'unknown',
        message: 'No compliance expiry date on record',
        icon: ShieldAlert,
        color: 'amber',
      };
    }

    if (expiry < start) {
      return {
        status: 'blocked',
        message: `Compliance expired on ${expiry.toLocaleDateString('en-GB')}. Recertification required before assignment.`,
        icon: ShieldX,
        color: 'rose',
        expiryDate: expiry,
      };
    }

    if (expiry <= end) {
      return {
        status: 'warning',
        message: `Compliance expires during job on ${expiry.toLocaleDateString('en-GB')}. Book recertification to avoid a gap.`,
        icon: ShieldAlert,
        color: 'amber',
        expiryDate: expiry,
      };
    }

    // Check if expiry is within 30 days after job end (upcoming)
    const thirtyDaysAfter = new Date(end.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (expiry <= thirtyDaysAfter) {
      return {
        status: 'soon',
        message: `Compliance expires ${expiry.toLocaleDateString('en-GB')} — soon after job ends. Consider booking recertification.`,
        icon: ShieldAlert,
        color: 'amber',
        expiryDate: expiry,
      };
    }

    return {
      status: 'ok',
      message: `Compliant until ${expiry.toLocaleDateString('en-GB')}`,
      icon: ShieldCheck,
      color: 'emerald',
      expiryDate: expiry,
    };
  }, [asset, isLoading, jobStartDate, jobEndDate]);

  // Notify parent when blocked
  React.useEffect(() => {
    if (gateStatus.status === 'blocked' && onBlocked) onBlocked(true);
  }, [gateStatus.status, onBlocked]);

  if (isLoading || !asset) {
    return compact ? null : (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking compliance...
      </div>
    );
  }

  const { status, message, icon: Icon, color } = gateStatus;
  if (status === 'loading' || status === 'ok') return null;

  const colorClasses = {
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${colorClasses[color] || ''}`}>
        <Icon className="w-3 h-3" />
        {status === 'blocked' ? 'BLOCKED' : status === 'warning' ? 'EXPIRES DURING JOB' : 'EXPIRING SOON'}
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${colorClasses[color] || 'bg-slate-50 border-slate-200'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color === 'rose' ? 'bg-rose-500' : color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800">
          {status === 'blocked' ? 'Assignment Blocked' : status === 'warning' ? 'Recertification Needed' : 'Compliance Note'}
        </p>
        <p className="text-xs text-slate-600 mt-0.5">{message}</p>
        {status === 'blocked' && (
          <button className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition">
            <Calendar className="w-3.5 h-3.5" /> Book Recertification
          </button>
        )}
      </div>
    </div>
  );
}