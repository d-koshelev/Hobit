import { describe, expect, it } from "vitest";

import type {
  CoordinatorActionProposal,
  CoordinatorProposalTypeId,
} from "./coordinatorActionProposalRegistry";
import {
  formatProposalDetails,
  getProposalCardState,
  proposalActionState,
  queueDraftReviewState,
} from "./workspaceAgentProposalDisplayState";

describe("workspaceAgentProposalDisplayState", () => {
  it("derives Queue proposal card and action state without creating on approval", () => {
    const proposal = proposalFixture("create-agent-queue-task", {
      approvalStatus: "Approved preview",
      executionStatus: "Ready to create Queue task",
      resultSummary:
        "Approved locally. Use Create Queue task to create a draft task. Does not run it.",
    });

    expect(getProposalCardState(proposal)).toMatchObject({
      stateDescription:
        "Approval only accepts the draft. Use Create Queue task separately. Creates a draft task. Does not run it.",
      stateLabel: "Approved",
      tone: "approved",
      typeLabel: "Draft Queue task",
    });
    expect(proposalActionState(proposal)).toMatchObject({
      canCreateQueueTask: true,
      hasCreatedQueueTask: false,
      isApproved: true,
      isCreateQueueTaskProposal: true,
    });
  });

  it("derives Knowledge Document proposal card and action state", () => {
    const proposal = proposalFixture("create-knowledge-document", {
      approvalStatus: "Approved preview",
      executionStatus: "Ready to create Knowledge document",
      resultSummary:
        "Approved locally. Review the visible title, source, content, tags, and enabled flag, then use Create Document. No document has been created yet.",
    });

    expect(getProposalCardState(proposal)).toMatchObject({
      stateDescription:
        "Approval only accepts the preview. Use Create Document separately to write workspace knowledge.",
      stateLabel: "Approved",
      tone: "approved",
      typeLabel: "Knowledge Document draft",
    });
    expect(proposalActionState(proposal)).toMatchObject({
      canCreateKnowledgeDocument: true,
      hasCreatedKnowledgeDocument: false,
      isCreateKnowledgeDocumentProposal: true,
    });
  });

  it("derives Skill proposal card and action state", () => {
    const proposal = proposalFixture("create-skill", {
      approvalStatus: "Approved preview",
      executionStatus: "Ready to create Skill",
      resultSummary:
        "Approved locally. Review the visible Skill fields, then use Create Skill. No Skill has been created yet.",
    });

    expect(getProposalCardState(proposal)).toMatchObject({
      stateDescription:
        "Approval only accepts the preview. Use Create Skill separately to write a workspace Skill.",
      stateLabel: "Approved",
      tone: "approved",
      typeLabel: "Skill draft",
    });
    expect(proposalActionState(proposal)).toMatchObject({
      canCreateSkill: true,
      hasCreatedSkill: false,
      isCreateSkillProposal: true,
    });
  });

  it("keeps display labels and copied details text stable", () => {
    const note = proposalFixture("create-note", {
      approvalStatus: "Rejected preview",
      executionStatus: "Not run",
      resultSummary: "Rejected locally only. No widget capability was invoked.",
    });
    const jdbc = proposalFixture("prepare-jdbc-query-suggestion");

    expect(getProposalCardState(note)).toMatchObject({
      stateDescription: "Rejected locally. No widget capability was invoked.",
      stateLabel: "Rejected",
      tone: "rejected",
      typeLabel: "Note proposal",
    });
    expect(getProposalCardState(jdbc)).toMatchObject({
      stateDescription:
        "Review or edit the visible SQL text. Approval and copy do not execute SQL.",
      stateLabel: "Suggestion only",
      tone: "suggestion",
      typeLabel: "JDBC SQL suggestion",
    });
    expect(formatProposalDetails(jdbc)).toContain(
      "SQL suggestion only. Copy SQL copies only the visible SQL text. No connector access, database call, EXPLAIN, provider runtime, Terminal command, Git mutation, Queue dispatch, Agent Executor launch, or JDBC SQL execution is triggered.",
    );
  });

  it("keeps Queue draft review summary counts and approvable ids stable", () => {
    const proposed = proposalFixture("create-agent-queue-task", {
      id: "queue-1",
    });
    const approved = proposalFixture("create-agent-queue-task", {
      approvalStatus: "Approved preview",
      executionStatus: "Ready to create Queue task",
      id: "queue-2",
    });
    const created = proposalFixture("create-agent-queue-task", {
      approvalStatus: "Approved preview",
      createdQueueTaskId: "task_1",
      executionStatus: "Queue task created",
      id: "queue-3",
    });
    const note = proposalFixture("create-note", { id: "note-1" });

    expect(
      queueDraftReviewState(
        ["queue-1", "note-1", "missing", "queue-2", "queue-3"],
        {
          "note-1": note,
          "queue-1": proposed,
          "queue-2": approved,
          "queue-3": created,
        },
      ),
    ).toMatchObject({
      approvableIds: ["queue-1", "queue-2"],
      approvedCount: 2,
      canApproveAll: true,
      createdCount: 1,
      queueDraftCount: 3,
    });
  });

  it("handles unknown proposal families with safe display defaults", () => {
    const unknown = proposalFixture(
      "unknown-proposal-family" as CoordinatorProposalTypeId,
      {
        approvalStatus: "Approved preview",
        executionStatus: "Execution bridge not implemented",
      },
    );

    expect(getProposalCardState(unknown)).toMatchObject({
      stateDescription:
        "Approval only accepts the preview. No capability executes from approval alone.",
      stateLabel: "Approved",
      tone: "approved",
      typeLabel: "JDBC SQL suggestion",
    });
    expect(proposalActionState(unknown)).toMatchObject({
      canCreateKnowledgeDocument: false,
      canCreateNote: false,
      canCreateQueueTask: false,
      canCreateSkill: false,
      isJdbcQuerySuggestion: false,
    });
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
