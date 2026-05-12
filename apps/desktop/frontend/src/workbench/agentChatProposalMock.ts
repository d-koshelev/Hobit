import type { AgentChatApprovedContextSnapshot } from "./agentChatApprovedContext";
import type { GenerateAgentChatAiProposalResponse } from "../workspace/types";

export type AgentChatProposalStatus = "proposal-only";
export type AgentChatProposalSource =
  | "ai-generated"
  | "local-mock"
  | "provider-fallback";

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
  source: AgentChatProposalSource;
  providerStatus: string;
  providerUsed: boolean;
  runtimeStatus: string;
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
    source: "local-mock",
    providerStatus: "local_mock",
    providerUsed: false,
    runtimeStatus: "proposal_only_mock",
    status: "proposal-only",
  };
}

export function createAgentChatAiProposalFromResponse(
  prompt: string,
  sequence: number,
  approvedContextSnapshot: AgentChatApprovedContextSnapshot,
  response: GenerateAgentChatAiProposalResponse,
): AgentChatMockProposal {
  return {
    actionProposals: response.proposal.actionProposals.map((action) => ({
      description: action.description,
      status: "not-executed",
      title: action.title,
    })),
    approvedContextSnapshot,
    contextNeeded: response.proposal.contextNeeded,
    id: response.proposal.id,
    prompt: compactWhitespace(prompt),
    proposedPlan: response.proposal.proposedPlan,
    requestSummary: response.proposal.requestSummary,
    runtimeNotes: response.proposal.runtimeNotes,
    safetyNotes: [
      ...response.proposal.safetyNotes,
      ...response.normalizationWarnings.map(
        (warning) => `Normalization warning: ${warning}`,
      ),
    ],
    sequence,
    source:
      response.providerUsed && response.providerStatus === "completed"
        ? "ai-generated"
        : "provider-fallback",
    providerStatus: response.providerStatus,
    providerUsed: response.providerUsed,
    runtimeStatus: response.runtimeStatus,
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
