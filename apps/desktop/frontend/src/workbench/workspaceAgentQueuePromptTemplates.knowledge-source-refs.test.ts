import { describe, expect, it } from "vitest";

import {
  codebaseKnowledgeGenerationQueueTaskPrompt,
  historyKnowledgeGenerationQueueTaskPrompt,
} from "./workspaceAgentQueuePromptTemplates";

describe("workspaceAgentQueuePromptTemplates Knowledge source refs", () => {
  it("adds structured codebase source refs to codebase Knowledge prompts", () => {
    const draft = codebaseKnowledgeGenerationQueueTaskPrompt(
      "Generate codebase knowledge. Area: apps/desktop/frontend/src/workbench",
    );

    expect(draft.prompt).toContain("Structured source refs:");
    expect(draft.prompt).toContain("kind: codebase");
    expect(draft.prompt).toContain(
      "path: apps/desktop/frontend/src/workbench",
    );
    expect(draft.prompt).toContain("scope: workspace-local");
    expect(draft.prompt).toContain(
      "Current Queue task API has no durable sourceRefs field",
    );
  });

  it("adds structured history source refs to history Knowledge prompts", () => {
    const draft = historyKnowledgeGenerationQueueTaskPrompt(
      "Summarize command history into knowledge. Command summaries: typecheck passed",
    );

    expect(draft.prompt).toContain("Structured source refs:");
    expect(draft.prompt).toContain("kind: command_history");
    expect(draft.prompt).toContain("selector: typecheck passed");
    expect(draft.prompt).toContain("scope: current-session-visible");
    expect(draft.prompt).toContain(
      "Current Queue task API has no durable sourceRefs field",
    );
  });
});
