import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, Briefcase, Calendar, StickyNote, Camera, Target, FileText, MessageSquare, ShieldCheck, Info, Users, PoundSterling } from 'lucide-react';

const DEFAULT_SECTIONS = {
  progress: true,
  client_info: true,
  schedule: true,
  notes: true,
  photos: true,
  milestones: true,
  documents: true,
  comments: true,
  team: true,
  client_charge: false
};

const SECTIONS = [
  { key: 'progress', label: 'Project Progress', desc: 'Completion bar and shift stats', icon: Activity },
  { key: 'team', label: 'Project Team', desc: 'Who is on the job and their roles', icon: Users },
  { key: 'client_info', label: 'Client & Contacts', desc: 'Client, PM and site contact', icon: Briefcase },
  { key: 'schedule', label: 'Work Schedule', desc: 'Daily crew breakdown', icon: Calendar },
  { key: 'notes', label: 'Project Notes', desc: 'Job notes text', icon: StickyNote },
  { key: 'photos', label: 'Site Photos', desc: 'Uploaded site photos', icon: Camera },
  { key: 'milestones', label: 'Milestones', desc: 'Project milestone timeline', icon: Target },
  { key: 'documents', label: 'Documents', desc: 'Downloadable job documents', icon: FileText },
  { key: 'comments', label: 'Comments', desc: 'Two-way client messaging', icon: MessageSquare },
  { key: 'client_charge', label: 'Project Investment', desc: 'Client billing total with markup & VAT (internal costs stay hidden)', icon: PoundSterling },
];

export default function PortalSectionManager({ job }) {
  const queryClient = useQueryClient();
  const [sections, setSections] = useState({ ...DEFAULT_SECTIONS, ...(job.portal_sections || {}) });
  const [saving, setSaving] = useState(false);

  const handleToggle = async (key) => {
    const next = { ...sections, [key]: !sections[key] };
    setSections(next);
    setSaving(true);
    try {
      await base44.entities.Job.update(job.id, { portal_sections: next });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (error) {
      console.error('Error updating portal sections:', error);
      setSections(sections);
    }
    setSaving(false);
  };

  const handleResetAll = async () => {
    const next = { ...DEFAULT_SECTIONS };
    setSections(next);
    try {
      await base44.entities.Job.update(job.id, { portal_sections: next });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (error) {
      console.error('Error resetting portal sections:', error);
    }
  };

  const enabledCount = Object.values(sections).filter(Boolean).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-emerald-700" /></div>
        <div>
          <h2 className="font-semibold text-slate-900">Client Portal Visibility</h2>
          <p className="text-xs text-slate-400">Choose what your client can see</p>
        </div>
        <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{enabledCount}/{SECTIONS.length} shown</span>
      </div>
      <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-500">Choose which sections appear on the client portal for this job. Disabled sections stay hidden from your client but remain visible to your team.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {SECTIONS.map(s => {
          const Icon = s.icon;
          const active = sections[s.key] !== false;
          return (
            <div key={s.key} className="px-5 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-slate-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{s.label}</p>
                <p className="text-xs text-slate-400">{s.desc}</p>
              </div>
              <button
                onClick={() => handleToggle(s.key)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition flex-shrink-0 disabled:opacity-50 ${active ? 'bg-emerald-600' : 'bg-slate-300'}`}
                aria-pressed={active}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${active ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-slate-100">
        <button onClick={handleResetAll} disabled={saving} className="text-xs text-slate-500 hover:text-emerald-700 font-medium transition disabled:opacity-50">Reset to show all</button>
      </div>
    </div>
  );
}