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

export type ProposalCreationKind =
  | "knowledgeDocument"
  | "note"
  | "queueTask"
  | "skill";

export type ProposalPendingState = {
  isKnowledgeDocumentCreationPending?: boolean;
  isNoteCreationPending?: boolean;
  isQueueTaskCreationPending?: boolean;
  isSkillCreationPending?: boolean;
};

type ProposalCreatedPatchInput = {
  id: string;
  title: string;
  status?: string;
};

const APPROVED_PREVIEW_SUMMARY =
  "Approved locally only. Execution bridge is not implemented, and no widget capability was invoked.";

const APPROVED_QUEUE_TASK_SUMMARY =
  "Approved locally. Use Create Queue task to create a draft task. Does not run it.";

const APPROVED_NOTE_SUMMARY =
  "Approved locally. Review the visible title, body, and pinned state, then use Create Note. No Note has been created yet.";

const APPROVED_JDBC_SUGGESTION_SUMMARY =
  "Approved locally as a non-executing SQL suggestion. Use Copy SQL for manual review. No connector is accessed and no SQL is executed.";

const APPROVED_KNOWLEDGE_DOCUMENT_SUMMARY =
  "Approved locally. Review the visible title, source, content, tags, and enabled flag, then use Create Document. No document has been created yet.";

const APPROVED_SKILL_SUMMARY =
  "Approved locally. Review the visible Skill fields, then use Create Skill. No Skill has been created yet.";

const CREATING_QUEUE_TASK_SUMMARY =
  "Creating a draft Agent Queue task from the visible approved proposal inputs.";

const CREATING_NOTE_SUMMARY =
  "Creating a workspace-local Note from the visible approved proposal inputs.";

const CREATING_KNOWLEDGE_DOCUMENT_SUMMARY =
  "Creating a workspace-local Knowledge Document from the visible approved proposal inputs.";

const CREATING_SKILL_SUMMARY =
  "Creating a workspace-local Skill from the visible approved proposal inputs.";

const QUEUE_TASK_CREATED_SUMMARY =
  "Draft Queue task created. It was not assigned, dispatched, run, or handed to Agent Executor.";

const KNOWLEDGE_DOCUMENT_CREATED_SUMMARY =
  "Workspace-local Knowledge Document created from visible approved content only.";

const SKILL_CREATED_SUMMARY =
  "Workspace-local Skill created from visible approved content only.";

const NOTE_CREATED_SUMMARY =
  "Workspace-local Note created. Existing Notes content was not read, summarized, or searched.";

const REJECTED_PREVIEW_SUMMARY =
  "Rejected locally only. No widget capability was invoked.";

const EDITED_PREVIEW_SUMMARY =
  "Edited locally only. Review this preview again before any future handoff.";

export function safeDefaultProposalState(
  typeId: CoordinatorProposalTypeId,
): Pick<
  CoordinatorActionProposal,
  "approvalStatus" | "executionStatus" | "resultSummary"
> {
  return {
    approvalStatus: "Pending preview",
    executionStatus: defaultExecutionStatus(typeId),
    resultSummary: defaultResultSummary(typeId),
  };
}

export function updateProposal(
  proposals: Record<string, CoordinatorActionProposal>,
  proposalId: string,
  patch: Partial<CoordinatorActionProposal>,
) {
  const proposal = proposals[proposalId];
  if (!proposal) {
    return proposals;
  }

  return {
    ...proposals,
    [proposalId]: {
      ...proposal,
      ...patch,
    },
  };
}

export function approveProposalPatch(proposal: CoordinatorActionProposal) {
  return {
    approvalStatus: "Approved preview" as const,
    executionError: undefined,
    executionStatus: approvedExecutionStatus(proposal.typeId),
    resultSummary: approvedResultSummary(proposal.typeId),
  };
}

export function approveProposal(
  proposals: Record<string, CoordinatorActionProposal>,
  proposalId: string,
) {
  const proposal = proposals[proposalId];
  if (!proposal) {
    return proposals;
  }

  return updateProposal(proposals, proposalId, approveProposalPatch(proposal));
}

export function approveQueueDraftProposals(
  proposals: Record<string, CoordinatorActionProposal>,
  proposalIds: string[],
) {
  let nextProposals = proposals;

  proposalIds.forEach((proposalId) => {
    const proposal = nextProposals[proposalId];
    if (!proposal || !isCreateQueueTaskProposal(proposal)) {
      return;
    }

    if (proposal.createdQueueTaskId) {
      return;
    }

    nextProposals = updateProposal(
      nextProposals,
      proposalId,
      approveProposalPatch(proposal),
    );
  });

  return nextProposals;
}

