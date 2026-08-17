import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  X, Search, Calendar, Users, Loader2, GraduationCap, CheckCircle2,
} from 'lucide-react';
import { format, isFuture } from 'date-fns';

export default function AssignTrainingModal({ preselectedStaffIds = [], preselectedCategory = null, staff, courses, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState(preselectedStaffIds);
  const [saving, setSaving] = useState(false);

  const availableCourses = useMemo(() => {
    let list = courses.filter(c => c.status !== 'cancelled' && c.status !== 'completed');
    if (preselectedCategory) list = list.filter(c => c.category === preselectedCategory);
    return list.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  }, [courses, preselectedCategory]);

  const filteredStaff = useMemo(() => staff.filter(s =>
    s.is_active !== false && (
      !search || s.name.toLowerCase().includes(search.toLowerCase())
    )
  ), [staff, search]);

  const toggleStaff = (id) => {
    setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAssign = async () => {
    if (!selectedCourse) { toast({ title: 'Select a course', variant: 'destructive' }); return; }
    if (selectedStaffIds.length === 0) { toast({ title: 'Select at least one crew member', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const bookings = selectedStaffIds.map(staffId => {
        const s = staff.find(x => x.id === staffId);
        return {
          course_id: selectedCourse.id,
          staff_id: staffId,
          staff_name: s?.name || '',
          status: 'booked',
        };
      });
      await base44.entities.TrainingBooking.bulkCreate(bookings);
      queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
      toast({ title: `${bookings.length} crew booked onto ${selectedCourse.title}` });
      onClose();
    } catch (err) {
      toast({ title: 'Could not assign', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2E5A1A] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Assign Training</h3>
              <p className="text-xs text-slate-500">Book crew onto a training course</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>

        {/* Course selection */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">1. Select Course{preselectedCategory && ' (filtered)'}</label>
          {availableCourses.length === 0 ? (
            <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-400">No upcoming courses{preselectedCategory ? ' for this category' : ''}.</p>
              <button onClick={() => { onClose(); navigate('/staff', { state: { initialTab: 'training' } }); }}
                className="text-xs text-[#2E5A1A] font-semibold hover:underline mt-1">
                Create a course in the Courses tab →
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {availableCourses.map(c => (
                <button key={c.id} onClick={() => setSelectedCourse(c)}
                  className={'w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ' +
                    (selectedCourse?.id === c.id ? 'border-[#2E5A1A] bg-[#2E5A1A]/5 ring-1 ring-[#2E5A1A]/20' : 'border-slate-200 bg-white hover:bg-slate-50')}>
                  <div className={'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ' + (selectedCourse?.id === c.id ? 'bg-[#2E5A1A]' : 'bg-blue-100')}>
                    {selectedCourse?.id === c.id ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Calendar className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{c.title}</p>
                    <p className="text-[10px] text-slate-400">{format(new Date(c.start_date + 'T00:00'), 'dd MMM yyyy')}{c.venue ? ` · ${c.venue}` : ''}{c.provider ? ` · ${c.provider}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Staff selection */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">2. Select Crew ({selectedStaffIds.length} selected)</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search crew…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10" />
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto border border-slate-100 rounded-xl">
            {filteredStaff.map(s => {
              const checked = selectedStaffIds.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggleStaff(s.id)}
                  className={'w-full flex items-center gap-3 p-2.5 transition text-left ' + (checked ? 'bg-[#2E5A1A]/5' : 'hover:bg-slate-50')}>
                  <div className={'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ' + (checked ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300 bg-white')}>
                    {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-[10px]">{s.name.charAt(0)}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-700 truncate">{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">Cancel</button>
          <button onClick={handleAssign} disabled={saving || !selectedCourse || selectedStaffIds.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            {saving ? 'Booking…' : `Book ${selectedStaffIds.length} ${selectedStaffIds.length === 1 ? 'person' : 'crew'}`}
          </button>
        </div>
      </div>
    </div>
  );
}