import type { CoordinatorActionProposal } from "./coordinatorActionProposalRegistry";
import type { WidgetRenderProps } from "./types";

export type QueueTaskCreateRequest = Parameters<
  NonNullable<WidgetRenderProps["onCreateAgentQueueTask"]>
>[0];

export type WorkspaceNoteCreateRequest = Parameters<
  NonNullable<WidgetRenderProps["onCreateWorkspaceNote"]>
>[0];

export type KnowledgeDocumentCreateRequest = Parameters<
  NonNullable<WidgetRenderProps["onCreateKnowledgeDocument"]>
>[0];

export type SkillCreateRequest = Parameters<
  NonNullable<WidgetRenderProps["onCreateSkill"]>
>[0];

export function queueTaskRequestFromProposal(
  proposal: CoordinatorActionProposal,
): QueueTaskCreateRequest {
  return {
    description:
      proposalInputValue(proposal, "Description") || proposal.intent.trim(),
    executionPolicy: queueTaskExecutionPolicy(
      proposalInputValue(proposal, "Policy"),
    ),
    priority: queueTaskPriority(proposalInputValue(proposal, "Priority")),
    prompt: proposalInputValue(proposal, "Prompt") || proposal.intent.trim(),
    status: "draft",
    title:
      proposalInputValue(proposal, "Title") ||
      proposal.title.replace(/^Preview:\s*/i, "").trim() ||
      "Workspace Agent proposal",
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
      "Workspace Agent note",
  };
}

export function knowledgeDocumentCreateRequestFromProposal(
  proposal: CoordinatorActionProposal,
): KnowledgeDocumentCreateRequest {
  return {
    content: proposalInputValue(proposal, "Content") || proposal.intent.trim(),
    enabled: enabledInputValue(proposalInputValue(proposal, "Enabled")),
    sourceLabel:
      proposalInputValue(proposal, "Source label") ||
      "Workspace Agent conversation",
    tags: proposalInputValue(proposal, "Tags"),
    title:
      proposalInputValue(proposal, "Title") ||
      proposal.title.replace(/^Preview:\s*/i, "").trim() ||
      "Workspace knowledge",
  };
}

export function skillCreateRequestFromProposal(
  proposal: CoordinatorActionProposal,
): SkillCreateRequest {
  return {
    prerequisites: proposalInputValue(proposal, "Prerequisites"),
    reviewStatus: reviewStatusInputValue(
      proposalInputValue(proposal, "Review status"),
    ),
    risks: proposalInputValue(proposal, "Risks"),
    steps: proposalInputValue(proposal, "Steps") || proposal.intent.trim(),
    tags: proposalInputValue(proposal, "Tags"),
    title:
      proposalInputValue(proposal, "Title") ||
      proposal.title.replace(/^Preview:\s*/i, "").trim() ||
      "Workspace skill",
    validation: proposalInputValue(proposal, "Validation"),
    whenToUse: proposalInputValue(proposal, "When to use"),
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

function queueTaskExecutionPolicy(value: string) {
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "manual" ||
    normalized === "auto" ||
    normalized === "after_previous_success"
  ) {
    return normalized;
  }

  return "manual";
}

function pinnedInputValue(value: string) {
  return ["true", "yes", "pinned", "1"].includes(value.trim().toLowerCase());
}

function enabledInputValue(value: string) {
  return !["false", "no", "disabled", "0"].includes(
    value.trim().toLowerCase(),
  );
}

function reviewStatusInputValue(value: string): SkillCreateRequest["reviewStatus"] {
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "draft" ||
    normalized === "needs_review" ||
    normalized === "reviewed" ||
    normalized === "deprecated"
  ) {
    return normalized;
  }

  if (normalized === "needs review") {
    return "needs_review";
  }

  return "draft";
}
