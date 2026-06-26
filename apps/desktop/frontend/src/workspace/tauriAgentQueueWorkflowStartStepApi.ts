import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueWorkflowCreateSetupStartStepResult,
  ExecuteAgentQueueWorkflowCreateSetupStartStepRequest,
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

type TauriCreateSetupStartActions = {
  create_task_downstream: TauriAgentQueueWorkflowAction | null;
  create_task_upstream: TauriAgentQueueWorkflowAction | null;
  promote_task: TauriAgentQueueWorkflowAction | null;
  start_worker: TauriAgentQueueWorkflowAction | null;
  update_run_settings: TauriAgentQueueWorkflowAction | null;
};

type TauriCreateSetupStartQueueControl = {
  status: string;
  version: number;
};

type TauriCreateSetupStartDownstreamVerification = {
  dependency_edge_exists: boolean;
  downstream_not_started: boolean;
  downstream_run_id_absent: boolean;
  downstream_task_exists: boolean;
  downstream_task_id: string | null;
};

type TauriCreateSetupStartStepResult = {
  actions: TauriCreateSetupStartActions;
  blockers: TauriAgentQueueWorkflowCommandBlocker[];
  conflict: TauriAgentQueueWorkflowConflict | null;
  downstream_verification: TauriCreateSetupStartDownstreamVerification | null;
  execution_target_hash: string | null;
  execution_target_kind: string | null;
  next_phase: string | null;
  next_step: string | null;
  provider_id: string | null;
  queue_control: TauriCreateSetupStartQueueControl | null;
  request_id: string;
  run_ids_by_slot: Record<string, string>;
  settings_hash: string | null;
  slot_binding_snapshot: unknown | null;
  status: string;
  task_ids_by_slot: Record<string, string>;
  transition: string;
  workflow_id: string;
  workflow_run: TauriAgentQueueWorkflowRun | null;
  workflow_run_id: string | null;
};

export async function executeAgentQueueWorkflowCreateSetupStartStep(
  request: ExecuteAgentQueueWorkflowCreateSetupStartStepRequest,
): Promise<AgentQueueWorkflowCreateSetupStartStepResult> {
  const result = await invoke<TauriCreateSetupStartStepResult>(
    "execute_agent_queue_workflow_create_setup_start_step",
    {
      request: {
        actor_id: request.actorId ?? null,
        confirmation_token: request.confirmationToken ?? null,
        expected_version: request.expectedVersion ?? null,
        grant_summary: request.grantSummary ?? null,
        inputs: request.inputs ?? null,
        request_id: request.requestId,
        workflow_id: request.workflowId,
        workflow_run_id: request.workflowRunId ?? null,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeCreateSetupStartStepResult(result);
}

function normalizeCreateSetupStartStepResult(
  result: TauriCreateSetupStartStepResult,
): AgentQueueWorkflowCreateSetupStartStepResult {
  return {
    actions: {
      createTaskDownstream: result.actions.create_task_downstream
        ? normalizeAction(result.actions.create_task_downstream)
        : null,
      createTaskUpstream: result.actions.create_task_upstream
        ? normalizeAction(result.actions.create_task_upstream)
        : null,
      promoteTask: result.actions.promote_task
        ? normalizeAction(result.actions.promote_task)
        : null,
      startWorker: result.actions.start_worker
        ? normalizeAction(result.actions.start_worker)
        : null,
      updateRunSettings: result.actions.update_run_settings
        ? normalizeAction(result.actions.update_run_settings)
        : null,
    },
    blockers: result.blockers.map(normalizeBlocker),
    conflict: result.conflict ? normalizeConflict(result.conflict) : null,
    downstreamVerification: result.downstream_verification
      ? {
          dependencyEdgeExists:
            result.downstream_verification.dependency_edge_exists,
          downstreamNotStarted:
            result.downstream_verification.downstream_not_started,
          downstreamRunIdAbsent:
            result.downstream_verification.downstream_run_id_absent,
          downstreamTaskExists:
            result.downstream_verification.downstream_task_exists,
          downstreamTaskId: result.downstream_verification.downstream_task_id,
        }
      : null,
    executionTargetHash: result.execution_target_hash,
    executionTargetKind: result.execution_target_kind,
    nextPhase: result.next_phase,
    nextStep: result.next_step,
    providerId: result.provider_id,
    queueControl: result.queue_control,
    requestId: result.request_id,
    runIdsBySlot: result.run_ids_by_slot,
    settingsHash: result.settings_hash,
    slotBindingSnapshot: result.slot_binding_snapshot as
      | AgentQueueWorkflowCreateSetupStartStepResult["slotBindingSnapshot"]
      | null,
    status: result.status,
    taskIdsBySlot: result.task_ids_by_slot,
    transition: result.transition,
    workflowId: result.workflow_id,
    workflowRun: result.workflow_run ? normalizeRun(result.workflow_run) : null,
    workflowRunId: result.workflow_run_id,
  };
}
