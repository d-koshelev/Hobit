export type AgentChatProposalStatus = "proposal-only";

export type AgentChatProposalAction = {
  description: string;
  status: "not-executed";
  title: string;
};

export type AgentChatMockProposal = {
  actionProposals: readonly AgentChatProposalAction[];
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
): AgentChatMockProposal {
  const compactPrompt = compactWhitespace(prompt);
  const summaryPrompt = truncateForSummary(compactPrompt);

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
          "Any future action would need a visible preview and explicit operator approval before it could mutate workspace state.",
        status: "not-executed",
        title: "Approval gate required",
      },
    ],
    contextNeeded: [
      "No approved context selected yet.",
      "This preview does not read Notes, Git status, Terminal results, Agent Queue items, widget state, or files.",
      "Future context selection must be explicit and operator-approved.",
    ],
    id: `agent-chat-mock-proposal-${sequence}`,
    prompt: compactPrompt,
    proposedPlan: [
      "Review only operator-approved workspace context; none has been selected in this mock runtime.",
      "Identify which visible widgets or future tool actions may support the request.",
      "Prepare an operator-reviewed action preview before any tool execution or workspace mutation.",
    ],
    requestSummary: `Local mock interpreted request: "${summaryPrompt}"`,
    runtimeNotes: [
      "Local/mock proposal preview only.",
      "No LLM is connected.",
      "No tools were executed.",
      "No workspace mutation was performed.",
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
