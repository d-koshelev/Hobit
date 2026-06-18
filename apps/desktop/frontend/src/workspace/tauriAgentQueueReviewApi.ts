import { invoke } from "@tauri-apps/api/core";
import type {
  AckAgentQueueReviewMessageRequest,
  AgentQueueReviewCommandResult,
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

export async function createAgentQueueReviewMessage(
  request: CreateAgentQueueReviewMessageRequest,
): Promise<AgentQueueReviewCommandResult> {
  const result = await invoke<TauriAgentQueueReviewCommandResult>(
    "create_agent_queue_review_message",
    {
      request: {
        actor_id: request.actorId,
        message_body: request.messageBody ?? null,
        task_id: request.taskId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeReviewCommandResult(result);
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
