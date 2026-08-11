import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Sparkles, Scan,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  DEFAULT_SERVICE_INTERVALS, DEFAULT_COMPLIANCE_CATEGORIES,
  autoComplianceStatus, autoNextServiceDate, autoMaintenanceStatus,
} from '@/utils/assetSmartDefaults';

/**
 * SmartCertImport — upload PDF certificate files and the system reads them
 * automatically to create assets + service records. Uses the LLM extraction
 * integration to parse each PDF for asset name, serial, type, dates, etc.
 */
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    asset_name: { type: 'string', description: 'Name or description of the equipment inspected' },
    serial_number: { type: 'string', description: 'Serial number, asset tag, or registration' },
    asset_type: { type: 'string', enum: ['rig', 'machinery', 'trailer', 'lifting', 'portable_appliance'], description: 'Type of equipment' },
    equipment_type: { type: 'string', description: 'Specific equipment type (e.g. Sling, Shackle, 110V Transformer)' },
    inspection_date: { type: 'string', description: 'Date of inspection/test (ISO format yyyy-mm-dd if possible)' },
    expiry_date: { type: 'string', description: 'Next inspection due / expiry date (ISO format yyyy-mm-dd if possible)' },
    inspection_type: { type: 'string', enum: ['loler_inspection', 'puwer_inspection', 'pat_inspection', 'service', 'calibration', 'other'], description: 'Type of inspection' },
    result: { type: 'string', enum: ['pass', 'fail', 'advisory', 'n/a'], description: 'Inspection result' },
    tested_by: { type: 'string', description: 'Name of person who carried out the inspection' },
    company: { type: 'string', description: 'Testing/inspection company' },
    notes: { type: 'string', description: 'Any findings, defects, or observations noted' },
  },
};

const TYPE_LABELS = { rig: 'Rig', machinery: 'Machinery', trailer: 'Trailer', lifting: 'Lifting Gear', portable_appliance: 'PAT / Electrical' };

