import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Briefcase, MapPin, Loader2, X, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { startOfWeek, format, addDays } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

/**
 * Quick-Assign Job Pool — a collapsible sidebar showing all active jobs.
 * Click a job to open a compact inline assign form (pick staff + day),
 * which creates a RotaAssignment directly. Designed to sit beside the
 * Weekly Rota Builder as a visual drag-alternative for fast assignment.
 */
export default function RotaJobPool({ weekStart }) {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState('');
  const [assigningJob, setAssigningJob] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const ws = weekStart || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const days = Array.from({ length: 5 }, (_, i) => format(addDays(new Date(ws), i), 'yyyy-MM-dd'));

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['rota-pool-jobs'],
    queryFn: async () => {
      const r = await base44.entities.Job.filter({ status: { $in: ['planning', 'in_progress'] } }, 'name', 50);
      return r.data || r || [];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['rota-pool-staff'],
    queryFn: async () => {
      const r = await base44.entities.Staff.filter({ is_active: true }, 'full_name', 200);
      return r.data || r || [];
    },
  });

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (j.name || '').toLowerCase().includes(q) || (j.location || '').toLowerCase().includes(q);
  });

  const handleAssign = async () => {
    if (!assigningJob || !selectedStaff || !selectedDate) return;
    setSaving(true);
    try {
      await base44.entities.RotaAssignment.create({
        staff_id: selectedStaff,
        job_id: assigningJob.id,
        assigned_date: selectedDate,
        week_start: ws,
        assignment_type: 'job',
        status: 'assigned',
      });
      await queryClient.invalidateQueries({ queryKey: ['rotas'] });
      await queryClient.invalidateQueries({ queryKey: ['rota-assignments-dnd'] });
      toast({ title: 'Assigned', description: `${staff.find(s => s.id === selectedStaff)?.name || 'Staff'} → ${assigningJob.name} on ${format(new Date(selectedDate), 'EEE dd MMM')}` });
      setAssigningJob(null);
      setSelectedStaff('');
      setSelectedDate('');
    } catch (err) {
      toast({ title: 'Assignment failed', description: err.message || 'Could not create assignment.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      {/* Header — collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#2E5A1A] to-[#3d6b1f] text-white"
      >
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4" />
          <span className="font-bold text-sm">Quick Assign Pool</span>
          <span className="text-xs text-white/70">({filtered.length} jobs)</span>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="p-3">
          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E5A1A]"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No active jobs found</p>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {filtered.map(job => (
                <div key={job.id}>
                  <button
                    onClick={() => {
                      if (assigningJob?.id === job.id) {
                        setAssigningJob(null);
                      } else {
                        setAssigningJob(job);
                        setSelectedDate(days[0]);
                      }
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border transition ${
                      assigningJob?.id === job.id
                        ? 'border-[#2E5A1A] bg-emerald-50 ring-1 ring-[#2E5A1A]/20'
                        : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-800 truncate">{job.name}</p>
                    {job.location && (
                      <p className="text-[10px] text-slate-400 truncate flex items-center gap-0.5 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" /> {job.location}
                      </p>
                    )}
                  </button>

                  {/* Inline assign form */}
                  {assigningJob?.id === job.id && (
                    <div className="mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <select
                        value={selectedStaff}
                        onChange={e => setSelectedStaff(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#2E5A1A]"
                      >
                        <option value="">Select staff...</option>
                        {staff.map(s => (
                          <option key={s.id} value={s.id}>{s.full_name || s.name}</option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        {days.map(d => (
                          <button
                            key={d}
                            onClick={() => setSelectedDate(d)}
                            className={`flex-1 py-1 text-[10px] font-medium rounded-md transition ${
                              selectedDate === d
                                ? 'bg-[#2E5A1A] text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {format(new Date(d), 'EEE')}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleAssign}
                          disabled={!selectedStaff || !selectedDate || saving}
                          className="flex-1 py-1.5 text-xs font-semibold bg-[#2E5A1A] text-white rounded-md hover:bg-[#1c4a12] disabled:opacity-50 transition flex items-center justify-center gap-1"
                        >
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Assign'}
                        </button>
                        <button
                          onClick={() => setAssigningJob(null)}
                          className="px-2 py-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}