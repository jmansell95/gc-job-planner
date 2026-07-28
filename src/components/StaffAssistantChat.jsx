import React, { createContext, useContext } from 'react';
import { Sparkles } from 'lucide-react';
import { useAgentChat } from '@/components/ai/useAgentChat';
import AgentChatPanel from '@/components/ai/AgentChatPanel';

const AGENT_NAME = 'staff_assistant';
const StaffAssistantContext = createContext({ openChat: () => {} });

export function useStaffAssistant() {
  return useContext(StaffAssistantContext);
}

const SUGGESTIONS = [
  "What's my schedule today?",
  "I worked 8am to 4pm with a 30 min break on the Bishops Stortford job",
  "I need time off next Friday — it's a personal day",
  "What van have I got assigned this week?",
];

export function StaffAssistantProvider({ children }) {
  const { open, setOpen, messages, input, setInput, loading, sending, scrollRef, handleSend } =
    useAgentChat(AGENT_NAME, 'Staff Assistant');

  return (
    <StaffAssistantContext.Provider value={{ openChat: () => setOpen(true) }}>
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
        icon={Sparkles}
        title="Staff Assistant"
        subtitle="Speak any language — I'll handle the rest"
        placeholder="Type in any language..."
        suggestions={SUGGESTIONS}
        panelClass="max-w-md"
      />
    </StaffAssistantContext.Provider>
  );
}