import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfWeek, format } from 'date-fns';
import {
  X, Truck, Cog, MapPin, Loader2, CheckCircle2, User, Calendar, Navigation,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Drive Away — Hilti ON!Track-style "Start Shift" flow. A driller/driver scans
 * a rig or vehicle QR, picks the job they're heading to, and books themselves
 * onto that asset for the day. Creates a RotaAssignment linking staff + asset
 * + job, and for vehicles also flips the live "Driving Now" operator status.
 */
export default function DriveAwayModal({ asset, staffProfile, onClose, onSuccess }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [clearedRigName, setClearedRigName] = useState(null);

  const isVehicle = asset?.asset_type === 'vehicle';
  const isRig = asset?.asset_type === 'rig';

  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['active-jobs-drive'],
    queryFn: async () => {
      const all = await base44.entities.Job.list();
      return all.filter(j => j.status === 'planning' || j.status === 'in_progress');
    },
  });

  const selectedJob = jobs.find(j => j.id === jobId);
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const canSubmit = jobId && !saving && staffProfile?.id;

  // Pre-fill the job from today's existing assignment so the driller doesn't
  // have to re-select if they're already scheduled onto a job today.
  const { data: todayAssignment } = useQuery({
    queryKey: ['drive-today-assignment', staffProfile?.id, today],
    queryFn: async () => {
      if (!staffProfile?.id) return null;
      const all = await base44.entities.RotaAssignment.filter({ staff_id: staffProfile.id, assigned_date: today });
      return all.find(a => a.assignment_type === 'job' && a.job_id) || null;
    },
    enabled: !!staffProfile?.id,
  });

  React.useEffect(() => {
    if (todayAssignment?.job_id && !jobId) setJobId(todayAssignment.job_id);
  }, [todayAssignment, jobId]);

  const handleSubmit = async () => {
    if (!jobId) { toast({ title: 'Select a job to drive to', variant: 'destructive' }); return; }
    if (!staffProfile?.id) { toast({ title: 'No staff profile linked to your account', description: 'Ask an admin to link your user to a Staff record.', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('bookAssetToStaff', { asset_id: asset.id, job_id: jobId });
      const result = res.data || {};

      queryClient.invalidateQueries({ queryKey: ['rota-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['my-gear-rota'] });
      queryClient.invalidateQueries({ queryKey: ['my-today-rota'] });
      queryClient.invalidateQueries({ queryKey: ['passport-today-job'] });
      setClearedRigName(result.cleared_old_rig ? result.old_rig_name : null);
      setConfirmed(true);
      if (onSuccess) onSuccess({ job: selectedJob });
      setTimeout(() => onClose(), 2200);
    } catch (err) {
      console.error('Drive away error:', err);
      const msg = err?.response?.data?.error || err?.message || 'Could not start shift.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[92vh] overflow-y-auto animate-pop-in" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Start Shift & Drive Away</h3>
              <p className="text-[11px] text-slate-400">Book yourself onto this {isVehicle ? 'vehicle' : isRig ? 'rig' : 'asset'} and head to the job</p>
            </div>
          </div>
          <button onClick={() => !saving && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>

        {confirmed ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="font-bold text-slate-900 mb-1">You're booked in!</p>
            <p className="text-sm text-slate-500">{asset.name} is assigned to you for {selectedJob?.name || 'the job'} today.</p>
            {clearedRigName && (
              <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-3 py-2">
                You've been checked out of {clearedRigName} automatically.
              </p>
            )}
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0">
                {isVehicle ? <Truck className="w-5 h-5 text-emerald-700" /> : <Cog className="w-5 h-5 text-emerald-700" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{asset.name}</p>
                <p className="text-xs text-slate-500 font-mono truncate">{asset.serial_number || 'No serial'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              <User className="w-3.5 h-3.5" />
              <span>Driver: <span className="font-semibold text-slate-700">{staffProfile?.name || 'Unknown'}</span></span>
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"><MapPin className="w-3 h-3" /> Which job are you heading to? *</label>
              {loadingJobs ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading jobs…</div>
              ) : (
                <select value={jobId} onChange={e => setJobId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                  <option value="">Select a job…</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.name}{j.location ? ` · ${j.location}` : ''}</option>)}
                </select>
              )}
              {selectedJob?.location && (
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedJob.location}</p>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>Shift date: <span className="font-semibold text-slate-700">{format(new Date(), 'dd MMM yyyy')}</span></span>
            </div>
          </div>
        )}

        {!confirmed && (
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
            <button onClick={handleSubmit} disabled={!canSubmit}
              className="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-semibold text-sm hover:bg-emerald-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 active:scale-95">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking…</> : <><Navigation className="w-4 h-4" /> Start Shift & Go</>}
            </button>
            <button onClick={() => !saving && onClose()} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}