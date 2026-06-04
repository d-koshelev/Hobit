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
