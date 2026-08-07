import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

// CSV bulk import — lets admins quickly create multiple Staff, Job, Vehicle,
// Client, Supplier, or Contractor records from a simple CSV file without the
// full planner spreadsheet rebuild. First row = headers matching entity field
// names, subsequent rows = data.

const ENTITIES = [
  { value: 'Staff', label: 'Staff' },
  { value: 'Job', label: 'Jobs' },
  { value: 'Vehicle', label: 'Vehicles' },
  { value: 'Client', label: 'Clients' },
  { value: 'Supplier', label: 'Suppliers' },
  { value: 'Contractor', label: 'Contractors' },
];

export default function CsvBulkImport() {
  const { toast } = useToast();
  const [entityType, setEntityType] = useState('Staff');
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target.result);
      setPreview(null);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!csvText.trim()) {
      toast({ title: 'Paste CSV data or upload a file first', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('csvBulkImport', {
        csv_data: csvText,
        entity_type: entityType,
        preview: true,
      });
      setPreview(res?.data || res);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('csvBulkImport', {
        csv_data: csvText,
        entity_type: entityType,
        preview: false,
      });
      toast({
        title: `✓ ${res?.data?.created_count || 0} ${entityType} records created`,
        description: 'Import complete.',
      });
      setCsvText('');
      setPreview(null);
      setFileName('');
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Upload}
        title="CSV Bulk Import"
        description="Quickly create multiple records from a simple CSV — no full planner spreadsheet needed."
      />

      <div className="insight-card rounded-2xl p-5 space-y-4">
        {/* Entity selector */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Record Type</label>
          <div className="flex flex-wrap gap-2">
            {ENTITIES.map(e => (
              <button
                key={e.value}
                onClick={() => { setEntityType(e.value); setPreview(null); }}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                  entityType === e.value
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* File upload */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Upload CSV File</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer transition">
              <Upload className="w-4 h-4" />
              Choose File
              <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
            </label>
            {fileName && (
              <span className="text-sm text-slate-500 flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> {fileName}
              </span>
            )}
          </div>
        </div>

        {/* Or paste CSV */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Or Paste CSV Text</label>
          <textarea
            value={csvText}
            onChange={e => { setCsvText(e.target.value); setPreview(null); }}
            rows={6}
            placeholder={`name,location,start_date\nJohn Smith,London,2026-01-01\nJane Doe,Manchester,2026-02-01`}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
          />
          <p className="text-xs text-slate-400 mt-1">
            First row = column headers (must match {entityType} field names). Subsequent rows = data.
          </p>
        </div>

        {/* Preview button */}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePreview} disabled={loading || !csvText.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            Preview Records
          </Button>
          {preview && (
            <Button onClick={handleImport} disabled={loading} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Import {preview.record_count || 0} Records
            </Button>
          )}
        </div>

        {/* Preview results */}
        {preview && (
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-semibold text-slate-700">
                Preview: {preview.record_count} {entityType} records ready to import
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    {preview.headers?.map(h => (
                      <th key={h} className="text-left py-1.5 px-2 font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.records?.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {preview.headers?.map(h => (
                        <td key={h} className="py-1.5 px-2 text-slate-700">{String(r[h] || '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.record_count > 10 && (
              <p className="text-xs text-slate-400 mt-2">Showing first 10 of {preview.record_count} records.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}