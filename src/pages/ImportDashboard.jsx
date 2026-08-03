import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Users, Briefcase, CalendarDays, Trash2, HardHat, Wrench, AlertCircle } from 'lucide-react';

export default function ImportDashboard() {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setFileUrl(null);
      setPreview(null);
      setError(null);
    }
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
      const res = await base44.functions.invoke('importPlannerSpreadsheet', {
        file_url: url,
        dry_run: true
      });
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
      const res = await base44.functions.invoke('importPlannerSpreadsheet', {
        file_url: fileUrl,
        dry_run: false
      });
      const s = res.data.summary;
      toast({
        title: 'Import complete',
        description: `Created ${s.rotas.created} rotas, ${s.staff.new} staff, ${s.jobs.new} jobs. Deleted ${s.rotas.deleted} stale assignments.`
      });
      setPreview(null);
      setFile(null);
      setFileUrl(null);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Import failed';
      setError(msg);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
        {/* Upload Card */}
        <div className="insight-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">1. Upload Spreadsheet</h2>
          <p className="text-sm text-slate-500 mb-4">Select your <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">.xlsx</code> planner file to begin.</p>

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

          {error && (
            <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Preview Card */}
        {preview && (
          <div className="insight-card rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">2. Review Import Preview</h2>
            <p className="text-sm text-slate-500 mb-4">
              Date range: <span className="font-medium text-slate-700">{preview.summary.date_range.from}</span> →{' '}
              <span className="font-medium text-slate-700">{preview.summary.date_range.to}</span>
            </p>

            {/* Dedup guarantee banner */}
            <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span><strong>Single-entry deduplication active.</strong> Existing staff, jobs, teams &amp; rotas are matched case-insensitively — nothing is duplicated.</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatTile icon={Users} label="Staff" total={preview.summary.staff.total} sub={`${preview.summary.staff.found} found · ${preview.summary.staff.new} new`} color="blue" />
              <StatTile icon={Briefcase} label="Jobs" total={preview.summary.jobs.total} sub={`${preview.summary.jobs.found} found · ${preview.summary.jobs.new} new`} color="emerald" />
              <StatTile icon={CalendarDays} label="Rotas to Create" total={preview.summary.rotas.to_create} color="amber" />
              <StatTile icon={Trash2} label="Rotas to Delete" total={preview.summary.rotas.to_delete} color="rose" />
            </div>

            {/* Subcontractor / Direct Employee split */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <HardHat className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-indigo-900">Subcontractors</p>
                  <p className="text-xs text-indigo-700">{preview.summary.staff.subcontractors} person(s) → Subcontractors team</p>
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900">Direct Employees</p>
                  <p className="text-xs text-emerald-700">{preview.summary.staff.total - preview.summary.staff.subcontractors} person(s) → crew-section teams</p>
                </div>
              </div>
            </div>

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

            {preview.new_staff?.length > 0 && (
              <DetailList title={`New Staff (${preview.summary.staff.new})`} items={preview.new_staff.map(s => `${s.name} — ${s.email} · ${s.team}`)} />
            )}
            {preview.staff_updates?.length > 0 && (
              <DetailList title={`Staff Updates (${preview.staff_updates.length})`} items={preview.staff_updates.map(s => `${s.name} — ${Object.keys(s.updates).join(', ')}`)} />
            )}
            {preview.new_jobs?.length > 0 && (
              <DetailList title={`New Jobs (${preview.summary.jobs.new})`} items={preview.new_jobs.map(j => j.name)} />
            )}
            {preview.job_updates?.length > 0 && (
              <DetailList title={`Job Updates (${preview.job_updates.length})`} items={preview.job_updates.map(j => `${j.name} — ${Object.keys(j.updates).join(', ')}`)} />
            )}
            {preview.new_teams?.length > 0 && (
              <DetailList title="New Teams" items={preview.new_teams} />
            )}
            {preview.new_rig_assignments?.length > 0 && (
              <DetailList title={`New Rig Assignments (${preview.new_rig_assignments.length})`} items={preview.new_rig_assignments.map(ra => `${ra.asset_name} → ${ra.job_name} (${ra.assigned_date})`)} />
            )}

            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Confirming will <strong>create {preview.summary.rotas.to_create} new rota assignments</strong> and{' '}
                <strong>delete {preview.summary.rotas.to_delete} existing assignments</strong> in this date range that are not in the spreadsheet.
                Staff and jobs are never deleted — only created if missing.
              </span>
            </div>

            <div className="mt-5 flex gap-3">
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
        )}

        {/* How it works */}
        {!preview && !analyzing && (
          <div className="insight-card rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">How it works</h2>
            <ol className="space-y-3 text-sm text-slate-600">
              <Step n={1} title="Upload your planner file">The Excel file is uploaded and parsed directly — no third-party AI involved.</Step>
              <Step n={2} title="Extract crews, jobs &amp; rotas">The system reads the grid — staff names, job names, dates, and crew sections — and matches them against your existing records.</Step>
              <Step n={3} title="Single-entry deduplication">Staff, jobs, and teams are matched case-insensitively. Subcontractors (names with "subbies", "subcontractor", etc.) go into the Subcontractors team; everyone else goes into their crew-section team as a Direct Employee.</Step>
              <Step n={4} title="Review the preview">See exactly what will be created, updated, or deleted — with found vs new counts and any warnings — before anything changes.</Step>
              <Step n={5} title="Confirm &amp; apply">On confirm, missing staff/jobs/teams are created in batch, new rota assignments are added, and stale ones (in the sheet's date range) are removed.</Step>
            </ol>
            <div className="mt-4 text-xs text-slate-400 bg-slate-50 rounded-lg px-4 py-3">
              <strong>Note:</strong> Staff without an email are auto-created with <code className="text-xs bg-slate-100 px-1 rounded">firstname.lastname@ground-control.co.uk</code>. Only rota assignments within the spreadsheet's date range are affected — historical data outside that range is untouched.
            </div>
          </div>
        )}
    </div>
  );
}

function StatTile({ icon: Icon, label, total, sub, color }) {
  const colors = {
    blue: 'stat-gradient-blue',
    emerald: 'stat-gradient-emerald',
    amber: 'stat-gradient-amber',
    rose: 'stat-gradient-rose'
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

function DetailList({ title, items }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 5);
  return (
    <div className="mb-4">
      <p className="text-sm font-semibold text-slate-700 mb-2">{title}</p>
      <ul className="space-y-1">
        {shown.map((item, i) => (
          <li key={i} className="text-sm text-slate-600 bg-slate-50 rounded px-3 py-1.5">{item}</li>
        ))}
      </ul>
      {items.length > 5 && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-emerald-700 font-medium mt-1.5 hover:underline">
          {expanded ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}
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