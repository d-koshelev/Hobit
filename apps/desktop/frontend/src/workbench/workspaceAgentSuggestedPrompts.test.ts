import { describe, expect, it } from "vitest";

import {
  WORKSPACE_AGENT_SUGGESTED_PROMPTS,
  workspaceAgentProposalTypeSummary,
} from "./workspaceAgentSuggestedPrompts";

describe("workspaceAgentSuggestedPrompts", () => {
  it("exports the expected prompt labels in stable order", () => {
    expect(
      WORKSPACE_AGENT_SUGGESTED_PROMPTS.map((suggestion) => suggestion.label),
    ).toEqual([
      "Make a plan",
      "Break into Queue tasks",
      "Draft tasks for this goal",
      "Review pasted Queue result",
      "Explain this Executor failure",
      "Turn this result into next steps",
      "Draft follow-up Queue tasks",
      "Summarize validation output",
      "Explain how to execute this safely",
    ]);
  });

  it("keeps important suggestion prompt text unchanged", () => {
    expect(WORKSPACE_AGENT_SUGGESTED_PROMPTS[0]?.prompt).toBe(
      "Make a plan from the visible chat only. Goal: ",
    );
    expect(WORKSPACE_AGENT_SUGGESTED_PROMPTS[4]?.prompt).toBe(
      "Explain this Executor failure using visible chat text only. Paste failure here: ",
    );
    expect(WORKSPACE_AGENT_SUGGESTED_PROMPTS[8]?.prompt).toBe(
      "Explain how to execute this safely from visible chat only. Do not start Queue, Executor, Terminal, Git, or JDBC actions.",
    );
  });

  it("summarizes supported proposal types in registry order", () => {
    expect(workspaceAgentProposalTypeSummary()).toBe(
      "Create Agent Queue task, Create Knowledge Document, Create Skill, Create Note, Prepare JDBC query suggestion",
    );
  });
});
