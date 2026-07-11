import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { FlaskConical, Plus, Send, Trash2, ArrowDownToLine, TestTube, MapPin, Package, Wrench, Ruler, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white";

const drillingLogTypes = [
  { value: 'borehole_progress', label: 'Borehole Progress', icon: ArrowDownToLine },
  { value: 'sample_collection', label: 'Sample Collected', icon: TestTube },
  { value: 'site_setup', label: 'Site Setup', icon: Wrench },
];

const groundworksLogTypes = [
  { value: 'pit_excavation', label: 'Trial Pit', icon: MapPin },
  { value: 'installation', label: 'Installation', icon: Package },
  { value: 'site_setup', label: 'Site Setup', icon: Wrench },
];

const sampleTypes = [
  { value: 'none', label: 'No sample' },
  { value: 'disturbed', label: 'Disturbed (D)' },
  { value: 'undisturbed', label: 'Undisturbed (U)' },
  { value: 'water', label: 'Water (W)' },
];

export default function InvestigationLogEntry({ staffId, jobId, job }) {
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isDrillingJob = job?.job_type === 'cp_drilling' || job?.job_type === 'rotary_drilling';
  const logTypes = isDrillingJob ? drillingLogTypes : groundworksLogTypes;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [form, setForm] = useState({
    log_type: isDrillingJob ? 'borehole_progress' : 'pit_excavation',
    borehole_ref: '',
    depth_from: '',
    depth_to: '',
    sample_id: '',
    sample_type: 'none',
    units_completed: '',
    units_label: '',
    dimensions: '',
    description: '',
  });

  const { data: todayLogs = [] } = useQuery({
    queryKey: ['investigation-logs-today', jobId, staffId, todayStr],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: jobId, date: todayStr }),
  });

  const handleAdd = async () => {
    setAdding(true);
    try {
      const payload = {
        job_id: jobId,
        staff_id: staffId,
        staff_name: '',
        date: todayStr,
        log_type: form.log_type,
        borehole_ref: form.borehole_ref || '',
        depth_from: form.depth_from ? parseFloat(form.depth_from) : null,
        depth_to: form.depth_to ? parseFloat(form.depth_to) : null,
        sample_id: form.sample_id || '',
        sample_type: form.sample_type || 'none',
        units_completed: form.units_completed ? parseFloat(form.units_completed) : null,
        units_label: form.units_label || '',
        dimensions: form.dimensions || '',
        description: form.description || '',
        created_at: new Date().toISOString(),
      };
      await base44.entities.InvestigationLog.create(payload);
      queryClient.invalidateQueries({ queryKey: ['investigation-logs-today', jobId, staffId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', jobId] });
      toast({ title: 'Log entry added', description: `${logTypes.find(t => t.value === form.log_type)?.label} recorded.` });
      // Pre-fill borehole ref for next entry
      setForm({
        ...form,
        depth_from: form.depth_to || '',
        depth_to: '',
        sample_id: '',
        sample_type: 'none',
        description: '',
      });
      setShowForm(false);
    } catch (e) {
      toast({ title: 'Error adding log', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.InvestigationLog.delete(id);
      queryClient.invalidateQueries({ queryKey: ['investigation-logs-today', jobId, staffId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', jobId] });
    } catch (e) {
      console.error(e);
    }
  };

  const isSampleLog = form.log_type === 'sample_collection';
  const isBoreholeLog = form.log_type === 'borehole_progress';
  const isPitLog = form.log_type === 'pit_excavation';
  const isInstallation = form.log_type === 'installation';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <FlaskConical className="w-4 h-4 text-blue-700" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Investigation Log</h3>
          <p className="text-xs text-slate-400">{isDrillingJob ? 'Borehole progress & samples' : 'Trial pits, installations & site setup'}</p>
        </div>
        {todayLogs.length > 0 && (
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{todayLogs.length} today</span>
        )}
      </div>

      {/* Today's logs */}
      {todayLogs.length > 0 && (
        <div className="space-y-2 mb-4">
          {todayLogs.sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0)).map(log => (
            <div key={log.id} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700 capitalize">{log.log_type.replace(/_/g, ' ')}</span>
                  {log.borehole_ref && <span className="text-xs font-mono font-bold text-blue-700">{log.borehole_ref}</span>}
                  {log.sample_id && <span className="text-xs font-mono font-bold text-purple-700">{log.sample_id}</span>}
                </div>
                {log.depth_from != null && log.depth_to != null && (
                  <p className="text-xs text-slate-600 mt-0.5"><Ruler className="w-3 h-3 inline text-slate-400" /> {log.depth_from}m → {log.depth_to}m</p>
                )}
                {log.units_completed != null && log.units_completed > 0 && (
                  <p className="text-xs text-slate-600 mt-0.5">{log.units_completed} {log.units_label}</p>
                )}
                {log.description && <p className="text-xs text-slate-500 mt-0.5">{log.description}</p>}
              </div>
              <button onClick={() => handleDelete(log.id)} className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick entry form */}
      {showForm ? (
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">New Log Entry</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>

          {/* Log type selector */}
          <div className="flex gap-1.5">
            {logTypes.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, log_type: t.value })}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium border transition ${form.log_type === t.value ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Drilling-specific fields */}
          {isBoreholeLog && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Borehole Reference</label>
                <input type="text" value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                  placeholder="e.g. BH-01" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Depth From (m)</label>
                  <input type="number" step="0.1" min="0" value={form.depth_from} onChange={e => setForm({ ...form, depth_from: e.target.value })}
                    placeholder="0.0" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Depth To (m)</label>
                  <input type="number" step="0.1" min="0" value={form.depth_to} onChange={e => setForm({ ...form, depth_to: e.target.value })}
                    placeholder="1.5" className={inputCls} />
                </div>
              </div>
            </>
          )}

          {/* Sample fields */}
          {isSampleLog && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Borehole Reference</label>
                <input type="text" value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                  placeholder="e.g. BH-01" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Sample ID</label>
                  <input type="text" value={form.sample_id} onChange={e => setForm({ ...form, sample_id: e.target.value })}
                    placeholder="e.g. S-01" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Sample Type</label>
                  <select value={form.sample_type} onChange={e => setForm({ ...form, sample_type: e.target.value })} className={inputCls}>
                    {sampleTypes.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Depth From (m)</label>
                  <input type="number" step="0.1" min="0" value={form.depth_from} onChange={e => setForm({ ...form, depth_from: e.target.value })}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Depth To (m)</label>
                  <input type="number" step="0.1" min="0" value={form.depth_to} onChange={e => setForm({ ...form, depth_to: e.target.value })}
                    className={inputCls} />
                </div>
              </div>
            </>
          )}

          {/* Pit excavation fields */}
          {isPitLog && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pit Reference</label>
                <input type="text" value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                  placeholder="e.g. TP-01" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dimensions</label>
                <input type="text" value={form.dimensions} onChange={e => setForm({ ...form, dimensions: e.target.value })}
                  placeholder="e.g. 1.2m x 0.8m x 1.5m deep" className={inputCls} />
              </div>
            </>
          )}

          {/* Installation fields */}
          {isInstallation && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Units Completed</label>
                <input type="number" min="0" step="1" value={form.units_completed} onChange={e => setForm({ ...form, units_completed: e.target.value })}
                  placeholder="e.g. 2" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Unit Label</label>
                <input type="text" value={form.units_label} onChange={e => setForm({ ...form, units_label: e.target.value })}
                  placeholder="e.g. EV chargers" className={inputCls} />
              </div>
            </div>
          )}

          {/* Description (always) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description / Observations</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
              placeholder={isDrillingJob ? "Ground conditions, obstructions, water strike..." : "What was done, ground conditions, observations..."}
              className={`${inputCls} resize-none`} />
          </div>

          <button onClick={handleAdd} disabled={adding}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
            {adding ? 'Adding…' : <><Send className="w-4 h-4" /> Add Log Entry</>}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 active:scale-95 transition text-sm font-semibold border border-blue-200 touch-manipulation">
          <Plus className="w-4 h-4" /> Log {isDrillingJob ? 'Borehole / Sample' : 'Pit / Installation'}
        </button>
      )}
    </div>
  );
}