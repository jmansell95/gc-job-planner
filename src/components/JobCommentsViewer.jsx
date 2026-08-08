import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send } from 'lucide-react';
import { format } from 'date-fns';

export default function JobCommentsViewer({ job }) {
  const [message, setMessage] = useState('');
  const [authorName, setAuthorName] = useState('');
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ['job-comments', job.id],
    queryFn: () => base44.entities.JobComment.filter({ job_id: job.id })
  });

  const sorted = [...comments].sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    await base44.entities.JobComment.create({
      job_id: job.id,
      author_name: authorName.trim() || 'Admin',
      message: message.trim(),
      is_client: false
    });
    setMessage('');
    queryClient.invalidateQueries({ queryKey: ['job-comments', job.id] });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-emerald-700" />
        <h3 className="font-semibold text-slate-900 text-sm">Client Messages</h3>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{sorted.length}</span>
      </div>
      <div className="px-5 py-4">
        {sorted.length > 0 && (
          <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
            {sorted.map(c => (
              <div key={c.id} className={`flex ${c.is_client ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-2.5 ${c.is_client ? 'bg-blue-50 text-slate-800 border border-blue-100' : 'bg-emerald-600 text-white'}`}>
                  <p className="text-sm">{c.message}</p>
                  <p className={`text-[10px] mt-1 ${c.is_client ? 'text-slate-400' : 'text-emerald-100'}`}>
                    {c.author_name}{c.is_client ? ' (Client)' : ''} · {c.created_date ? format(new Date(c.created_date), 'dd MMM HH:mm') : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="flex gap-2">
          <input type="text" value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Your name"
            className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          <input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="Reply to client..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          <button type="submit" disabled={!message.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium disabled:opacity-50">
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}