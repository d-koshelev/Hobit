import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  KnowledgeDraftReviewDecision,
  ListKnowledgeDraftReviewsRequest,
  RecordKnowledgeDraftReviewRequest,
} from "./types";

export function recordKnowledgeDraftReview(
  request: RecordKnowledgeDraftReviewRequest,
): Promise<KnowledgeDraftReviewDecision> {
  return getWorkspaceApi().recordKnowledgeDraftReview(request);
}

export function listKnowledgeDraftReviews(
  request: ListKnowledgeDraftReviewsRequest,
): Promise<KnowledgeDraftReviewDecision[]> {
  return getWorkspaceApi().listKnowledgeDraftReviews(request);
}
