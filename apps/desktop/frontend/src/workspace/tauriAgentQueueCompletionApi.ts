import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueCompletionCommandBlocker,
  AgentQueueCompletionCommandResult,
  AgentQueueCompletionDecision,
  MarkAgentQueueItemDoneRequest,
} from "./types";
import { normalizeAgentQueueItemAggregate } from "./tauriAgentQueueAggregateApi";

type TauriAgentQueueCompletionDecision = {
  actor_id: string;
  created_at: string;
  decision: string;
  decision_id: string;
  metadata_json: string | null;
  reason: string | null;
  review_message_id: string | null;
  run_id: string | null;
  run_link_id: string | null;
  task_id: string;
  workspace_id: string;
};

type TauriAgentQueueCompletionCommandBlocker = {
  blocker_code: string;
  blocker_message: string;
  commit_state: string | null;
  dependency_state: string | null;
  evidence_bundle_id: string | null;
  evidence_state: string | null;
  missing_required_field: string | null;
  next_suggested_capability: string | null;
  review_message_id: string | null;
  review_state: string | null;
  run_id: string | null;
  task_id: string;
  ticket_state: string | null;
  validation_state: string | null;
  worker_run_state: string | null;
};

type TauriAgentQueueCompletionCommandResult = {
  aggregate: Parameters<typeof normalizeAgentQueueItemAggregate>[0] | null;
  blocker: TauriAgentQueueCompletionCommandBlocker | null;
  completion_decision: TauriAgentQueueCompletionDecision | null;
  decision_id: string | null;
  durable: boolean;
  evidence_bundle_id: string | null;
  review_message_id: string | null;
  run_id: string | null;
  status: string;
  task_id: string;
  workspace_id: string;
};

export async function markAgentQueueItemDone(
  request: MarkAgentQueueItemDoneRequest,
): Promise<AgentQueueCompletionCommandResult> {
  const result = await invoke<TauriAgentQueueCompletionCommandResult>(
    "mark_agent_queue_item_done",
    {
      request: {
        actor_id: request.actorId,
        confirmation_token: request.confirmationToken,
        reason: request.reason ?? null,
        review_message_id: request.reviewMessageId ?? null,
        run_id: request.runId ?? null,
        task_id: request.taskId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeCompletionCommandResult(result);
}

function normalizeCompletionCommandResult(
  result: TauriAgentQueueCompletionCommandResult,
): AgentQueueCompletionCommandResult {
  return {
    aggregate: result.aggregate
      ? normalizeAgentQueueItemAggregate(result.aggregate)
      : null,
    blocker: result.blocker ? normalizeCompletionBlocker(result.blocker) : null,
    completionDecision: result.completion_decision
      ? normalizeCompletionDecision(result.completion_decision)
      : null,
    decisionId: result.decision_id,
    durable: result.durable,
    evidenceBundleId: result.evidence_bundle_id,
    reviewMessageId: result.review_message_id,
    runId: result.run_id,
    status: result.status,
    taskId: result.task_id,
    workspaceId: result.workspace_id,
  };
}

function normalizeCompletionDecision(
  decision: TauriAgentQueueCompletionDecision,
): AgentQueueCompletionDecision {
  return {
    actorId: decision.actor_id,
    createdAt: decision.created_at,
    decision: decision.decision,
    decisionId: decision.decision_id,
    metadataJson: decision.metadata_json,
    reason: decision.reason,
    reviewMessageId: decision.review_message_id,
    runId: decision.run_id,
    runLinkId: decision.run_link_id,
    taskId: decision.task_id,
    workspaceId: decision.workspace_id,
  };
}

function normalizeCompletionBlocker(
  blocker: TauriAgentQueueCompletionCommandBlocker,
): AgentQueueCompletionCommandBlocker {
  return {
    blockerCode: blocker.blocker_code,
    blockerMessage: blocker.blocker_message,
    commitState: blocker.commit_state,
    dependencyState: blocker.dependency_state,
    evidenceBundleId: blocker.evidence_bundle_id,
    evidenceState: blocker.evidence_state,
    missingRequiredField: blocker.missing_required_field,
    nextSuggestedCapability: blocker.next_suggested_capability,
    reviewMessageId: blocker.review_message_id,
    reviewState: blocker.review_state,
    runId: blocker.run_id,
    taskId: blocker.task_id,
    ticketState: blocker.ticket_state,
    validationState: blocker.validation_state,
    workerRunState: blocker.worker_run_state,
  };
}
