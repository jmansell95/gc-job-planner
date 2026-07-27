import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { HardHat, X, Send, MessageSquare, Check, Loader2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const AGENT_NAME = 'drilling_intelligence';
const DrillingIntelligenceContext = createContext({ openChat: () => {} });

export function useDrillingIntelligence() {
  return useContext(DrillingIntelligenceContext);
}

export function DrillingIntelligenceProvider({ children }) {
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
            metadata: { name: 'Drilling Intelligence' }
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
        console.error('Drilling Intelligence error', e);
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
    <DrillingIntelligenceContext.Provider value={{ openChat: () => setOpen(true) }}>
      {children}
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
              className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg h-[82vh] sm:h-[640px] flex flex-col overflow-hidden"
            >
              {/* header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 hero-gradient">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center ring-1 ring-white/20">
                    <HardHat className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Drilling Intelligence</p>
                    <p className="text-white/70 text-[11px]">Hazard &amp; log analysis across your jobs</p>
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
                    <Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" />
                  </div>
                )}
                {messages.length === 0 && !loading && (
                  <div className="text-center text-slate-500 text-sm py-10 px-4">
                    <HardHat className="w-9 h-9 mx-auto mb-3 text-[#2E5A1A]/40" />
                    <p className="font-medium text-slate-600">Ask me about hazards, ground conditions or log anomalies.</p>
                    <div className="mt-4 grid gap-2 text-left">
                      {[
                        'What hazards have been flagged across active jobs this week?',
                        'Summarise the ground conditions for BH-01 at Battersea',
                        'Which logs are awaiting my review?',
                        'Any rigs on site with expired compliance?',
                      ].map((s) => (
                        <button key={s} onClick={() => setInput(s)}
                          className="text-left text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-[#2E5A1A]/40 hover:bg-[#2E5A1A]/5 transition">
                          {s}
                        </button>
                      ))}
                    </div>
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
                  placeholder="Ask about hazards, strata, reviews…"
                  className="flex-1 px-3 py-2 bg-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/40"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="p-2.5 bg-[#2E5A1A] text-white rounded-full hover:bg-[#1c4a12] disabled:opacity-40 transition flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DrillingIntelligenceContext.Provider>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isPending = ['pending', 'running', 'in_progress'].includes(message.status);
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] px-3.5 py-2 rounded-2xl text-sm ${
          isUser
            ? 'bg-[#2E5A1A] text-white rounded-br-sm'
            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm'
        }`}
      >
        {message.content ? (
          isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-headings:text-[#2E5A1A] prose-strong:text-slate-800 prose-table:text-xs">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )
        ) : isPending ? (
          <div className="flex items-center gap-1.5 text-slate-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-xs">Analysing logs…</span>
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
  const activeLabel = proj.active_label || 'Querying…';
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
          <AlertTriangle className="w-3 h-3 text-red-500" />
        ) : (
          <Check className="w-3 h-3 text-[#2E5A1A]" />
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