import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowDownToLine, TestTube, Wrench, Ruler, Send, Trash2, Plus, X, Droplets, Calculator, Layers } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { strataOptions, sampleTypes, calculateSptN } from './shared';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 bg-white";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

const drillingLogTypes = [
  { value: 'borehole_progress', label: 'Borehole', icon: ArrowDownToLine },
  { value: 'sample_collection', label: 'Sample', icon: TestTube },
  { value: 'site_setup', label: 'Setup', icon: Wrench },
];

export default function DrillerLogForm({ staffId, jobId, job, staffName }) {
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const [form, setForm] = useState({
    log_type: 'borehole_progress',
    borehole_ref: '',
    depth_from: '',
    depth_to: '',
    strata_descriptor: 'other',
    strata_description_detail: '',
    spt_blows_1: '', spt_blows_2: '', spt_blows_3: '',
    groundwater_strike_depth: '',
    groundwater_static_level: '',
    core_run_number: '',
    coring_recovery: '',
    coring_rqd: '',
    sample_id: '',
    sample_type: 'none',
    description: '',
    photo_urls: '',
  });

  const { data: todayLogs = [] } = useQuery({
    queryKey: ['investigation-logs-today', jobId, staffId, todayStr],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: jobId, date: todayStr }),
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      const existing = form.photo_urls ? form.photo_urls.split(',').filter(Boolean) : [];
      existing.push(res.file_url);
      setForm({ ...form, photo_urls: existing.join(',') });
      toast({ title: 'Photo attached' });
    } catch (err) { toast({ title: 'Upload failed', variant: 'destructive' }); }
    setUploadingPhoto(false);
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      const blows = [form.spt_blows_1, form.spt_blows_2, form.spt_blows_3]
        .map(b => b ? parseInt(b) : null)
        .filter(b => b !== null);
      const sptN = blows.length >= 2 ? calculateSptN(blows) : null;

      const payload = {
        job_id: jobId,
        staff_id: staffId,
        staff_name: staffName || '',
        date: todayStr,
        log_type: form.log_type,
        borehole_ref: form.borehole_ref || '',
        depth_from: form.depth_from ? parseFloat(form.depth_from) : null,
        depth_to: form.depth_to ? parseFloat(form.depth_to) : null,
        strata_descriptor: form.strata_descriptor || 'other',
        strata_description_detail: form.strata_description_detail || '',
        spt_blows: blows.length > 0 ? blows : [],
        spt_n_value: sptN,
        groundwater_strike_depth: form.groundwater_strike_depth ? parseFloat(form.groundwater_strike_depth) : null,
        groundwater_static_level: form.groundwater_static_level ? parseFloat(form.groundwater_static_level) : null,
        core_run_number: form.core_run_number || '',
        coring_recovery: form.coring_recovery ? parseFloat(form.coring_recovery) : null,
        coring_rqd: form.coring_rqd ? parseFloat(form.coring_rqd) : null,
        sample_id: form.sample_id || '',
        sample_type: form.sample_type || 'none',
        description: form.description || '',
        photo_urls: form.photo_urls || '',
        created_at: new Date().toISOString(),
        manager_review_status: 'pending',
      };
      await base44.entities.InvestigationLog.create(payload);
      queryClient.invalidateQueries({ queryKey: ['investigation-logs-today', jobId, staffId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['log-quality-control'] });
      toast({ title: 'Log entry added', description: sptN != null ? `SPT N = ${sptN}` : undefined });
      // Pre-fill borehole ref and carry depth_from forward
      setForm({
        ...form,
        depth_from: form.depth_to || '',
        depth_to: '',
        spt_blows_1: '', spt_blows_2: '', spt_blows_3: '',
        strata_description_detail: '',
        sample_id: '',
        sample_type: 'none',
        description: '',
        photo_urls: '',
        coring_recovery: '',
        coring_rqd: '',
        core_run_number: '',
        groundwater_strike_depth: '',
        groundwater_static_level: '',
      });
      setShowForm(false);
    } catch (e) {
      toast({ title: 'Error adding log', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this log entry?')) return;
    try {
      await base44.entities.InvestigationLog.delete(id);
      queryClient.invalidateQueries({ queryKey: ['investigation-logs-today', jobId, staffId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['log-quality-control'] });
    } catch (e) { console.error(e); }
  };

  const isBorehole = form.log_type === 'borehole_progress';
  const isSample = form.log_type === 'sample_collection';
  const isCoring = job?.job_type === 'rotary_drilling' && isBorehole;
  const photos = form.photo_urls ? form.photo_urls.split(',').filter(Boolean) : [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <ArrowDownToLine className="w-4 h-4 text-blue-700" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Borehole Log</h3>
          <p className="text-xs text-slate-400">Strata · SPT · Groundwater {isCoring ? '· Core recovery' : ''}</p>
        </div>
        {todayLogs.length > 0 && (
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{todayLogs.length} today</span>
        )}
      </div>

      {todayLogs.length > 0 && (
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {todayLogs.sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0)).map(log => (
            <div key={log.id} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-mono font-bold text-blue-700">{log.borehole_ref || '—'}</span>
                  {log.depth_from != null && log.depth_to != null && (
                    <span className="text-xs text-slate-600">{log.depth_from}→{log.depth_to}m</span>
                  )}
                  {log.spt_n_value != null && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">N={log.spt_n_value}</span>
                  )}
                  {log.sample_id && (
                    <span className="text-xs font-mono font-bold text-purple-700">{log.sample_id}</span>
                  )}
                  {log.groundwater_strike_depth != null && (
                    <span className="text-xs bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                      <Droplets className="w-2.5 h-2.5" /> {log.groundwater_strike_depth}m
                    </span>
                  )}
                </div>
                {log.strata_description_detail && <p className="text-xs text-slate-600 mt-0.5">{log.strata_description_detail}</p>}
                {log.description && <p className="text-xs text-slate-500 mt-0.5">{log.description}</p>}
              </div>
              <button onClick={() => handleDelete(log.id)} className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">New Borehole Entry</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex gap-1.5">
            {drillingLogTypes.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, log_type: t.value })}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium border transition ${form.log_type === t.value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {(isBorehole || isSample) && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Borehole Ref</label>
                  <input type="text" value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                    placeholder="BH-01" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{isSample ? 'Sample ID' : 'Core Run'}</label>
                  <input type="text" value={isSample ? form.sample_id : form.core_run_number}
                    onChange={e => isSample ? setForm({ ...form, sample_id: e.target.value }) : setForm({ ...form, core_run_number: e.target.value })}
                    placeholder={isSample ? 'S-01' : 'C1'} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Depth From (m)</label>
                  <input type="number" step="0.1" min="0" value={form.depth_from} onChange={e => setForm({ ...form, depth_from: e.target.value })}
                    placeholder="0.0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Depth To (m)</label>
                  <input type="number" step="0.1" min="0" value={form.depth_to} onChange={e => setForm({ ...form, depth_to: e.target.value })}
                    placeholder="1.5" className={inputCls} />
                </div>
              </div>
            </>
          )}

          {isBorehole && (
            <>
              {/* Strata classification */}
              <div>
                <label className={labelCls}>Strata Classification</label>
                <select value={form.strata_descriptor} onChange={e => setForm({ ...form, strata_descriptor: e.target.value })} className={inputCls}>
                  {strataOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Strata Description Detail</label>
                <textarea value={form.strata_description_detail} onChange={e => setForm({ ...form, strata_description_detail: e.target.value })} rows={2}
                  placeholder="e.g. firm grey slightly sandy CLAY with gravel pockets"
                  className={`${inputCls} resize-none`} />
              </div>

              {/* SPT blows */}
              <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Calculator className="w-3.5 h-3.5 text-blue-600" />
                  <p className="text-xs font-semibold text-blue-700">SPT Blow Counts (per 75mm)</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>1st</label>
                    <input type="number" min="0" value={form.spt_blows_1} onChange={e => setForm({ ...form, spt_blows_1: e.target.value })} className={inputCls} placeholder="—" />
                  </div>
                  <div>
                    <label className={labelCls}>2nd</label>
                    <input type="number" min="0" value={form.spt_blows_2} onChange={e => setForm({ ...form, spt_blows_2: e.target.value })} className={inputCls} placeholder="—" />
                  </div>
                  <div>
                    <label className={labelCls}>3rd</label>
                    <input type="number" min="0" value={form.spt_blows_3} onChange={e => setForm({ ...form, spt_blows_3: e.target.value })} className={inputCls} placeholder="—" />
                  </div>
                </div>
                {form.spt_blows_2 && form.spt_blows_3 && (
                  <p className="text-xs text-blue-700 mt-1.5 font-medium">N = {parseInt(form.spt_blows_2) + parseInt(form.spt_blows_3)}</p>
                )}
              </div>

              {/* Groundwater */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}><Droplets className="w-3 h-3 inline" /> Water Strike (m)</label>
                  <input type="number" step="0.1" min="0" value={form.groundwater_strike_depth} onChange={e => setForm({ ...form, groundwater_strike_depth: e.target.value })}
                    className={inputCls} placeholder="—" />
                </div>
                <div>
                  <label className={labelCls}>Static Level (m)</label>
                  <input type="number" step="0.1" min="0" value={form.groundwater_static_level} onChange={e => setForm({ ...form, groundwater_static_level: e.target.value })}
                    className={inputCls} placeholder="—" />
                </div>
              </div>

              {/* Coring (rotary only) */}
              {isCoring && (
                <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Layers className="w-3.5 h-3.5 text-purple-600" />
                    <p className="text-xs font-semibold text-purple-700">Core Recovery</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Recovery %</label>
                      <input type="number" step="1" min="0" max="100" value={form.coring_recovery} onChange={e => setForm({ ...form, coring_recovery: e.target.value })}
                        className={inputCls} placeholder="—" />
                    </div>
                    <div>
                      <label className={labelCls}>RQD %</label>
                      <input type="number" step="1" min="0" max="100" value={form.coring_rqd} onChange={e => setForm({ ...form, coring_rqd: e.target.value })}
                        className={inputCls} placeholder="—" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {isSample && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Sample Type</label>
                <select value={form.sample_type} onChange={e => setForm({ ...form, sample_type: e.target.value })} className={inputCls}>
                  {sampleTypes.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Description / Observations</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
              placeholder="Ground conditions, obstructions, water ingress..."
              className={`${inputCls} resize-none`} />
          </div>

          {/* Photo upload */}
          <div>
            <label className={labelCls}>Evidence Photos</label>
            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition">
                {uploadingPhoto ? 'Uploading…' : <><Plus className="w-3.5 h-3.5" /> Attach Photo</>}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
              </label>
            </div>
            {photos.length > 0 && <p className="text-xs text-emerald-700 mt-1">{photos.length} photo(s) attached</p>}
          </div>

          <button onClick={handleAdd} disabled={adding}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 text-white rounded-xl hover:bg-blue-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
            {adding ? 'Adding…' : <><Send className="w-4 h-4" /> Add Log Entry</>}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 active:scale-95 transition text-sm font-semibold border border-blue-200 touch-manipulation">
          <Plus className="w-4 h-4" /> Log Borehole / Sample
        </button>
      )}
    </div>
  );
}