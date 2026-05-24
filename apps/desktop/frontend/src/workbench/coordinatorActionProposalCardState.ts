import type {
  CoordinatorActionProposal,
  CoordinatorProposalApprovalStatus,
  CoordinatorProposalExecutionStatus,
  CoordinatorProposalInput,
  CoordinatorProposalTypeId,
} from "./coordinatorActionProposalRegistry";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";

export type ProposalCardTone =
  | "approved"
  | "error"
  | "pending"
  | "rejected"
  | "review"
  | "success"
  | "suggestion";

export type ProposalResultDisplay = {
  detail: string;
  summary?: string;
  title: string;
  tone: "error" | "pending" | "success";
};

export type ProposalCardState = {
  approvalVariant: BadgeVariant;
  executionVariant: BadgeVariant;
  result: ProposalResultDisplay | null;
  stateDescription: string;
  stateLabel: string;
  statusDotVariant: BadgeVariant;
  tone: ProposalCardTone;
  typeLabel: string;
};

export function getProposalCardState(
  proposal: CoordinatorActionProposal,
): ProposalCardState {
  const result = getProposalResult(proposal);

  if (result?.tone === "success") {
    return {
      approvalVariant: approvalBadgeVariant(proposal.approvalStatus),
      executionVariant: executionBadgeVariant(proposal.executionStatus),
      result,
      stateDescription:
        proposal.typeId === "create-note"
          ? "The approved Note handoff completed. No existing Notes content was read."
          : "The approved Queue task handoff created a draft task. It was not assigned or run.",
      stateLabel: "Created",
      statusDotVariant: "success",
      tone: "success",
      typeLabel: proposalTypeLabel(proposal.typeId),
    };
  }

  if (result?.tone === "error") {
    return {
      approvalVariant: approvalBadgeVariant(proposal.approvalStatus),
      executionVariant: executionBadgeVariant(proposal.executionStatus),
      result,
      stateDescription:
        "The attempted handoff failed locally. No hidden action or fallback execution ran.",
      stateLabel: "Failed",
      statusDotVariant: "error",
      tone: "error",
      typeLabel: proposalTypeLabel(proposal.typeId),
    };
  }

  if (result?.tone === "pending") {
    return {
      approvalVariant: approvalBadgeVariant(proposal.approvalStatus),
      executionVariant: executionBadgeVariant(proposal.executionStatus),
      result,
      stateDescription:
        "Creating from the visible approved fields. No dispatch or hidden execution is part of this step.",
      stateLabel: "Creating",
      statusDotVariant: "warning",
      tone: "pending",
      typeLabel: proposalTypeLabel(proposal.typeId),
    };
  }

  if (proposal.approvalStatus === "Rejected preview") {
    return {
      approvalVariant: approvalBadgeVariant(proposal.approvalStatus),
      executionVariant: executionBadgeVariant(proposal.executionStatus),
      result,
      stateDescription: "Rejected locally. No widget capability was invoked.",
      stateLabel: "Rejected",
      statusDotVariant: "error",
      tone: "rejected",
      typeLabel: proposalTypeLabel(proposal.typeId),
    };
  }

  if (proposal.typeId === "prepare-jdbc-query-suggestion") {
    return {
      approvalVariant: approvalBadgeVariant(proposal.approvalStatus),
      executionVariant: executionBadgeVariant(proposal.executionStatus),
      result,
      stateDescription:
        proposal.approvalStatus === "Approved preview"
          ? "Approved as a review-only SQL suggestion. Copy SQL is the only JDBC-specific action."
          : "Review or edit the visible SQL text. Approval and copy do not execute SQL.",
      stateLabel: "Suggestion only",
      statusDotVariant: "info",
      tone: "suggestion",
      typeLabel: proposalTypeLabel(proposal.typeId),
    };
  }

  if (proposal.approvalStatus === "Approved preview") {
    const stateDescription =
      proposal.typeId === "create-note"
        ? "Approval only accepts the preview. Use Create Note separately to write a new Note."
        : proposal.typeId === "create-agent-queue-task"
          ? "Approval only accepts the draft. Use Create Queue task separately. Creates a draft task. Does not run it."
          : "Approval only accepts the preview. No capability executes from approval alone.";

    return {
      approvalVariant: approvalBadgeVariant(proposal.approvalStatus),
      executionVariant: executionBadgeVariant(proposal.executionStatus),
      result,
      stateDescription,
      stateLabel: "Approved",
      statusDotVariant: "success",
      tone: "approved",
      typeLabel: proposalTypeLabel(proposal.typeId),
    };
  }

  return {
    approvalVariant: approvalBadgeVariant(proposal.approvalStatus),
    executionVariant: executionBadgeVariant(proposal.executionStatus),
    result,
    stateDescription:
      proposal.approvalStatus === "Edited preview"
        ? "Edited locally. Review the visible fields again before approving."
        : proposal.typeId === "create-agent-queue-task"
          ? "Review the draft task. Approval does not create or run anything by itself."
          : "Review the visible inputs. Approval does not execute or create anything by itself.",
    stateLabel:
      proposal.approvalStatus === "Edited preview" ? "Edited" : "Review",
    statusDotVariant: proposal.approvalStatus === "Edited preview" ? "info" : "warning",
    tone: "review",
    typeLabel: proposalTypeLabel(proposal.typeId),
  };
}

