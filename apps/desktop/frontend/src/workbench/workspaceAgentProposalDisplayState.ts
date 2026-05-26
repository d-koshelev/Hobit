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

export type ProposalActionState = {
  canChangeReviewState: boolean;
  canCreateKnowledgeDocument: boolean;
  canCreateNote: boolean;
  canCreateQueueTask: boolean;
  canCreateSkill: boolean;
  hasCreatedKnowledgeDocument: boolean;
  hasCreatedNote: boolean;
  hasCreatedQueueTask: boolean;
  hasCreatedSkill: boolean;
  isApproved: boolean;
  isCreateKnowledgeDocumentProposal: boolean;
  isCreateNoteProposal: boolean;
  isCreateQueueTaskProposal: boolean;
  isCreateSkillProposal: boolean;
  isJdbcQuerySuggestion: boolean;
};

export type ProposalPendingState = {
  isKnowledgeDocumentCreationPending?: boolean;
  isNoteCreationPending?: boolean;
  isQueueTaskCreationPending?: boolean;
  isSkillCreationPending?: boolean;
};

export function proposalActionState(
  proposal: CoordinatorActionProposal,
  pendingState: ProposalPendingState = {},
): ProposalActionState {
  const hasCreatedKnowledgeDocument = Boolean(
    proposal.createdKnowledgeDocumentId,
  );
  const hasCreatedNote = Boolean(proposal.createdNoteId);
  const hasCreatedQueueTask = Boolean(proposal.createdQueueTaskId);
  const hasCreatedSkill = Boolean(proposal.createdSkillId);
  const isApproved = proposal.approvalStatus === "Approved preview";
  const isCreateKnowledgeDocumentProposal =
    proposal.typeId === "create-knowledge-document";
  const isCreateNoteProposal = proposal.typeId === "create-note";
  const isCreateQueueTaskProposal =
    proposal.typeId === "create-agent-queue-task";
  const isCreateSkillProposal = proposal.typeId === "create-skill";
  const isJdbcQuerySuggestion =
    proposal.typeId === "prepare-jdbc-query-suggestion";

  return {
    canChangeReviewState:
      !pendingState.isKnowledgeDocumentCreationPending &&
      !pendingState.isNoteCreationPending &&
      !pendingState.isQueueTaskCreationPending &&
      !pendingState.isSkillCreationPending &&
      !hasCreatedKnowledgeDocument &&
      !hasCreatedNote &&
      !hasCreatedQueueTask &&
      !hasCreatedSkill,
    canCreateKnowledgeDocument:
      isCreateKnowledgeDocumentProposal &&
      isApproved &&
      !hasCreatedKnowledgeDocument,
    canCreateNote: isCreateNoteProposal && isApproved && !hasCreatedNote,
    canCreateQueueTask:
      isCreateQueueTaskProposal && isApproved && !hasCreatedQueueTask,
    canCreateSkill: isCreateSkillProposal && isApproved && !hasCreatedSkill,
    hasCreatedKnowledgeDocument,
    hasCreatedNote,
    hasCreatedQueueTask,
    hasCreatedSkill,
    isApproved,
    isCreateKnowledgeDocumentProposal,
    isCreateNoteProposal,
    isCreateQueueTaskProposal,
    isCreateSkillProposal,
    isJdbcQuerySuggestion,
  };
}

export function queueDraftReviewState(
  proposalIds: string[],
  proposals: Record<string, CoordinatorActionProposal>,
) {
  const queueDraftIds = proposalIds.filter(
    (proposalId) => proposals[proposalId]?.typeId === "create-agent-queue-task",
  );
  const queueDrafts = queueDraftIds
    .map((proposalId) => proposals[proposalId])
    .filter((proposal): proposal is CoordinatorActionProposal =>
      Boolean(proposal),
    );
  const approvedCount = queueDrafts.filter(
    (proposal) => proposal.approvalStatus === "Approved preview",
  ).length;
  const createdCount = queueDrafts.filter((proposal) =>
    Boolean(proposal.createdQueueTaskId),
  ).length;
  const approvableIds = queueDrafts
    .filter((proposal) => !proposal.createdQueueTaskId)
    .map((proposal) => proposal.id);

  return {
    approvableIds,
    approvedCount,
    canApproveAll:
      approvableIds.length > 0 && approvedCount < queueDrafts.length,
    createdCount,
    queueDraftCount: queueDrafts.length,
    queueDrafts,
  };
}

export function isCreateQueueTaskProposal(
  proposal: CoordinatorActionProposal,
) {
  return proposal.typeId === "create-agent-queue-task";
}

