import { describe, expect, it } from "vitest";

import {
  knowledgeDocumentScopeFromKnowledgeScope,
  knowledgeItemTypeFromCatalogItemType,
  knowledgeScopeFromDocumentScope,
  knowledgeSourceRefFromLegacyFields,
  legacyKnowledgeSourceFromRefs,
  type KnowledgeContextSnapshot,
  type KnowledgeDraftReviewDecision,
  type KnowledgeSafetyWarning,
} from "./knowledgeDocuments";

describe("Knowledge production DTO model", () => {
  it("normalizes current document scopes to production Knowledge scopes", () => {
    expect(knowledgeScopeFromDocumentScope("workspace")).toBe("workspace-local");
    expect(knowledgeScopeFromDocumentScope("global")).toBe("global");
    expect(knowledgeDocumentScopeFromKnowledgeScope("workspace-local")).toBe(
      "workspace",
    );
  });

  it("keeps current catalog item compatibility while exposing production item types", () => {
    expect(knowledgeItemTypeFromCatalogItemType("architecture_decision")).toBe(
      "decision",
    );
    expect(knowledgeItemTypeFromCatalogItemType("prompt_template")).toBe(
      "document",
    );
    expect(knowledgeItemTypeFromCatalogItemType("known_issue")).toBe(
      "known_issue",
    );
  });

  it("maps typed source refs to and from legacy source fields", () => {
    expect(
      knowledgeSourceRefFromLegacyFields({
        sourceKind: "file",
        sourceLabel: "Selected file",
        sourceRef: "src/App.tsx",
      }),
    ).toEqual({
      kind: "codebase_path",
      label: "Selected file",
      path: "src/App.tsx",
    });

    expect(
      legacyKnowledgeSourceFromRefs([
        {
          kind: "queue_run",
          label: "Queue run",
          queueTaskId: "task_1",
          runId: "run_1",
        },
      ]),
    ).toEqual({ sourceKind: "queue_run", sourceRef: "run_1" });
  });

  it("models bounded context snapshots, warnings, and draft decisions without full bodies", () => {
    const warning: KnowledgeSafetyWarning = {
      code: "stale",
      createdAt: "2026-06-04T10:00:00.000Z",
      message: "Review before use.",
      severity: "warning",
      sourceRefId: "kdoc_1",
      warningId: "warn_1",
    };
    const snapshot: KnowledgeContextSnapshot = {
      capped: true,
      content: "Bounded excerpt only.",
      contentKind: "excerpt",
      itemType: "documentation_knowledge",
      lifecycleStatus: "stale",
      materializedAt: "2026-06-04T10:00:00.000Z",
      quickSummary: "Use only after review.",
      scope: "workspace-local",
      snapshotId: "snapshot_1",
      sourceRefId: "kdoc_1",
      title: "Knowledge doc",
      tokenEstimate: 5,
      version: "updated_at_token",
      warnings: [warning],
    };
    const decision: KnowledgeDraftReviewDecision = {
      acceptedKnowledgeDocumentId: "kdoc_1",
      acceptedSkillId: null,
      action: "accepted",
      createdAt: "2026-06-04T10:05:00.000Z",
      draftPackId: "pack_1",
      proposedItemId: "draft_1",
      proposedItemKey: "pack_1|draft_1",
      rejectionReason: null,
      reviewedAt: "2026-06-04T10:05:00.000Z",
      reviewId: "decision_1",
      sourceFingerprint: "queue:task_1|pack:pack_1",
      sourceQueueItemId: "task_1",
      sourceRunId: null,
      updatedAt: "2026-06-04T10:05:00.000Z",
      workspaceId: "ws_1",
    };

    expect(snapshot.content).toBe("Bounded excerpt only.");
    expect(snapshot.warnings[0]?.severity).toBe("warning");
    expect(decision.action).toBe("accepted");
  });
});
