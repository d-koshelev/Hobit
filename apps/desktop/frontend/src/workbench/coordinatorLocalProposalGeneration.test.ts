import { describe, expect, it } from "vitest";

import { generateLocalCoordinatorProposals } from "./coordinatorLocalProposalGeneration";
import { queueTaskRequestFromProposal } from "./coordinatorProposalHandoffs";

describe("coordinatorLocalProposalGeneration", () => {
  it("drafts a manual Queue task for docs-to-Knowledge generation without scanning or activation", () => {
    const result = generateLocalCoordinatorProposals(
      "Create knowledge from docs. Docs: docs/ACTIVE_CONTRACT_INDEX.md, docs/CURRENT_WIDGET_SURFACE.md",
      "assistant-1",
    );
    const queueProposal = result.proposals.find(
      (proposal) => proposal.typeId === "create-agent-queue-task",
    );

    expect(queueProposal).toBeTruthy();
    expect(result.proposals).toHaveLength(1);
    expect(queueProposal).toMatchObject({
      approvalStatus: "Pending preview",
      executionStatus: "Not run",
      targetWidget: "Agent Queue",
      title: "Generate documentation Knowledge drafts",
      typeId: "create-agent-queue-task",
    });
    expect(input(queueProposal, "Source docs/path")).toBe(
      "docs/ACTIVE_CONTRACT_INDEX.md, docs/CURRENT_WIDGET_SURFACE.md",
    );
    expect(input(queueProposal, "Policy")).toBe("manual");
    expect(input(queueProposal, "Prompt")).toContain(
      "Task type: knowledge_generation",
    );
    expect(input(queueProposal, "Prompt")).toContain("Structured source refs:");
    expect(input(queueProposal, "Prompt")).toContain("kind: docs");
    expect(input(queueProposal, "Prompt")).toContain(
      "path: docs/ACTIVE_CONTRACT_INDEX.md",
    );
    expect(input(queueProposal, "Prompt")).toContain(
      "Current Queue task API has no durable sourceRefs field",
    );
    expect(input(queueProposal, "Prompt")).toContain("overview");
    expect(input(queueProposal, "Prompt")).toContain(
      "component responsibilities",
    );
    expect(input(queueProposal, "Prompt")).toContain("acceptance criteria");
    expect(input(queueProposal, "Prompt")).toContain("non-goals");
    expect(input(queueProposal, "Prompt")).toContain("known gaps");
    expect(input(queueProposal, "Prompt")).toContain("related docs index");
    expect(input(queueProposal, "Prompt")).toContain("quick summaries");
    expect(input(queueProposal, "Prompt")).toContain(
      "Do not create Knowledge Documents, activate Knowledge, enable Knowledge",
    );
    expect(queueProposal?.riskNotes.join(" ")).toContain(
      "Workspace Agent did not scan docs or read files",
    );

    const request = queueTaskRequestFromProposal(queueProposal!);
    expect(request).toMatchObject({
      executionPolicy: "manual",
      priority: 1,
      status: "draft",
      title: "Generate documentation Knowledge drafts",
    });
    expect(request.prompt).toContain("Return a bounded draft pack");
    expect(request.prompt).toContain("activationRecommendation");
  });

  it("keeps docs-to-Knowledge Queue creation draft-only when no docs are selected yet", () => {
    const result = generateLocalCoordinatorProposals(
      "Generate documentation knowledge from docs",
      "assistant-2",
    );
    const queueProposal = result.proposals.find(
      (proposal) => proposal.typeId === "create-agent-queue-task",
    );

    expect(input(queueProposal, "Source docs/path")).toContain(
      "Not selected yet",
    );
    expect(queueProposal?.expectedResult).toContain("does not run or activate");
    expect(queueProposal?.resultSummary).toContain("No docs were read");
  });

  it("drafts a manual Queue task for history-to-Knowledge generation without reading hidden history", () => {
    const result = generateLocalCoordinatorProposals(
      "Create knowledge from coordinator history. Coordinator history: visible transcript local-1..local-5 and Queue report summary Q-7",
      "assistant-history-1",
    );
    const queueProposal = result.proposals.find(
      (proposal) => proposal.typeId === "create-agent-queue-task",
    );

    expect(queueProposal).toBeTruthy();
    expect(result.proposals).toHaveLength(1);
    expect(queueProposal).toMatchObject({
      approvalStatus: "Pending preview",
      executionStatus: "Not run",
      targetWidget: "Agent Queue",
      title: "Generate Workspace Agent history Knowledge draft",
      typeId: "create-agent-queue-task",
    });
    expect(input(queueProposal, "Source history refs")).toBe(
      "visible transcript local-1..local-5 and Queue report summary Q-7",
    );
    expect(input(queueProposal, "Policy")).toBe("manual");
    expect(input(queueProposal, "Prompt")).toContain("knowledge_generation");
    expect(input(queueProposal, "Prompt")).toContain("Structured source refs:");
    expect(input(queueProposal, "Prompt")).toContain(
      "kind: coordinator_history",
    );
    expect(input(queueProposal, "Prompt")).toContain(
      "selector: visible transcript local-1..local-5 and Queue report summary Q-7",
    );
    expect(input(queueProposal, "Prompt")).toContain(
      "scope: current-session-visible",
    );
    expect(input(queueProposal, "Prompt")).toContain(
      "* coordinator_history: visible transcript local-1..local-5 and Queue report summary Q-7",
    );
    expect(input(queueProposal, "Prompt")).toContain("* what was learned");
    expect(input(queueProposal, "Prompt")).toContain(
      "* what remains uncertain",
    );
    expect(input(queueProposal, "Prompt")).toContain(
      "Do not read hidden Workspace Agent messages",
    );
    expect(input(queueProposal, "Prompt")).toContain(
      "raw Terminal transcripts",
    );
    expect(queueProposal?.riskNotes.join(" ")).toContain(
      "did not auto-read transcript, Queue, Terminal, Executor",
    );

    const request = queueTaskRequestFromProposal(queueProposal!);
    expect(request).toMatchObject({
      executionPolicy: "manual",
      priority: 1,
      status: "draft",
      title: "Generate Workspace Agent history Knowledge draft",
    });
    expect(request.prompt).toContain("Return draft Knowledge only.");
    expect(request.prompt).toContain(
      "confirmation that no Knowledge was activated",
    );
  });

  it("keeps history-to-Knowledge Queue creation draft-only when no history refs are selected yet", () => {
    const result = generateLocalCoordinatorProposals(
      "Create knowledge from recent history",
      "assistant-history-2",
    );
    const queueProposal = result.proposals.find(
      (proposal) => proposal.typeId === "create-agent-queue-task",
    );

    expect(input(queueProposal, "Source history refs")).toContain(
      "Not selected yet",
    );
    expect(queueProposal?.expectedResult).toContain("does not run or activate");
    expect(queueProposal?.resultSummary).toContain(
      "No history, logs, transcripts",
    );
  });
});

function input(
  proposal:
    | ReturnType<typeof generateLocalCoordinatorProposals>["proposals"][number]
    | undefined,
  label: string,
) {
  return (
    proposal?.inputs.find(
      (proposalInput) =>
        proposalInput.label.toLowerCase() === label.toLowerCase(),
    )?.value ?? ""
  );
}
