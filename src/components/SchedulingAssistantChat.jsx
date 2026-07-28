import React, { createContext, useContext } from 'react';
import { BrainCircuit } from 'lucide-react';
import { useAgentChat } from '@/components/ai/useAgentChat';
import AgentChatPanel from '@/components/ai/AgentChatPanel';

const AGENT_NAME = 'scheduling_assistant';
const SchedulingContext = createContext({ openChat: () => {} });

export function useSchedulingAssistant() {
  return useContext(SchedulingContext);
}

const SUGGESTIONS = [
  "Who can I assign to the Bishops Stortford job next week?",
  "Show me available drillers for this Thursday",
  "Who's on holiday next week?",
  "Staff the Cambridge job for next Monday — suggest 3 crew",
];

export function SchedulingAssistantProvider({ children }) {
  const { open, setOpen, messages, input, setInput, loading, sending, scrollRef, handleSend } =
    useAgentChat(AGENT_NAME, 'Scheduling Assistant');

  return (
    <SchedulingContext.Provider value={{ openChat: () => setOpen(true) }}>
      {children}
      <AgentChatPanel
        open={open}
        onClose={() => setOpen(false)}
        messages={messages}
        input={input}
        setInput={setInput}
        onSend={handleSend}
        loading={loading}
        sending={sending}
        scrollRef={scrollRef}
        icon={BrainCircuit}
        title="Scheduling Assistant"
        subtitle="Helps you build rotas and find available crew"
        placeholder="Ask about staffing a job..."
        suggestions={SUGGESTIONS}
        panelClass="max-w-md"
      />
    </SchedulingContext.Provider>
  );
}