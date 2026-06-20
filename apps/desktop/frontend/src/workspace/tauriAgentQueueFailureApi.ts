import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueFailureCommandBlocker,
  AgentQueueFailureCommandResult,
  AgentQueueFailureDecision,
  FailAgentQueueItemRequest,
} from "./types";
import { normalizeAgentQueueItemAggregate } from "./tauriAgentQueueAggregateApi";

type TauriAgentQueueFailureDecision = {
  actor_id: string;
  created_at: string;
  decision: string;
  decision_id: string;
  evidence_bundle_id: string | null;
  metadata_json: string | null;
  reason: string;
  review_message_id: string | null;
  run_id: string | null;
  run_link_id: string | null;
  task_id: string;
  workspace_id: string;
};

type TauriAgentQueueFailureCommandBlocker = {
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

type TauriAgentQueueFailureCommandResult = {
  aggregate: Parameters<typeof normalizeAgentQueueItemAggregate>[0] | null;
  blocker: TauriAgentQueueFailureCommandBlocker | null;
  decision_id: string | null;
  durable: boolean;
  evidence_bundle_id: string | null;
  failure_decision: TauriAgentQueueFailureDecision | null;
  review_message_id: string | null;
  run_id: string | null;
  status: string;
  task_id: string;
  workspace_id: string;
};

export async function failAgentQueueItem(
  request: FailAgentQueueItemRequest,
): Promise<AgentQueueFailureCommandResult> {
  const result = await invoke<TauriAgentQueueFailureCommandResult>(
    "fail_agent_queue_item",
    {
      request: {
        actor_id: request.actorId ?? null,
        confirmation_token: request.confirmationToken,
        evidence_bundle_id: request.evidenceBundleId ?? null,
        reason: request.reason,
        review_message_id: request.reviewMessageId ?? null,
        run_id: request.runId ?? null,
        task_id: request.taskId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeFailureCommandResult(result);
}

function normalizeFailureCommandResult(
  result: TauriAgentQueueFailureCommandResult,
): AgentQueueFailureCommandResult {
  return {
    aggregate: result.aggregate
      ? normalizeAgentQueueItemAggregate(result.aggregate)
      : null,
    blocker: result.blocker ? normalizeFailureBlocker(result.blocker) : null,
    decisionId: result.decision_id,
    durable: result.durable,
    evidenceBundleId: result.evidence_bundle_id,
    failureDecision: result.failure_decision
      ? normalizeFailureDecision(result.failure_decision)
      : null,
    reviewMessageId: result.review_message_id,
    runId: result.run_id,
    status: result.status,
    taskId: result.task_id,
    workspaceId: result.workspace_id,
  };
}

function normalizeFailureDecision(
  decision: TauriAgentQueueFailureDecision,
): AgentQueueFailureDecision {
  return {
    actorId: decision.actor_id,
    createdAt: decision.created_at,
    decision: decision.decision,
    decisionId: decision.decision_id,
    evidenceBundleId: decision.evidence_bundle_id,
    metadataJson: decision.metadata_json,
    reason: decision.reason,
    reviewMessageId: decision.review_message_id,
    runId: decision.run_id,
    runLinkId: decision.run_link_id,
    taskId: decision.task_id,
    workspaceId: decision.workspace_id,
  };
}

function normalizeFailureBlocker(
  blocker: TauriAgentQueueFailureCommandBlocker,
): AgentQueueFailureCommandBlocker {
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
