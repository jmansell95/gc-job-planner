import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { format } from 'date-fns';

export default function MilestoneManager({ job }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const queryClient = useQueryClient();

  const { data: milestones = [] } = useQuery({
    queryKey: ['job-milestones', job.id],
    queryFn: () => base44.entities.JobMilestone.filter({ job_id: job.id })
  });

  const sorted = [...milestones].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const completedCount = sorted.filter(m => m.completed).length;
  const progressPct = sorted.length > 0 ? Math.round((completedCount / sorted.length) * 100) : 0;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name) return;
    await base44.entities.JobMilestone.create({
      job_id: job.id,
      name,
      target_date: targetDate || '',
      sort_order: milestones.length
    });
    setName('');
    setTargetDate('');
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['job-milestones', job.id] });
  };

  const toggleComplete = async (milestone) => {
    await base44.entities.JobMilestone.update(milestone.id, {
      completed: !milestone.completed,
      completed_date: !milestone.completed ? format(new Date(), 'yyyy-MM-dd') : ''
    });
    queryClient.invalidateQueries({ queryKey: ['job-milestones', job.id] });
  };

  const handleDelete = async (id) => {
    await base44.entities.JobMilestone.delete(id);
    queryClient.invalidateQueries({ queryKey: ['job-milestones', job.id] });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-emerald-700" />
          <h2 className="font-semibold text-slate-900">Milestones</h2>
          <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            {completedCount}/{sorted.length}
          </span>
        </div>
        {sorted.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500">Job Progress</span>
              <span className={`text-xs font-bold tabular-nums ${progressPct === 100 ? 'text-emerald-600' : progressPct >= 50 ? 'text-blue-600' : 'text-slate-600'}`}>{progressPct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${progressPct === 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : progressPct >= 50 ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 'bg-gradient-to-r from-slate-400 to-slate-500'}`} style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
      </div>
      <div className="px-5 py-4">
        {sorted.length > 0 && (
          <div className="space-y-2 mb-4">
            {sorted.map(m => (
              <div key={m.id} className="flex items-center gap-3 group">
                <button onClick={() => toggleComplete(m)} className="flex-shrink-0">
                  {m.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 hover:text-emerald-400" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${m.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{m.name}</p>
                  {m.target_date && (
                    <p className="text-xs text-slate-400">Target: {format(new Date(m.target_date + 'T00:00:00'), 'dd MMM yyyy')}</p>
                  )}
                </div>
                <button onClick={() => handleDelete(m.id)}
                  className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <form onSubmit={handleAdd} className="space-y-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Milestone name" required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-sm font-medium">Add</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-900 font-medium">
            <Plus className="w-4 h-4" /> Add Milestone
          </button>
        )}
      </div>
    </div>
  );
}