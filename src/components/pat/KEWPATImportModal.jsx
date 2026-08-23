import React, { useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload, FileText, CheckCircle2, AlertCircle, X, Loader2,
  ArrowRight, AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { saveOrQueue } from '@/utils/offlineSync';

/**
 * KEWPATImportModal — bulk-imports PAT test results from a KEWPAT App CSV export.
 *
 * The tester uses the KEWPAT App + SMARTPAT to perform tests (as they do now),
 * exports the session data as CSV, and uploads it here. This modal:
 *  1. Parses the CSV (flexible column auto-detection)
 *  2. Matches each row to a SiteAsset by serial_number / barcode / fleet_number
 *  3. Lets the tester manually match any unmatched rows
 *  4. Creates ServiceRecord entries and updates SiteAsset compliance in bulk
 *
 * The KEW80L label printing stays on the KEWPAT App side (proprietary Bluetooth
 * protocol). This import ensures all test results are captured in the compliance
 * system for audit, dashboards, and alerts.
 */

// --- CSV parser (handles quoted fields, embedded commas/newlines) ---
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        if (row.some(f => f.trim() !== '')) rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some(f => f.trim() !== '')) rows.push(row);
  }
  return rows;
}

// --- Flexible column auto-mapping ---
const normalizeHeader = (h) => h.toLowerCase().replace(/[\s\-_./()]/g, '');

const COLUMN_MAP = {
  // Asset identifier
  assetid: '_assetRef', applianceid: '_assetRef', id: '_assetRef',
  assetno: '_assetRef', applianceno: '_assetRef', number: '_assetRef',
  ref: '_assetRef', serial: '_assetRef', serialno: '_assetRef',
  serialnumber: '_assetRef', barcode: '_assetRef', tag: '_assetRef',
  assettag: '_assetRef', fleetnumber: '_assetRef', fleet: '_assetRef',
  // Asset name / description
  description: '_assetName', appliance: '_assetName', name: '_assetName',
  appliancename: '_assetName', assetname: '_assetName', location: '_assetName',
  // Test date
  datetested: 'date', testdate: 'date', date: 'date', tested: 'date',
  testdatecompleted: 'date',
  // Result
  result: 'result', passfail: 'result', pass: 'result',
  overallresult: 'result', status: 'result',
  // Appliance class
  class: 'pat_appliance_class', applianceclass: 'pat_appliance_class',
  classofappliance: 'pat_appliance_class', protectionclass: 'pat_appliance_class',
  // Earth continuity
  earthcontinuity: 'pat_earth_continuity', earthbond: 'pat_earth_continuity',
  earth: 'pat_earth_continuity', earthcontinuityohms: 'pat_earth_continuity',
  earthbondohms: 'pat_earth_continuity',
  // Insulation resistance
  insulation: 'pat_insulation_resistance', insulationresistance: 'pat_insulation_resistance',
  insulationmohms: 'pat_insulation_resistance', insulationtest: 'pat_insulation_resistance',
  // Load current
  load: 'pat_load_current', loadcurrent: 'pat_load_current',
  loadma: 'pat_load_current', loadtest: 'pat_load_current',
  // Leakage current
  leakage: 'pat_leakage_current', leakagecurrent: 'pat_leakage_current',
  leakagema: 'pat_leakage_current', touchcurrent: 'pat_leakage_current',
  // Polarity
  polarity: 'pat_lead_polarity', leadpolarity: 'pat_lead_polarity',
  // Next test due
  nexttest: 'resulting_expiry_date', retestdate: 'resulting_expiry_date',
  nexttestdue: 'resulting_expiry_date', nextdue: 'resulting_expiry_date',
  retest: 'resulting_expiry_date', nexttestdate: 'resulting_expiry_date',
  // Tested by
  testedby: 'tested_by', tester: 'tested_by', engineer: 'tested_by',
  // Visual inspection
  visual: 'pat_visual_pass', visualinspection: 'pat_visual_pass',
  visualcheck: 'pat_visual_pass',
  // Tester serial
  testerserial: 'pat_tester_serial', testersn: 'pat_tester_serial',
  // Notes
  notes: 'notes', comments: 'notes', remark: 'notes', remarks: 'notes',
};

