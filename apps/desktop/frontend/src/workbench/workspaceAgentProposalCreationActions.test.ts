import { describe, expect, it, vi } from "vitest";

import type { CoordinatorActionProposal } from "./coordinatorActionProposalRegistry";
import type { WidgetRenderProps } from "./types";
import {
  runCreateKnowledgeDocumentProposal,
  runCreateNoteProposal,
  runCreateQueueTaskProposal,
  runCreateSkillProposal,
} from "./workspaceAgentProposalCreationActions";

describe("workspaceAgentProposalCreationActions", () => {
  it("sets pending, creates a Queue task with the existing request shape, then clears pending on success", async () => {
    const proposal = approvedProposal("create-agent-queue-task", {
      inputs: [
        { label: "Title", value: "Queue draft" },
        { label: "Description", value: "Visible description" },
        { label: "Prompt", value: "Visible prompt" },
        { label: "Priority", value: "3" },
        { label: "Policy", value: "after_previous_success" },
      ],
    });
    const state = proposalCreationState(proposal);
    const deferred = createDeferred<Awaited<ReturnType<NonNullable<WidgetRenderProps["onCreateAgentQueueTask"]>>>>();
    const onCreateAgentQueueTask: NonNullable<
      WidgetRenderProps["onCreateAgentQueueTask"]
    > = vi.fn(() => deferred.promise);

    const run = runCreateQueueTaskProposal({
      onCreateAgentQueueTask,
      pendingProposalIds: state.pendingIds,
      proposalId: proposal.id,
      proposals: state.proposals,
      setPendingProposalIds: state.setPendingIds,
      setProposals: state.setProposals,
    });

    expect(state.pendingIds.has(proposal.id)).toBe(true);
    expect(state.proposals[proposal.id].executionStatus).toBe(
      "Creating Queue task",
    );
    expect(onCreateAgentQueueTask).toHaveBeenCalledWith({
      description: "Visible description",
      executionPolicy: "after_previous_success",
      priority: 3,
      prompt: "Visible prompt",
      status: "draft",
      title: "Queue draft",
    });

    deferred.resolve(queueTaskResult());
    await run;

    expect(state.pendingIds.has(proposal.id)).toBe(false);
    expect(state.proposals[proposal.id]).toMatchObject({
      createdQueueTaskId: "queue_1",
      createdQueueTaskTitle: "Created Queue task",
      executionStatus: "Queue task created",
    });
  });

  it("sets pending, records failure, and clears pending when a Note create rejects", async () => {
    const proposal = approvedProposal("create-note", {
      inputs: [
        { label: "Title", value: "Note draft" },
        { label: "Body", value: "Visible note body" },
        { label: "Pinned", value: "true" },
      ],
    });
    const state = proposalCreationState(proposal);
    const onCreateWorkspaceNote: NonNullable<
      WidgetRenderProps["onCreateWorkspaceNote"]
    > = vi.fn(async () => {
      throw new Error("Write failed.");
    });

    await runCreateNoteProposal({
      onCreateWorkspaceNote,
      pendingProposalIds: state.pendingIds,
      proposalId: proposal.id,
      proposals: state.proposals,
      setPendingProposalIds: state.setPendingIds,
      setProposals: state.setProposals,
    });

    expect(onCreateWorkspaceNote).toHaveBeenCalledWith({
      body: "Visible note body",
      pinned: true,
      title: "Note draft",
    });
    expect(state.pendingIds.has(proposal.id)).toBe(false);
    expect(state.proposals[proposal.id]).toMatchObject({
      executionError: "Write failed.",
      executionStatus: "Note creation failed",
      resultSummary: "No Note was created.",
    });
  });

  it("blocks duplicate actions when the proposal id is already pending", async () => {
    const proposal = approvedProposal("create-skill");
    const state = proposalCreationState(proposal, new Set([proposal.id]));
    const onCreateSkill: NonNullable<WidgetRenderProps["onCreateSkill"]> =
      vi.fn(async () => skillResult());

    await runCreateSkillProposal({
      onCreateSkill,
      pendingProposalIds: state.pendingIds,
      proposalId: proposal.id,
      proposals: state.proposals,
      setPendingProposalIds: state.setPendingIds,
      setProposals: state.setProposals,
    });

    expect(onCreateSkill).not.toHaveBeenCalled();
    expect(state.pendingIds.has(proposal.id)).toBe(true);
    expect(state.proposals[proposal.id].executionStatus).toBe(
      "Ready to create Skill",
    );
  });

  it("refuses unavailable callbacks and wrong proposal families without running a create callback", async () => {
    const noteProposal = approvedProposal("create-note");
    const state = proposalCreationState(noteProposal);
    const onCreateAgentQueueTask: NonNullable<
      WidgetRenderProps["onCreateAgentQueueTask"]
    > = vi.fn(async () => queueTaskResult());

    await runCreateKnowledgeDocumentProposal({
      onCreateKnowledgeDocument: undefined,
      pendingProposalIds: state.pendingIds,
      proposalId: noteProposal.id,
      proposals: state.proposals,
      setPendingProposalIds: state.setPendingIds,
      setProposals: state.setProposals,
    });
    expect(state.proposals[noteProposal.id].executionStatus).toBe(
      "Ready to create Note",
    );

    await runCreateQueueTaskProposal({
      onCreateAgentQueueTask,
      pendingProposalIds: state.pendingIds,
      proposalId: noteProposal.id,
      proposals: state.proposals,
      setPendingProposalIds: state.setPendingIds,
      setProposals: state.setProposals,
    });
    expect(onCreateAgentQueueTask).not.toHaveBeenCalled();

    await runCreateNoteProposal({
      onCreateWorkspaceNote: undefined,
      pendingProposalIds: state.pendingIds,
      proposalId: noteProposal.id,
      proposals: state.proposals,
      setPendingProposalIds: state.setPendingIds,
      setProposals: state.setProposals,
    });
    expect(state.proposals[noteProposal.id]).toMatchObject({
      executionError: "Workspace Note creation is unavailable in this runtime.",
      executionStatus: "Note creation failed",
    });
  });

  it("creates Knowledge Documents and Skills with the existing request shapes", async () => {
    const documentProposal = approvedProposal("create-knowledge-document", {
      id: "document-proposal",
    });
    const skillProposal = approvedProposal("create-skill", {
      id: "skill-proposal",
    });
    const state = proposalCreationState(documentProposal);
    state.proposals[skillProposal.id] = skillProposal;
    const onCreateKnowledgeDocument: NonNullable<
      WidgetRenderProps["onCreateKnowledgeDocument"]
    > = vi.fn(async () => knowledgeDocumentResult());
    const onCreateSkill: NonNullable<WidgetRenderProps["onCreateSkill"]> =
      vi.fn(async () => skillResult());

    await runCreateKnowledgeDocumentProposal({
      onCreateKnowledgeDocument,
      pendingProposalIds: state.pendingIds,
      proposalId: documentProposal.id,
      proposals: state.proposals,
      setPendingProposalIds: state.setPendingIds,
      setProposals: state.setProposals,
    });
    await runCreateSkillProposal({
      onCreateSkill,
      pendingProposalIds: state.pendingIds,
      proposalId: skillProposal.id,
      proposals: state.proposals,
      setPendingProposalIds: state.setPendingIds,
      setProposals: state.setProposals,
    });

    expect(onCreateKnowledgeDocument).toHaveBeenCalledWith({
      content: "Visible content",
      enabled: true,
      sourceLabel: "Workspace Agent conversation",
      tags: "docs",
      title: "Visible title",
    });
    expect(onCreateSkill).toHaveBeenCalledWith({
      prerequisites: "Visible prerequisites",
      reviewStatus: "needs_review",
      risks: "Visible risks",
      steps: "Visible steps",
      tags: "skill",
      title: "Visible title",
      validation: "Visible validation",
      whenToUse: "Visible when to use",
    });
    expect(state.proposals[documentProposal.id].createdKnowledgeDocumentId).toBe(
      "doc_1",
    );
    expect(state.proposals[skillProposal.id].createdSkillId).toBe("skill_1");
  });
});

