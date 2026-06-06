import type { KnowledgeDraftReviewDecision } from "./types";
import type { WorkspaceApi } from "./workspaceApiTypes";

const decisionsByWorkspaceId = new Map<string, KnowledgeDraftReviewDecision[]>();
let nextDecisionId = 1;

export const recordKnowledgeDraftReview: WorkspaceApi["recordKnowledgeDraftReview"] =
  async (request) => {
    const now = new Date().toISOString();
    const draftPackId = request.draftPackId.trim();
    const proposedItemId = request.proposedItemId.trim();
    const sourceFingerprint =
      request.sourceFingerprint?.trim() || draftPackId;
    const proposedItemKey = request.proposedItemKey?.trim() || proposedItemId;
    const decision: KnowledgeDraftReviewDecision = {
      reviewId: `dev_memory_kdr_${nextDecisionId++}`,
      workspaceId: request.workspaceId,
      draftPackId,
      sourceFingerprint,
      sourceQueueItemId: request.sourceQueueItemId?.trim() || null,
      sourceRunId: request.sourceRunId?.trim() || null,
      proposedItemId,
      proposedItemKey,
      action: request.action,
      reviewedAt: request.reviewedAt ?? now,
      acceptedKnowledgeDocumentId:
        request.acceptedKnowledgeDocumentId?.trim() || null,
      acceptedSkillId: request.acceptedSkillId?.trim() || null,
      rejectionReason: request.rejectionReason?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    const existing = decisionsByWorkspaceId.get(request.workspaceId) ?? [];
    const nextDecisions = [
      decision,
      ...existing.filter(
        (candidate) =>
          candidate.draftPackId !== draftPackId ||
          candidate.proposedItemId !== proposedItemId,
      ),
    ];
    decisionsByWorkspaceId.set(request.workspaceId, nextDecisions);
    return cloneDecision(decision);
  };

export const listKnowledgeDraftReviews: WorkspaceApi["listKnowledgeDraftReviews"] =
  async (request) => {
    const sourceFingerprint =
      request.sourceFingerprint?.trim() || request.draftPackId.trim();
    return (decisionsByWorkspaceId.get(request.workspaceId) ?? [])
      .filter(
        (decision) =>
          decision.draftPackId === request.draftPackId ||
          decision.sourceFingerprint === sourceFingerprint,
      )
      .map(cloneDecision);
  };

function cloneDecision(
  decision: KnowledgeDraftReviewDecision,
): KnowledgeDraftReviewDecision {
  return { ...decision };
}
