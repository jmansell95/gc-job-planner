import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function PortalComments({ token, comments }) {
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [localComments, setLocalComments] = useState(comments || []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !name.trim()) return;
    setSending(true);
    try {
      await base44.functions.invoke('addPortalComment', {
        portal_token: token,
        author_name: name,
        message: message.trim()
      });
      setLocalComments([...localComments, {
        author_name: name, message: message.trim(), is_client: true, created_date: new Date().toISOString()
      }]);
      setMessage('');
    } catch (error) {
      console.error('Error sending comment:', error);
    }
    setSending(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Comments</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{localComments.length}</span>
      </div>
      <div className="p-5">
        {localComments.length > 0 && (
          <div className="space-y-3 mb-4">
            {localComments.map((c, i) => (
              <div key={i} className={`flex ${c.is_client ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-2.5 ${c.is_system_milestone ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : c.is_client ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  {c.is_system_milestone && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Verified Milestone</span>
                    </div>
                  )}
                  <p className="text-sm">{c.message}</p>
                  <p className={`text-[10px] mt-1 ${c.is_client ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {c.author_name} · {c.created_date ? format(new Date(c.created_date), 'dd MMM HH:mm') : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="space-y-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          <div className="flex gap-2">
            <input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="Write a comment..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            <button type="submit" disabled={sending || !message.trim() || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium disabled:opacity-50">
              <Send className="w-3.5 h-3.5" /> {sending ? '...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}