function proposalCreationState(
  proposal: CoordinatorActionProposal,
  initialPendingIds: ReadonlySet<string> = new Set(),
) {
  let proposals = { [proposal.id]: proposal };
  let pendingIds = initialPendingIds;

  return {
    get pendingIds() {
      return pendingIds;
    },
    get proposals() {
      return proposals;
    },
    setPendingIds(updater: (currentIds: ReadonlySet<string>) => ReadonlySet<string>) {
      pendingIds = updater(pendingIds);
    },
    setProposals(
      updater: (
        currentProposals: Record<string, CoordinatorActionProposal>,
      ) => Record<string, CoordinatorActionProposal>,
    ) {
      proposals = updater(proposals);
    },
  };
}

function approvedProposal(
  typeId: CoordinatorActionProposal["typeId"],
  overrides: Partial<CoordinatorActionProposal> = {},
): CoordinatorActionProposal {
  return {
    approvalStatus: "Approved preview",
    executionStatus: readyStatus(typeId),
    expectedResult: "A record can be created explicitly.",
    id: "proposal",
    inputs: defaultInputs(typeId),
    intent: "Create from visible text.",
    resultSummary: "Approved locally. Explicit create still required.",
    riskLevel: "local_write",
    riskNotes: ["Requires a separate explicit create action."],
    targetCapability: "create",
    targetWidget: "Workspace",
    title: "Visible title",
    typeId,
    ...overrides,
  };
}

