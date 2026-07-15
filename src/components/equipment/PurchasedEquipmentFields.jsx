import React, { useState } from 'react';
import { Upload, FileText, X, Package, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { inputCls, fmt } from './shared';

export default function PurchasedEquipmentFields({ form, setForm, suppliers = [] }) {
  const [orderSlipFile, setOrderSlipFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setOrderSlipFile(file);
    setUploadError(false);
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setForm({ ...form, order_slip_url: res.file_url, order_slip_name: file.name });
    } catch (err) {
      console.error(err);
      setUploadError(true);
      setOrderSlipFile(null);
    }
    setUploading(false);
  };

  const lineTotal = (Number(form.unit_cost) || 0) * (Number(form.quantity) || 1);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">What are you purchasing? *</label>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Coreliner, HDPE pipe" className={inputCls} />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Supplier (optional)</label>
        <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className={inputCls}>
          <option value="">Select supplier…</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div>
        <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
          <Package className="w-3 h-3 text-emerald-700" /> PO Number *
        </label>
        <input value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} placeholder="e.g. PO-1042" className={`${inputCls} font-mono`} />
      </div>

      <div>
        <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
          <Upload className="w-3 h-3 text-emerald-700" /> Order Slip / Purchase Document *
        </label>
        {form.order_slip_url && !orderSlipFile && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200 mb-2">
            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
            <a href={form.order_slip_url} target="_blank" rel="noopener noreferrer" className="hover:underline font-medium truncate">{form.order_slip_name || 'View order slip'}</a>
            <button type="button" onClick={() => setForm({ ...form, order_slip_url: '', order_slip_name: '' })} className="ml-auto text-slate-400 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {!form.order_slip_url && (
          <input type="file" accept=".pdf,image/*,.doc,.docx,.xlsx,.xls" onChange={(e) => handleFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium hover:file:bg-emerald-100 cursor-pointer" />
        )}
        {orderSlipFile && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200 mt-1.5">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" /> : <FileText className="w-3.5 h-3.5 flex-shrink-0" />}
            <span className="truncate">{orderSlipFile.name}</span>
          </div>
        )}
        {uploadError && <p className="text-[10px] text-red-500 mt-1">Upload failed. Please try again.</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Unit cost (net) *</label>
          <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} placeholder="0.00" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
          <select value={form.unit_label} onChange={(e) => setForm({ ...form, unit_label: e.target.value })} className={inputCls}>
            <option value="each">each</option>
            <option value="day">per day</option>
            <option value="m">per metre</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
          <input type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
          <input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="Asset tag / serial no." className={inputCls} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={form.vat_exempt} onChange={(e) => setForm({ ...form, vat_exempt: e.target.checked })} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
        VAT exempt (zero-rated item)
      </label>

      {Number(form.unit_cost) > 0 && (
        <div className="text-xs text-slate-600 bg-white rounded-md px-3 py-2 border border-slate-200 flex items-center justify-between">
          <span>Line total: {Number(form.quantity) || 1} × {fmt(Number(form.unit_cost) || 0)}</span>
          <span className="font-bold text-slate-900">{fmt(lineTotal)}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Any special notes about this item" className={inputCls} />
      </div>
    </div>
  );
}