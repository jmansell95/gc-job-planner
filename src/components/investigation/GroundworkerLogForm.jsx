import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MapPin, Package, Wrench, Ruler, Send, Trash2, Plus, X, ShieldAlert, Gauge, Waves, MapPinned } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { strataOptions, pitStabilityOptions, serviceEncounterOptions, serviceEncounterConfig } from './shared';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100 bg-white";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

const groundworksLogTypes = [
  { value: 'pit_excavation', label: 'Trial Pit', icon: MapPin },
  { value: 'installation', label: 'Install', icon: Package },
  { value: 'site_setup', label: 'Setup', icon: Wrench },
];

export default function GroundworkerLogForm({ staffId, jobId, job, staffName }) {
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [gettingGps, setGettingGps] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const [form, setForm] = useState({
    log_type: 'pit_excavation',
    borehole_ref: '',
    depth_from: '',
    depth_to: '',
    dimensions: '',
    strata_descriptor: 'other',
    strata_description_detail: '',
    pit_stability_rating: 'not_assessed',
    service_encounter_type: 'none',
    service_encounter_gps: '',
    cbr_value: '',
    vane_strength: '',
    units_completed: '',
    units_label: '',
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

  const captureGps = () => {
    setGettingGps(true);
    if (!navigator.geolocation) {
      toast({ title: 'GPS unavailable', description: 'Device does not support GPS', variant: 'destructive' });
      setGettingGps(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({ ...form, service_encounter_gps: `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}` });
        toast({ title: 'GPS captured', description: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}` });
        setGettingGps(false);
      },
      (err) => {
        toast({ title: 'GPS failed', description: err.message, variant: 'destructive' });
        setGettingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAdd = async () => {
    // Service encounter GPS enforcement
    if (form.service_encounter_type && form.service_encounter_type !== 'none' && !form.service_encounter_gps) {
      toast({ title: 'GPS required', description: 'GPS coordinates required when a service is encountered.', variant: 'destructive' });
      return;
    }
    // Pit stability enforcement
    if (form.log_type === 'pit_excavation' && (!form.pit_stability_rating || form.pit_stability_rating === 'not_assessed')) {
      toast({ title: 'Stability required', description: 'Please assess pit wall stability before saving.', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      const payload = {
        job_id: jobId,
        staff_id: staffId,
        staff_name: staffName || '',
        date: todayStr,
        log_type: form.log_type,
        borehole_ref: form.borehole_ref || '',
        depth_from: form.depth_from ? parseFloat(form.depth_from) : null,
        depth_to: form.depth_to ? parseFloat(form.depth_to) : null,
        dimensions: form.dimensions || '',
        strata_descriptor: form.strata_descriptor || 'other',
        strata_description_detail: form.strata_description_detail || '',
        pit_stability_rating: form.pit_stability_rating || 'not_assessed',
        service_encounter_type: form.service_encounter_type || 'none',
        service_encounter_gps: form.service_encounter_gps || '',
        cbr_value: form.cbr_value ? parseFloat(form.cbr_value) : null,
        vane_strength: form.vane_strength ? parseFloat(form.vane_strength) : null,
        units_completed: form.units_completed ? parseFloat(form.units_completed) : null,
        units_label: form.units_label || '',
        description: form.description || '',
        photo_urls: form.photo_urls || '',
        created_at: new Date().toISOString(),
        manager_review_status: 'pending',
      };
      await base44.entities.InvestigationLog.create(payload);
      queryClient.invalidateQueries({ queryKey: ['investigation-logs-today', jobId, staffId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['log-quality-control'] });
      toast({ title: 'Log entry added' });
      setForm({
        ...form,
        depth_from: '', depth_to: '', dimensions: '',
        strata_description_detail: '', pit_stability_rating: 'not_assessed',
        service_encounter_type: 'none', service_encounter_gps: '',
        cbr_value: '', vane_strength: '',
        units_completed: '', units_label: '',
        description: '', photo_urls: '',
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

  const isPit = form.log_type === 'pit_excavation';
  const isInstallation = form.log_type === 'installation';
  const isServiceFound = form.service_encounter_type && form.service_encounter_type !== 'none';
  const photos = form.photo_urls ? form.photo_urls.split(',').filter(Boolean) : [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-4 h-4 text-amber-700" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Trial Pit Log</h3>
          <p className="text-xs text-slate-400">Pit mapping · Stability · Services · CBR</p>
        </div>
        {todayLogs.length > 0 && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">{todayLogs.length} today</span>
        )}
      </div>

      {todayLogs.length > 0 && (
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {todayLogs.map(log => {
            const svcCfg = serviceEncounterConfig[log.service_encounter_type] || serviceEncounterConfig.none;
            return (
              <div key={log.id} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-mono font-bold text-amber-700">{log.borehole_ref || '—'}</span>
                    {log.dimensions && <span className="text-xs text-slate-600">{log.dimensions}</span>}
                    {log.pit_stability_rating && log.pit_stability_rating !== 'not_assessed' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${log.pit_stability_rating === 'stable' ? 'bg-emerald-100 text-emerald-700' : log.pit_stability_rating === 'minor_slumping' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {log.pit_stability_rating.replace(/_/g, ' ')}
                      </span>
                    )}
                    {log.service_encounter_type && log.service_encounter_type !== 'none' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${svcCfg.color}`}>
                        {svcCfg.label}
                      </span>
                    )}
                    {log.cbr_value != null && <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">CBR {log.cbr_value}%</span>}
                    {log.vane_strength != null && <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">Vane {log.vane_strength}kPa</span>}
                  </div>
                  {log.strata_description_detail && <p className="text-xs text-slate-600 mt-0.5">{log.strata_description_detail}</p>}
                  {log.description && <p className="text-xs text-slate-500 mt-0.5">{log.description}</p>}
                </div>
                <button onClick={() => handleDelete(log.id)} className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">New Pit / Installation Entry</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex gap-1.5">
            {groundworksLogTypes.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, log_type: t.value })}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium border transition ${form.log_type === t.value ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {(isPit || isInstallation) && (
            <>
              <div>
                <label className={labelCls}>{isPit ? 'Pit Reference' : 'Location Ref'}</label>
                <input type="text" value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                  placeholder={isPit ? "TP-01" : "e.g. Area A"} className={inputCls} />
              </div>

              {isPit && (
                <>
                  <div>
                    <label className={labelCls}>Dimensions</label>
                    <input type="text" value={form.dimensions} onChange={e => setForm({ ...form, dimensions: e.target.value })}
                      placeholder="1.2m x 0.8m x 1.5m deep" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}><Ruler className="w-3 h-3 inline" /> Depth From (m)</label>
                      <input type="number" step="0.1" min="0" value={form.depth_from} onChange={e => setForm({ ...form, depth_from: e.target.value })}
                        className={inputCls} placeholder="0.0" />
                    </div>
                    <div>
                      <label className={labelCls}>Depth To (m)</label>
                      <input type="number" step="0.1" min="0" value={form.depth_to} onChange={e => setForm({ ...form, depth_to: e.target.value })}
                        className={inputCls} placeholder="1.5" />
                    </div>
                  </div>
                </>
              )}

              {isPit && (
                <>
                  {/* Strata */}
                  <div>
                    <label className={labelCls}>Strata Classification</label>
                    <select value={form.strata_descriptor} onChange={e => setForm({ ...form, strata_descriptor: e.target.value })} className={inputCls}>
                      {strataOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Strata Description</label>
                    <textarea value={form.strata_description_detail} onChange={e => setForm({ ...form, strata_description_detail: e.target.value })} rows={2}
                      placeholder="e.g. brown sandy topsoil with rootlets"
                      className={`${inputCls} resize-none`} />
                  </div>

                  {/* Pit stability — MANDATORY */}
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      <p className="text-xs font-semibold text-amber-700">Wall Stability (Required)</p>
                    </div>
                    <select value={form.pit_stability_rating} onChange={e => setForm({ ...form, pit_stability_rating: e.target.value })} className={inputCls}>
                      {pitStabilityOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>

                  {/* Service encounter — forces GPS */}
                  <div className="p-2.5 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Waves className="w-3.5 h-3.5 text-red-600" />
                      <p className="text-xs font-semibold text-red-700">Service Encounter</p>
                    </div>
                    <select value={form.service_encounter_type} onChange={e => setForm({ ...form, service_encounter_type: e.target.value, service_encounter_gps: e.target.value === 'none' ? '' : form.service_encounter_gps })} className={inputCls}>
                      {serviceEncounterOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    {isServiceFound && (
                      <div className="mt-2">
                        <label className={labelCls}><MapPinned className="w-3 h-3 inline" /> GPS Coordinates (Required)</label>
                        <div className="flex gap-2">
                          <input type="text" value={form.service_encounter_gps} readOnly placeholder="Capture GPS…"
                            className={`${inputCls} flex-1 bg-slate-50 text-slate-500`} />
                          <button type="button" onClick={captureGps} disabled={gettingGps}
                            className="px-3 py-2 bg-red-700 text-white rounded-xl text-xs font-semibold hover:bg-red-800 transition disabled:opacity-50 whitespace-nowrap">
                            {gettingGps ? '…' : 'Capture'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* In-situ testing */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}><Gauge className="w-3 h-3 inline" /> CBR (%)</label>
                      <input type="number" step="0.1" min="0" value={form.cbr_value} onChange={e => setForm({ ...form, cbr_value: e.target.value })}
                        className={inputCls} placeholder="—" />
                    </div>
                    <div>
                      <label className={labelCls}>Hand Vane (kPa)</label>
                      <input type="number" step="1" min="0" value={form.vane_strength} onChange={e => setForm({ ...form, vane_strength: e.target.value })}
                        className={inputCls} placeholder="—" />
                    </div>
                  </div>
                </>
              )}

              {isInstallation && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Units Completed</label>
                    <input type="number" min="0" step="1" value={form.units_completed} onChange={e => setForm({ ...form, units_completed: e.target.value })}
                      placeholder="e.g. 2" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Unit Label</label>
                    <input type="text" value={form.units_label} onChange={e => setForm({ ...form, units_label: e.target.value })}
                      placeholder="e.g. EV chargers" className={inputCls} />
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Description / Observations</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  placeholder="Ground conditions, observations, obstructions..."
                  className={`${inputCls} resize-none`} />
              </div>

              {/* Photo upload */}
              <div>
                <label className={labelCls}>Evidence Photos</label>
                <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 hover:border-amber-400 hover:text-amber-600 cursor-pointer transition">
                  {uploadingPhoto ? 'Uploading…' : <><Plus className="w-3.5 h-3.5" /> Attach Photo</>}
                  <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
                </label>
                {photos.length > 0 && <p className="text-xs text-emerald-700 mt-1">{photos.length} photo(s) attached</p>}
              </div>
            </>
          )}

          <button onClick={handleAdd} disabled={adding}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-700 text-white rounded-xl hover:bg-amber-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
            {adding ? 'Adding…' : <><Send className="w-4 h-4" /> Add Log Entry</>}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 active:scale-95 transition text-sm font-semibold border border-amber-200 touch-manipulation">
          <Plus className="w-4 h-4" /> Log Pit / Installation
        </button>
      )}
    </div>
  );
}