function defaultInputs(typeId: CoordinatorActionProposal["typeId"]) {
  if (typeId === "create-agent-queue-task") {
    return [
      { label: "Title", value: "Visible title" },
      { label: "Description", value: "Visible description" },
      { label: "Prompt", value: "Visible prompt" },
      { label: "Priority", value: "0" },
      { label: "Policy", value: "manual" },
    ];
  }

  if (typeId === "create-note") {
    return [
      { label: "Title", value: "Visible title" },
      { label: "Body", value: "Visible note body" },
      { label: "Pinned", value: "false" },
    ];
  }

  if (typeId === "create-knowledge-document") {
    return [
      { label: "Title", value: "Visible title" },
      { label: "Source label", value: "Workspace Agent conversation" },
      { label: "Content", value: "Visible content" },
      { label: "Tags", value: "docs" },
      { label: "Enabled", value: "true" },
    ];
  }

  return [
    { label: "Title", value: "Visible title" },
    { label: "When to use", value: "Visible when to use" },
    { label: "Prerequisites", value: "Visible prerequisites" },
    { label: "Steps", value: "Visible steps" },
    { label: "Validation", value: "Visible validation" },
    { label: "Risks", value: "Visible risks" },
    { label: "Tags", value: "skill" },
    { label: "Review status", value: "needs review" },
  ];
}

function readyStatus(typeId: CoordinatorActionProposal["typeId"]) {
  if (typeId === "create-agent-queue-task") {
    return "Ready to create Queue task";
  }
  if (typeId === "create-note") {
    return "Ready to create Note";
  }
  if (typeId === "create-knowledge-document") {
    return "Ready to create Knowledge document";
  }
  if (typeId === "create-skill") {
    return "Ready to create Skill";
  }
  return "Not run";
}

function queueTaskResult() {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-01-01T00:00:00Z",
    description: "Visible description",
    executionPolicy: "manual" as const,
    priority: 0,
    prompt: "Visible prompt",
    queueItemId: "queue_1",
    status: "draft" as const,
    title: "Created Queue task",
    updatedAt: "2026-01-01T00:00:00Z",
    workspaceId: "workspace_1",
  };
}

function knowledgeDocumentResult() {
  return {
    content: "Visible content",
    createdAt: "2026-01-01T00:00:00Z",
    enabled: true,
    knowledgeDocumentId: "doc_1",
    sourceLabel: "Workspace Agent conversation",
    tags: "docs",
    title: "Created document",
    updatedAt: "2026-01-01T00:00:00Z",
    workspaceId: "workspace_1",
  };
}

function skillResult() {
  return {
    createdAt: "2026-01-01T00:00:00Z",
    prerequisites: "Visible prerequisites",
    reviewStatus: "needs_review" as const,
    risks: "Visible risks",
    skillId: "skill_1",
    steps: "Visible steps",
    tags: "skill",
    title: "Created skill",
    updatedAt: "2026-01-01T00:00:00Z",
    validation: "Visible validation",
    whenToUse: "Visible when to use",
    workspaceId: "workspace_1",
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}
