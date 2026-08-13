import React, { createContext, useContext } from 'react';
import { HardHat } from 'lucide-react';
import { useAgentChat } from '@/components/ai/useAgentChat';
import AgentChatPanel from '@/components/ai/AgentChatPanel';

const AGENT_NAME = 'drilling_intelligence';
const DrillingIntelligenceContext = createContext({ openChat: () => {} });

export function useDrillingIntelligence() {
  return useContext(DrillingIntelligenceContext);
}

const SUGGESTIONS = [
  "What hazards have been flagged across active jobs this week?",
  "Summarise the ground conditions for BH-01 at Battersea",
  "Which logs are awaiting my review?",
  "Any rigs on site with expired compliance?",
  "What's the mileage for van registration MK23 ABC?",
  "Staff the Cambridge drilling job for next Monday — suggest 3 crew",
];

export function DrillingIntelligenceProvider({ children }) {
  const { open, setOpen, messages, input, setInput, loading, sending, scrollRef, handleSend } =
    useAgentChat(AGENT_NAME, 'Drilling AI');

  return (
    <DrillingIntelligenceContext.Provider value={{ openChat: () => setOpen(true) }}>
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
        icon={HardHat}
        title="Drilling AI"
        subtitle="Hazard analysis, strata logs, rotas & borehole intelligence"
        placeholder="Ask about hazards, strata, reviews, rotas…"
        suggestions={SUGGESTIONS}
        panelClass="max-w-lg"
      />
    </DrillingIntelligenceContext.Provider>
  );
}