export function rejectProposalPatch(): Partial<CoordinatorActionProposal> {
  return {
    approvalStatus: "Rejected preview",
    executionError: undefined,
    executionStatus: "Not run",
    resultSummary: REJECTED_PREVIEW_SUMMARY,
  };
}

export function editProposalPatch(
  proposal: CoordinatorActionProposal | undefined,
  patch: Pick<CoordinatorActionProposal, "expectedResult" | "inputs" | "intent">,
): Partial<CoordinatorActionProposal> {
  return {
    ...patch,
    approvalStatus: "Edited preview",
    createdKnowledgeDocumentId: undefined,
    createdKnowledgeDocumentTitle: undefined,
    createdNoteId: undefined,
    createdNoteTitle: undefined,
    createdQueueTaskId: undefined,
    createdQueueTaskTitle: undefined,
    createdSkillId: undefined,
    createdSkillTitle: undefined,
    executionError: undefined,
    executionStatus: proposal
      ? editedExecutionStatus(proposal.typeId)
      : "Execution bridge not implemented",
    resultSummary: EDITED_PREVIEW_SUMMARY,
  };
}

export function createNotApprovedFailurePatch(
  kind: ProposalCreationKind,
): Partial<CoordinatorActionProposal> {
  return failedProposalPatch(kind, notApprovedMessage(kind));
}

export function createUnavailableFailurePatch(
  kind: ProposalCreationKind,
): Partial<CoordinatorActionProposal> {
  return failedProposalPatch(kind, unavailableMessage(kind));
}

export function proposalCreatingPatch(
  kind: ProposalCreationKind,
): Partial<CoordinatorActionProposal> {
  return {
    executionError: undefined,
    executionStatus: creatingExecutionStatus(kind),
    resultSummary: creatingResultSummary(kind),
  };
}

export function proposalCreatedPatch(
  kind: ProposalCreationKind,
  created: ProposalCreatedPatchInput,
): Partial<CoordinatorActionProposal> {
  if (kind === "queueTask") {
    return {
      createdQueueTaskId: created.id,
      createdQueueTaskTitle: created.title,
      executionError: undefined,
      executionStatus: "Queue task created",
      resultSummary: `${QUEUE_TASK_CREATED_SUMMARY} Created task "${created.title}" (${created.id}) with status ${created.status}.`,
    };
  }

  if (kind === "note") {
    return {
      createdNoteId: created.id,
      createdNoteTitle: created.title,
      executionError: undefined,
      executionStatus: "Note created",
      resultSummary: `${NOTE_CREATED_SUMMARY} Created note "${created.title}" (${created.id}).`,
    };
  }

  if (kind === "knowledgeDocument") {
    return {
      createdKnowledgeDocumentId: created.id,
      createdKnowledgeDocumentTitle: created.title,
      executionError: undefined,
      executionStatus: "Knowledge document created",
      resultSummary: `${KNOWLEDGE_DOCUMENT_CREATED_SUMMARY} Created document "${created.title}" (${created.id}).`,
    };
  }

  return {
    createdSkillId: created.id,
    createdSkillTitle: created.title,
    executionError: undefined,
    executionStatus: "Skill created",
    resultSummary: `${SKILL_CREATED_SUMMARY} Created skill "${created.title}" (${created.id}).`,
  };
}

export function failedProposalPatch(
  kind: ProposalCreationKind,
  executionError: string,
): Partial<CoordinatorActionProposal> {
  return {
    executionError,
    executionStatus: failedExecutionStatus(kind),
    resultSummary: failedResultSummary(kind),
  };
}

export function canStartProposalCreation(
  proposal: CoordinatorActionProposal,
  kind: ProposalCreationKind,
) {
  return (
    proposalKindMatches(proposal, kind) &&
    proposal.approvalStatus === "Approved preview" &&
    !hasCreatedProposalForKind(proposal, kind)
  );
}

export function hasCreatedProposalForKind(
  proposal: CoordinatorActionProposal,
  kind: ProposalCreationKind,
) {
  if (kind === "queueTask") {
    return Boolean(proposal.createdQueueTaskId);
  }

  if (kind === "note") {
    return Boolean(proposal.createdNoteId);
  }

  if (kind === "knowledgeDocument") {
    return Boolean(proposal.createdKnowledgeDocumentId);
  }

  return Boolean(proposal.createdSkillId);
}

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

function defaultExecutionStatus(
  typeId: CoordinatorProposalTypeId,
): CoordinatorProposalExecutionStatus {
  if (typeId === "prepare-jdbc-query-suggestion") {
    return "SQL suggestion only";
  }

  return "Not run";
}

function defaultResultSummary(typeId: CoordinatorProposalTypeId) {
  if (typeId === "prepare-jdbc-query-suggestion") {
    return "Non-executing SQL suggestion only. Copy SQL copies the visible SQL text and does not contact a connector or database.";
  }

  return "No action has run. Approval is required before creation is available.";
}

