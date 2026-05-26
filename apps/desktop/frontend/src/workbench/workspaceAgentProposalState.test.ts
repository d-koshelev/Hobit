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

  it("allows creation only after approval for write proposal families", () => {
    const queue = proposalFixture("create-agent-queue-task");
    const note = proposalFixture("create-note");
    const document = proposalFixture("create-knowledge-document");
    const skill = proposalFixture("create-skill");

    expect(canStartProposalCreation(queue, "queueTask")).toBe(false);
    expect(canStartProposalCreation(note, "note")).toBe(false);
    expect(canStartProposalCreation(document, "knowledgeDocument")).toBe(false);
    expect(canStartProposalCreation(skill, "skill")).toBe(false);

    expect(
      canStartProposalCreation(
        approveProposal({ [document.id]: document }, document.id)[document.id],
        "knowledgeDocument",
      ),
    ).toBe(true);
    expect(
      canStartProposalCreation(
        approveProposal({ [skill.id]: skill }, skill.id)[skill.id],
        "skill",
      ),
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

    expect(canStartProposalCreation(created, "skill")).toBe(false);
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
    expect(canStartProposalCreation(approved, "queueTask")).toBe(false);
    expect(canStartProposalCreation(approved, "note")).toBe(false);
    expect(canStartProposalCreation(approved, "knowledgeDocument")).toBe(false);
    expect(canStartProposalCreation(approved, "skill")).toBe(false);
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

    expect(canStartProposalCreation(queue, "queueTask")).toBe(true);
    expect(canStartProposalCreation(note, "note")).toBe(true);
    expect(canStartProposalCreation(jdbc, "queueTask")).toBe(false);
    expect(canStartProposalCreation(jdbc, "note")).toBe(false);
    expect(canStartProposalCreation(jdbc, "knowledgeDocument")).toBe(false);
    expect(canStartProposalCreation(jdbc, "skill")).toBe(false);
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
