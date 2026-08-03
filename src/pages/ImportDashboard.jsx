import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
  Users, Briefcase, CalendarDays, Trash2, HardHat, AlertCircle, RefreshCw,
  ChevronDown, ChevronRight, MapPin, Building2, UserX, Layers, Clock,
  Palmtree, Thermometer, GraduationCap, Building
} from 'lucide-react';
import LegacyArchiveImport from '@/components/import/LegacyArchiveImport';

export default function ImportDashboard() {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null);
  const [applyResult, setApplyResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setFileUrl(null); setPreview(null); setError(null); }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFileUrl(file_url);
      toast({ title: 'File uploaded', description: 'Analyzing spreadsheet…' });
      await runAnalysis(file_url);
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const runAnalysis = async (url) => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('importPlannerSpreadsheet', { file_url: url, dry_run: true });
      setPreview(res.data);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Analysis failed';
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async () => {
    if (!fileUrl) return;
    setApplying(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('importPlannerSpreadsheet', { file_url: fileUrl, dry_run: false });
      setApplyResult(res.data);
      const s = res.data.summary;
      toast({
        title: 'Import complete',
        description: `Wiped ${s.purge.staff_deleted} staff, ${s.purge.jobs_deleted} jobs, ${s.purge.teams_deleted} teams. Created ${s.rotas.created} rotas, ${s.staff.new} staff, ${s.jobs.new} jobs.`
      });
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Import failed';
      setError(msg);
    } finally {
      setApplying(false);
    }
  };

  const handleReset = () => {
    setApplyResult(null);
    setPreview(null);
    setFile(null);
    setFileUrl(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Completion breakdown — shown after applying */}
      {applyResult && (
        <div className="space-y-4">
          <div className="insight-card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Import Complete — Full Breakdown</h2>
                <p className="text-sm text-slate-500">
                  Wiped everything and rebuilt from {applyResult.summary.target_tabs?.length || 0} tab(s):{' '}
                  <span className="font-medium text-slate-700">{applyResult.summary.target_tabs?.join(', ')}</span>
                </p>
              </div>
            </div>

            {/* Purge + create summary */}
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                <p className="text-sm font-semibold text-red-800">Wiped (Deleted)</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{applyResult.summary.purge.staff_deleted}</span> staff</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{applyResult.summary.purge.jobs_deleted}</span> jobs</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{applyResult.summary.purge.teams_deleted}</span> teams</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{applyResult.summary.purge.crews_deleted}</span> crews</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{applyResult.summary.purge.rotas_deleted}</span> rotas</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{applyResult.summary.purge.asset_assignments_deleted}</span> asset assignments</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{applyResult.summary.purge.training_bookings_deleted || 0}</span> training bookings</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{applyResult.summary.purge.absences_deleted || 0}</span> absences</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
              <StatTile icon={Users} label="Staff Created" total={applyResult.summary.staff.new} sub={`${applyResult.summary.staff.subcontractors} subcon`} color="blue" />
              <StatTile icon={Briefcase} label="Jobs Created" total={applyResult.summary.jobs.new} sub={`${applyResult.summary.jobs.completed} completed`} color="emerald" />
              <StatTile icon={CalendarDays} label="Rotas Created" total={applyResult.summary.rotas.created} sub={`${applyResult.summary.rotas.duplicates_collapsed} dupes`} color="amber" />
              <StatTile icon={Building2} label="Teams" total={applyResult.summary.teams.total} sub={`${applyResult.summary.teams.new} new`} color="teal" />
              <StatTile icon={CheckCircle2} label="Completed Jobs" total={applyResult.summary.jobs.completed} sub="past dates" color="slate" />
              <StatTile icon={Clock} label="In Progress" total={applyResult.summary.jobs.in_progress} sub="today/future" color="teal" />
              <StatTile icon={Layers} label="Projects" total={(applyResult.summary.projects?.existing_matched || 0) + (applyResult.summary.projects?.new_created || 0)} sub={`${applyResult.summary.projects?.new_created || 0} new`} color="violet" />
              <StatTile icon={GraduationCap} label="Training" total={(applyResult.summary.training?.courses_new || 0) + (applyResult.summary.training?.courses_matched || 0)} sub={`${applyResult.summary.training?.bookings_created || 0} bookings`} color="indigo" />
              <StatTile icon={Palmtree} label="Absences" total={applyResult.summary.absences?.created || 0} sub={`${applyResult.summary.absences?.holiday || 0} hol · ${applyResult.summary.absences?.sick || 0} sick`} color="rose" />
            </div>

            {/* Agency breakdown */}
            {applyResult.summary.agencies?.total > 0 && (
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Building className="w-4 h-4" /> Agency Suppliers ({applyResult.summary.agencies.total})
                </p>
                <div className="space-y-1.5">
                  {Object.entries(applyResult.summary.agencies.breakdown).map(([agencyName, data], i) => (
                    <div key={i} className="bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-cyan-600" />
                        <span className="text-sm font-medium text-cyan-900">{agencyName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-cyan-700">
                        <span><strong>{data.workers}</strong> workers</span>
                        <span><strong>{data.assignments}</strong> assignments</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skipped sheets */}
            {applyResult.summary.skipped_sheets?.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-3">
                <p className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Skipped Tabs ({applyResult.summary.skipped_sheets.length}) — Prehistoric Data
                </p>
                <div className="flex flex-wrap gap-2">
                  {applyResult.summary.skipped_sheets.map((s, i) => (
                    <span key={i} className="text-xs bg-slate-200 text-slate-500 rounded-full px-3 py-1 line-through">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleReset}
              className="command-gradient text-white px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition hover:shadow-lg"
            >
              <RefreshCw className="w-4 h-4" /> Start New Import
            </button>
          </div>

          {/* Staff breakdown */}
          {applyResult.staff_breakdown?.length > 0 && (
            <CollapsibleSection title={`Staff Created (${applyResult.staff_breakdown.length})`} icon={Users} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {applyResult.staff_breakdown.map((s, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{s.name}</span>
                        <span className={`text-xs rounded-full px-2 py-0.5 ${s.worker_type === 'subcontractor' ? 'bg-indigo-100 text-indigo-700' : s.worker_type === 'agency' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                          {s.worker_type === 'subcontractor' ? 'Subcon' : s.worker_type === 'agency' ? 'Agency' : 'Direct'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{s.assignment_count} assignments</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>📧 {s.email}</span>
                      <span>👥 {s.team}</span>
                      {s.job_title && <span>🔧 {s.job_title}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Jobs breakdown */}
          {applyResult.jobs_breakdown?.length > 0 && (
            <CollapsibleSection title={`Jobs Created (${applyResult.jobs_breakdown.length})`} icon={Briefcase} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {applyResult.jobs_breakdown.map((j, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{j.name}</span>
                      <StatusBadge status={j.status} />
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {j.reference && <span>🏷️ {j.reference}</span>}
                      {j.location && <span><MapPin className="w-3 h-3 inline" /> {j.location}</span>}
                      <span>📅 {j.start_date || '—'} → {j.end_date || '—'}</span>
                      <span>👷 {j.staff_count} staff</span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Training breakdown */}
          {applyResult.training_breakdown?.length > 0 && (
            <CollapsibleSection title={`Training Courses (${applyResult.training_breakdown.length})`} icon={GraduationCap} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {applyResult.training_breakdown.map((t, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{t.title}</span>
                        {t.is_new && <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">NEW</span>}
                        <span className={`text-xs rounded-full px-2 py-0.5 ${t.status === 'completed' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>
                          {t.status === 'completed' ? 'Completed' : 'Scheduled'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{t.staff_count} staff</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>📅 {t.start_date}{t.end_date !== t.start_date ? ` → ${t.end_date}` : ''}</span>
                      <span>🏷️ {t.category}</span>
                      <span>👥 {t.staff_names.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Absence breakdown */}
          {applyResult.absence_breakdown?.length > 0 && (
            <CollapsibleSection title={`Absences (${applyResult.absence_breakdown.length})`} icon={Palmtree} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {applyResult.absence_breakdown.map((a, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{a.staff_name}</span>
                        <span className={`text-xs rounded-full px-2 py-0.5 ${a.reason === 'holiday' ? 'bg-teal-100 text-teal-700' : a.reason === 'sick' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700'}`}>
                          {a.reason === 'holiday' ? 'Holiday' : a.reason === 'sick' ? 'Sick' : 'Training'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{a.days} day{a.days !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>📅 {a.start_date}{a.end_date !== a.start_date ? ` → ${a.end_date}` : ''}</span>
                      {a.notes && <span>📝 {a.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* Upload Card */}
      <div className="insight-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">1. Upload Spreadsheet</h2>
        <p className="text-sm text-slate-500 mb-4">
          Select your <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">.xlsx</code> planner file. Only the <strong>"Team Planner 2026_GW+Depot"</strong> and <strong>"Drillers"</strong> tabs are imported — all other tabs are ignored. Every import <strong>wipes all old rota data</strong> and replaces it with the spreadsheet contents.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <label className="flex-1 cursor-pointer">
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
            <div className="border-2 border-dashed border-slate-300 rounded-xl px-4 py-6 text-center hover:border-emerald-500 hover:bg-emerald-50/40 transition">
              {file ? (
                <div className="flex items-center justify-center gap-2 text-slate-700">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <UploadCloud className="w-6 h-6" />
                  <span className="text-sm">Click to choose a file</span>
                </div>
              )}
            </div>
          </label>
          <button
            onClick={handleUpload}
            disabled={!file || uploading || analyzing}
            className="command-gradient text-white px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition hover:shadow-lg"
          >
            {uploading || analyzing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {uploading ? 'Uploading…' : 'Analyzing…'}</>
            ) : (
              <><UploadCloud className="w-4 h-4" /> Upload &amp; Analyze</>
            )}
          </button>
        </div>

        {/* Clean-slate warning */}
        <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <RefreshCw className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span><strong>Full wipe mode:</strong> Importing will delete ALL existing staff, teams, jobs, drilling crews, rota assignments, asset assignments, training bookings, and absences — then rebuild everything fresh from this spreadsheet. This happens every time you upload.</span>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Preview / Full Breakdown */}
      {preview && (
        <div className="space-y-4">
          {/* Summary tiles */}
          <div className="insight-card rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">2. Review Full Breakdown</h2>
            <p className="text-sm text-slate-500 mb-4">
              Date range: <span className="font-medium text-slate-700">{preview.summary.date_range.from}</span> →{' '}
              <span className="font-medium text-slate-700">{preview.summary.date_range.to}</span>
              <span className="ml-2 text-xs text-slate-400">(today: {preview.summary.today})</span>
            </p>

            {/* Full wipe summary */}
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                <p className="text-sm font-semibold text-red-800">Full Wipe — Everything Will Be Deleted</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.staff_deleted}</span> staff</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.jobs_deleted}</span> jobs</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.teams_deleted}</span> teams</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.crews_deleted}</span> crews</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.rotas_deleted}</span> rotas</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.asset_assignments_deleted}</span> asset assignments</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.training_bookings_deleted || 0}</span> training bookings</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.absences_deleted || 0}</span> absences</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
              <StatTile icon={Users} label="Staff" total={preview.summary.staff.total} sub={`${preview.summary.staff.new} new`} color="blue" />
              <StatTile icon={Briefcase} label="Jobs" total={preview.summary.jobs.total} sub={`${preview.summary.jobs.new} new`} color="emerald" />
              <StatTile icon={CalendarDays} label="Rotas" total={preview.summary.rotas.to_create} sub={`${preview.summary.rotas.duplicates_collapsed} dupes`} color="amber" />
              <StatTile icon={UserX} label="Leavers" total={preview.summary.staff.leavers_detected} sub="not in file" color="rose" />
              <StatTile icon={CheckCircle2} label="Completed Jobs" total={preview.summary.jobs.completed} sub="past dates" color="slate" />
              <StatTile icon={Clock} label="In Progress" total={preview.summary.jobs.in_progress} sub="today/future" color="teal" />
              <StatTile icon={Layers} label="Projects" total={(preview.summary.projects?.existing_matched || 0) + (preview.summary.projects?.new_created || 0)} sub={`${preview.summary.projects?.new_created || 0} new`} color="violet" />
              <StatTile icon={GraduationCap} label="Training" total={(preview.summary.training?.courses_new || 0) + (preview.summary.training?.courses_matched || 0)} sub={`${preview.summary.training?.bookings_created || 0} bookings`} color="indigo" />
              <StatTile icon={Palmtree} label="Absences" total={preview.summary.absences?.created || 0} sub={`${preview.summary.absences?.holiday || 0} hol · ${preview.summary.absences?.sick || 0} sick`} color="rose" />
            </div>

            {/* Subcon / Agency / Direct split */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <HardHat className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-indigo-900">Subcontractors: {preview.summary.staff.subcontractors}</p>
                  <p className="text-xs text-indigo-700">→ Subcontractors team</p>
                </div>
              </div>
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-cyan-900">Agency: {preview.summary.staff.agency}</p>
                  <p className="text-xs text-cyan-700">→ Grouped by supplying agency</p>
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900">Direct Employees: {preview.summary.staff.direct_employees}</p>
                  <p className="text-xs text-emerald-700">→ crew-section teams</p>
                </div>
              </div>
            </div>

            {/* Agency breakdown — workers grouped by supplying agency */}
            {preview.summary.agencies?.total > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Building className="w-4 h-4" /> Agency Suppliers ({preview.summary.agencies.total})
                </p>
                <div className="space-y-2">
                  {Object.entries(preview.summary.agencies.breakdown).map(([agencyName, data], i) => (
                    <div key={i} className="bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-cyan-600" />
                        <span className="text-sm font-medium text-cyan-900">{agencyName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-cyan-700">
                        <span><strong>{data.workers}</strong> workers</span>
                        <span><strong>{data.assignments}</strong> assignments</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Non-job days (Annual Leave / Sick / Training) */}
            {preview.summary.non_job_assignments && (preview.summary.non_job_assignments.annual_leave + preview.summary.non_job_assignments.sick + preview.summary.non_job_assignments.training) > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <Palmtree className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-teal-900">Annual Leave: {preview.summary.non_job_assignments.annual_leave}</p>
                    <p className="text-xs text-teal-700">days off (Off, Holiday, Golf day, AL)</p>
                  </div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <Thermometer className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-rose-900">Sick: {preview.summary.non_job_assignments.sick}</p>
                    <p className="text-xs text-rose-700">sick days</p>
                  </div>
                </div>
                <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-violet-900">Training: {preview.summary.non_job_assignments.training}</p>
                    <p className="text-xs text-violet-700">training course days</p>
                  </div>
                </div>
              </div>
            )}

            {/* Sections detected */}
            {preview.summary.sections_detected?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Sections Detected ({preview.summary.sections_detected.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {preview.summary.sections_detected.map((s, i) => (
                    <span key={i} className="text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-1 font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Skipped sheets */}
            {preview.summary.skipped_sheets?.length > 0 && (
              <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <p className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Skipped Tabs ({preview.summary.skipped_sheets.length}) — Prehistoric Data
                </p>
                <div className="flex flex-wrap gap-2">
                  {preview.summary.skipped_sheets.map((s, i) => (
                    <span key={i} className="text-xs bg-slate-200 text-slate-500 rounded-full px-3 py-1 line-through">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Sheets breakdown */}
            {preview.sheet_breakdown?.length > 0 && (
              <CollapsibleSection title={`Sheets Parsed (${preview.sheet_breakdown.length})`} icon={FileSpreadsheet}>
                <div className="space-y-2">
                  {preview.sheet_breakdown.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{s.sheet}</span>
                        {s.is_plant && <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">Plant</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>{s.assignments} assignments</span>
                        <span>{s.sections} sections</span>
                        {s.date_range ? (
                          <span className="text-emerald-600 font-medium">{s.date_range.from} → {s.date_range.to}</span>
                        ) : (
                          <span className="text-amber-600">no dates</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Warnings */}
            {preview.summary.warnings?.length > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm font-semibold text-amber-800">Warnings</p>
                </div>
                <ul className="space-y-1">
                  {preview.summary.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700">{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Leavers */}
          {preview.leavers?.length > 0 && (
            <div className="insight-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                  <UserX className="w-4 h-4 text-rose-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">
                  Staff Not in Spreadsheet ({preview.leavers.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                These staff have linked login accounts but don't appear in this spreadsheet. They will be marked as <strong>inactive (left the company)</strong> on import.
              </p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {preview.leavers.map((l, i) => (
                  <div key={i} className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-700">{l.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{l.email}</span>
                    </div>
                    <span className="text-xs text-rose-600 font-medium">Will be deactivated</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff breakdown */}
          {preview.staff_breakdown?.length > 0 && (
            <CollapsibleSection title={`Staff Breakdown (${preview.staff_breakdown.length})`} icon={Users} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {preview.staff_breakdown.map((s, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{s.name}</span>
                        {s.status === 'new' && <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">NEW</span>}
                        <span className={`text-xs rounded-full px-2 py-0.5 ${s.worker_type === 'subcontractor' ? 'bg-indigo-100 text-indigo-700' : s.worker_type === 'agency' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                          {s.worker_type === 'subcontractor' ? 'Subcon' : s.worker_type === 'agency' ? 'Agency' : 'Direct'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{s.assignment_count} assignments</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>📧 {s.email}</span>
                      <span>👥 {s.team}</span>
                      {s.agency_name && <span>🏢 {s.agency_name}</span>}
                      {s.job_title && <span>🔧 {s.job_title}</span>}
                      {s.date_range && <span>📅 {s.date_range.from} → {s.date_range.to}</span>}
                    </div>
                    {s.non_job_days?.length > 0 && (
                      <div className="text-xs mt-1 flex flex-wrap gap-1">
                        {s.non_job_days.map((d, i) => (
                          <span key={i} className={`rounded-full px-2 py-0.5 font-medium ${d.type === 'annual_leave' ? 'bg-teal-100 text-teal-700' : d.type === 'sick' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700'}`}>
                            {d.date}: {d.type === 'annual_leave' ? 'AL' : d.type === 'sick' ? 'Sick' : 'Training'}{d.label && d.label !== d.type ? ` (${d.label})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.jobs.length > 0 && (
                      <div className="text-xs text-slate-400 mt-1">
                        Jobs: {s.jobs.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Jobs breakdown */}
          {preview.jobs_breakdown?.length > 0 && (
            <CollapsibleSection title={`Jobs Breakdown (${preview.jobs_breakdown.length})`} icon={Briefcase} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {preview.jobs_breakdown.map((j, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{j.name}</span>
                        {j.status_new === 'new' && <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">NEW</span>}
                      </div>
                      <StatusBadge status={j.status} />
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {j.reference && <span>🏷️ {j.reference}</span>}
                      {j.location && <span><MapPin className="w-3 h-3 inline" /> {j.location}</span>}
                      <span>📅 {j.start_date || '—'} → {j.end_date || '—'}</span>
                      <span>👷 {j.staff_count} staff</span>
                      <span>📋 {j.assignment_count} assignments</span>
                    </div>
                    {j.crew_sections.length > 0 && (
                      <div className="text-xs text-slate-400 mt-1">
                        Sections: {j.crew_sections.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* New teams */}
          {preview.new_teams?.length > 0 && (
            <CollapsibleSection title={`New Teams (${preview.new_teams.length})`} icon={Building2}>
              <div className="flex flex-wrap gap-2">
                {preview.new_teams.map((t, i) => (
                  <span key={i} className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-1.5 font-medium">{t}</span>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* New projects */}
          {preview.summary.projects?.new_site_names?.length > 0 && (
            <CollapsibleSection title={`New Projects (${preview.summary.projects.new_site_names.length})`} icon={Layers} defaultOpen={false}>
              <div className="flex flex-wrap gap-2">
                {preview.summary.projects.new_site_names.map((p, i) => (
                  <span key={i} className="text-sm bg-violet-50 text-violet-700 rounded-lg px-3 py-1.5 font-medium">{p}</span>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Training breakdown */}
          {preview.training_breakdown?.length > 0 && (
            <CollapsibleSection title={`Training Courses (${preview.training_breakdown.length})`} icon={GraduationCap} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {preview.training_breakdown.map((t, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{t.title}</span>
                        {t.is_new && <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">NEW</span>}
                        <span className={`text-xs rounded-full px-2 py-0.5 ${t.status === 'completed' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>
                          {t.status === 'completed' ? 'Completed' : 'Scheduled'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{t.staff_count} staff</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>📅 {t.start_date}{t.end_date !== t.start_date ? ` → ${t.end_date}` : ''}</span>
                      <span>🏷️ {t.category}</span>
                      <span>👥 {t.staff_names.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Absence breakdown */}
          {preview.absence_breakdown?.length > 0 && (
            <CollapsibleSection title={`Absences (${preview.absence_breakdown.length})`} icon={Palmtree} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {preview.absence_breakdown.map((a, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{a.staff_name}</span>
                        <span className={`text-xs rounded-full px-2 py-0.5 ${a.reason === 'holiday' ? 'bg-teal-100 text-teal-700' : a.reason === 'sick' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700'}`}>
                          {a.reason === 'holiday' ? 'Holiday' : a.reason === 'sick' ? 'Sick' : 'Training'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{a.days} day{a.days !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>📅 {a.start_date}{a.end_date !== a.start_date ? ` → ${a.end_date}` : ''}</span>
                      {a.notes && <span>📝 {a.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* New rig assignments */}
          {preview.new_rig_assignments?.length > 0 && (
            <CollapsibleSection title={`Rig Assignments (${preview.new_rig_assignments.length})`} icon={Layers} defaultOpen={false}>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {preview.new_rig_assignments.map((ra, i) => (
                  <div key={i} className="text-sm bg-slate-50 rounded px-3 py-1.5 text-slate-600">
                    {ra.asset_name} → {ra.job_name} ({ra.assigned_date})
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Confirm bar */}
          <div className="insight-card rounded-2xl p-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Confirming will <strong>delete ALL existing staff, teams, jobs, crews, rotas, training bookings, and absences</strong>, then rebuild everything fresh from this spreadsheet.
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleApply}
                disabled={applying}
                className="command-gradient text-white px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition hover:shadow-lg"
              >
                {applying ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</> : <><CheckCircle2 className="w-4 h-4" /> Confirm &amp; Apply Import</>}
              </button>
              <button
                onClick={() => { setPreview(null); setFile(null); setFileUrl(null); }}
                disabled={applying}
                className="px-5 py-3 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Archive Import */}
      {!preview && !applyResult && (
        <LegacyArchiveImport />
      )}

      {/* How it works */}
      {!preview && !analyzing && (
        <div className="insight-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">How it works</h2>
          <ol className="space-y-3 text-sm text-slate-600">
            <Step n={1} title="Upload your planner file">The Excel file is uploaded and parsed directly — no third-party AI involved.</Step>
            <Step n={2} title="Targeted tab import">Only two tabs are imported: <strong>"Team Planner 2026_GW+Depot"</strong> (Groundworkers &amp; Depot Staff) and <strong>"Drillers"</strong> (drilling team). All other tabs are treated as prehistoric data and skipped.</Step>
            <Step n={3} title="Date-aware job status">Jobs with all past dates are marked <strong>completed</strong>. Jobs with any today/future dates are marked <strong>in_progress</strong>. New jobs with no dates yet are <strong>planning</strong>.</Step>
            <Step n={4} title="Leaver detection">Staff with linked logins who aren't in this spreadsheet are flagged as leavers and will be marked inactive on import.</Step>
            <Step n={5} title="Absences &amp; training">Non-job days (holiday, sick, training) create Absence records in the Absence Manager — grouped by staff and week. Training courses create TrainingCourse + TrainingBooking records linked to staff.</Step>
            <Step n={6} title="Full breakdown review">See every staff member, every job, every section, every sheet, and every leaver before you confirm — so you can drill down and verify everything is correct.</Step>
            <Step n={7} title="Full wipe &amp; rebuild">On confirm, ALL existing staff, teams, jobs, drilling crews, rota assignments, asset assignments, training bookings, and absences are deleted. The spreadsheet becomes the single source of truth — everything is rebuilt fresh from scratch every time you upload.</Step>
          </ol>
        </div>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, total, sub, color }) {
  const colors = {
    blue: 'stat-gradient-blue', emerald: 'stat-gradient-emerald',
    amber: 'stat-gradient-amber', rose: 'stat-gradient-rose',
    slate: 'stat-gradient-slate', teal: 'stat-gradient-teal',
    violet: 'stat-gradient-violet', indigo: 'stat-gradient-indigo',
  };
  return (
    <div className={`${colors[color]} rounded-xl p-4 text-white`}>
      <Icon className="w-5 h-5 mb-2 opacity-80" />
      <p className="text-2xl font-bold tabular-nums">{total}</p>
      <p className="text-xs opacity-90">{label}</p>
      {sub && <p className="text-[11px] mt-1 bg-white/20 rounded-full px-2 py-0.5 inline-block">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    completed: { label: 'Completed', cls: 'bg-slate-200 text-slate-700' },
    in_progress: { label: 'In Progress', cls: 'bg-teal-100 text-teal-700' },
    planning: { label: 'Planning', cls: 'bg-blue-100 text-blue-700' },
  };
  const cfg = map[status] || map.planning;
  return <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${cfg.cls}`}>{cfg.label}</span>;
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="insight-card rounded-2xl p-6">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        {Icon && <Icon className="w-4 h-4 text-slate-500" />}
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">{n}</span>
      <div>
        <p className="font-medium text-slate-700" dangerouslySetInnerHTML={{ __html: title }} />
        <p className="text-slate-500" dangerouslySetInnerHTML={{ __html: children }} />
      </div>
    </li>
  );
}