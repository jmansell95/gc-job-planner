import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
  Archive, Users, Briefcase, CalendarDays, UserX, AlertCircle, Building2,
} from 'lucide-react';

export default function LegacyArchiveImport() {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
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
      toast({ title: 'File uploaded', description: 'Analyzing legacy sheets…' });
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
      const res = await base44.functions.invoke('importLegacyArchive', { file_url: url, dry_run: true });
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
      const res = await base44.functions.invoke('importLegacyArchive', { file_url: fileUrl, dry_run: false });
      setResult(res.data);
      toast({
        title: 'Legacy import complete',
        description: `Created ${res.data.summary.rotas_created || 0} historical rota assignments.`,
      });
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Import failed';
      setError(msg);
    } finally {
      setApplying(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setPreview(null);
    setFile(null);
    setFileUrl(null);
    setError(null);
  };

  return (
    <div className="insight-card rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Archive className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Legacy Archive Import</h2>
          <p className="text-sm text-slate-500">Import prehistoric data from old planner tabs. Matches staff & jobs to existing records — never creates new ones.</p>
        </div>
      </div>

      {result ? (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-800">Import Complete</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-center">
              <p className="text-2xl font-bold text-slate-700">{result.summary.total_assignments}</p>
              <p className="text-xs text-slate-500">Total Rows</p>
            </div>
            <div className="bg-emerald-50 rounded-lg px-3 py-2 text-center">
              <p className="text-2xl font-bold text-emerald-600">{result.summary.matched_staff}</p>
              <p className="text-xs text-emerald-600">Matched Staff</p>
            </div>
            <div className="bg-emerald-50 rounded-lg px-3 py-2 text-center">
              <p className="text-2xl font-bold text-emerald-600">{result.summary.matched_jobs}</p>
              <p className="text-xs text-emerald-600">Matched Jobs</p>
            </div>
            <div className="bg-rose-50 rounded-lg px-3 py-2 text-center">
              <p className="text-2xl font-bold text-rose-600">{result.summary.unmatched_staff}</p>
              <p className="text-xs text-rose-600">Unmatched Staff</p>
            </div>
            <div className="bg-rose-50 rounded-lg px-3 py-2 text-center">
              <p className="text-2xl font-bold text-rose-600">{result.summary.unmatched_jobs}</p>
              <p className="text-xs text-rose-600">Unmatched Jobs</p>
            </div>
            <div className="bg-teal-50 rounded-lg px-3 py-2 text-center">
              <p className="text-2xl font-bold text-teal-600">{result.summary.rotas_created || 0}</p>
              <p className="text-xs text-teal-600">Rotas Created</p>
            </div>
          </div>
          {result.unmatched_staff?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-rose-700 mb-1.5 flex items-center gap-1.5">
                <UserX className="w-4 h-4" /> Unmatched Staff ({result.unmatched_staff.length}) — not in the system
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {result.unmatched_staff.map((s, i) => (
                  <span key={i} className="text-xs bg-rose-100 text-rose-600 rounded-full px-2.5 py-1">{s}</span>
                ))}
              </div>
            </div>
          )}
          {result.unmatched_jobs?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-rose-700 mb-1.5 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Unmatched Jobs ({result.unmatched_jobs.length}) — not in the system
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {result.unmatched_jobs.map((j, i) => (
                  <span key={i} className="text-xs bg-rose-100 text-rose-600 rounded-full px-2.5 py-1">{j}</span>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleReset} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium text-sm hover:bg-slate-200 transition">
            Start New Legacy Import
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-3">
            <label className="flex-1 cursor-pointer">
              <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
              <div className="border-2 border-dashed border-slate-300 rounded-xl px-4 py-5 text-center hover:border-amber-500 hover:bg-amber-50/40 transition">
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-slate-700">
                    <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-medium">{file.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400">
                    <UploadCloud className="w-6 h-6" />
                    <span className="text-sm">Click to choose a legacy file</span>
                  </div>
                )}
              </div>
            </label>
            <button
              onClick={handleUpload}
              disabled={!file || uploading || analyzing}
              className="bg-amber-600 text-white px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-amber-700"
            >
              {uploading || analyzing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {uploading ? 'Uploading…' : 'Analyzing…'}</>
              ) : (
                <><UploadCloud className="w-4 h-4" /> Upload &amp; Analyze</>
              )}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-slate-700 mb-2">Legacy Sheets Found ({preview.summary.legacy_sheets.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.summary.legacy_sheets.map((s, i) => (
                    <span key={i} className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-1 font-medium">{s}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xl font-bold text-slate-700">{preview.summary.total_assignments}</p>
                  <p className="text-xs text-slate-500">Total Rows</p>
                </div>
                <div className="bg-emerald-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xl font-bold text-emerald-600">{preview.summary.matched_staff}</p>
                  <p className="text-xs text-emerald-600">Matched Staff</p>
                </div>
                <div className="bg-emerald-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xl font-bold text-emerald-600">{preview.summary.matched_jobs}</p>
                  <p className="text-xs text-emerald-600">Matched Jobs</p>
                </div>
                <div className="bg-rose-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xl font-bold text-rose-600">{preview.summary.unmatched_staff}</p>
                  <p className="text-xs text-rose-600">Unmatched Staff</p>
                </div>
                <div className="bg-rose-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xl font-bold text-rose-600">{preview.summary.unmatched_jobs}</p>
                  <p className="text-xs text-rose-600">Unmatched Jobs</p>
                </div>
                <div className="bg-teal-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xl font-bold text-teal-600">{preview.summary.rotas_to_create}</p>
                  <p className="text-xs text-teal-600">Rotas to Create</p>
                </div>
              </div>

              {preview.sheet_breakdown?.length > 0 && (
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Sheet Breakdown</p>
                  <div className="space-y-1">
                    {preview.sheet_breakdown.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium">{s.sheet}</span>
                        <span>{s.assignments} rows {s.date_range ? `(${s.date_range.from} → ${s.date_range.to})` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.unmatched_staff?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-rose-700 mb-1.5 flex items-center gap-1.5">
                    <UserX className="w-4 h-4" /> Unmatched Staff ({preview.unmatched_staff.length}) — won't be imported
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {preview.unmatched_staff.map((s, i) => (
                      <span key={i} className="text-xs bg-rose-100 text-rose-600 rounded-full px-2.5 py-1">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {preview.unmatched_jobs?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-rose-700 mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Unmatched Jobs ({preview.unmatched_jobs.length}) — won't be imported
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {preview.unmatched_jobs.map((j, i) => (
                      <span key={i} className="text-xs bg-rose-100 text-rose-600 rounded-full px-2.5 py-1">{j}</span>
                    ))}
                  </div>
                </div>
              )}

              {preview.summary.rotas_to_create > 0 ? (
                <div className="flex gap-3">
                  <button
                    onClick={handleApply}
                    disabled={applying}
                    className="bg-amber-600 text-white px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition hover:bg-amber-700"
                  >
                    {applying ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</> : <><CheckCircle2 className="w-4 h-4" /> Import {preview.summary.rotas_to_create} Historical Rotas</>}
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={applying}
                    className="px-5 py-3 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="bg-slate-100 rounded-lg px-4 py-3 text-sm text-slate-500 text-center">
                  No new historical rotas to create — all matching assignments already exist in the system.
                </div>
              )}
            </div>
          )}

          {!preview && !analyzing && !error && (
            <p className="text-xs text-slate-400">
              Upload the same planner file. This tool reads all tabs that the active importer skips (everything except "Team Planner 2026_GW+Depot" and "Drillers") and creates historical rota assignments for staff and jobs that already exist in the system.
            </p>
          )}
        </>
      )}
    </div>
  );
}