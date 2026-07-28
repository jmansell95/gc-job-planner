import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare, Check, Loader2, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

/**
 * Shared agent chat panel — used by all three in-app AI assistants.
 * Features: brand-coloured header, suggestion chips for first-time users,
 * styled markdown rendering (headings, tables, lists, callouts), and
 * expandable tool-call display showing both parameters and results.
 */
export default function AgentChatPanel({
  open, onClose, messages, input, setInput, onSend, loading, sending, scrollRef,
  icon: Icon, title, subtitle, placeholder, suggestions = [],
  brandClass = 'bg-[#2E5A1A]', brandRing = 'focus:ring-[#2E5A1A]/40',
  panelClass = 'max-w-md', headerGradient = 'hero-gradient',
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4"
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${panelClass} h-[82vh] sm:h-[640px] flex flex-col overflow-hidden`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-white/10 ${headerGradient}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center ring-1 ring-white/20">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{title}</p>
                  <p className="text-white/70 text-[11px] truncate">{subtitle}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 text-white/80 hover:bg-white/10 rounded-lg transition flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {loading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" />
                </div>
              )}
              {messages.length === 0 && !loading && (
                <div className="text-center text-slate-500 text-sm py-8 px-4">
                  <Icon className="w-9 h-9 mx-auto mb-3 text-[#2E5A1A]/40" />
                  <p className="font-medium text-slate-600">{suggestions.length > 0 ? 'Try one of these, or ask me anything:' : 'Ask me a question to get started.'}</p>
                  {suggestions.length > 0 && (
                    <div className="mt-4 grid gap-2 text-left">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => { setInput(s); }}
                          className="text-left text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2.5 hover:border-[#2E5A1A]/40 hover:bg-[#2E5A1A]/5 transition"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {messages.map((m, i) => (
                <MessageBubble key={i} message={m} />
              ))}
            </div>

            {/* Input */}
            <form onSubmit={(e) => onSend(e)} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2 safe-area-bottom">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                className={`flex-1 px-3.5 py-2.5 bg-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 ${brandRing}`}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className={`p-2.5 ${brandClass} text-white rounded-full hover:opacity-90 disabled:opacity-40 transition flex-shrink-0`}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isPending = ['pending', 'running', 'in_progress'].includes(message.status);
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-sm ${
          isUser
            ? 'bg-[#2E5A1A] text-white rounded-br-sm'
            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm'
        }`}
      >
        {message.content ? (
          isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-headings:text-[#2E5A1A] prose-headings:font-bold prose-strong:text-slate-800 prose-strong:bg-[#2E5A1A]/10 prose-strong:px-1 prose-strong:rounded prose-table:text-xs prose-table:border-collapse prose-th:border prose-th:border-slate-200 prose-th:bg-slate-50 prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-slate-200 prose-td:px-2 prose-td:py-1 prose-li:text-slate-600 prose-a:text-[#2E5A1A]">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )
        ) : isPending ? (
          <div className="flex items-center gap-2 text-slate-400">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-[#2E5A1A]/40 rounded-full animate-pulse" />
              <span className="w-1.5 h-1.5 bg-[#2E5A1A]/40 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
              <span className="w-1.5 h-1.5 bg-[#2E5A1A]/40 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
            </div>
            <span className="text-xs">Working…</span>
          </div>
        ) : null}
        {message.tool_calls?.map((tc, i) => (
          <ToolCallDisplay key={i} toolCall={tc} isUserMessage={isUser} />
        ))}
      </div>
    </div>
  );
}

function ToolCallDisplay({ toolCall, isUserMessage }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status;
  const isFailed = ['failed', 'error'].includes(status);
  const isActive = ['pending', 'running', 'in_progress'].includes(status);
  const proj = toolCall.display_projection || {};
  const label = proj.label || toolCall.name || 'Tool call';
  const activeLabel = proj.active_label || 'Querying…';
  const errorLabel = proj.error_label || 'Failed';
  const hideDetails = proj.hide_details && proj.details_redacted;
  const statusText = isActive ? activeLabel : isFailed ? errorLabel : label;

  // Don't show tool calls inside user messages (only assistant messages display them)
  if (isUserMessage) return null;

  let resultSummary = null;
  if (toolCall.result && !hideDetails) {
    try {
      const parsed = typeof toolCall.result === 'string' ? JSON.parse(toolCall.result) : toolCall.result;
      if (Array.isArray(parsed)) {
        resultSummary = `${parsed.length} record${parsed.length !== 1 ? 's' : ''}`;
      } else if (parsed && typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        resultSummary = keys.slice(0, 3).join(', ') + (keys.length > 3 ? '…' : '');
      }
    } catch { resultSummary = null; }
  }

  return (
    <div className="mt-2 text-xs border-t border-slate-100 pt-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition"
      >
        {isActive ? (
          <Loader2 className="w-3 h-3 animate-spin text-[#2E5A1A]" />
        ) : isFailed ? (
          <X className="w-3 h-3 text-red-500" />
        ) : (
          <Check className="w-3 h-3 text-emerald-600" />
        )}
        <span className="font-medium">{statusText}</span>
        {resultSummary && !isActive && (
          <span className="text-slate-400">· {resultSummary}</span>
        )}
        {!hideDetails && (toolCall.arguments_string || toolCall.result) && (
          expanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />
        )}
      </button>
      {!hideDetails && expanded && (
        <div className="mt-1.5 space-y-1.5">
          {toolCall.arguments_string && (
            <div className="p-2 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-400 mb-1 flex items-center gap-1"><Wrench className="w-2.5 h-2.5" /> Parameters</p>
              <pre className="whitespace-pre-wrap text-[11px] text-slate-500 font-mono">
                {(() => { try { return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2); } catch { return toolCall.arguments_string; } })()}
              </pre>
            </div>
          )}
          {toolCall.result && (
            <div className="p-2 bg-emerald-50/50 rounded-lg">
              <p className="font-medium text-emerald-700 mb-1">Result</p>
              <pre className="whitespace-pre-wrap text-[11px] text-slate-600 font-mono max-h-40 overflow-y-auto">
                {(() => {
                  try {
                    const r = typeof toolCall.result === 'string' ? JSON.parse(toolCall.result) : toolCall.result;
                    return JSON.stringify(r, null, 2);
                  } catch { return String(toolCall.result); }
                })()}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}