import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, FileCheck, PoundSterling, X, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

export default function ConfirmQuoteModal({ item, jobId, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [negotiatedCost, setNegotiatedCost] = useState(String(item?.negotiated_unit_cost ?? ''));
  const [quoteFile, setQuoteFile] = useState(null);
  const [existingDocUrl, setExistingDocUrl] = useState(item?.quote_document_url || '');
  const [existingDocName, setExistingDocName] = useState(item?.quote_document_name || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    base44.auth.me().then(u => setUserName(u?.full_name || u?.email || '')).catch(() => {});
  }, []);

  if (!item) return null;

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setExistingDocUrl(file_url);
      setExistingDocName(file.name);
      setQuoteFile(null);
    } catch (e) {
      toast({ title: 'Upload failed', description: e?.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  const handleSave = async () => {
    const price = Number(negotiatedCost);
    if (!price || price <= 0) {
      toast({ title: 'Enter a confirmed price', description: 'The negotiated unit cost must be greater than zero.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.JobCostItem.update(item.id, {
        negotiated_unit_cost: price,
        price_confirmed: true,
        quote_document_url: existingDocUrl || '',
        quote_document_name: existingDocName || '',
        confirmed_by_name: userName,
        confirmed_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({ title: 'Price confirmed', description: `${item.description} — ${fmt(price)}/${item.unit_label || 'unit'}` });
      onClose();
    } catch (e) {
      toast({ title: 'Could not save', description: e?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleUnconfirm = async () => {
    if (!confirm('Remove the confirmed price and reset to POA?')) return;
    setSaving(true);
    try {
      await base44.entities.JobCostItem.update(item.id, {
        negotiated_unit_cost: null,
        price_confirmed: false,
        quote_document_url: '',
        quote_document_name: '',
        confirmed_by_name: '',
        confirmed_at: '',
      });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({ title: 'Reset to POA', description: 'The confirmed price has been removed.' });
      onClose();
    } catch (e) {
      toast({ title: 'Could not reset', description: e?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={!!item} onOpenChange={(open) => { if (!open && !saving && !uploading) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            Confirm Quote / Contract Price
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item summary */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-sm font-semibold text-slate-900">{item.description}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {item.unit_label || 'unit'} · {item.quantity || 1} qty
              {item.reference_number && ` · Ref: ${item.reference_number}`}
            </p>
            {item.is_poa && (
              <p className="text-xs text-amber-600 mt-1 inline-flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3" /> Price on Application — no rate card price set
              </p>
            )}
          </div>

          {/* Negotiated price input */}
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-1.5">
              <PoundSterling className="w-4 h-4 text-emerald-600" /> Confirmed unit price (net) *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={negotiatedCost}
                onChange={(e) => setNegotiatedCost(e.target.value)}
                placeholder="0.00"
                className={inputCls}
                autoFocus
              />
              <span className="text-sm text-slate-500 whitespace-nowrap">per {item.unit_label || 'unit'}</span>
            </div>
            {Number(negotiatedCost) > 0 && (
              <p className="text-xs text-slate-600 mt-1.5 bg-emerald-50 rounded-md px-2.5 py-1.5 border border-emerald-100">
                Line total: {fmt(Number(negotiatedCost) * (Number(item.quantity) || 1))}
              </p>
            )}
          </div>

          {/* Quote document upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Quote / Contract document</label>
            {existingDocUrl ? (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <FileCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <a href={existingDocUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-700 font-medium hover:underline truncate flex-1">
                  {existingDocName || 'View document'}
                </a>
                <button
                  type="button"
                  onClick={() => { setExistingDocUrl(''); setExistingDocName(''); }}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                  disabled={saving || uploading}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-slate-300 rounded-lg px-3 py-3 hover:border-emerald-400 hover:bg-emerald-50/30 transition">
                {uploading ? (
                  <><Loader2 className="w-4 h-4 text-emerald-600 animate-spin" /> <span className="text-sm text-slate-500">Uploading…</span></>
                ) : (
                  <><Upload className="w-4 h-4 text-slate-400" /> <span className="text-sm text-slate-500">Upload quote PDF or contract</span></>
                )}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.eml,.msg"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  disabled={uploading || saving}
                />
              </label>
            )}
            <p className="text-xs text-slate-400 mt-1">Evidence of the agreed price — visible to admins on the job costing tab.</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || uploading || !Number(negotiatedCost)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
              {item.price_confirmed ? 'Update confirmed price' : 'Confirm price'}
            </button>
            <button
              onClick={onClose}
              disabled={saving || uploading}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          {item.price_confirmed && (
            <button
              onClick={handleUnconfirm}
              disabled={saving}
              className="w-full text-xs text-red-500 hover:text-red-700 font-medium py-1"
            >
              Reset to POA (remove confirmed price)
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}