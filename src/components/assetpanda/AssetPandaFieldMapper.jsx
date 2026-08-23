import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  ArrowRightLeft, Plus, Trash2, Loader2, RefreshCw, Wand2, FlaskConical, Check,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// System fields that can be mapped to Asset Panda fields.
const SYSTEM_FIELDS = [
  { value: 'name', label: 'Asset Name' },
  { value: 'serial_number', label: 'Serial / Asset Tag' },
  { value: 'barcode', label: 'Barcode (Asset Panda barcode field)' },
  { value: 'asset_type', label: 'Asset Type' },
  { value: 'stock_level', label: 'Stock / Condition Status' },
  { value: 'daily_billing_rate', label: 'Daily Billing Rate' },
  { value: 'cost_price', label: 'Cost Price (internal cost)' },
  { value: 'charge_out_price', label: 'Charge-Out Price (sell)' },
  { value: 'storage_location', label: 'Storage Location' },
  { value: 'responsible_person', label: 'Responsible Person' },
  { value: 'compliance_expiry_date', label: 'Compliance Expiry Date' },
  { value: 'next_service_date', label: 'Next Service Date' },
  { value: 'last_service_date', label: 'Last Service Date' },
  { value: 'service_notes', label: 'Service Notes' },
  { value: 'repair_notes', label: 'Repair Notes' },
  { value: 'colour', label: 'Colour' },
  { value: 'equipment_type', label: 'Equipment Type' },
  { value: 'fleet_number', label: 'Fleet Number (FAA Ref)' },
  { value: 'make', label: 'Make / Manufacturer' },
  { value: 'model', label: 'Model' },
  { value: 'length', label: 'Length (m)' },
  { value: 'weight_kg', label: 'Weight (kg)' },
  { value: 'height_m', label: 'Height (m) — vehicles' },
  { value: 'fuel_type', label: 'Fuel Type' },
  { value: 'condition', label: 'Condition' },
  { value: 'hours_used', label: 'Hours Used' },
  { value: 'tooling_notes', label: 'Tooling Notes' },
  { value: 'notes', label: 'Notes' },
];

export default function AssetPandaFieldMapper({ form, setForm, config, onSave, saving }) {
  const { toast } = useToast();
  const [fetching, setFetching] = useState(false);
  const [pandaFields, setPandaFields] = useState([]);
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState(null);

  const fieldMap = form.field_map || [];
  const ready = !!(form.group_id && (form.api_token || (form.email && form.password)));

  const fetchFields = async () => {
    setFetching(true);
    try {
      const res = await base44.functions.invoke('getAssetPandaGroupFields', { group_id: form.group_id });
      const fields = res.data?.fields || [];
      setPandaFields(fields);
      toast({ title: `Loaded ${fields.length} fields from Asset Panda` });
    } catch (err) {
      toast({
        title: 'Could not fetch fields',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    }
    setFetching(false);
  };

  const updateRow = (idx, patch) => {
    const next = [...fieldMap];
    next[idx] = { ...next[idx], ...patch };
    setForm({ ...form, field_map: next });
  };

  const addRow = () => {
    setForm({ ...form, field_map: [...fieldMap, { system_field: '', panda_field_key: '', panda_field_label: '' }] });
  };

  const removeRow = (idx) => {
    setForm({ ...form, field_map: fieldMap.filter((_, i) => i !== idx) });
  };

  const testMapping = async () => {
    setTesting(true);
    setPreview(null);
    try {
      const res = await base44.functions.invoke('getAssetPandaGroupFields', { group_id: form.group_id, sample: true });
      const sample = res.data?.sample || null;
      if (!sample) {
        toast({
          title: 'No sample object found',
          description: 'Make sure your Asset Panda group has at least one asset.',
          variant: 'destructive',
        });
        setTesting(false);
        return;
      }
      const mapped = {};
      for (const row of fieldMap) {
        if (row.system_field && row.panda_field_key) {
          const v = sample[row.panda_field_key];
          mapped[row.system_field] = v == null ? '' : typeof v === 'object' ? String(v.value ?? v.name ?? '') : String(v);
        }
      }
      setPreview({ sample, mapped });
    } catch (err) {
      toast({ title: 'Test failed', description: err.message, variant: 'destructive' });
    }
    setTesting(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <ArrowRightLeft className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">Field Mapping</h3>
        <span className="text-[11px] text-slate-400 hidden sm:inline">— match Asset Panda fields to your system fields</span>
        <button
          onClick={fetchFields}
          disabled={fetching || !ready}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition disabled:opacity-50"
        >
          {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Fetch fields
        </button>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-500">
          Map each Asset Panda field to a system field. Click <strong>Fetch fields</strong> to load the real field names
          from your group, then pair them up. Unmapped core fields (name, serial, type, stock, rate) auto-detect from
          field labels. Custom fields like storage location and service dates are applied as direct copies.
        </p>

        {fieldMap.length === 0 && (
          <div className="text-center py-6 text-sm text-slate-400">
            No mappings yet. Click <strong>Add mapping</strong> to match an Asset Panda field to a system field.
          </div>
        )}

        {fieldMap.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              value={row.system_field}
              onChange={(e) => updateRow(idx, { system_field: e.target.value })}
              className="flex-1 min-w-0 px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="">— System field —</option>
              {SYSTEM_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <ArrowRightLeft className="w-4 h-4 text-slate-300 flex-shrink-0" />
            <select
              value={row.panda_field_key}
              onChange={(e) => {
                const f = pandaFields.find((x) => x.key === e.target.value);
                updateRow(idx, { panda_field_key: e.target.value, panda_field_label: f?.label || '' });
              }}
              className="flex-1 min-w-0 px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="">— Asset Panda field —</option>
              {pandaFields.length === 0 && row.panda_field_key && (
                <option value={row.panda_field_key}>{row.panda_field_label || row.panda_field_key}</option>
              )}
              {pandaFields.length === 0 && !row.panda_field_key && (
                <option value="" disabled>Fetch fields first…</option>
              )}
              {pandaFields.map((f) => (
                <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
              ))}
            </select>
            <button
              onClick={() => removeRow(idx)}
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition flex-shrink-0"
              aria-label="Remove mapping"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          onClick={addRow}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          <Plus className="w-4 h-4" /> Add mapping
        </button>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={testMapping}
            disabled={testing || fieldMap.length === 0 || !ready}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />} Test mapping
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save mapping
          </button>
        </div>

        {preview && (
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5" /> Preview — sample object mapped through your field map
            </p>
            {Object.keys(preview.mapped).length === 0 ? (
              <p className="text-xs text-slate-400">No fields mapped yet — add mappings above to see a preview.</p>
            ) : (
              <div className="space-y-1">
                {Object.entries(preview.mapped).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs">
                    <span className="font-mono text-slate-500 w-40 flex-shrink-0 truncate">{k}</span>
                    <span className="text-slate-800 truncate">{String(v) || <em className="text-slate-300">(empty)</em>}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}