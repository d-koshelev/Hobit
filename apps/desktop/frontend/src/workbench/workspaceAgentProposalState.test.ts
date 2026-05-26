import { describe, expect, it } from "vitest";

import type {
  CoordinatorActionProposal,
  CoordinatorProposalTypeId,
} from "./coordinatorActionProposalRegistry";
import {
  approveProposal,
  canStartProposalCreation,
  editProposalPatch,
  failedProposalPatch,
  getProposalCardState,
  proposalActionState,
  proposalCreatedPatch,
  rejectProposalPatch,
  safeDefaultProposalState,
  updateProposal,
} from "./workspaceAgentProposalState";

describe("workspaceAgentProposalState", () => {
  it("returns safe default proposal state by family", () => {
    expect(safeDefaultProposalState("create-agent-queue-task")).toMatchObject({
      approvalStatus: "Pending preview",
      executionStatus: "Not run",
    });
    expect(
      safeDefaultProposalState("prepare-jdbc-query-suggestion"),
    ).toMatchObject({
      approvalStatus: "Pending preview",
      executionStatus: "SQL suggestion only",
    });
  });

  it("approves Queue task proposals without creating or running them", () => {
    const proposal = proposalFixture("create-agent-queue-task");
    const proposals = approveProposal({ [proposal.id]: proposal }, proposal.id);
    const approved = proposals[proposal.id];

    expect(approved).toMatchObject({
      approvalStatus: "Approved preview",
      executionStatus: "Ready to create Queue task",
    });
    expect(approved.createdQueueTaskId).toBeUndefined();
    expect(canStartProposalCreation(approved, "queueTask")).toBe(true);
    expect(getProposalCardState(approved).stateDescription).toContain(
      "Use Create Queue task separately",
    );
  });

  it("rejects and edits proposals locally without running actions", () => {
    const rejected = {
      ...proposalFixture("create-note"),
      ...rejectProposalPatch(),
    };

    expect(rejected).toMatchObject({
      approvalStatus: "Rejected preview",
      executionStatus: "Not run",
    });
    expect(getProposalCardState(rejected).stateLabel).toBe("Rejected");

    const edited = {
      ...proposalFixture("create-knowledge-document", {
        createdKnowledgeDocumentId: "doc_1",
        createdKnowledgeDocumentTitle: "Doc",
      }),
      ...editProposalPatch(proposalFixture("create-knowledge-document"), {
        expectedResult: "Edited result",
        inputs: [{ label: "Title", value: "Edited" }],
        intent: "Edited intent",
      }),
    };

    expect(edited).toMatchObject({
      approvalStatus: "Edited preview",
      createdKnowledgeDocumentId: undefined,
      executionStatus: "Not run",
      intent: "Edited intent",
    });
  });

  it("allows create actions only after approval for write proposal families", () => {
    const queue = proposalFixture("create-agent-queue-task");
    const note = proposalFixture("create-note");
    const document = proposalFixture("create-knowledge-document");
    const skill = proposalFixture("create-skill");

    expect(proposalActionState(queue).canCreateQueueTask).toBe(false);
    expect(proposalActionState(note).canCreateNote).toBe(false);
    expect(proposalActionState(document).canCreateKnowledgeDocument).toBe(false);
    expect(proposalActionState(skill).canCreateSkill).toBe(false);

    expect(
      proposalActionState({
        ...document,
        ...approveProposal({ [document.id]: document }, document.id)[document.id],
      }).canCreateKnowledgeDocument,
    ).toBe(true);
    expect(
      proposalActionState({
        ...skill,
        ...approveProposal({ [skill.id]: skill }, skill.id)[skill.id],
      }).canCreateSkill,
    ).toBe(true);
  });

  it("prevents duplicate saves after a successful handoff", () => {
    const approved = approveProposal(
      { proposal: proposalFixture("create-skill") },
      "proposal",
    ).proposal;
    const created = {
      ...approved,
      ...proposalCreatedPatch("skill", {
        id: "skill_1",
        title: "Saved skill",
      }),
    };

    expect(proposalActionState(created).canCreateSkill).toBe(false);
    expect(canStartProposalCreation(created, "skill")).toBe(false);
    expect(getProposalCardState(created).stateLabel).toBe("Created");
  });

  it("records failure while keeping approved proposals retryable", () => {
    const approved = approveProposal(
      { proposal: proposalFixture("create-knowledge-document") },
      "proposal",
    ).proposal;
    const failed = {
      ...approved,
      ...failedProposalPatch("knowledgeDocument", "Write failed."),
    };

    expect(failed).toMatchObject({
      approvalStatus: "Approved preview",
      executionError: "Write failed.",
      executionStatus: "Knowledge document creation failed",
    });
    expect(getProposalCardState(failed).stateLabel).toBe("Failed");
    expect(canStartProposalCreation(failed, "knowledgeDocument")).toBe(true);
  });

  it("handles unknown proposal families safely", () => {
    const unknown = proposalFixture(
      "unknown-proposal-family" as CoordinatorProposalTypeId,
    );
    const approved = approveProposal({ [unknown.id]: unknown }, unknown.id)[
      unknown.id
    ];

    expect(approved.executionStatus).toBe("Execution bridge not implemented");
    expect(proposalActionState(approved)).toMatchObject({
      canCreateKnowledgeDocument: false,
      canCreateNote: false,
      canCreateQueueTask: false,
      canCreateSkill: false,
    });
  });

  it("preserves Queue, Note, and JDBC proposal semantics", () => {
    const queue = approveProposal(
      { proposal: proposalFixture("create-agent-queue-task") },
      "proposal",
    ).proposal;
    const note = approveProposal(
      { proposal: proposalFixture("create-note") },
      "proposal",
    ).proposal;
    const jdbc = approveProposal(
      { proposal: proposalFixture("prepare-jdbc-query-suggestion") },
      "proposal",
    ).proposal;

    expect(proposalActionState(queue)).toMatchObject({
      canCreateQueueTask: true,
      isCreateQueueTaskProposal: true,
    });
    expect(proposalActionState(note)).toMatchObject({
      canCreateNote: true,
      isCreateNoteProposal: true,
    });
    expect(proposalActionState(jdbc)).toMatchObject({
      canCreateKnowledgeDocument: false,
      canCreateNote: false,
      canCreateQueueTask: false,
      canCreateSkill: false,
      isJdbcQuerySuggestion: true,
    });
    expect(jdbc.executionStatus).toBe("SQL suggestion only");
  });

  it("updates missing proposal ids as a no-op", () => {
    const proposals = { proposal: proposalFixture("create-note") };

    expect(updateProposal(proposals, "missing", rejectProposalPatch())).toBe(
      proposals,
    );
  });
});

