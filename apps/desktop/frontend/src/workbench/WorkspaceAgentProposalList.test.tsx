import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CoordinatorActionProposal } from "./coordinatorActionProposalRegistry";
import { WorkspaceAgentProposalList } from "./WorkspaceAgentProposalList";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("WorkspaceAgentProposalList", () => {
  it("renders proposal cards in message order and ignores missing proposal ids", () => {
    renderProposalList({
      proposalIds: ["queue-2", "missing-proposal", "queue-1"],
      proposals: {
        "queue-1": proposalFixture({
          id: "queue-1",
          title: "First Queue draft",
          typeId: "create-agent-queue-task",
        }),
        "queue-2": proposalFixture({
          id: "queue-2",
          title: "Second Queue draft",
          typeId: "create-agent-queue-task",
        }),
      },
    });

    const cards = Array.from(
      document.querySelectorAll('[aria-label^="Workspace Agent action proposal"]'),
    );

    expect(cards).toHaveLength(2);
    expect(cards[0]?.textContent).toContain("Second Queue draft");
    expect(cards[1]?.textContent).toContain("First Queue draft");
    expect(document.body.textContent).toContain("2 drafted, 0 approved, 0 created.");
    expect(document.body.textContent).toContain(
      "Approve all drafts is local review only.",
    );
  });

  it("wires review and explicit create action callbacks without creating on approval", async () => {
    const approve = vi.fn();
    const approveAll = vi.fn();
    const createKnowledgeDocument = vi.fn();
    const createNote = vi.fn();
    const createQueueTask = vi.fn();
    const createSkill = vi.fn();
    const reject = vi.fn();

    renderProposalList({
      onApproveAllQueueDrafts: approveAll,
      onApproveProposal: approve,
      onCreateKnowledgeDocument: createKnowledgeDocument,
      onCreateNote: createNote,
      onCreateQueueTask: createQueueTask,
      onCreateSkill: createSkill,
      onRejectProposal: reject,
      proposalIds: ["queue-1", "note-1", "doc-1", "skill-1", "sql-1"],
      proposals: {
        "doc-1": proposalFixture({
          approvalStatus: "Approved preview",
          executionStatus: "Ready to create Knowledge document",
          id: "doc-1",
          title: "Document draft",
          typeId: "create-knowledge-document",
        }),
        "note-1": proposalFixture({
          approvalStatus: "Approved preview",
          executionStatus: "Ready to create Note",
          id: "note-1",
          title: "Note draft",
          typeId: "create-note",
        }),
        "queue-1": proposalFixture({
          id: "queue-1",
          title: "Queue draft",
          typeId: "create-agent-queue-task",
        }),
        "skill-1": proposalFixture({
          approvalStatus: "Approved preview",
          executionStatus: "Ready to create Skill",
          id: "skill-1",
          title: "Skill draft",
          typeId: "create-skill",
        }),
        "sql-1": proposalFixture({
          executionStatus: "SQL suggestion only",
          id: "sql-1",
          title: "SQL suggestion",
          typeId: "prepare-jdbc-query-suggestion",
        }),
      },
    });

    await clickButton("Approve");

    expect(approve).toHaveBeenCalledWith("queue-1");
    expect(createQueueTask).not.toHaveBeenCalled();
    expect(createNote).not.toHaveBeenCalled();
    expect(createKnowledgeDocument).not.toHaveBeenCalled();
    expect(createSkill).not.toHaveBeenCalled();

    await clickButton("Create Note");
    await clickButton("Create Document");
    await clickButton("Create Skill");

    expect(createNote).toHaveBeenCalledWith("note-1");
    expect(createKnowledgeDocument).toHaveBeenCalledWith("doc-1");
    expect(createSkill).toHaveBeenCalledWith("skill-1");
    expect(document.body.textContent).toContain("Copy SQL");
  });
});

function renderProposalList(
  overrides: Partial<Parameters<typeof WorkspaceAgentProposalList>[0]> = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  const props: Parameters<typeof WorkspaceAgentProposalList>[0] = {
    creatingKnowledgeDocumentProposalIds: new Set(),
    creatingNoteProposalIds: new Set(),
    creatingQueueProposalIds: new Set(),
    onApproveAllQueueDrafts: vi.fn(),
    onApproveProposal: vi.fn(),
    onCreateKnowledgeDocument: vi.fn(),
    onCreateNote: vi.fn(),
    onCreateQueueTask: vi.fn(),
    onCreateSkill: vi.fn(),
    onEditProposal: vi.fn(),
    onRejectProposal: vi.fn(),
    proposalIds: [],
    proposals: {},
    ...overrides,
  };

  act(() => {
    root?.render(<WorkspaceAgentProposalList {...props} />);
  });
}