function approvedExecutionStatus(
  typeId: CoordinatorProposalTypeId,
): CoordinatorProposalExecutionStatus {
  if (typeId === "create-agent-queue-task") {
    return "Ready to create Queue task";
  }

  if (typeId === "create-knowledge-document") {
    return "Ready to create Knowledge document";
  }

  if (typeId === "create-note") {
    return "Ready to create Note";
  }

  if (typeId === "create-skill") {
    return "Ready to create Skill";
  }

  if (typeId === "prepare-jdbc-query-suggestion") {
    return "SQL suggestion only";
  }

  return "Execution bridge not implemented";
}

function approvedResultSummary(typeId: CoordinatorProposalTypeId) {
  if (typeId === "create-agent-queue-task") {
    return APPROVED_QUEUE_TASK_SUMMARY;
  }

  if (typeId === "create-knowledge-document") {
    return APPROVED_KNOWLEDGE_DOCUMENT_SUMMARY;
  }

  if (typeId === "create-note") {
    return APPROVED_NOTE_SUMMARY;
  }

  if (typeId === "create-skill") {
    return APPROVED_SKILL_SUMMARY;
  }

  if (typeId === "prepare-jdbc-query-suggestion") {
    return APPROVED_JDBC_SUGGESTION_SUMMARY;
  }

  return APPROVED_PREVIEW_SUMMARY;
}

function editedExecutionStatus(
  typeId: CoordinatorProposalTypeId,
): CoordinatorProposalExecutionStatus {
  if (typeId === "prepare-jdbc-query-suggestion") {
    return "SQL suggestion only";
  }

  if (
    typeId === "create-agent-queue-task" ||
    typeId === "create-knowledge-document" ||
    typeId === "create-note" ||
    typeId === "create-skill"
  ) {
    return "Not run";
  }

  return "Execution bridge not implemented";
}

function proposalKindMatches(
  proposal: CoordinatorActionProposal,
  kind: ProposalCreationKind,
) {
  if (kind === "queueTask") {
    return isCreateQueueTaskProposal(proposal);
  }

  if (kind === "note") {
    return isCreateNoteProposal(proposal);
  }

  if (kind === "knowledgeDocument") {
    return isCreateKnowledgeDocumentProposal(proposal);
  }

  return isCreateSkillProposal(proposal);
}

function notApprovedMessage(kind: ProposalCreationKind) {
  if (kind === "queueTask") {
    return "Approve this proposal before creating a Queue task.";
  }

  if (kind === "note") {
    return "Approve this proposal before creating a Note.";
  }

  if (kind === "knowledgeDocument") {
    return "Approve this proposal before creating a Knowledge Document.";
  }

  return "Approve this proposal before creating a Skill.";
}

function unavailableMessage(kind: ProposalCreationKind) {
  if (kind === "queueTask") {
    return "Agent Queue task creation is unavailable in this runtime.";
  }

  if (kind === "note") {
    return "Workspace Note creation is unavailable in this runtime.";
  }

  if (kind === "knowledgeDocument") {
    return "Knowledge Document creation is unavailable in this runtime.";
  }

  return "Skill creation is unavailable in this runtime.";
}

function creatingExecutionStatus(
  kind: ProposalCreationKind,
): CoordinatorProposalExecutionStatus {
  if (kind === "queueTask") {
    return "Creating Queue task";
  }

  if (kind === "note") {
    return "Creating Note";
  }

  if (kind === "knowledgeDocument") {
    return "Creating Knowledge document";
  }

  return "Creating Skill";
}

function creatingResultSummary(kind: ProposalCreationKind) {
  if (kind === "queueTask") {
    return CREATING_QUEUE_TASK_SUMMARY;
  }

  if (kind === "note") {
    return CREATING_NOTE_SUMMARY;
  }

  if (kind === "knowledgeDocument") {
    return CREATING_KNOWLEDGE_DOCUMENT_SUMMARY;
  }

  return CREATING_SKILL_SUMMARY;
}

function failedExecutionStatus(
  kind: ProposalCreationKind,
): CoordinatorProposalExecutionStatus {
  if (kind === "queueTask") {
    return "Queue task creation failed";
  }

  if (kind === "note") {
    return "Note creation failed";
  }

  if (kind === "knowledgeDocument") {
    return "Knowledge document creation failed";
  }

  return "Skill creation failed";
}

function failedResultSummary(kind: ProposalCreationKind) {
  if (kind === "queueTask") {
    return "No Queue task was created.";
  }

  if (kind === "note") {
    return "No Note was created.";
  }

  if (kind === "knowledgeDocument") {
    return "No Knowledge Document was created.";
  }

  return "No Skill was created.";
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
