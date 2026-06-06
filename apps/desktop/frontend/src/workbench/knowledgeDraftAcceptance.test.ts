import { describe, expect, it, vi } from "vitest";

import { acceptKnowledgeDraftItem } from "./knowledgeDraftAcceptance";
import type {
  KnowledgeDraftReviewItem,
  KnowledgeDraftReviewPack,
} from "./knowledgeDraftPacks";

describe("acceptKnowledgeDraftItem source refs", () => {
  it("preserves accepted draft source refs into the Knowledge Document request", async () => {
    const onCreateKnowledgeDocument = vi.fn(async (request) => ({
      ...request,
      createdAt: "2026-06-06T10:00:00.000Z",
      knowledgeDocumentId: "kdoc_1",
      updatedAt: "2026-06-06T10:00:00.000Z",
      version: 1,
      workspaceId: "ws_1",
    }));

    await acceptKnowledgeDraftItem({
      item: draftItem({
        sourceRefs: [
          {
            caps: ["Use only selected docs"],
            kind: "docs_path",
            label: "Selected docs contract",
            path: "docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md",
            reason: "Supports the accepted Queue draft item.",
            warnings: ["Bounded excerpt only"],
            workspaceScope: "workspace-local",
          },
        ],
      }),
      onCreateKnowledgeDocument,
      onCreateSkill: undefined,
      pack: draftPack(),
    });

    expect(onCreateKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRefs: [
          expect.objectContaining({
            caps: ["Use only selected docs"],
            kind: "docs_path",
            label: "Selected docs contract",
            path: "docs/KNOWLEDGE_GENERATION_WORKFLOW_CONTRACT.md",
            reason: "Supports the accepted Queue draft item.",
            warnings: ["Bounded excerpt only"],
            workspaceScope: "workspace-local",
          }),
        ],
      }),
    );
  });
});

function draftPack(): KnowledgeDraftReviewPack {
  return {
    draftPackId: "pack_1",
    generationGoal: "Generate docs Knowledge.",
    packTitle: "Docs draft pack",
    proposedItems: [],
    queueItemId: "task_1",
    rawJson: "{}",
    sourceLabel: "Queue task task_1",
    sourceRefs: [],
  };
}

function draftItem(
  overrides: Partial<KnowledgeDraftReviewItem> = {},
): KnowledgeDraftReviewItem {
  return {
    activationRecommendation: "accept as active",
    blockers: "",
    confidence: "high",
    draftItemId: "draft_1",
    fullContent: "Accepted draft content.",
    quickSummary: "Accepted draft summary.",
    relatedTasks: [],
    reviewNotes: "",
    sourceLabel: "Queue task task_1",
    sourceQueueItemId: "task_1",
    sourceRef: "queue:task_1;draft:draft_1",
    sourceRefs: [],
    suggestedScope: "workspace",
    suggestedTags: "docs",
    suggestedType: "documentation_knowledge",
    targetKind: "document",
    title: "Accepted draft",
    ...overrides,
  };
}