function proposalFixture(
  overrides: Partial<CoordinatorActionProposal> & {
    id: string;
    title: string;
    typeId: CoordinatorActionProposal["typeId"];
  },
): CoordinatorActionProposal {
  const base = proposalBase(overrides.typeId);

  return {
    ...base,
    ...overrides,
    id: overrides.id,
    title: overrides.title,
    typeId: overrides.typeId,
  };
}

function proposalBase(
  typeId: CoordinatorActionProposal["typeId"],
): CoordinatorActionProposal {
  if (typeId === "create-agent-queue-task") {
    return {
      approvalStatus: "Pending preview",
      executionStatus: "Not run",
      expectedResult: "A draft Queue task can be created explicitly.",
      id: "queue",
      inputs: [
        { label: "Title", value: "Queue draft" },
        { label: "Description", value: "Visible draft description" },
        { label: "Prompt", value: "Visible draft prompt" },
        { label: "Priority", value: "0" },
        { label: "Policy", value: "manual" },
      ],
      intent: "Create a draft Queue task from visible text.",
      resultSummary: "No action has run.",
      riskLevel: "local_write",
      riskNotes: ["Requires separate Create Queue task action."],
      targetCapability: "create Queue task",
      targetWidget: "Agent Queue",
      title: "Queue draft",
      typeId,
    };
  }

  if (typeId === "create-knowledge-document") {
    return {
      approvalStatus: "Pending preview",
      executionStatus: "Not run",
      expectedResult: "A Knowledge Document can be created explicitly.",
      id: "document",
      inputs: [
        { label: "Title", value: "Document draft" },
        { label: "Source label", value: "Workspace Agent conversation" },
        { label: "Content", value: "Visible document content" },
        { label: "Tags", value: "docs" },
        { label: "Enabled", value: "true" },
      ],
      intent: "Create a Knowledge Document from visible text.",
      resultSummary: "No action has run.",
      riskLevel: "local_write",
      riskNotes: ["Requires separate Create Document action."],
      targetCapability: "create Knowledge Document",
      targetWidget: "Skill Library / Knowledge",
      title: "Document draft",
      typeId,
    };
  }

  if (typeId === "create-skill") {
    return {
      approvalStatus: "Pending preview",
      executionStatus: "Not run",
      expectedResult: "A Skill can be created explicitly.",
      id: "skill",
      inputs: [
        { label: "Title", value: "Skill draft" },
        { label: "When to use", value: "When visible work needs it" },
        { label: "Prerequisites", value: "" },
        { label: "Steps", value: "Follow visible steps" },
        { label: "Validation", value: "Validation passes" },
        { label: "Risks", value: "" },
        { label: "Tags", value: "skill" },
        { label: "Review status", value: "draft" },
      ],
      intent: "Create a Skill from visible text.",
      resultSummary: "No action has run.",
      riskLevel: "local_write",
      riskNotes: ["Requires separate Create Skill action."],
      targetCapability: "create Skill",
      targetWidget: "Skill Library / Knowledge",
      title: "Skill draft",
      typeId,
    };
  }

  if (typeId === "create-note") {
    return {
      approvalStatus: "Pending preview",
      executionStatus: "Not run",
      expectedResult: "A Note can be created explicitly.",
      id: "note",
      inputs: [
        { label: "Title", value: "Note draft" },
        { label: "Body", value: "Visible note body" },
        { label: "Pinned", value: "false" },
      ],
      intent: "Create a Note from visible text.",
      resultSummary: "No action has run.",
      riskLevel: "local_write",
      riskNotes: ["Requires separate Create Note action."],
      targetCapability: "create Note",
      targetWidget: "Notes",
      title: "Note draft",
      typeId,
    };
  }

  return {
    approvalStatus: "Pending preview",
    executionStatus: "SQL suggestion only",
    expectedResult: "A SQL suggestion can be copied explicitly.",
    id: "sql",
    inputs: [
      { label: "Question", value: "Visible database question" },
      { label: "Suggested SQL text", value: "select * from visible_table" },
    ],
    intent: "Prepare a SQL suggestion from visible text.",
    resultSummary: "No SQL has run.",
    riskLevel: "analysis_only",
    riskNotes: ["Copy only. No SQL execution."],
    targetCapability: "prepare query suggestion",
    targetWidget: "Database / JDBC",
    title: "SQL suggestion",
    typeId,
  };
}

async function clickButton(text: string) {
  await act(async () => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === text,
    );
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}