function parseDate(str) {
  if (!str) return '';
  // Try ISO first
  const iso = new Date(str);
  if (!isNaN(iso.getTime()) && str.match(/\d{4}-\d{2}-\d{2}/)) return str.slice(0, 10);
  // Try DD/MM/YYYY
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  // Try "12 January 2025"
  const m2 = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (m2) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const mi = months.findIndex(mo => mo.toLowerCase().startsWith(m2[2].toLowerCase().slice(0,3)));
    if (mi >= 0) return `${m2[3]}-${String(mi+1).padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
  }
  return '';
}

export default function SmartCertImport({ onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, fileName: '' });
  const [results, setResults] = useState([]);

  const { data: existingAssets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const handleFiles = (fileList) => {
    const pdfs = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      toast({ title: 'No PDF files', description: 'Select PDF certificate files to import.', variant: 'destructive' });
      return;
    }
    setFiles(pdfs);
    setResults([]);
  };

  const processFile = async (file) => {
    // 1. Upload the PDF
    const uploadRes = await base44.integrations.Core.UploadFile({ file });
    const fileUrl = uploadRes.file_url;

    // 2. Extract structured data from the PDF
    const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: EXTRACTION_SCHEMA,
    });

    if (extractRes.status !== 'success' || !extractRes.output) {
      throw new Error('Could not read certificate data from PDF');
    }

    const data = extractRes.output;
    const assetName = data.asset_name || file.name.replace(/\.pdf$/i, '');
    const serial = data.serial_number || '';
    const type = ['rig', 'machinery', 'trailer', 'lifting', 'portable_appliance'].includes(data.asset_type) ? data.asset_type : 'machinery';
    const inspectionDate = parseDate(data.inspection_date) || new Date().toISOString().slice(0, 10);
    const expiryDate = parseDate(data.expiry_date) || '';
    const inspectionType = data.inspection_type || 'service';
    const result = data.result || 'pass';

    // 3. Match to existing asset by serial or name
    let asset = null;
    if (serial) {
      asset = existingAssets.find(a => a.serial_number && a.serial_number.toLowerCase() === serial.toLowerCase());
    }
    if (!asset) {
      asset = existingAssets.find(a => a.name.toLowerCase() === assetName.toLowerCase());
    }

    // 4. Create asset if not found
    let isNewAsset = false;
    if (!asset) {
      isNewAsset = true;
      const status = expiryDate ? autoComplianceStatus(expiryDate) : 'unknown';
      const nextService = inspectionDate ? autoNextServiceDate(inspectionDate, type) : '';
      const interval = (type === 'rig' || type === 'machinery')
        ? DEFAULT_SERVICE_INTERVALS[type] : null;
      const payload = {
        name: assetName,
        asset_type: type,
        is_rig: type === 'rig',
        rig_type: 'n/a',
        equipment_type: data.equipment_type || '',
        compliance_category: DEFAULT_COMPLIANCE_CATEGORIES[type] || '',
        serial_number: serial,
        compliance_status: status,
        compliance_expiry_date: expiryDate || null,
        last_service_date: inspectionDate,
        next_service_date: nextService || null,
        is_active: true,
        service_interval_hours: interval,
        operating_hours: 0,
        hours_at_last_service: 0,
        linked_equipment_ids: [],
      };
      payload.maintenance_status = autoMaintenanceStatus(payload);
      asset = await base44.entities.SiteAsset.create(payload);
    } else {
      // Update existing asset's compliance from the new certificate
      const updates = {};
      if (expiryDate) {
        updates.compliance_expiry_date = expiryDate;
        updates.compliance_status = autoComplianceStatus(expiryDate);
      }
      if (inspectionDate) updates.last_service_date = inspectionDate;
      const nextService = autoNextServiceDate(inspectionDate, asset.asset_type);
      if (nextService) updates.next_service_date = nextService;
      if (Object.keys(updates).length > 0) {
        await base44.entities.SiteAsset.update(asset.id, updates);
      }
    }

    // 5. Create the service record with the certificate attached
    await base44.entities.ServiceRecord.create({
      site_asset_id: asset.id,
      record_type: inspectionType,
      date: inspectionDate,
      result,
      tested_by: data.tested_by || '',
      company: data.company || '',
      certificate_url: fileUrl,
      certificate_name: file.name,
      resulting_expiry_date: expiryDate || null,
      notes: data.notes || '',
    });

    return { fileName: file.name, assetName, serial, type, isNewAsset, expiryDate, result, error: null };
  };

  const handleImport = async () => {
    setProcessing(true);
    setProgress({ current: 0, total: files.length, fileName: files[0]?.name || '' });
    const allResults = [];
    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length, fileName: files[i].name });
      try {
        const r = await processFile(files[i]);
        allResults.push(r);
      } catch (e) {
        allResults.push({ fileName: files[i].name, error: e.message, assetName: '', isNewAsset: false });
      }
    }
    setResults(allResults);
    queryClient.invalidateQueries({ queryKey: ['site-assets'] });
    queryClient.invalidateQueries({ queryKey: ['service-records'] });
    queryClient.invalidateQueries({ queryKey: ['cert-vault'] });
    queryClient.invalidateQueries({ queryKey: ['master-cert-vault'] });
    setProcessing(false);
    const success = allResults.filter(r => !r.error).length;
    if (success > 0) {
      toast({ title: `${success} certificate(s) imported`, description: allResults.filter(r => r.error).length > 0 ? 'Some failed — see details.' : 'All processed.' });
    }
  };

  const successCount = results.filter(r => !r.error).length;
  const newCount = results.filter(r => r.isNewAsset).length;
  const errorCount = results.filter(r => r.error).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 overflow-y-auto" onClick={() => !processing && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full my-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Scan className="w-5 h-5 text-[#2E5A1A]" /> Smart Certificate Import
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" /> AI
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Upload PDFs — the system reads them and creates assets + records automatically</p>
          </div>
          <button onClick={() => !processing && onClose()} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {results.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100">
                  <p className="text-2xl font-bold text-emerald-700 tabular-nums">{successCount}</p>
                  <p className="text-[10px] text-emerald-600 uppercase font-medium">Imported</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                  <p className="text-2xl font-bold text-blue-700 tabular-nums">{newCount}</p>
                  <p className="text-[10px] text-blue-600 uppercase font-medium">New Assets</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                  <p className="text-2xl font-bold text-red-700 tabular-nums">{errorCount}</p>
                  <p className="text-[10px] text-red-600 uppercase font-medium">Failed</p>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className={`rounded-lg p-3 border ${r.error ? 'bg-red-50 border-red-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                    <div className="flex items-start gap-2">
                      {r.error ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{r.fileName}</p>
                        {r.error ? (
                          <p className="text-[11px] text-red-600 mt-0.5">{r.error}</p>
                        ) : (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {r.isNewAsset ? 'Created' : 'Updated'}: <span className="font-medium text-slate-700">{r.assetName}</span>
                            {r.serial && ` · ${r.serial}`}
                            {r.expiryDate && ` · expires ${r.expiryDate}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={onClose} className="w-full py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] transition">
                Done
              </button>
            </div>
          ) : (
            <>
              {!files.length ? (
                <label className="flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition">
                  <FileText className="w-8 h-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">Drop or select PDF certificates</p>
                  <p className="text-xs text-slate-400">The AI will read each file and extract asset name, serial, dates, etc.</p>
                  <input type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={e => e.target.files.length > 0 && handleFiles(e.target.files)} />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">{files.length} PDF file(s) ready</p>
                    <button onClick={() => { setFiles([]); setResults([]); }} disabled={processing} className="text-xs text-slate-400 hover:text-red-500 transition disabled:opacity-50">
                      Clear
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <p className="text-xs font-medium text-slate-700 truncate flex-1">{f.name}</p>
                        <p className="text-[10px] text-slate-400 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</p>
                      </div>
                    ))}
                  </div>

                  {processing && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                        <p className="text-xs font-medium text-blue-700">Reading {progress.fileName}...</p>
                      </div>
                      <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                      </div>
                      <p className="text-[10px] text-blue-500 mt-1 text-center">{progress.current} of {progress.total}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {results.length === 0 && (
          <div className="px-5 py-3.5 border-t border-slate-100 flex items-center gap-2">
            <button onClick={() => !processing && onClose()} disabled={processing} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition disabled:opacity-50">Cancel</button>
            <button onClick={handleImport} disabled={!files.length || processing}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-sm font-semibold hover:brightness-110 transition disabled:opacity-50">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {processing ? 'Reading PDFs...' : `Read & Import ${files.length || ''} PDF(s)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}