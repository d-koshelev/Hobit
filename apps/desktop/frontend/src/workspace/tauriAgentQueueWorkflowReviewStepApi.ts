import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueWorkflowReviewStepResult,
  ExecuteAgentQueueWorkflowReviewStepRequest,
} from "./types";
import {
  normalizeAction,
  normalizeBlocker,
  normalizeConflict,
  normalizeRun,
  type TauriAgentQueueWorkflowAction,
  type TauriAgentQueueWorkflowCommandBlocker,
  type TauriAgentQueueWorkflowConflict,
  type TauriAgentQueueWorkflowRun,
} from "./tauriAgentQueueWorkflowApi";

type TauriAgentQueueWorkflowReviewBinding = {
  ack_action_id: string | null;
  ack_action_idempotency_key: string;
  ack_status: string;
  create_action_id: string | null;
  create_action_idempotency_key: string;
  evidence_bundle_id: string;
  message_id: string;
  review_acked_at: string | null;
  review_created_at: string | null;
  run_id: string;
  slot: string;
  task_id: string;
};

type TauriAgentQueueWorkflowReviewStepResult = {
  ack_action: TauriAgentQueueWorkflowAction | null;
  ack_status: string | null;
  binding: TauriAgentQueueWorkflowReviewBinding | null;
  blockers: TauriAgentQueueWorkflowCommandBlocker[];
  conflict: TauriAgentQueueWorkflowConflict | null;
  create_action: TauriAgentQueueWorkflowAction | null;
  message_id: string | null;
  next_phase: string | null;
  next_step: string | null;
  status: string;
  transition: string;
  workflow_run: TauriAgentQueueWorkflowRun | null;
  workflow_run_id: string;
};

export async function executeAgentQueueWorkflowReviewStep(
  request: ExecuteAgentQueueWorkflowReviewStepRequest,
): Promise<AgentQueueWorkflowReviewStepResult> {
  const result = await invoke<TauriAgentQueueWorkflowReviewStepResult>(
    "execute_agent_queue_workflow_review_step",
    {
      request: {
        actor_id: request.actorId ?? null,
        grant_summary: request.grantSummary ?? null,
        request_id: request.requestId ?? null,
        slot: request.slot ?? null,
        workflow_run_id: request.workflowRunId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeReviewStepResult(result);
}

function normalizeReviewStepResult(
  result: TauriAgentQueueWorkflowReviewStepResult,
): AgentQueueWorkflowReviewStepResult {
  return {
    ackAction: result.ack_action ? normalizeAction(result.ack_action) : null,
    ackStatus: result.ack_status,
    binding: result.binding
      ? {
          ackActionId: result.binding.ack_action_id,
          ackActionIdempotencyKey: result.binding.ack_action_idempotency_key,
          ackStatus: result.binding.ack_status,
          createActionId: result.binding.create_action_id,
          createActionIdempotencyKey:
            result.binding.create_action_idempotency_key,
          evidenceBundleId: result.binding.evidence_bundle_id,
          messageId: result.binding.message_id,
          reviewAckedAt: result.binding.review_acked_at,
          reviewCreatedAt: result.binding.review_created_at,
          runId: result.binding.run_id,
          slot: result.binding.slot,
          taskId: result.binding.task_id,
        }
      : null,
    blockers: result.blockers.map(normalizeBlocker),
    conflict: result.conflict ? normalizeConflict(result.conflict) : null,
    createAction: result.create_action
      ? normalizeAction(result.create_action)
      : null,
    messageId: result.message_id,
    nextPhase: result.next_phase,
    nextStep: result.next_step,
    status: result.status,
    transition: result.transition,
    workflowRun: result.workflow_run ? normalizeRun(result.workflow_run) : null,
    workflowRunId: result.workflow_run_id,
  };
}
