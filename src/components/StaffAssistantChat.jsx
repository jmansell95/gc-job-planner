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
  "Create a rota for John Smith on the Cambridge job next week",
  "What's the mileage and trip history for van registration MK23 ABC?",
  "Show me today's deliveries for driver Tom",
  "I worked 8am to 4pm with a 30 min break on the Bishops Stortford job",
  "I need time off next Friday — it's a personal day",
];

export function StaffAssistantProvider({ children }) {
  const { open, setOpen, messages, input, setInput, loading, sending, scrollRef, handleSend } =
    useAgentChat(AGENT_NAME, 'AI Assistant');

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
        title="AI Assistant"
        subtitle="Your operations co-pilot — rotas, vehicles, deliveries & more"
        placeholder="Ask about schedules, rotas, vehicles, deliveries…"
        suggestions={SUGGESTIONS}
        panelClass="max-w-md"
      />
    </StaffAssistantContext.Provider>
  );
}