import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, MessageSquare, Check, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const AGENT_NAME = 'staff_assistant';

export default function StaffAssistantChat({ staffName }) {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let unsub = () => {};
    let mounted = true;
    (async () => {
      try {
        const existing = await base44.agents.listConversations({ agent_name: AGENT_NAME });
        let conv;
        if (existing.length > 0) {
          conv = await base44.agents.getConversation(existing[0].id);
        } else {
          conv = await base44.agents.createConversation({
            agent_name: AGENT_NAME,
            metadata: { name: staffName ? `Assistant - ${staffName}` : 'Staff Assistant' }
          });
        }
        if (!mounted) return;
        setConversation(conv);
        setMessages(conv.messages || []);
        setLoading(false);
        unsub = base44.agents.subscribeToConversation(conv.id, (data) => {
          setMessages(data.messages || []);
        });
      } catch (e) {
        console.error('Assistant error', e);
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; unsub(); };
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !conversation || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: text });
    } catch (err) {
      console.error(err);
    }
    setSending(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-full shadow-lg shadow-emerald-900/30 hover:scale-105 active:scale-95 transition"
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-medium text-sm hidden sm:inline">Ask Assistant</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4"
          >
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md h-[80vh] sm:h-[600px] flex flex-col overflow-hidden"
            >
              {/* header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-emerald-700 to-emerald-900">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Staff Assistant</p>
                    <p className="text-emerald-100 text-[11px]">Speak any language — I'll handle the rest</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="p-1.5 text-white/80 hover:bg-white/10 rounded-lg transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {loading && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                  </div>
                )}
                {messages.length === 0 && !loading && (
                  <div className="text-center text-slate-400 text-sm py-10">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p>Ask me to log your hours, request time off, or check your schedule.</p>
                    <p className="text-xs mt-1 text-slate-400">You can write in any language.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <MessageBubble key={i} message={m} />
                ))}
              </div>

              {/* input */}
              <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type in any language..."
                  className="flex-1 px-3 py-2 bg-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="p-2.5 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-40 transition flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isPending = ['pending', 'running', 'in_progress'].includes(message.status);
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm ${
          isUser
            ? 'bg-emerald-600 text-white rounded-br-sm'
            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm'
        }`}
      >
        {message.content ? (
          isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )
        ) : isPending ? (
          <div className="flex items-center gap-1.5 text-slate-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-xs">Thinking...</span>
          </div>
        ) : null}
        {message.tool_calls?.map((tc, i) => (
          <FunctionDisplay key={i} toolCall={tc} />
        ))}
      </div>
    </div>
  );
}

function FunctionDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status;
  const isFailed = ['failed', 'error'].includes(status);
  const isActive = ['pending', 'running', 'in_progress'].includes(status);
  const proj = toolCall.display_projection || {};
  const label = proj.label || toolCall.name;
  const activeLabel = proj.active_label || 'Working...';
  const errorLabel = proj.error_label || 'Failed';
  const hideDetails = proj.hide_details && proj.details_redacted;
  const statusText = isActive ? activeLabel : isFailed ? errorLabel : label;

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition"
      >
        {isActive ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : isFailed ? (
          <X className="w-3 h-3 text-red-500" />
        ) : (
          <Check className="w-3 h-3 text-emerald-500" />
        )}
        <span>{statusText}</span>
      </button>
      {!hideDetails && expanded && (
        <div className="mt-1 p-2 bg-slate-50 rounded text-[11px] text-slate-500">
          {toolCall.arguments_string && (
            <div>
              <span className="font-medium">Parameters:</span>
              <pre className="whitespace-pre-wrap mt-0.5">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2);
                  } catch {
                    return toolCall.arguments_string;
                  }
                })()}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}