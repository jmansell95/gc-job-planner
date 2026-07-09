import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Edit2, ShieldCheck, X, Upload, FileText, Loader2, CreditCard, Calendar, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { formatComplianceDate, complianceDaysUntil } from '@/utils/complianceDate';

const QUALIFICATION_TYPES = [
  { value: 'cscs_card', label: 'CSCS Card', requiresFrontBack: true },
  { value: 'cpcs_card', label: 'CPCS Card', requiresFrontBack: true },
  { value: 'npors_card', label: 'NPORS Card', requiresFrontBack: true },
  { value: 'first_aid_cert', label: 'First Aid Certificate', requiresFrontBack: false },
  { value: 'driver_license', label: 'Driver License', requiresFrontBack: true },
  { value: 'dbs_certificate', label: 'DBS Certificate', requiresFrontBack: false },
  { value: 'other', label: 'Other', requiresFrontBack: false },
];

function getStatus(item) {
  if (item.status_override === 'missing') return { label: 'Missing', Icon: XCircle, bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100' };
  if (item.status_override === 'not_required') return { label: 'N/A', Icon: CheckCircle2, bg: 'bg-slate-50', text: 'text-slate-400', ring: 'ring-slate-100' };
  if (!item.expiry_date) return { label: 'No Expiry', Icon: FileText, bg: 'bg-slate-50', text: 'text-slate-400', ring: 'ring-slate-100' };
  const days = complianceDaysUntil(item.expiry_date);
  if (days === null) return { label: 'No Expiry', Icon: FileText, bg: 'bg-slate-50', text: 'text-slate-400', ring: 'ring-slate-100' };
  if (days < 0) return { label: 'Expired', Icon: XCircle, bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100' };
  if (days <= 30) return { label: `${days}d left`, Icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' };
  return { label: 'Valid', Icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' };
}

const emptyForm = {
  title: '',
  qualification_type: 'other',
  card_number: '',
  issue_date: '',
  expiry_date: '',
  notes: '',
  document_url: '',
  document_name: '',
  back_document_url: '',
  back_document_name: '',
  status_override: 'auto',
};

export default function StaffComplianceEditor({ staffId, staffName }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['staff-compliance-edit', staffId],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
    enabled: !!staffId
  });

  const items = allItems.filter(i => i.reference_id === staffId || (staffName && i.reference_name === staffName));

  const handleUpload = async (file, side) => {
    if (!file) return;
    if (side === 'front') setUploadingFront(true);
    else setUploadingBack(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      if (side === 'front') {
        setForm(prev => ({ ...prev, document_url: res.file_url, document_name: file.name }));
      } else {
        setForm(prev => ({ ...prev, back_document_url: res.file_url, back_document_name: file.name }));
      }
    } catch (err) {
      toast({ title: 'Upload failed', description: err?.message, variant: 'destructive' });
    }
    if (side === 'front') setUploadingFront(false);
    else setUploadingBack(false);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const qualType = QUALIFICATION_TYPES.find(q => q.value === form.qualification_type);
    if (qualType?.requiresFrontBack && !form.document_url) {
      toast({ title: 'Front of card required', description: `${qualType.label} requires a front image upload.`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        category: 'staff',
        reference_id: staffId,
        reference_name: staffName,
      };
      if (editingId) {
        await base44.entities.ComplianceItem.update(editingId, payload);
        toast({ title: 'Compliance item updated' });
      } else {
        await base44.entities.ComplianceItem.create(payload);
        toast({ title: 'Compliance item added' });
      }
      queryClient.invalidateQueries({ queryKey: ['staff-compliance-edit', staffId] });
      queryClient.invalidateQueries({ queryKey: ['staff-compliance', staffId] });
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      toast({ title: 'Could not save', description: err?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleEdit = (item) => {
    setForm({ ...emptyForm, ...item });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete ${item.title}?`)) return;
    try {
      await base44.entities.ComplianceItem.delete(item.id);
      queryClient.invalidateQueries({ queryKey: ['staff-compliance-edit', staffId] });
      queryClient.invalidateQueries({ queryKey: ['staff-compliance', staffId] });
      toast({ title: 'Item deleted' });
    } catch (err) {
      toast({ title: 'Could not delete', description: err?.message, variant: 'destructive' });
    }
  };

  const qualLabel = (val) => QUALIFICATION_TYPES.find(q => q.value === val)?.label || 'Other';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Compliance & Qualifications</h3>
            <p className="text-xs text-slate-500">{staffName}</p>
          </div>
        </div>
        {!showForm && (
          <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">{editingId ? 'Edit Item' : 'New Compliance Item'}</p>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
              className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Qualification Type</label>
              <select value={form.qualification_type} onChange={e => setForm({ ...form, qualification_type: e.target.value, title: QUALIFICATION_TYPES.find(q => q.value === e.target.value)?.label || form.title })}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                {QUALIFICATION_TYPES.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Card / Reg Number</label>
              <input type="text" value={form.card_number || ''} onChange={e => setForm({ ...form, card_number: e.target.value })}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status Override</label>
              <select value={form.status_override} onChange={e => setForm({ ...form, status_override: e.target.value })}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                <option value="auto">Auto (from expiry)</option>
                <option value="missing">Missing</option>
                <option value="not_required">Not Required</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Issue Date</label>
              <input type="month" value={form.issue_date || ''} onChange={e => setForm({ ...form, issue_date: e.target.value })}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
              <input type="month" value={form.expiry_date || ''} onChange={e => setForm({ ...form, expiry_date: e.target.value })}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>

          {/* Document uploads */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {QUALIFICATION_TYPES.find(q => q.value === form.qualification_type)?.requiresFrontBack ? 'Front of Card *' : 'Document'}
              </label>
              {form.document_url ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                  <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs text-emerald-700 truncate flex-1">{form.document_name || 'Uploaded'}</span>
                  <button type="button" onClick={() => setForm({ ...form, document_url: '', document_name: '' })}
                    className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg p-2.5 cursor-pointer hover:border-emerald-400 transition">
                  {uploadingFront ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Upload className="w-4 h-4 text-slate-400" />}
                  <span className="text-xs text-slate-500">{uploadingFront ? 'Uploading...' : 'Choose file'}</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleUpload(e.target.files[0], 'front')} />
                </label>
              )}
            </div>
            {QUALIFICATION_TYPES.find(q => q.value === form.qualification_type)?.requiresFrontBack && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Back of Card</label>
                {form.back_document_url ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs text-emerald-700 truncate flex-1">{form.back_document_name || 'Uploaded'}</span>
                    <button type="button" onClick={() => setForm({ ...form, back_document_url: '', back_document_name: '' })}
                      className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg p-2.5 cursor-pointer hover:border-emerald-400 transition">
                    {uploadingBack ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Upload className="w-4 h-4 text-slate-400" />}
                    <span className="text-xs text-slate-500">{uploadingBack ? 'Uploading...' : 'Choose file'}</span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleUpload(e.target.files[0], 'back')} />
                  </label>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-semibold disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition text-sm font-medium">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <ShieldCheck className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-600">No compliance items yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Add CSCS cards, certificates and qualifications above.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map(item => {
            const st = getStatus(item);
            const isCard = item.qualification_type === 'cscs_card' || item.qualification_type === 'cpcs_card' || item.qualification_type === 'npors_card' || item.qualification_type === 'driver_license';
            return (
              <div key={item.id} className={`rounded-xl p-3 ring-1 ${st.bg} ${st.ring}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${st.bg}`}>
                    {isCard ? <CreditCard className={`w-4 h-4 ${st.text}`} /> : <st.Icon className={`w-4 h-4 ${st.text}`} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                    </div>
                    {item.card_number && <p className="text-xs text-slate-500 mt-0.5">Card #: {item.card_number}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      {item.issue_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Issued: {formatComplianceDate(item.issue_date)}</span>}
                      {item.expiry_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Expires: {formatComplianceDate(item.expiry_date)}</span>}
                    </div>
                    {(item.document_url || item.back_document_url) && (
                      <div className="flex items-center gap-2 mt-2">
                        {item.document_url && (
                          <a href={item.document_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline">
                            <FileText className="w-3.5 h-3.5" /> Front
                          </a>
                        )}
                        {item.back_document_url && (
                          <a href={item.back_document_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
                            <FileText className="w-3.5 h-3.5" /> Back
                          </a>
                        )}
                      </div>
                    )}
                    {item.notes && <p className="text-xs text-slate-500 mt-1.5">{item.notes}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(item)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}