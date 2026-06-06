import { invoke } from "@tauri-apps/api/core";
import type {
  KnowledgeDraftReviewDecision,
  ListKnowledgeDraftReviewsRequest,
  RecordKnowledgeDraftReviewRequest,
} from "./types";

type TauriKnowledgeDraftReviewDecision = {
  review_id: string;
  workspace_id: string;
  draft_pack_id: string;
  source_fingerprint: string;
  source_queue_item_id?: string | null;
  source_run_id?: string | null;
  proposed_item_id: string;
  proposed_item_key: string;
  action: string;
  reviewed_at: string;
  accepted_knowledge_document_id?: string | null;
  accepted_skill_id?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
};

export async function recordKnowledgeDraftReview(
  request: RecordKnowledgeDraftReviewRequest,
): Promise<KnowledgeDraftReviewDecision> {
  const decision = await invoke<TauriKnowledgeDraftReviewDecision>(
    "record_knowledge_draft_review",
    {
      request: {
        workspace_id: request.workspaceId,
        draft_pack_id: request.draftPackId,
        source_fingerprint: request.sourceFingerprint ?? null,
        source_queue_item_id: request.sourceQueueItemId ?? null,
        source_run_id: request.sourceRunId ?? null,
        proposed_item_id: request.proposedItemId,
        proposed_item_key: request.proposedItemKey ?? null,
        action: request.action,
        reviewed_at: request.reviewedAt ?? null,
        accepted_knowledge_document_id:
          request.acceptedKnowledgeDocumentId ?? null,
        accepted_skill_id: request.acceptedSkillId ?? null,
        rejection_reason: request.rejectionReason ?? null,
      },
    },
  );

  return normalizeKnowledgeDraftReviewDecision(decision);
}

export async function listKnowledgeDraftReviews(
  request: ListKnowledgeDraftReviewsRequest,
): Promise<KnowledgeDraftReviewDecision[]> {
  const decisions = await invoke<TauriKnowledgeDraftReviewDecision[]>(
    "list_knowledge_draft_reviews",
    {
      request: {
        workspace_id: request.workspaceId,
        draft_pack_id: request.draftPackId,
        source_fingerprint: request.sourceFingerprint ?? null,
      },
    },
  );

  return decisions.map(normalizeKnowledgeDraftReviewDecision);
}

function normalizeKnowledgeDraftReviewDecision(
  decision: TauriKnowledgeDraftReviewDecision,
): KnowledgeDraftReviewDecision {
  return {
    reviewId: decision.review_id,
    workspaceId: decision.workspace_id,
    draftPackId: decision.draft_pack_id,
    sourceFingerprint: decision.source_fingerprint,
    sourceQueueItemId: decision.source_queue_item_id ?? null,
    sourceRunId: decision.source_run_id ?? null,
    proposedItemId: decision.proposed_item_id,
    proposedItemKey: decision.proposed_item_key,
    action: normalizeAction(decision.action),
    reviewedAt: decision.reviewed_at,
    acceptedKnowledgeDocumentId:
      decision.accepted_knowledge_document_id ?? null,
    acceptedSkillId: decision.accepted_skill_id ?? null,
    rejectionReason: decision.rejection_reason ?? null,
    createdAt: decision.created_at,
    updatedAt: decision.updated_at,
  };
}

function normalizeAction(action: string): KnowledgeDraftReviewDecision["action"] {
  switch (action) {
    case "accepted":
    case "rejected":
    case "edited_before_accept":
      return action;
    default:
      return "blocked";
  }
}
