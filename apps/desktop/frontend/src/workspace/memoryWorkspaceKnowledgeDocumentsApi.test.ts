import { describe, expect, it } from "vitest";

import {
  createKnowledgeDocument,
  searchKnowledgeDocuments,
} from "./memoryWorkspaceKnowledgeDocumentsApi";

describe("memoryWorkspaceKnowledgeDocumentsApi search safety", () => {
  it("applies typed filters while keeping disabled and non-active documents excluded", async () => {
    const workspaceId = "memory-filter-workspace";
    const query = "memory_filter_unique_needle";

    const active = await createKnowledgeDocument({
      catalogItemType: "codebase_knowledge",
      content: `${query} active codebase document.`,
      enabled: true,
      lifecycleStatus: "active",
      quickSummary: "Active codebase summary.",
      scope: "workspace",
      searchable: true,
      sourceKind: "docs_path",
      sourceLabel: "docs/filter.md",
      sourceRef: "docs/filter.md",
      tags: "deploy, frontend",
      title: "Active filtered docs",
      workspaceId,
    });

    await createKnowledgeDocument({
      catalogItemType: "known_issue",
      content: `${query} disabled document.`,
      enabled: false,
      lifecycleStatus: "active",
      quickSummary: "Disabled summary.",
      scope: "workspace",
      searchable: true,
      sourceKind: "manual",
      sourceLabel: "manual",
      sourceRef: "",
      tags: "deploy",
      title: "Disabled docs",
      workspaceId,
    });

    await createKnowledgeDocument({
      catalogItemType: "codebase_knowledge",
      content: `${query} stale document.`,
      enabled: true,
      lifecycleStatus: "stale",
      quickSummary: "Stale summary.",
      scope: "workspace",
      searchable: true,
      sourceKind: "docs_path",
      sourceLabel: "docs/stale.md",
      sourceRef: "docs/stale.md",
      tags: "deploy, frontend",
      title: "Stale docs",
      workspaceId,
    });

    const results = await searchKnowledgeDocuments({
      catalogItemTypes: ["codebase_knowledge"],
      lifecycleStatuses: ["active"],
      query,
      scopes: ["workspace"],
      sourceKinds: ["docs_path"],
      tags: ["deploy", "frontend"],
      updatedWithinDays: 1,
      workspaceId,
    });

    expect(results).toHaveLength(1);
    expect(results[0].knowledgeDocumentId).toBe(active.knowledgeDocumentId);

    await expect(
      searchKnowledgeDocuments({
        lifecycleStatuses: ["stale"],
        query,
        workspaceId,
      }),
    ).resolves.toEqual([]);
  });
});
