import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  CheckCircle2, AlertTriangle, Clock, XCircle, Calendar, FileText,
  Plus, Trash2, GraduationCap, Loader2, ExternalLink, ScanLine,
} from 'lucide-react';
import { formatComplianceDate, complianceDaysUntil } from '@/utils/complianceDate';
import SmartCertificateUpload from '@/components/staff/SmartCertificateUpload';

function statusInfo(item) {
  if (item.status_override === 'missing') return { label: 'Missing', Icon: XCircle, cls: 'text-red-600 bg-red-50' };
  if (item.status_override === 'not_required') return { label: 'N/A', Icon: CheckCircle2, cls: 'text-slate-400 bg-slate-50' };
  const days = complianceDaysUntil(item.expiry_date);
  if (days === null) return { label: 'No Expiry', Icon: FileText, cls: 'text-slate-400 bg-slate-50' };
  if (days < 0) return { label: 'Expired', Icon: XCircle, cls: 'text-red-600 bg-red-50' };
  if (days <= 30) return { label: `${days}d left`, Icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50' };
  return { label: 'Valid', Icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' };
}

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10';

export default function QualificationDetailSheet({
  open, onOpenChange, staff, category, allCategories = [], complianceItems, bookings, courses, onBookTraining,
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: category?.label || '', card_number: '', issue_date: '', expiry_date: '' });

  if (!staff || !category) return null;

  const items = complianceItems.filter(c =>
    (c.reference_id === staff.id || c.reference_name === staff.name) &&
    c.qualification_type === category.qualification_type
  );
  const staffBookings = bookings.filter(b => b.staff_id === staff.id);
  const categoryBookings = staffBookings.filter(b => {
    const course = courses.find(c => c.id === b.course_id);
    return course?.category === category.qualification_type;
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.ComplianceItem.create({
        category: 'staff',
        title: form.title || category.label,
        qualification_type: category.qualification_type,
        reference_id: staff.id,
        reference_name: staff.name,
        card_number: form.card_number,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        status_override: 'auto',
      });
      queryClient.invalidateQueries({ queryKey: ['compliance-items-staff'] });
      toast({ title: 'Compliance item added' });
      setForm({ title: category.label, card_number: '', issue_date: '', expiry_date: '' });
      setShowAdd(false);
    } catch (err) {
      toast({ title: 'Could not add', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
      await base44.entities.ComplianceItem.delete(item.id);
      queryClient.invalidateQueries({ queryKey: ['compliance-items-staff'] });
      toast({ title: 'Item deleted' });
    } catch (err) {
      toast({ title: 'Could not delete', description: err.message, variant: 'destructive' });
    }
  };

  const handleMarkMissing = async () => {
    setSaving(true);
    try {
      await base44.entities.ComplianceItem.create({
        category: 'staff',
        title: category.label,
        qualification_type: category.qualification_type,
        reference_id: staff.id,
        reference_name: staff.name,
        status_override: 'missing',
      });
      queryClient.invalidateQueries({ queryKey: ['compliance-items-staff'] });
      toast({ title: 'Marked as missing' });
    } catch (err) {
      toast({ title: 'Could not update', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2E5A1A] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-left">{staff.name}</SheetTitle>
              <SheetDescription className="text-left">{category.label} · {category.short_code}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Quick actions */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setShowScan(s => !s); setShowAdd(false); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-xs font-semibold hover:brightness-110 transition shadow-sm">
              <ScanLine className="w-3.5 h-3.5" /> Scan & Auto-Fill
            </button>
            <button onClick={() => { setShowAdd(s => !s); setShowScan(false); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-[#2E5A1A] border border-[#2E5A1A]/20 rounded-lg text-xs font-semibold hover:bg-[#2E5A1A]/5 transition">
              <Plus className="w-3.5 h-3.5" /> Add Manually
            </button>
            <button onClick={handleMarkMissing} disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition border border-red-200">
              <XCircle className="w-3.5 h-3.5" /> Mark Missing
            </button>
            <button onClick={() => onBookTraining([staff.id], category.qualification_type)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition border border-blue-200">
              <Calendar className="w-3.5 h-3.5" /> Book Training
            </button>
          </div>

          {/* Smart scan upload */}
          {showScan && (
            <SmartCertificateUpload
              staffId={staff.id}
              staffName={staff.name}
              categories={allCategories && allCategories.length > 0 ? allCategories : (category ? [category] : [])}
              preselectedCategory={category}
              onSaved={() => { setShowScan(false); onOpenChange(false); }}
            />
          )}

          {/* Inline add form */}
          {showAdd && (
            <form onSubmit={handleAdd} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Card / Ref</label>
                  <input value={form.card_number} onChange={e => setForm({ ...form, card_number: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Issue (YYYY-MM)</label>
                  <input type="month" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expiry (YYYY-MM)</label>
                  <input type="month" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className={inputClass} />
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="w-full px-4 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">
                {saving ? 'Saving…' : 'Save Item'}
              </button>
            </form>
          )}

          {/* Existing compliance items */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Compliance Records</p>
            {items.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs text-slate-400">No records yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(item => {
                  const st = statusInfo(item);
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${st.cls}`}>
                        <st.Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{st.label}</span>
                          {item.card_number && <span>· #{item.card_number}</span>}
                          {item.expiry_date && <span>· exp {formatComplianceDate(item.expiry_date)}</span>}
                          {item.document_url && (
                            <a href={item.document_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[#2E5A1A] hover:underline">
                              <ExternalLink className="w-2.5 h-2.5" /> doc
                            </a>
                          )}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(item)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bookings */}
          {categoryBookings.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Training Bookings</p>
              <div className="space-y-2">
                {categoryBookings.map(b => {
                  const course = courses.find(c => c.id === b.course_id);
                  return (
                    <div key={b.id} className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{course?.title || 'Course'}</p>
                        <p className="text-[10px] text-slate-400">Status: {b.status}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}