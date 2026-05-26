import {
  COORDINATOR_ACTION_PROPOSAL_REGISTRY,
} from "./coordinatorActionProposalRegistry";

export type WorkspaceAgentSuggestedPrompt = {
  label: string;
  prompt: string;
};

export const WORKSPACE_AGENT_SUGGESTED_PROMPTS: WorkspaceAgentSuggestedPrompt[] =
  [
    {
      label: "Make a plan",
      prompt:
        "Make a plan from the visible chat only. Goal: ",
    },
    {
      label: "Break into Queue tasks",
      prompt: "Break this into Queue tasks from visible text only. Goal: ",
    },
    {
      label: "Draft tasks for this goal",
      prompt: "Draft tasks for this goal using only the visible chat: ",
    },
    {
      label: "Review pasted Queue result",
      prompt:
        "Review pasted Queue result using visible chat text only. Paste result here: ",
    },
    {
      label: "Explain this Executor failure",
      prompt:
        "Explain this Executor failure using visible chat text only. Paste failure here: ",
    },
    {
      label: "Turn this result into next steps",
      prompt:
        "Turn this result into next steps using visible chat text only. Paste result here: ",
    },
    {
      label: "Draft follow-up Queue tasks",
      prompt:
        "Draft follow-up Queue tasks from this pasted result using visible chat text only. Paste result here: ",
    },
    {
      label: "Summarize validation output",
      prompt:
        "Summarize validation output using visible chat text only. Paste validation output here: ",
    },
    {
      label: "Explain how to execute this safely",
      prompt:
        "Explain how to execute this safely from visible chat only. Do not start Queue, Executor, Terminal, Git, or JDBC actions.",
    },
  ];

export function workspaceAgentProposalTypeSummary() {
  return COORDINATOR_ACTION_PROPOSAL_REGISTRY.map(
    (proposalType) => proposalType.displayName,
  ).join(", ");
}

export const WORKSPACE_AGENT_PROPOSAL_TYPE_SUMMARY =
  workspaceAgentProposalTypeSummary();
