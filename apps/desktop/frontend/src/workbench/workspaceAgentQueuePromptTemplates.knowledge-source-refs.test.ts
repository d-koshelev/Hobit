import { describe, expect, it } from "vitest";

import {
  codebaseKnowledgeGenerationQueueTaskPrompt,
  docsKnowledgeGenerationSourceRefs,
  historyKnowledgeGenerationQueueTaskPrompt,
} from "./workspaceAgentQueuePromptTemplates";
import { formatKnowledgeGenerationSourceRefs } from "./knowledgeSourceRefs";

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

  it("adds structured docs source refs to documentation Knowledge prompts", () => {
    const refs = docsKnowledgeGenerationSourceRefs(
      "docs/ACTIVE_CONTRACT_INDEX.md, decision:knowledge-refresh",
    );
    const promptPayload = formatKnowledgeGenerationSourceRefs(refs);

    expect(promptPayload).toContain("Structured source refs:");
    expect(promptPayload).toContain("kind: docs");
    expect(promptPayload).toContain("path: docs/ACTIVE_CONTRACT_INDEX.md");
    expect(promptPayload).toContain("id: decision:knowledge-refresh");
    expect(promptPayload).toContain("scope: workspace-local");
    expect(promptPayload).toContain(
      "Fallback: if task metadata has no sourceRefs field",
    );
  });
});
