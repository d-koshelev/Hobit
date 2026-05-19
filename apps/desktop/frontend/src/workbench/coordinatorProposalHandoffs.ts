import type { CoordinatorActionProposal } from "./coordinatorActionProposalRegistry";
import type { WidgetRenderProps } from "./types";

export type QueueTaskCreateRequest = Parameters<
  NonNullable<WidgetRenderProps["onCreateAgentQueueTask"]>
>[0];

export type WorkspaceNoteCreateRequest = Parameters<
  NonNullable<WidgetRenderProps["onCreateWorkspaceNote"]>
>[0];

export function queueTaskRequestFromProposal(
  proposal: CoordinatorActionProposal,
): QueueTaskCreateRequest {
  return {
    description:
      proposalInputValue(proposal, "Description") || proposal.intent.trim(),
    priority: queueTaskPriority(proposalInputValue(proposal, "Priority")),
    prompt: proposalInputValue(proposal, "Prompt") || proposal.intent.trim(),
    status: "draft",
    title:
      proposalInputValue(proposal, "Title") ||
      proposal.title.replace(/^Preview:\s*/i, "").trim() ||
      "Coordinator proposal",
  };
}

export function noteCreateRequestFromProposal(
  proposal: CoordinatorActionProposal,
): WorkspaceNoteCreateRequest {
  return {
    body:
      proposalInputValue(proposal, "Body") ||
      proposal.intent.trim() ||
      proposal.expectedResult.trim(),
    pinned: pinnedInputValue(proposalInputValue(proposal, "Pinned")),
    title:
      proposalInputValue(proposal, "Title") ||
      proposal.title.replace(/^Preview:\s*/i, "").trim() ||
      "Coordinator note",
  };
}

function proposalInputValue(
  proposal: CoordinatorActionProposal,
  label: string,
) {
  return (
    proposal.inputs
      .find((input) => input.label.toLowerCase() === label.toLowerCase())
      ?.value.trim() ?? ""
  );
}

function queueTaskPriority(value: string) {
  const priority = Number.parseInt(value, 10);

  if (!Number.isFinite(priority)) {
    return 0;
  }

  return Math.min(5, Math.max(0, priority));
}

function pinnedInputValue(value: string) {
  return ["true", "yes", "pinned", "1"].includes(value.trim().toLowerCase());
}