export function formatProposalDetails(proposal: CoordinatorActionProposal) {
  const inputs = proposal.inputs
    .map((input) => `- ${input.label}: ${input.value}`)
    .join("\n");
  const riskNotes = proposal.riskNotes.map((note) => `- ${note}`).join("\n");

  return [
    `Title: ${proposal.title}`,
    `Target widget: ${proposal.targetWidget}`,
    `Capability: ${proposal.targetCapability}`,
    `Risk: ${proposal.riskLevel}`,
    `Approval status: ${proposal.approvalStatus}`,
    `Execution status: ${proposal.executionStatus}`,
    "",
    `Intent: ${proposal.intent}`,
    "",
    "Visible inputs:",
    inputs,
    "",
    "Risk / safety notes:",
    riskNotes,
    "",
    `Expected result: ${proposal.expectedResult}`,
    proposal.createdQueueTaskId
      ? `Created Queue task: ${proposal.createdQueueTaskTitle ?? "Queue task"} (${proposal.createdQueueTaskId})`
      : null,
    proposal.createdNoteId
      ? `Created Note: ${proposal.createdNoteTitle ?? "Note"} (${proposal.createdNoteId})`
      : null,
    proposal.executionError ? `Error: ${proposal.executionError}` : null,
    `Result summary: ${proposal.resultSummary}`,
    "",
    proposal.typeId === "create-agent-queue-task"
      ? "Queue task creation requires approval and a separate Create Queue task action. Creates a draft task. Does not run it. No provider runtime, Agent Executor launch, Queue auto-dispatch, Terminal command, Git mutation, or JDBC SQL execution is triggered."
      : proposal.typeId === "create-note"
        ? "Note creation requires approval and a separate Create Note action. No existing Notes content is read, and no provider runtime, Queue task, Agent Executor launch, Terminal command, Git mutation, or JDBC SQL execution is triggered."
        : proposal.typeId === "prepare-jdbc-query-suggestion"
          ? "SQL suggestion only. Copy SQL copies only the visible SQL text. No connector access, database call, EXPLAIN, provider runtime, Terminal command, Git mutation, Queue dispatch, Agent Executor launch, or JDBC SQL execution is triggered."
          : "Preview only. No backend API, widget mutation, provider runtime, or tool execution ran.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function proposalInputValue(
  proposal: CoordinatorActionProposal,
  label: string,
) {
  return (
    proposal.inputs
      .find((input) => input.label.toLowerCase() === label.toLowerCase())
      ?.value.trim() ?? ""
  );
}

export function isSqlSuggestionInput(input: CoordinatorProposalInput) {
  return input.label.toLowerCase() === "suggested sql text";
}

function approvalBadgeVariant(
  status: CoordinatorProposalApprovalStatus,
): BadgeVariant {
  if (status === "Approved preview") {
    return "success";
  }
  if (status === "Rejected preview") {
    return "error";
  }
  if (status === "Edited preview") {
    return "info";
  }
  return "warning";
}

function executionBadgeVariant(
  status: CoordinatorProposalExecutionStatus,
): BadgeVariant {
  if (status === "Queue task created" || status === "Note created") {
    return "success";
  }
  if (
    status === "Queue task creation failed" ||
    status === "Note creation failed"
  ) {
    return "error";
  }
  if (
    status === "Ready to create Queue task" ||
    status === "Creating Queue task" ||
    status === "Ready to create Note" ||
    status === "Creating Note" ||
    status === "SQL suggestion only"
  ) {
    return "info";
  }
  if (status === "Execution bridge not implemented") {
    return "warning";
  }
  return "neutral";
}

function proposalTypeLabel(typeId: CoordinatorProposalTypeId) {
  if (typeId === "create-agent-queue-task") {
    return "Draft Queue task";
  }
  if (typeId === "create-note") {
    return "Note proposal";
  }
  return "JDBC SQL suggestion";
}

function getProposalResult(
  proposal: CoordinatorActionProposal,
): ProposalResultDisplay | null {
  if (proposal.executionError) {
    return {
      detail: proposal.executionError,
      title: "Local error",
      tone: "error",
    };
  }

  if (proposal.createdQueueTaskId) {
    return {
      detail: `${proposal.createdQueueTaskTitle ?? "Queue task"} (${proposal.createdQueueTaskId})`,
      summary: proposal.resultSummary,
      title: "Created Queue task",
      tone: "success",
    };
  }

  if (proposal.createdNoteId) {
    return {
      detail: `${proposal.createdNoteTitle ?? "Note"} (${proposal.createdNoteId})`,
      summary: proposal.resultSummary,
      title: "Created Note",
      tone: "success",
    };
  }

  if (
    proposal.executionStatus === "Creating Queue task" ||
    proposal.executionStatus === "Creating Note"
  ) {
    return {
      detail: proposal.resultSummary,
      title: "Pending handoff",
      tone: "pending",
    };
  }

  return null;
}
