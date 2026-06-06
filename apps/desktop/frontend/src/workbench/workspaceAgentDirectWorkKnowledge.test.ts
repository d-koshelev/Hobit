import { describe, expect, it } from "vitest";

import type { KnowledgeDocumentSearchResult } from "../workspace/types";
import {
  codexPromptWithWorkspaceKnowledge,
  knowledgeScopeLabel,
  workspaceKnowledgeLogText,
  workspaceKnowledgeSummaryText,
} from "./workspaceAgentDirectWorkKnowledge";

describe("workspaceAgentDirectWorkKnowledge", () => {
  it("materializes only capped visible snippets with scope labels for Codex", () => {
    const hiddenFullBodyTail =
      "RAW_FULL_DOCUMENT_BODY_SHOULD_NOT_BE_COPIED_BY_DEFAULT";
    const results = Array.from({ length: 7 }, (_, index) =>
      knowledgeResult({
        chunkIndex: index,
        documentTitle: `Knowledge ${index + 1}`,
        scope: index === 1 ? "global" : "workspace",
        snippet:
          index === 0
            ? "Visible bounded snippet from the search result."
            : `Visible snippet ${index + 1}.`,
      }),
    );

    const prompt = codexPromptWithWorkspaceKnowledge(
      "Use bounded Knowledge safely.",
      results,
    );

    expect(prompt.match(/\[Doc:/g)).toHaveLength(5);
    expect(prompt).toContain("[Doc: Knowledge 1, chunk 1]");
    expect(prompt).toContain("Scope: Workspace");
    expect(prompt).toContain("[Doc: Knowledge 2, chunk 2]");
    expect(prompt).toContain("Scope: Global");
    expect(prompt).not.toContain("Knowledge 6");
    expect(prompt).not.toContain("Knowledge 7");
    expect(prompt).not.toContain(hiddenFullBodyTail);
    expect(prompt).not.toMatch(/allowed_tools|queue execution|queue dispatch/i);
  });

  it("caps oversized knowledge snippets before prompt materialization", () => {
    const prompt = codexPromptWithWorkspaceKnowledge(
      "Keep Knowledge bounded.",
      [
        knowledgeResult({
          documentTitle: "Oversized Knowledge",
          snippet: "secret-free ".repeat(1000),
        }),
      ],
    );

    expect(prompt).toContain("[Doc: Oversized Knowledge, chunk 1]");
    expect(prompt).toContain("...");
    expect(prompt).not.toContain("secret-free ".repeat(100));
  });

  it("keeps no-match and failed lookup copy non-materializing", () => {
    expect(
      workspaceKnowledgeSummaryText({
        error: null,
        query: "missing",
        results: [],
        status: "checked",
      }),
    ).toBe("Workspace knowledge checked: no matches");
    expect(
      workspaceKnowledgeLogText({
        error: "Search failed.",
        query: "missing",
        results: [],
        status: "failed",
      }),
    ).toBe("Workspace knowledge check failed; continuing without it.");
    expect(knowledgeScopeLabel("global")).toBe("Global");
    expect(knowledgeScopeLabel("workspace")).toBe("Workspace");
  });
});

function knowledgeResult(
  overrides: Partial<KnowledgeDocumentSearchResult> = {},
): KnowledgeDocumentSearchResult {
  return {
    chunkId: "chunk_1",
    chunkIndex: 0,
    documentTitle: "Knowledge doc",
    knowledgeDocumentId: "doc_1",
    score: 10,
    snippet: "Knowledge snippet.",
    sourceLabel: "Workspace document",
    scope: "workspace",
    tags: "docs",
    ...overrides,
  };
}
