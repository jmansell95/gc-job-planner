import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Repeat, X, Loader2, CalendarRange, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PermanentCrewCard({ job }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(null);
  const crew = Array.isArray(job?.permanent_crew) ? job.permanent_crew : [];

  if (crew.length === 0) return null;

  const removeMember = async (staffId) => {
    const member = crew.find((c) => c.staff_id === staffId);
    if (!member) return;
    if (!confirm(`Remove ${member.staff_name || 'this crew member'} from the permanent crew? Future recurring shifts will no longer auto-generate for them.`)) return;
    setRemoving(staffId);
    try {
      const updated = crew.filter((c) => c.staff_id !== staffId);
      await base44.entities.Job.update(job.id, { permanent_crew: updated });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['rota-assignments'] });
      toast({ title: 'Removed from permanent crew', description: member.staff_name });
    } catch (e) {
      toast({ title: 'Could not remove', description: e?.message, variant: 'destructive' });
    }
    setRemoving(null);
  };

  return (
    <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
          <Repeat className="w-4 h-4 text-emerald-700" />
        </div>
        <h3 className="font-semibold text-slate-900 text-sm">Permanent Crew</h3>
        <span className="text-xs text-slate-400 font-normal hidden sm:inline">· recurring weekly pattern, auto-extends with the job</span>
        <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
          {crew.length} {crew.length === 1 ? 'member' : 'members'}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {crew.map((c) => {
          const days = (c.working_days || []).slice().sort((a, b) => a - b);
          const dayLabels = days.map((d) => DAY_LABELS[d] || '?').join(' · ');
          return (
            <div key={c.staff_id} className="px-5 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 text-sm truncate">{c.staff_name || 'Unknown'}</p>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-xs text-slate-500">{dayLabels || 'No days set'}</span>
                  {(c.start_date || c.end_date) && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400">
                      <CalendarRange className="w-3 h-3" />
                      {c.start_date || 'job start'} → {c.end_date || 'job end'}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeMember(c.staff_id)}
                disabled={removing === c.staff_id}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                aria-label={`Remove ${c.staff_name} from permanent crew`}
              >
                {removing === c.staff_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}