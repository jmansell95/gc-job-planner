import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2, Sparkles, Tag, Type, FileText, Mail } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Modal for creating a new custom email template.
// Custom templates get a unique alert_key prefixed with 'custom_' and can be
// deleted (unlike system templates). Users define their own tokens, subject,
// and body — the template appears alongside system templates in the editor.
export default function CustomTemplateModal({ onClose, onCreated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    custom_name: '',
    custom_description: '',
    custom_tokens: '',
    subject: '',
    template: '',
    recipient_emails: '',
    accent_color: '#0e7a4f',
    banner_title: 'GC Mission Control',
    show_banner: true,
    footer_text: 'GC Mission Control',
  });

  const handleSave = async () => {
    if (!form.custom_name.trim()) {
      toast({ title: 'Name required', description: 'Give your template a name.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('manageEmailAlerts', { action: 'create_custom', ...form });
      toast({ title: 'Template created', description: `"${form.custom_name}" is now in your template list.` });
      onCreated();
    } catch (e) {
      toast({ title: 'Error', description: e.message || 'Could not create template', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="command-gradient px-5 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">New Email Template</h3>
              <p className="text-white/70 text-xs">Create a custom email template</p>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 text-white/70 hover:bg-white/10 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Template name */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" /> Template name
            </label>
            <input type="text" value={form.custom_name} onChange={e => setForm({ ...form, custom_name: e.target.value })}
              placeholder="e.g. Welcome Email, Site Visit Follow-up"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="text" value={form.custom_description} onChange={e => setForm({ ...form, custom_description: e.target.value })}
              placeholder="When is this email sent?"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          </div>

          {/* Tokens */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Available tokens <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="text" value={form.custom_tokens} onChange={e => setForm({ ...form, custom_tokens: e.target.value })}
              placeholder="{staff_name},{job_name},{date}"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 font-mono" />
            <p className="text-xs text-slate-400 mt-1">Comma-separated. These are placeholders you can use in the body.</p>
          </div>

          {/* Subject */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
              <Type className="w-3.5 h-3.5 text-slate-400" /> Subject line
            </label>
            <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
              placeholder="Email subject"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          </div>

          {/* Body */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" /> Email body
            </label>
            <textarea value={form.template} onChange={e => setForm({ ...form, template: e.target.value })} rows={5}
              placeholder="Write your email body here. Use tokens like {staff_name} as placeholders."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 font-mono resize-none" />
          </div>

          {/* Recipients */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> Recipients <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input type="text" value={form.recipient_emails} onChange={e => setForm({ ...form, recipient_emails: e.target.value })}
              placeholder="Leave blank for all admins"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            <p className="text-xs text-slate-400 mt-1">Comma-separated email addresses.</p>
          </div>

          {/* Accent color */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Accent colour</label>
            <div className="flex items-center gap-2">
              {['#0e7a4f', '#1d4ed8', '#d97706', '#be123c', '#475569', '#7c3aed'].map(c => (
                <button key={c} type="button" onClick={() => setForm({ ...form, accent_color: c })}
                  className={`w-8 h-8 rounded-full ring-2 transition ${form.accent_color === c ? 'ring-slate-900' : 'ring-transparent hover:ring-slate-300'}`}
                  style={{ background: c }} />
              ))}
              <input type="color" value={form.accent_color} onChange={e => setForm({ ...form, accent_color: e.target.value })}
                className="w-8 h-8 rounded-full border border-slate-200 cursor-pointer p-0 bg-transparent" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button onClick={handleSave} disabled={saving || !form.custom_name.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {saving ? 'Creating…' : 'Create Template'}
          </button>
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2.5 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition text-sm font-medium">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}