export function isCreateKnowledgeDocumentProposal(
  proposal: CoordinatorActionProposal,
) {
  return proposal.typeId === "create-knowledge-document";
}

export function isCreateSkillProposal(proposal: CoordinatorActionProposal) {
  return proposal.typeId === "create-skill";
}

export function isCreateNoteProposal(proposal: CoordinatorActionProposal) {
  return proposal.typeId === "create-note";
}

export function isJdbcQuerySuggestionProposal(
  proposal: CoordinatorActionProposal,
) {
  return proposal.typeId === "prepare-jdbc-query-suggestion";
}

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
          : proposal.typeId === "create-knowledge-document"
            ? "The approved Knowledge Document handoff created a workspace-local document from visible content."
            : proposal.typeId === "create-skill"
              ? "The approved Skill handoff created a workspace-local reusable procedure from visible content."
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
        : proposal.typeId === "create-knowledge-document"
          ? "Approval only accepts the preview. Use Create Document separately to write workspace knowledge."
          : proposal.typeId === "create-skill"
            ? "Approval only accepts the preview. Use Create Skill separately to write a workspace Skill."
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
    statusDotVariant:
      proposal.approvalStatus === "Edited preview" ? "info" : "warning",
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
    proposal.createdKnowledgeDocumentId
      ? `Created Knowledge Document: ${proposal.createdKnowledgeDocumentTitle ?? "Knowledge Document"} (${proposal.createdKnowledgeDocumentId})`
      : null,
    proposal.createdSkillId
      ? `Created Skill: ${proposal.createdSkillTitle ?? "Skill"} (${proposal.createdSkillId})`
      : null,
    proposal.createdNoteId
      ? `Created Note: ${proposal.createdNoteTitle ?? "Note"} (${proposal.createdNoteId})`
      : null,
    proposal.executionError ? `Error: ${proposal.executionError}` : null,
    `Result summary: ${proposal.resultSummary}`,
    "",
    proposal.typeId === "create-agent-queue-task"
      ? "Queue task creation requires approval and a separate Create Queue task action. Creates a draft task. Does not run it. No provider runtime, Agent Executor launch, Queue auto-dispatch, Terminal command, Git mutation, or JDBC SQL execution is triggered."
      : proposal.typeId === "create-knowledge-document"
        ? "Knowledge Document creation requires approval and a separate Create Document action. It writes only visible approved fields to workspace-local Knowledge. No Notes, files, logs, Git, JDBC, Terminal, Queue, Executor, Evidence, Context Pack, global, or team data is read."
        : proposal.typeId === "create-skill"
          ? "Skill creation requires approval and a separate Create Skill action. It writes only visible approved fields to workspace-local Skills. No Notes, files, logs, Git, JDBC, Terminal, Queue, Executor, Evidence, Context Pack, global, or team data is read."
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
  if (
    status === "Queue task created" ||
    status === "Note created" ||
    status === "Knowledge document created" ||
    status === "Skill created"
  ) {
    return "success";
  }
  if (
    status === "Queue task creation failed" ||
    status === "Note creation failed" ||
    status === "Knowledge document creation failed" ||
    status === "Skill creation failed"
  ) {
    return "error";
  }
  if (
    status === "Ready to create Queue task" ||
    status === "Creating Queue task" ||
    status === "Ready to create Knowledge document" ||
    status === "Creating Knowledge document" ||
    status === "Ready to create Skill" ||
    status === "Creating Skill" ||
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
  if (typeId === "create-knowledge-document") {
    return "Knowledge Document draft";
  }
  if (typeId === "create-skill") {
    return "Skill draft";
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

  if (proposal.createdKnowledgeDocumentId) {
    return {
      detail: `${proposal.createdKnowledgeDocumentTitle ?? "Knowledge Document"} (${proposal.createdKnowledgeDocumentId})`,
      summary: proposal.resultSummary,
      title: "Created Knowledge Document",
      tone: "success",
    };
  }

  if (proposal.createdSkillId) {
    return {
      detail: `${proposal.createdSkillTitle ?? "Skill"} (${proposal.createdSkillId})`,
      summary: proposal.resultSummary,
      title: "Created Skill",
      tone: "success",
    };
  }

  if (
    proposal.executionStatus === "Creating Queue task" ||
    proposal.executionStatus === "Creating Note" ||
    proposal.executionStatus === "Creating Knowledge document" ||
    proposal.executionStatus === "Creating Skill"
  ) {
    return {
      detail: proposal.resultSummary,
      title: "Pending handoff",
      tone: "pending",
    };
  }

  return null;
}
