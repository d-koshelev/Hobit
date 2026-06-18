import { invoke } from "@tauri-apps/api/core";
import type {
  AckAgentQueueReviewMessageRequest,
  AgentQueueReviewCommandResult,
  AgentQueueReviewCreateMessageBlocker,
  AgentQueueReviewCreateMessageResult,
  AgentQueueReviewMessage,
  CreateAgentQueueReviewMessageRequest,
} from "./types";
import { normalizeAgentQueueItemAggregate } from "./tauriAgentQueueAggregateApi";

type TauriAgentQueueReviewMessage = {
  ack_actor_id: string | null;
  acked_at: string | null;
  actor_id: string;
  created_at: string;
  message_body: string;
  message_id: string;
  metadata_json: string | null;
  run_id: string | null;
  run_link_id: string | null;
  status: string;
  task_id: string;
  updated_at: string;
  workspace_id: string;
};

type TauriAgentQueueReviewCommandResult = {
  aggregate: Parameters<typeof normalizeAgentQueueItemAggregate>[0];
  durable: boolean;
  message_id: string;
  review_message: TauriAgentQueueReviewMessage;
  task_id: string;
  workspace_id: string;
};

type TauriAgentQueueReviewCreateMessageBlocker = {
  blocker_code: string;
  blocker_message: string;
  durable_evidence_required: boolean;
  evidence_bundle_id: string | null;
  evidence_bundle_id_required: boolean;
  evidence_state: string | null;
  existing_message_id: string | null;
  missing_required_field: string | null;
  next_suggested_capability: string | null;
  review_message_already_exists: boolean;
  review_state: string | null;
  run_id: string | null;
  run_id_required: boolean;
  task_id: string;
  ticket_state: string | null;
  worker_run_state: string | null;
};

type TauriAgentQueueReviewCreateMessageResult = {
  aggregate: Parameters<typeof normalizeAgentQueueItemAggregate>[0] | null;
  blocker: TauriAgentQueueReviewCreateMessageBlocker | null;
  durable: boolean;
  evidence_bundle_id: string | null;
  message_id: string | null;
  review_message: TauriAgentQueueReviewMessage | null;
  run_id: string | null;
  status: string;
  task_id: string;
  workspace_id: string;
};

export async function createAgentQueueReviewMessage(
  request: CreateAgentQueueReviewMessageRequest,
): Promise<AgentQueueReviewCreateMessageResult> {
  const result = await invoke<TauriAgentQueueReviewCreateMessageResult>(
    "create_agent_queue_review_message",
    {
      request: {
        actor_id: request.actorId,
        evidence_bundle_id: request.evidenceBundleId ?? null,
        message_body: request.messageBody ?? null,
        run_id: request.runId ?? null,
        task_id: request.taskId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeCreateReviewMessageResult(result);
}

export async function ackAgentQueueReviewMessage(
  request: AckAgentQueueReviewMessageRequest,
): Promise<AgentQueueReviewCommandResult> {
  const result = await invoke<TauriAgentQueueReviewCommandResult>(
    "ack_agent_queue_review_message",
    {
      request: {
        actor_id: request.actorId,
        message_id: request.messageId,
        task_id: request.taskId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeReviewCommandResult(result);
}

function normalizeReviewCommandResult(
  result: TauriAgentQueueReviewCommandResult,
): AgentQueueReviewCommandResult {
  return {
    aggregate: normalizeAgentQueueItemAggregate(result.aggregate),
    durable: result.durable,
    messageId: result.message_id,
    reviewMessage: normalizeReviewMessage(result.review_message),
    taskId: result.task_id,
    workspaceId: result.workspace_id,
  };
}

function normalizeCreateReviewMessageResult(
  result: TauriAgentQueueReviewCreateMessageResult,
): AgentQueueReviewCreateMessageResult {
  return {
    aggregate: result.aggregate
      ? normalizeAgentQueueItemAggregate(result.aggregate)
      : null,
    blocker: result.blocker ? normalizeCreateBlocker(result.blocker) : null,
    durable: result.durable,
    evidenceBundleId: result.evidence_bundle_id,
    messageId: result.message_id,
    reviewMessage: result.review_message
      ? normalizeReviewMessage(result.review_message)
      : null,
    runId: result.run_id,
    status: result.status,
    taskId: result.task_id,
    workspaceId: result.workspace_id,
  };
}

function normalizeCreateBlocker(
  blocker: TauriAgentQueueReviewCreateMessageBlocker,
): AgentQueueReviewCreateMessageBlocker {
  return {
    blockerCode: blocker.blocker_code,
    blockerMessage: blocker.blocker_message,
    durableEvidenceRequired: blocker.durable_evidence_required,
    evidenceBundleId: blocker.evidence_bundle_id,
    evidenceBundleIdRequired: blocker.evidence_bundle_id_required,
    evidenceState: blocker.evidence_state,
    existingMessageId: blocker.existing_message_id,
    missingRequiredField: blocker.missing_required_field,
    nextSuggestedCapability: blocker.next_suggested_capability,
    reviewMessageAlreadyExists: blocker.review_message_already_exists,
    reviewState: blocker.review_state,
    runId: blocker.run_id,
    runIdRequired: blocker.run_id_required,
    taskId: blocker.task_id,
    ticketState: blocker.ticket_state,
    workerRunState: blocker.worker_run_state,
  };
}

function normalizeReviewMessage(
  message: TauriAgentQueueReviewMessage,
): AgentQueueReviewMessage {
  return {
    ackActorId: message.ack_actor_id,
    ackedAt: message.acked_at,
    actorId: message.actor_id,
    createdAt: message.created_at,
    messageBody: message.message_body,
    messageId: message.message_id,
    metadataJson: message.metadata_json,
    runId: message.run_id,
    runLinkId: message.run_link_id,
    status: message.status,
    taskId: message.task_id,
    updatedAt: message.updated_at,
    workspaceId: message.workspace_id,
  };
}
