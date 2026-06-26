import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueWorkflowFinalizationStepResult,
  ExecuteAgentQueueWorkflowFinalizationStepRequest,
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

type TauriAgentQueueWorkflowFinalizationBinding = {
  action_idempotency_key: string;
  completion_decision_id: string | null;
  evidence_bundle_id: string;
  failure_decision_id: string | null;
  finalization_action_id: string | null;
  finalized_at: string | null;
  message_id: string;
  run_id: string;
  slot: string;
  task_id: string;
  terminal_status: string;
};

type TauriAgentQueueWorkflowFinalizationDownstreamVerification = {
  dependency_state: string | null;
  dependency_verified: boolean;
  downstream_task_id: string | null;
  expected_dependency_state: string;
  latest_run_id: string | null;
  not_auto_started_verified: boolean;
  ticket_state: string | null;
  verification_missing: boolean;
  worker_run_state: string | null;
};

type TauriAgentQueueWorkflowFinalizationStepResult = {
  action: TauriAgentQueueWorkflowAction | null;
  binding: TauriAgentQueueWorkflowFinalizationBinding | null;
  blockers: TauriAgentQueueWorkflowCommandBlocker[];
  completion_decision_id: string | null;
  conflict: TauriAgentQueueWorkflowConflict | null;
  downstream_verification:
    | TauriAgentQueueWorkflowFinalizationDownstreamVerification
    | null;
  failure_decision_id: string | null;
  next_phase: string | null;
  next_step: string | null;
  status: string;
  terminal_status: string | null;
  transition: string;
  workflow_id: string | null;
  workflow_run: TauriAgentQueueWorkflowRun | null;
  workflow_run_id: string;
};

export async function executeAgentQueueWorkflowFinalizationStep(
  request: ExecuteAgentQueueWorkflowFinalizationStepRequest,
): Promise<AgentQueueWorkflowFinalizationStepResult> {
  const result = await invoke<TauriAgentQueueWorkflowFinalizationStepResult>(
    "execute_agent_queue_workflow_finalization_step",
    {
      request: {
        actor_id: request.actorId ?? null,
        confirmation_token: request.confirmationToken ?? null,
        expected_version: request.expectedVersion ?? null,
        failure_reason: request.failureReason ?? null,
        grant_summary: request.grantSummary ?? null,
        request_id: request.requestId ?? null,
        slot: request.slot ?? null,
        workflow_run_id: request.workflowRunId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeFinalizationStepResult(result);
}

function normalizeFinalizationStepResult(
  result: TauriAgentQueueWorkflowFinalizationStepResult,
): AgentQueueWorkflowFinalizationStepResult {
  return {
    action: result.action ? normalizeAction(result.action) : null,
    binding: result.binding
      ? {
          actionIdempotencyKey: result.binding.action_idempotency_key,
          completionDecisionId: result.binding.completion_decision_id,
          evidenceBundleId: result.binding.evidence_bundle_id,
          failureDecisionId: result.binding.failure_decision_id,
          finalizationActionId: result.binding.finalization_action_id,
          finalizedAt: result.binding.finalized_at,
          messageId: result.binding.message_id,
          runId: result.binding.run_id,
          slot: result.binding.slot,
          taskId: result.binding.task_id,
          terminalStatus: result.binding.terminal_status,
        }
      : null,
    blockers: result.blockers.map(normalizeBlocker),
    completionDecisionId: result.completion_decision_id,
    conflict: result.conflict ? normalizeConflict(result.conflict) : null,
    downstreamVerification: result.downstream_verification
      ? {
          dependencyState: result.downstream_verification.dependency_state,
          dependencyVerified: result.downstream_verification.dependency_verified,
          downstreamTaskId: result.downstream_verification.downstream_task_id,
          expectedDependencyState:
            result.downstream_verification.expected_dependency_state,
          latestRunId: result.downstream_verification.latest_run_id,
          notAutoStartedVerified:
            result.downstream_verification.not_auto_started_verified,
          ticketState: result.downstream_verification.ticket_state,
          verificationMissing: result.downstream_verification.verification_missing,
          workerRunState: result.downstream_verification.worker_run_state,
        }
      : null,
    failureDecisionId: result.failure_decision_id,
    nextPhase: result.next_phase,
    nextStep: result.next_step,
    status: result.status,
    terminalStatus: result.terminal_status,
    transition: result.transition,
    workflowId: result.workflow_id,
    workflowRun: result.workflow_run ? normalizeRun(result.workflow_run) : null,
    workflowRunId: result.workflow_run_id,
  };
}