function proposalFixture(
  typeId: CoordinatorProposalTypeId,
  overrides: Partial<CoordinatorActionProposal> = {},
): CoordinatorActionProposal {
  return {
    approvalStatus: "Pending preview",
    executionStatus:
      typeId === "prepare-jdbc-query-suggestion" ? "SQL suggestion only" : "Not run",
    expectedResult: "Expected result",
    id: "proposal",
    inputs: [
      { label: "Title", value: "Visible title" },
      { label: "Prompt", value: "Visible prompt" },
      { label: "Body", value: "Visible body" },
      { label: "Content", value: "Visible content" },
      { label: "Steps", value: "Visible steps" },
      { label: "Suggested SQL text", value: "select * from visible_table" },
    ],
    intent: "Visible intent",
    resultSummary: "No action has run.",
    riskLevel:
      typeId === "prepare-jdbc-query-suggestion" ? "analysis_only" : "local_write",
    riskNotes: ["Visible review only."],
    targetCapability:
      typeId === "prepare-jdbc-query-suggestion"
        ? "prepare query suggestion"
        : "create preview",
    targetWidget:
      typeId === "prepare-jdbc-query-suggestion"
        ? "Database / JDBC"
        : "Workspace",
    title: "Visible proposal",
    typeId,
    ...overrides,
  };
}