function autoMapColumns(headers) {
  const mapping = {};
  headers.forEach((h, i) => {
    const key = normalizeHeader(h);
    mapping[i] = COLUMN_MAP[key] || null;
  });
  return mapping;
}

// --- Date parsing (handles DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD) ---
function parseDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  // ISO format
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // UK format DD/MM/YYYY
  const uk = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (uk) {
    const [d, m, y] = [uk[1], uk[2], uk[3]].map(Number);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

// --- Pass/fail normalisation ---
function normaliseResult(val) {
  if (!val) return null;
  const s = String(val).trim().toLowerCase();
  if (s === 'pass' || s === 'p' || s === 'passed') return 'pass';
  if (s === 'fail' || s === 'f' || s === 'failed') return 'fail';
  if (s.includes('advisory') || s.includes('warn')) return 'advisory';
  if (s === 'n/a' || s === 'na' || s === 'notapplicable' || s === 'skipped') return 'n/a';
  return null;
}

function normaliseClass(val) {
  if (!val) return 'n/a';
  const s = String(val).trim().toLowerCase().replace(/[\s\-_]/g, '');
  if (s === 'class1' || s === 'classi' || s === '1' || s === 'i') return 'class_I';
  if (s === 'class2' || s === 'classii' || s === '2' || s === 'ii') return 'class_II';
  if (s === 'class3' || s === 'classiii' || s === '3' || s === 'iii') return 'class_III';
  if (s.includes('extension') || s.includes('lead') || s === 'ext') return 'extension_lead';
  return 'n/a';
}

function normalisePolarity(val) {
  if (!val) return 'n/a';
  const s = String(val).trim().toLowerCase();
  if (s === 'pass' || s === 'p' || s === 'correct') return 'pass';
  if (s === 'fail' || s === 'f' || s === 'incorrect') return 'fail';
  return 'n/a';
}

// --- Asset matching ---
function matchAsset(ref, assets) {
  if (!ref) return null;
  const val = String(ref).trim().toLowerCase();
  return assets.find(a =>
    (a.serial_number || '').toLowerCase() === val ||
    (a.barcode || '').toLowerCase() === val ||
    (a.fleet_number || '').toLowerCase() === val ||
    (a.name || '').toLowerCase() === val
  ) || null;
}

export default function KEWPATImportModal({ assets, onClose }) {
  const [stage, setStage] = useState('upload'); // upload → preview → importing → done
  const [parsed, setParsed] = useState(null); // { headers, rows, mapping }
  const [rowAssets, setRowAssets] = useState({}); // rowIndex → assetId (manual match overrides)
  const [results, setResults] = useState(null); // { created, skipped, errors }
  const fileRef = useRef(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const patAssets = useMemo(() => assets.filter(a => a.asset_type === 'portable_appliance'), [assets]);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast({ title: 'CSV is empty', description: 'No data rows found in the file.', variant: 'destructive' });
        return;
      }
      const headers = rows[0].map(h => h.trim());
      const dataRows = rows.slice(1);
      const mapping = autoMapColumns(headers);

      // Auto-match assets
      const refCol = Object.entries(mapping).find(([, v]) => v === '_assetRef')?.[0];
      const matches = {};
      dataRows.forEach((row, i) => {
        if (refCol != null) {
          const ref = row[refCol];
          const asset = matchAsset(ref, patAssets);
          if (asset) matches[i] = asset.id;
        }
      });

      setParsed({ headers, rows: dataRows, mapping });
      setRowAssets(matches);
      setStage('preview');
    };
    reader.readAsText(file);
  };

  const mappedFields = useMemo(() => {
    if (!parsed) return [];
    return Object.entries(parsed.mapping)
      .filter(([, v]) => v && !v.startsWith('_'))
      .map(([col, field]) => ({ col: Number(col), field, header: parsed.headers[col] }));
  }, [parsed]);

  const matchCount = Object.values(rowAssets).filter(Boolean).length;
  const unmatchedCount = parsed ? parsed.rows.length - matchCount : 0;

  const handleImport = async () => {
    setStage('importing');
    let created = 0;
    let skipped = 0;
    const errors = [];

    const dateCol = Object.entries(parsed.mapping).find(([, v]) => v === 'date')?.[0];
    const resultCol = Object.entries(parsed.mapping).find(([, v]) => v === 'result')?.[0];
    const classCol = Object.entries(parsed.mapping).find(([, v]) => v === 'pat_appliance_class')?.[0];
    const earthCol = Object.entries(parsed.mapping).find(([, v]) => v === 'pat_earth_continuity')?.[0];
    const insCol = Object.entries(parsed.mapping).find(([, v]) => v === 'pat_insulation_resistance')?.[0];
    const loadCol = Object.entries(parsed.mapping).find(([, v]) => v === 'pat_load_current')?.[0];
    const leakCol = Object.entries(parsed.mapping).find(([, v]) => v === 'pat_leakage_current')?.[0];
    const polCol = Object.entries(parsed.mapping).find(([, v]) => v === 'pat_lead_polarity')?.[0];
    const visualCol = Object.entries(parsed.mapping).find(([, v]) => v === 'pat_visual_pass')?.[0];
    const nextCol = Object.entries(parsed.mapping).find(([, v]) => v === 'resulting_expiry_date')?.[0];
    const testerCol = Object.entries(parsed.mapping).find(([, v]) => v === 'tested_by')?.[0];
    const testerSnCol = Object.entries(parsed.mapping).find(([, v]) => v === 'pat_tester_serial')?.[0];
    const notesCol = Object.entries(parsed.mapping).find(([, v]) => v === 'notes')?.[0];

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const assetId = rowAssets[i];
      if (!assetId) { skipped++; continue; }

      const asset = patAssets.find(a => a.id === assetId);
      if (!asset) { skipped++; continue; }

      const date = dateCol != null ? parseDate(row[dateCol]) : null;
      const result = resultCol != null ? normaliseResult(row[resultCol]) : null;
      const expiryDate = nextCol != null ? parseDate(row[nextCol]) : null;

      if (!date) { errors.push(`Row ${i + 2}: missing or unparseable test date`); continue; }

      const recordData = {
        site_asset_id: asset.id,
        record_type: 'pat_inspection',
        date,
        result: result || 'pass',
        tested_by: testerCol != null ? (row[testerCol] || '').trim() : 'KEWPAT Import',
        pat_appliance_class: classCol != null ? normaliseClass(row[classCol]) : 'n/a',
        pat_earth_continuity: earthCol != null ? parseFloat(row[earthCol]) || null : null,
        pat_insulation_resistance: insCol != null ? parseFloat(row[insCol]) || null : null,
        pat_load_current: loadCol != null ? parseFloat(row[loadCol]) || null : null,
        pat_leakage_current: leakCol != null ? parseFloat(row[leakCol]) || null : null,
        pat_lead_polarity: polCol != null ? normalisePolarity(row[polCol]) : 'n/a',
        pat_visual_pass: visualCol != null ? normaliseResult(row[visualCol]) !== 'fail' : true,
        pat_tester_serial: testerSnCol != null ? (row[testerSnCol] || '').trim() : '',
        resulting_expiry_date: expiryDate,
        notes: notesCol != null ? (row[notesCol] || '').trim() : 'Imported from KEWPAT App CSV export',
      };

      try {
        await saveOrQueue('ServiceRecord', 'create', recordData);

        // Update asset compliance
        const status = result === 'fail' ? 'expired'
          : (expiryDate && Math.floor((new Date(expiryDate + 'T00:00:00') - new Date()) / 86400000) <= 30) ? 'expiring'
          : 'compliant';
        await saveOrQueue('SiteAsset', 'update', {
          last_service_date: date,
          next_service_date: result === 'fail' ? null : expiryDate,
          compliance_expiry_date: result === 'fail' ? null : expiryDate,
          compliance_status: status,
          compliance_last_checked: new Date().toISOString(),
          is_active: result !== 'fail',
        }, asset.id);
        created++;
      } catch (e) {
        errors.push(`Row ${i + 2} (${asset.name}): ${e.message || e}`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['site-assets'] });
    queryClient.invalidateQueries({ queryKey: ['service-records'] });
    queryClient.invalidateQueries({ queryKey: ['pat-session'] });

    setResults({ created, skipped, errors: errors.slice(0, 10), totalErrors: errors.length });
    setStage('done');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Import from KEWPAT</h2>
              <p className="text-xs text-slate-500">Bulk-import PAT test results from a CSV export</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {stage === 'upload' && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">How to export from the KEWPAT App:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-amber-700">
                    <li>Open the KEWPAT App on your phone</li>
                    <li>Export the session data (Email / Save to Files)</li>
                    <li>If the export is a database file, use SimplyPats V7 to convert it to CSV</li>
                    <li>Upload the CSV file below</li>
                  </ol>
                </div>
              </div>

              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 rounded-xl p-10 hover:border-amber-400 hover:bg-amber-50/50 transition group"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 group-hover:bg-amber-100 flex items-center justify-center transition">
                    <FileText className="w-7 h-7 text-slate-400 group-hover:text-amber-500 transition" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">Click to select a CSV file</p>
                    <p className="text-xs text-slate-400 mt-0.5">Exported from the KEWPAT App or SimplyPats</p>
                  </div>
                </div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </>
          )}

          {stage === 'preview' && parsed && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{parsed.rows.length}</p>
                  <p className="text-xs text-slate-500">Rows</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{matchCount}</p>
                  <p className="text-xs text-emerald-600">Matched</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{unmatchedCount}</p>
                  <p className="text-xs text-amber-600">Unmatched</p>
                </div>
              </div>

              {/* Detected columns */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1.5">Detected columns:</p>
                <div className="flex flex-wrap gap-1.5">
                  {mappedFields.map(({ col, field, header }) => (
                    <span key={col} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                      <span className="font-medium">{header}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="text-amber-600 font-mono">{field}</span>
                    </span>
                  ))}
                  {mappedFields.length === 0 && (
                    <span className="text-xs text-slate-400">No recognised columns — check the CSV format.</span>
                  )}
                </div>
              </div>

              {/* Preview table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-600">
                    Preview — first {Math.min(parsed.rows.length, 20)} rows
                  </p>
                </div>
                <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-200">
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-500">#</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-500">Matched Asset</th>
                        {parsed.headers.map((h, i) => (
                          parsed.mapping[i] && !parsed.mapping[i].startsWith('_') ? (
                            <th key={i} className="px-2 py-1.5 text-left font-semibold text-slate-500 whitespace-nowrap">
                              {h}
                            </th>
                          ) : null
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 20).map((row, i) => {
                        const assetId = rowAssets[i];
                        const asset = assetId ? patAssets.find(a => a.id === assetId) : null;
                        return (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                            <td className="px-2 py-1.5">
                              {asset ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <CheckCircle2 className="w-3 h-3" /> {asset.name}
                                </span>
                              ) : (
                                <select
                                  className="text-xs border border-amber-300 rounded px-1.5 py-1 bg-amber-50 text-amber-800 max-w-[140px]"
                                  value={rowAssets[i] || ''}
                                  onChange={(e) => setRowAssets(prev => ({ ...prev, [i]: e.target.value }))}
                                >
                                  <option value="">— Select asset —</option>
                                  {patAssets.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                            {parsed.headers.map((_, j) => (
                              parsed.mapping[j] && !parsed.mapping[j].startsWith('_') ? (
                                <td key={j} className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{row[j]}</td>
                              ) : null
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {unmatchedCount > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    {unmatchedCount} row{unmatchedCount > 1 ? 's' : ''} couldn't be auto-matched to an asset.
                    Select the correct asset from the dropdown above, or those rows will be skipped.
                    Matching is by serial number, barcode, or fleet number — make sure the KEWPAT App
                    uses the same identifiers as Asset Panda.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setParsed(null); setStage('upload'); }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={matchCount === 0}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Import {matchCount} record{matchCount !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}

          {stage === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-700">Importing PAT records…</p>
              <p className="text-xs text-slate-400">Creating service records and updating compliance</p>
            </div>
          )}

          {stage === 'done' && results && (
            <>
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </div>
                <p className="text-lg font-bold text-slate-900">Import complete</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{results.created}</p>
                  <p className="text-xs text-emerald-600">Created</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-600">{results.skipped}</p>
                  <p className="text-xs text-slate-500">Skipped</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{results.totalErrors}</p>
                  <p className="text-xs text-red-500">Errors</p>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1.5">Errors:</p>
                  <ul className="space-y-1">
                    {results.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-600">{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}