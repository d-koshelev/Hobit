import type {
  CoordinatorActionProposal,
  CoordinatorProposalExecutionStatus,
  CoordinatorProposalTypeId,
} from "./coordinatorActionProposalRegistry";

export type ProposalCreationKind =
  | "knowledgeDocument"
  | "note"
  | "queueTask"
  | "skill";

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
    if (!proposal || proposal.typeId !== "create-agent-queue-task") {
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
    return proposal.typeId === "create-agent-queue-task";
  }

  if (kind === "note") {
    return proposal.typeId === "create-note";
  }

  if (kind === "knowledgeDocument") {
    return proposal.typeId === "create-knowledge-document";
  }

  return proposal.typeId === "create-skill";
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
