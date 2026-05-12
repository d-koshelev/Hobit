import type { AgentChatApprovedContextSnapshot } from "./agentChatApprovedContext";

export type AgentChatProposalStatus = "proposal-only";

export type AgentChatProposalAction = {
  description: string;
  status: "not-executed";
  title: string;
};

export type AgentChatMockProposal = {
  actionProposals: readonly AgentChatProposalAction[];
  approvedContextSnapshot: AgentChatApprovedContextSnapshot;
  contextNeeded: readonly string[];
  id: string;
  prompt: string;
  proposedPlan: readonly string[];
  requestSummary: string;
  runtimeNotes: readonly string[];
  safetyNotes: readonly string[];
  sequence: number;
  status: AgentChatProposalStatus;
};

const MAX_SUMMARY_LENGTH = 180;

export function createAgentChatMockProposal(
  prompt: string,
  sequence: number,
  approvedContextSnapshot: AgentChatApprovedContextSnapshot,
): AgentChatMockProposal {
  const compactPrompt = compactWhitespace(prompt);
  const summaryPrompt = truncateForSummary(compactPrompt);
  const hasApprovedContext = approvedContextSnapshot.status === "approved";

  return {
    actionProposals: [
      {
        description:
          "This mock runtime did not call Terminal, Git, Notes, Agent Queue, filesystem, scripts, network, or any external tool.",
        status: "not-executed",
        title: "No tool action executed",
      },
      {
        description:
          "Any future action would need a visible preview and explicit operator approval before it could mutate workspace content.",
        status: "not-executed",
        title: "Approval gate required",
      },
    ],
    approvedContextSnapshot,
    contextNeeded: [
      hasApprovedContext
        ? "This proposal used only the context selected above."
        : "No approved context selected; the proposal used the operator prompt only.",
      "No files, Git, Notes, Terminal output, logs, or hidden context are included.",
    ],
    id: `agent-chat-mock-proposal-${sequence}`,
    prompt: compactPrompt,
    proposedPlan: [
      hasApprovedContext
        ? "Review the selected context included in this proposal."
        : "Proceed from the operator prompt only; no workspace context has been approved.",
      "Identify which visible widgets or future tool actions may support the request.",
      "Prepare an operator-reviewed action preview before any tool execution or workspace content mutation.",
    ],
    requestSummary: `Local mock interpreted request: "${summaryPrompt}"`,
    runtimeNotes: [
      "Local/mock proposal preview only.",
      "No LLM is connected.",
      "No tools were executed.",
      "No workspace content mutation was performed.",
      hasApprovedContext
        ? "Approved context is a current-session snapshot only."
        : "No workspace context was included.",
    ],
    safetyNotes: [
      "Proposal only. This does not approve, queue, apply, or execute anything.",
      "No hidden context access is performed.",
      "No response parser, response validator, provider configuration, or secrets handling is connected.",
    ],
    sequence,
    status: "proposal-only",
  };
}

function compactWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function truncateForSummary(value: string) {
  if (value.length <= MAX_SUMMARY_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_SUMMARY_LENGTH - 3).trimEnd()}...`;
}
