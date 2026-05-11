import { createContext, useContext, type ReactNode } from "react";
import type { AgentChatAvailableContext } from "./agentChatApprovedContext";

const AgentChatAvailableContextValue =
  createContext<AgentChatAvailableContext | null>(null);

type AgentChatAvailableContextProviderProps = {
  children: ReactNode;
  value: AgentChatAvailableContext;
};

export function AgentChatAvailableContextProvider({
  children,
  value,
}: AgentChatAvailableContextProviderProps) {
  return (
    <AgentChatAvailableContextValue.Provider value={value}>
      {children}
    </AgentChatAvailableContextValue.Provider>
  );
}

export function useAgentChatAvailableContext() {
  return useContext(AgentChatAvailableContextValue);
}
