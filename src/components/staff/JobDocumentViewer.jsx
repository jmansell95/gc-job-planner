import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Map, ClipboardList, ShieldAlert, FileText, FileCheck2, FileQuestion, ExternalLink, FolderOpen, Loader2 } from 'lucide-react';

const categoryConfig = {
  site_map: { label: 'Site Map', icon: Map, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  scope_of_work: { label: 'Scope of Work', icon: ClipboardList, tone: 'bg-blue-50 text-blue-700 ring-blue-200' },
  rams: { label: 'RAMS', icon: ShieldAlert, tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
  method_statement: { label: 'Method Statement', icon: FileText, tone: 'bg-purple-50 text-purple-700 ring-purple-200' },
  risk_assessment: { label: 'Risk Assessment', icon: ShieldAlert, tone: 'bg-rose-50 text-rose-700 ring-rose-200' },
  completion_cert: { label: 'Completion Cert', icon: FileCheck2, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  other: { label: 'Document', icon: FileQuestion, tone: 'bg-slate-50 text-slate-600 ring-slate-200' }
};

// Ordered grouping so the most useful field documents appear first.
const categoryOrder = ['site_map', 'scope_of_work', 'rams', 'method_statement', 'risk_assessment', 'completion_cert', 'other'];

export default function JobDocumentViewer({ jobId }) {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['job-documents-staff', jobId],
    queryFn: () => base44.entities.JobDocument.filter({ job_id: jobId }),
    enabled: !!jobId
  });

  const grouped = useMemo(() => {
    const map = {};
    docs.forEach(d => {
      const key = d.category || 'other';
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [docs]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading documents…
      </div>
    );
  }

  if (docs.length === 0) return null;

  return (
    <div className="mb-4 bg-white rounded-xl border border-slate-200 p-3.5">
      <div className="flex items-center gap-1.5 mb-3">
        <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Job Documents</p>
        <span className="text-[10px] text-slate-400 ml-auto">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-3">
        {categoryOrder.filter(c => grouped[c]?.length).map(cat => {
          const cfg = categoryConfig[cat] || categoryConfig.other;
          const Icon = cfg.icon;
          return (
            <div key={cat}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${cfg.tone}`}>
                  <Icon className="w-3 h-3" /> {cfg.label}
                </span>
              </div>
              <div className="space-y-1.5">
                {grouped[cat].map(doc => {
                  const name = doc.document_name || 'Document';
                  const isImg = /\.(png|jpe?g|webp|gif)$/i.test(name);
                  return (
                    <a key={doc.id} href={doc.document_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 hover:bg-emerald-50/60 rounded-lg border border-slate-100 hover:border-emerald-200 transition group">
                      <div className="flex items-center gap-2 min-w-0">
                        {isImg ? (
                          <img src={doc.document_url} alt="" className="w-8 h-8 rounded-md object-cover border border-slate-200 flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                          {doc.uploaded_by_name && (
                            <p className="text-[10px] text-slate-400 truncate">Added by {doc.uploaded_by_name}</p>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 flex-shrink-0 transition" />
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}