import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Download, CheckCircle2, Circle, Loader2, ShieldCheck } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function PortalDocuments({ token, documents }) {
  const [name, setName] = useState('');
  const [approvals, setApprovals] = useState(() => {
    const map = {};
    (documents || []).forEach((d) => {
      if (d.client_approved) map[d.document_name + d.document_url] = true;
    });
    return map;
  });
  const [pending, setPending] = useState(null);

  const handleApprove = async (doc) => {
    const approver = name.trim();
    if (!approver) {
      alert('Please enter your name first to acknowledge documents.');
      return;
    }
    setPending(doc.id);
    try {
      await base44.functions.invoke('approvePortalDocument', {
        portal_token: token,
        document_id: doc.id,
        approver_name: approver
      });
      setApprovals((prev) => ({ ...prev, [doc.document_name + doc.document_url]: { at: new Date().toISOString(), by: approver } }));
    } catch (e) {
      alert(e.response?.data?.error || 'Could not acknowledge document.');
    }
    setPending(null);
  };

  if (!documents || documents.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <FileText className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Documents</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{documents.length}</span>
      </div>
      <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100 flex items-start gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-500">Review each document and acknowledge once you've read it. Your project manager is notified of acknowledgements.</p>
      </div>

      <div className="px-5 py-3 border-b border-slate-100">
        <label className="text-xs text-slate-400 font-medium">Your name (for acknowledgement)</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Smith"
          className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
      </div>

      <div className="p-5 space-y-2">
        {documents.map((doc, i) => {
          const key = doc.document_name + doc.document_url;
          const approved = approvals[key];
          const isPending = pending === doc.id;
          return (
            <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-900 truncate block hover:text-emerald-700">
                  {doc.document_name}
                </a>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400 capitalize">{(doc.category || 'other').replace(/_/g, ' ')}</span>
                  {approved && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      Acknowledged{approved.by ? ` by ${approved.by}` : ''}{approved.at ? ` · ${format(parseISO(approved.at), 'dd MMM')}` : ''}
                    </span>
                  )}
                </div>
              </div>
              <a href={doc.document_url} target="_blank" rel="noopener noreferrer"
                className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg transition flex-shrink-0" title="Download">
                <Download className="w-4 h-4" />
              </a>
              {approved ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Done
                </span>
              ) : (
                <button onClick={() => handleApprove(doc)} disabled={isPending}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:border-emerald-400 hover:text-emerald-700 rounded-lg transition flex-shrink-0 disabled:opacity-50">
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Circle className="w-3.5 h-3.5" />} Acknowledge
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}