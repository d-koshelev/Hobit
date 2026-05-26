import { describe, expect, it } from "vitest";

import {
  appendWorkspaceAgentVisibleContextBlock,
  hasWorkspaceAgentVisibleContext,
  removeWorkspaceAgentVisibleContextFromDraft,
  workspaceAgentVisibleContextBlock,
  type WorkspaceAgentVisibleContext,
} from "./workspaceAgentVisibleContext";

const context: WorkspaceAgentVisibleContext = {
  contextText: "Executor run metadata\nRun: run_safe_123456",
  sourceLabel: "Executor run detail",
};

describe("workspaceAgentVisibleContext", () => {
  it("formats visible attached context blocks for editable composer text", () => {
    expect(workspaceAgentVisibleContextBlock(context)).toBe(
      [
        "Visible attached context (Executor run detail)",
        "Executor run metadata\nRun: run_safe_123456",
        "Only visible attached context is sent.",
      ].join("\n"),
    );
  });

  it("appends visible context after existing draft text", () => {
    const block = workspaceAgentVisibleContextBlock(context);

    expect(
      appendWorkspaceAgentVisibleContextBlock("Review this.\n", block),
    ).toBe(`Review this.\n\n${block}`);
  });

  it("uses the visible context block as the draft when the composer is empty", () => {
    const block = workspaceAgentVisibleContextBlock(context);

    expect(appendWorkspaceAgentVisibleContextBlock("  ", block)).toBe(block);
  });

  it("removes matching visible context from the editable draft", () => {
    const block = workspaceAgentVisibleContextBlock(context);

    expect(
      removeWorkspaceAgentVisibleContextFromDraft(
        `${block}\n\nOperator note.`,
        context,
      ),
    ).toBe("Operator note.");
  });

  it("leaves the draft unchanged when the matching context block is absent", () => {
    expect(
      removeWorkspaceAgentVisibleContextFromDraft("Operator note.", context),
    ).toBe("Operator note.");
  });

  it("detects non-empty visible context", () => {
    expect(hasWorkspaceAgentVisibleContext(context)).toBe(true);
    expect(hasWorkspaceAgentVisibleContext(null)).toBe(false);
    expect(
      hasWorkspaceAgentVisibleContext({ contextText: " ", sourceLabel: "Skill" }),
    ).toBe(false);
  });
});
