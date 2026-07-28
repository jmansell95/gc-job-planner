import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Shared hook for managing an in-app agent conversation.
 * Used by StaffAssistantChat, SchedulingAssistantChat, and DrillingIntelligenceChat
 * so all three share identical conversation lifecycle logic.
 */
export function useAgentChat(agentName, displayName) {
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
        const existing = await base44.agents.listConversations({ agent_name: agentName });
        let conv;
        if (existing.length > 0) {
          conv = await base44.agents.getConversation(existing[0].id);
        } else {
          conv = await base44.agents.createConversation({
            agent_name: agentName,
            metadata: { name: displayName }
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
        console.error(`${agentName} error`, e);
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; unsub(); };
  }, [open, agentName, displayName]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = useCallback(async (e, overrideText) => {
    if (e && e.preventDefault) e.preventDefault();
    const text = (overrideText ?? input).trim();
    if (!text || !conversation || sending) return;
    if (!overrideText) setInput('');
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: text });
    } catch (err) {
      console.error(err);
    }
    setSending(false);
  }, [input, conversation, sending]);

  return {
    open, setOpen, messages, input, setInput,
    loading, sending, scrollRef, handleSend,
  };
}