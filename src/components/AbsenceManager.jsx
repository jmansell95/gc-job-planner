import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX, Plus, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/PageHeader';

const reasonConfig = {
  holiday: { label: 'Holiday', badge: 'bg-blue-100 text-blue-700' },
  sick: { label: 'Sick Leave', badge: 'bg-red-100 text-red-700' },
  personal: { label: 'Personal', badge: 'bg-purple-100 text-purple-700' },
  training: { label: 'Training', badge: 'bg-amber-100 text-amber-700' },
  other: { label: 'Other', badge: 'bg-slate-100 text-slate-600' }
};

const statusConfig = {
  pending: { label: 'Pending', badge: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-700' }
};

export default function AbsenceManager() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ staff_id: '', start_date: '', end_date: '', reason: 'holiday', notes: '' });
  const queryClient = useQueryClient();

  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list('-created_date', 50) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.Absence.create({ ...formData, status: 'pending' });
    setFormData({ staff_id: '', start_date: '', end_date: '', reason: 'holiday', notes: '' });
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['absences'] });
  };

  const handleApprove = async (id) => {
    await base44.entities.Absence.update(id, { status: 'approved' });
    queryClient.invalidateQueries({ queryKey: ['absences'] });
  };
  const handleReject = async (id) => {
    await base44.entities.Absence.update(id, { status: 'rejected' });
    queryClient.invalidateQueries({ queryKey: ['absences'] });
  };
  const handleDelete = async (id) => {
    await base44.entities.Absence.delete(id);
    queryClient.invalidateQueries({ queryKey: ['absences'] });
  };

  const pendingCount = absences.filter(a => a.status === 'pending').length;
  const today = format(new Date(), 'yyyy-MM-dd');
  const onLeaveToday = absences.filter(a => a.status === 'approved' && a.start_date <= today && a.end_date >= today);

  return (
    <div>
      <PageHeader title="Absence Management" icon={CalendarX} />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Pending Requests</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">On Leave Today</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{onLeaveToday.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Total Requests</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{absences.length}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-slate-900">Absence Requests</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> Log Absence
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 border border-emerald-200 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member *</label>
              <select value={formData.staff_id} onChange={e => setFormData({ ...formData, staff_id: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Staff</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
              <select value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                {Object.entries(reasonConfig).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
              <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Date *</label>
              <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">Submit Request</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {absences.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-400 text-sm">No absence requests</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {absences.map(a => {
              const member = staff.find(s => s.id === a.staff_id);
              const reason = reasonConfig[a.reason] || reasonConfig.other;
              const status = statusConfig[a.status] || statusConfig.pending;
              return (
                <div key={a.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <CalendarX className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{member?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{format(new Date(a.start_date + 'T00:00:00'), 'dd MMM')} → {format(new Date(a.end_date + 'T00:00:00'), 'dd MMM yyyy')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${reason.badge}`}>{reason.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.badge}`}>{status.label}</span>
                    {a.status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(a.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"><CheckCircle2 className="w-4 h-4" /></button>
                        <button onClick={() => handleReject(a.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><XCircle className="w-4 h-4" /></button>
                      </>
                    )}
                    <button onClick={() => handleDelete(a.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}