import type { CoordinatorActionProposal } from "./coordinatorActionProposalRegistry";
import {
  knowledgeDocumentCreateRequestFromProposal,
  noteCreateRequestFromProposal,
  queueTaskRequestFromProposal,
  skillCreateRequestFromProposal,
} from "./coordinatorProposalHandoffs";
import type { WidgetRenderProps } from "./types";
import { errorToMessage } from "./workspaceAgentProviderGuards";
import {
  canStartProposalCreation,
  createNotApprovedFailurePatch,
  createUnavailableFailurePatch,
  failedProposalPatch,
  hasCreatedProposalForKind,
  proposalCreatedPatch,
  proposalCreatingPatch,
  updateProposal,
  type ProposalCreationKind,
} from "./workspaceAgentProposalState";

type ProposalRecord = Record<string, CoordinatorActionProposal>;

type SetProposals = (
  updater: (currentProposals: ProposalRecord) => ProposalRecord,
) => void;

type SetPendingProposalIds = (
  updater: (currentIds: ReadonlySet<string>) => ReadonlySet<string>,
) => void;

type ProposalCreationActionInput = {
  pendingProposalIds: ReadonlySet<string>;
  proposalId: string;
  proposals: ProposalRecord;
  setPendingProposalIds: SetPendingProposalIds;
  setProposals: SetProposals;
};

type CreatedProposalSummary = {
  id: string;
  status?: string;
  title: string;
};

type RunProposalCreationActionInput<Result> = ProposalCreationActionInput & {
  create: ((proposal: CoordinatorActionProposal) => Promise<Result>) | undefined;
  failureFallback: string;
  kind: ProposalCreationKind;
  proposalTypeId: CoordinatorActionProposal["typeId"];
  summarizeCreated: (result: Result) => CreatedProposalSummary;
};

export type RunCreateQueueTaskProposalInput = ProposalCreationActionInput & {
  onCreateAgentQueueTask: WidgetRenderProps["onCreateAgentQueueTask"];
};

export type RunCreateNoteProposalInput = ProposalCreationActionInput & {
  onCreateWorkspaceNote: WidgetRenderProps["onCreateWorkspaceNote"];
};

export type RunCreateKnowledgeDocumentProposalInput =
  ProposalCreationActionInput & {
    onCreateKnowledgeDocument: WidgetRenderProps["onCreateKnowledgeDocument"];
  };

export type RunCreateSkillProposalInput = ProposalCreationActionInput & {
  onCreateSkill: WidgetRenderProps["onCreateSkill"];
};

export async function runCreateQueueTaskProposal({
  onCreateAgentQueueTask,
  ...input
}: RunCreateQueueTaskProposalInput) {
  await runProposalCreationAction({
    ...input,
    create: onCreateAgentQueueTask
      ? (proposal) => onCreateAgentQueueTask(queueTaskRequestFromProposal(proposal))
      : undefined,
    failureFallback: "Unable to create Queue task.",
    kind: "queueTask",
    proposalTypeId: "create-agent-queue-task",
    summarizeCreated: (task) => ({
      id: task.queueItemId,
      status: task.status,
      title: task.title,
    }),
  });
}

export async function runCreateNoteProposal({
  onCreateWorkspaceNote,
  ...input
}: RunCreateNoteProposalInput) {
  await runProposalCreationAction({
    ...input,
    create: onCreateWorkspaceNote
      ? (proposal) => onCreateWorkspaceNote(noteCreateRequestFromProposal(proposal))
      : undefined,
    failureFallback: "Unable to create Note.",
    kind: "note",
    proposalTypeId: "create-note",
    summarizeCreated: (note) => ({
      id: note.noteId,
      title: note.title,
    }),
  });
}

export async function runCreateKnowledgeDocumentProposal({
  onCreateKnowledgeDocument,
  ...input
}: RunCreateKnowledgeDocumentProposalInput) {
  await runProposalCreationAction({
    ...input,
    create: onCreateKnowledgeDocument
      ? (proposal) =>
          onCreateKnowledgeDocument(
            knowledgeDocumentCreateRequestFromProposal(proposal),
          )
      : undefined,
    failureFallback: "Unable to create Knowledge Document.",
    kind: "knowledgeDocument",
    proposalTypeId: "create-knowledge-document",
    summarizeCreated: (document) => ({
      id: document.knowledgeDocumentId,
      title: document.title,
    }),
  });
}

export async function runCreateSkillProposal({
  onCreateSkill,
  ...input
}: RunCreateSkillProposalInput) {
  await runProposalCreationAction({
    ...input,
    create: onCreateSkill
      ? (proposal) => onCreateSkill(skillCreateRequestFromProposal(proposal))
      : undefined,
    failureFallback: "Unable to create Skill.",
    kind: "skill",
    proposalTypeId: "create-skill",
    summarizeCreated: (skill) => ({
      id: skill.skillId,
      title: skill.title,
    }),
  });
}

async function runProposalCreationAction<Result>({
  create,
  failureFallback,
  kind,
  pendingProposalIds,
  proposalId,
  proposals,
  proposalTypeId,
  setPendingProposalIds,
  setProposals,
  summarizeCreated,
}: RunProposalCreationActionInput<Result>) {
  if (pendingProposalIds.has(proposalId)) {
    return;
  }

  const proposal = proposals[proposalId];
  if (!proposal || proposal.typeId !== proposalTypeId) {
    return;
  }

  if (hasCreatedProposalForKind(proposal, kind)) {
    return;
  }

  if (!canStartProposalCreation(proposal, kind)) {
    patchProposal(setProposals, proposalId, createNotApprovedFailurePatch(kind));
    return;
  }

  if (!create) {
    patchProposal(setProposals, proposalId, createUnavailableFailurePatch(kind));
    return;
  }

  addPendingProposalId(setPendingProposalIds, proposalId);
  patchProposal(setProposals, proposalId, proposalCreatingPatch(kind));

  try {
    const created = await create(proposal);
    patchProposal(
      setProposals,
      proposalId,
      proposalCreatedPatch(kind, summarizeCreated(created)),
    );
  } catch (error) {
    patchProposal(
      setProposals,
      proposalId,
      failedProposalPatch(kind, errorToMessage(error, failureFallback)),
    );
  } finally {
    removePendingProposalId(setPendingProposalIds, proposalId);
  }
}

function patchProposal(
  setProposals: SetProposals,
  proposalId: string,
  patch: Partial<CoordinatorActionProposal>,
) {
  setProposals((currentProposals) =>
    updateProposal(currentProposals, proposalId, patch),
  );
}

function addPendingProposalId(
  setPendingProposalIds: SetPendingProposalIds,
  proposalId: string,
) {
  setPendingProposalIds((currentIds) => {
    const nextIds = new Set(currentIds);
    nextIds.add(proposalId);
    return nextIds;
  });
}

function removePendingProposalId(
  setPendingProposalIds: SetPendingProposalIds,
  proposalId: string,
) {
  setPendingProposalIds((currentIds) => {
    const nextIds = new Set(currentIds);
    nextIds.delete(proposalId);
    return nextIds;
  });
}
