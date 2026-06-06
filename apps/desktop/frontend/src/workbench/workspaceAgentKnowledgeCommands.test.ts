import { describe, expect, it, vi } from "vitest";

import type {
  KnowledgeDocument,
  KnowledgeDocumentSearchResult,
} from "../workspace/types";
import { runWorkspaceAgentKnowledgeCommand } from "./workspaceAgentKnowledgeCommands";

describe("workspaceAgentKnowledgeCommands", () => {
  it("searches active Knowledge explicitly without attaching context", async () => {
    const searchKnowledgeDocuments = vi.fn(async () => [
      knowledgeResult({
        documentTitle: "API guide",
        snippet: "Use the Workspace API.",
      }),
    ]);

    const result = await runWorkspaceAgentKnowledgeCommand(
      "knowledge search: Workspace API",
      { searchKnowledgeDocuments },
    );

    expect(searchKnowledgeDocuments).toHaveBeenCalledWith({
      limit: 3,
      query: "Workspace API",
    });
    expect(result).toMatchObject({ handled: true });
    expect(result.handled && result.body).toContain("Knowledge search results");
    expect(result.handled && result.body).toContain("No context was attached");
    expect(result.handled && result.visibleContext).toBeUndefined();
  });

  it("attaches a bounded visible context card with source, scope, and version", async () => {
    const searchKnowledgeDocuments = vi.fn(async () => [
      knowledgeResult({
        documentTitle: "API guide",
        snippet: "Use the Workspace API. ".repeat(80),
      }),
    ]);
    const getKnowledgeDocument = vi.fn(async () =>
      knowledgeDocument({
        quickSummary: "Workspace API summary.",
        sourceLabel: "Workspace docs",
        sourceRef: "docs/api.md",
        title: "API guide",
        updatedAt: "2026-06-01T10:00:00.000Z",
      }),
    );

    const result = await runWorkspaceAgentKnowledgeCommand(
      "knowledge attach: Workspace API",
      { getKnowledgeDocument, searchKnowledgeDocuments },
    );

    expect(result).toMatchObject({ handled: true });
    expect(result.handled && result.visibleContext?.sourceLabel).toContain(
      "Knowledge: API guide (Workspace, active, v 2026-06-01T10:00:00.000Z)",
    );
    expect(result.handled && result.visibleContext?.contextText).toContain(
      "Source ref: docs/api.md",
    );
    expect(result.handled && result.visibleContext?.contextText).toContain(
      "[truncated]",
    );
    expect(result.handled && result.visibleContext?.contextText).not.toContain(
      "RAW_FULL_DOCUMENT_BODY",
    );
  });

  it("blocks disabled or rejected Knowledge attachment even when a search result exists", async () => {
    const searchKnowledgeDocuments = vi.fn(async () => [knowledgeResult()]);
    const getKnowledgeDocument = vi.fn(async () =>
      knowledgeDocument({ enabled: false, lifecycleStatus: "rejected" }),
    );

    const result = await runWorkspaceAgentKnowledgeCommand(
      "knowledge attach: blocked docs",
      { getKnowledgeDocument, searchKnowledgeDocuments },
    );

    expect(result).toMatchObject({ handled: true });
    expect(result.handled && result.body).toContain("not attached");
    expect(result.handled && result.body).toContain("disabled Knowledge is blocked");
    expect(result.handled && result.visibleContext).toBeUndefined();
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

function knowledgeDocument(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    catalogItemType: "documentation_knowledge",
    content: "RAW_FULL_DOCUMENT_BODY",
    createdAt: "2026-05-24T00:00:00Z",
    enabled: true,
    knowledgeDocumentId: "doc_1",
    lifecycleStatus: "active",
    quickSummary: "Document summary.",
    scope: "workspace",
    searchable: true,
    sourceKind: "operator_authored",
    sourceLabel: "Workspace document",
    sourceRef: "",
    tags: "",
    title: "Document",
    updatedAt: "2026-05-24T00:00:00Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}
