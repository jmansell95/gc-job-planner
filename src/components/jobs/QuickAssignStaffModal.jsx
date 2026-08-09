import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { format, addDays, isWeekend } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CrewSuggesterAI from '@/components/jobs/CrewSuggesterAI';

const computeWeekStart = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return format(monday, 'yyyy-MM-dd');
};

export default function QuickAssignStaffModal({ open, onClose, job, allStaff = [], rotas = [] }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [startDate, setStartDate] = useState(job?.start_date || format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(job?.end_date || job?.start_date || format(new Date(), 'yyyy-MM-dd'));
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [saving, setSaving] = useState(false);

  const assignedStaffIds = useMemo(() => new Set(rotas.map(r => r.staff_id)), [rotas]);

  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allStaff.filter(s => {
      if (s.is_active === false) return false;
      if (!q) return true;
      return (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
    });
  }, [allStaff, search]);

  const toggleStaff = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const buildDateRange = (startStr, endStr) => {
    const days = [];
    let d = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    while (d <= end) {
      if (!skipWeekends || !isWeekend(d)) days.push(format(d, 'yyyy-MM-dd'));
      d = addDays(d, 1);
    }
    return days;
  };

  const handleAssign = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    try {
      const dates = buildDateRange(startDate, endDate);
      const assignments = [];
      selectedIds.forEach(staffId => {
        dates.forEach(date => {
          assignments.push({
            job_id: job.id,
            staff_id: staffId,
            assigned_date: date,
            week_start: computeWeekStart(date),
            status: 'assigned',
          });
        });
      });
      await base44.entities.RotaAssignment.bulkCreate(assignments);
      queryClient.invalidateQueries({ queryKey: ['rotas-for-job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      setSelectedIds([]);
      setSearch('');
      onClose();
    } catch (err) {
      console.error('Quick assign error:', err);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#2E5A1A]" /> Quick Assign Staff
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Add crew to <span className="font-semibold text-slate-700">{job?.name}</span></p>

          {/* AI Crew Suggester */}
          {job?.id && (
            <CrewSuggesterAI
              job={job}
              assignedDate={startDate}
              allStaff={allStaff}
              onApply={(staffId) => toggleStaff(staffId)}
            />
          )}

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={skipWeekends} onChange={e => setSkipWeekends(e.target.checked)} className="rounded border-slate-300" />
            Skip weekends
          </label>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
          </div>

          {/* Staff list */}
          <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {filteredStaff.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No staff found</p>
            ) : filteredStaff.map(s => {
              const isAssigned = assignedStaffIds.has(s.id);
              const isSelected = selectedIds.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggleStaff(s.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition text-left ${isSelected ? 'bg-[#2E5A1A]/5' : ''}`}>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300'}`}>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                    {(s.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{(s.worker_type || '').replace(/_/g, ' ') || 'Staff'}</p>
                  </div>
                  {isAssigned && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">On job</span>}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-slate-500">
              {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select staff above'}
            </span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">Cancel</button>
              <button onClick={handleAssign} disabled={saving || selectedIds.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-medium hover:bg-[#1c4a12] transition disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {saving ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}