import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Link2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

export default function AGSImportSettings() {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-ags-import'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
  });

  const handleFile = (e) => {
    setFile(e.target.files?.[0] || null);
    setResult(null);
    setError('');
  };

  const handleImport = async () => {
    if (!file) { setError('Please choose an AGS file first.'); return; }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('importAGS', { file_url, job_id: jobId || null });
      setResult(res.data);
      toast({ title: 'AGS data imported', description: `${res.data.inserted} log entries added to ${res.data.job_name}.` });
      setFile(null);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Import failed';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <SettingsSectionHeader
        title="AGS Import (KeyLogBook)"
        description="Upload an AGS data export from KeyLogBook. Re-importing overwrites the previous data for the job — borehole locations, strata, core runs, installations, water readings, samples and SPT results are refreshed each time. Core data in the GEOL group is detected automatically."
        icon={UploadCloud}
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        {/* Job selector */}
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Link2 className="w-4 h-4 text-slate-400" /> Target job (optional)
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Leave blank to auto-match using the job reference number against the AGS <code className="text-slate-600">PROJ_ID</code>. Pick a job manually to override.
          </p>
          <select
            value={jobId}
            onChange={e => setJobId(e.target.value)}
            disabled={busy}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white"
          >
            <option value="">Auto-match by job reference</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>
                {j.name}{j.job_reference ? ` · ${j.job_reference}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* File picker */}
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">AGS export file</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className={`flex-1 flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition ${file ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'} ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
              <FileText className={`w-5 h-5 ${file ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="text-sm text-slate-600 truncate">
                {file ? file.name : 'Choose .ags file…'}
              </span>
              <input type="file" accept=".ags,.txt,.csv" onChange={handleFile} className="hidden" />
            </label>
            <button
              onClick={handleImport}
              disabled={!file || busy}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {busy ? 'Importing…' : 'Import AGS data'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">
                Imported {result.inserted} log entries into {result.job_name}
                {result.deleted > 0 && <span className="text-emerald-600 font-normal"> · replaced {result.deleted} previous entries</span>}
              </p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-1">
              <ResultStat label="Boreholes" value={result.counts.locations} />
              <ResultStat label="Strata logs" value={result.counts.strata} />
              <ResultStat label="Core runs" value={result.counts.core} />
              <ResultStat label="Samples" value={result.counts.samples} />
              <ResultStat label="SPT tests" value={result.counts.spt} />
              <ResultStat label="Installations" value={result.counts.installations} />
              {result.counts.waterReadings > 0 && (
                <ResultStat label="Water Readings" value={result.counts.waterReadings} />
              )}
            </div>
            {result.job_reference && (
              <p className="text-xs text-emerald-700 pt-1">Matched job reference: <span className="font-mono font-semibold">{result.job_reference}</span></p>
            )}
            {result.groups && Object.keys(result.groups).length > 0 && (
              <details className="pt-1">
                <summary className="text-xs text-emerald-600 cursor-pointer hover:text-emerald-700 font-medium">
                  AGS groups found ({Object.keys(result.groups).length}) — click to inspect field names
                </summary>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {Object.entries(result.groups).map(([name, headings]) => (
                    <div key={name} className="text-[11px] text-slate-600">
                      <span className="font-mono font-bold text-slate-800">{name}</span>
                      <span className="text-slate-400">: {headings.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Help */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-600">Supported AGS blocks:</span> <code>PROJ</code> (job matching),{' '}
          <code>LOCA</code> (borehole locations), <code>GEOL</code>/<code>CHIS</code> (strata descriptions),{' '}
          <code>SAMP</code> (samples), <code>SPT</code>/<code>DENS</code> (penetration tests),{' '}
          <code>CORE</code> (rotary core runs with RQD &amp; recovery),{' '}
          <code>TREM</code> (installation pipes),{' '}
          <code>WSTG</code> (standpipe installations &amp; groundwater monitoring readings).{' '}
          If the <code>GEOL</code> group contains RQD or recovery fields, its rows are automatically treated as core runs instead of strata. Tab, comma and
          semicolon-delimited files are auto-detected, and group/field names are matched case-insensitively
          with common aliases. Imported logs are marked as non-chargeable and attributed to "AGS Import
          (KeyLogBook)". They appear in the job's Borehole Data Explorer. Re-importing a file overwrites the previous AGS data for the selected job.
        </p>
      </div>
    </div>
  );
}

function ResultStat({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-emerald-100 px-3 py-2 text-center">
      <p className="text-lg font-extrabold text-emerald-700 tabular-nums">{value || 0}</p>
      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}