import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueWorkflowAction,
  AgentQueueWorkflowCancelResult,
  AgentQueueWorkflowCommandBlocker,
  AgentQueueWorkflowConflict,
  AgentQueueWorkflowReport,
  AgentQueueWorkflowRun,
  AgentQueueWorkflowStartResult,
  CancelAgentQueueWorkflowRequest,
  GetAgentQueueWorkflowRequest,
  ListAgentQueueWorkflowsRequest,
  StartAgentQueueWorkflowRequest,
} from "./types";

type TauriAgentQueueWorkflowRun = {
  workflow_run_id: string;
  workspace_id: string;
  workflow_id: string;
  request_id: string;
  request_hash: string;
  status: string;
  phase: string;
  current_step: string | null;
  pause_reason: string | null;
  blocker_reason: string | null;
  actor_id: string | null;
  inputs_snapshot_json: string | null;
  grant_summary_json: string | null;
  variables_json: string | null;
  slot_bindings_json: string | null;
  mutation_refs_json: string | null;
  idempotency_keys_json: string | null;
  action_log_summary_json: string | null;
  version: number;
  schema_version: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type TauriAgentQueueWorkflowAction = {
  action_id: string;
  workflow_run_id: string;
  workspace_id: string;
  step_id: string;
  action_type: string;
  idempotency_key: string;
  status: string;
  target_refs_json: string | null;
  result_refs_json: string | null;
  blocker_code: string | null;
  blocker_message: string | null;
  attempt_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type TauriAgentQueueWorkflowCommandBlocker = {
  blocker_code: string;
  blocker_message: string;
  missing_required_field: string | null;
};

type TauriAgentQueueWorkflowConflict = {
  conflict_code: string;
  conflict_message: string;
  existing_workflow_run_id: string | null;
  existing_request_hash: string | null;
  requested_request_hash: string | null;
};

type TauriAgentQueueWorkflowStartResult = {
  status: string;
  workflow_run: TauriAgentQueueWorkflowRun | null;
  conflict: TauriAgentQueueWorkflowConflict | null;
  blocker: TauriAgentQueueWorkflowCommandBlocker | null;
};

type TauriAgentQueueWorkflowCancelResult = {
  status: string;
  workflow_run: TauriAgentQueueWorkflowRun | null;
  blocker: TauriAgentQueueWorkflowCommandBlocker | null;
};

type TauriAgentQueueWorkflowReport = {
  workflow_run: TauriAgentQueueWorkflowRun;
  actions: TauriAgentQueueWorkflowAction[];
  resume_available: boolean;
  resume_status: string;
  report_summary: string;
};

export async function startAgentQueueWorkflow(
  request: StartAgentQueueWorkflowRequest,
): Promise<AgentQueueWorkflowStartResult> {
  const result = await invoke<TauriAgentQueueWorkflowStartResult>(
    "start_agent_queue_workflow",
    {
      request: {
        action_log_summary: request.actionLogSummary ?? null,
        actor_id: request.actorId ?? null,
        current_step: request.currentStep ?? null,
        grant_summary: request.grantSummary ?? null,
        idempotency_keys: request.idempotencyKeys ?? null,
        inputs_snapshot: request.inputsSnapshot ?? null,
        mutation_refs: request.mutationRefs ?? null,
        phase: request.phase ?? null,
        request_id: request.requestId,
        slot_bindings: request.slotBindings ?? null,
        variables: request.variables ?? null,
        workflow_id: request.workflowId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeStartResult(result);
}

export async function getAgentQueueWorkflow(
  request: GetAgentQueueWorkflowRequest,
): Promise<AgentQueueWorkflowRun | null> {
  const result = await invoke<TauriAgentQueueWorkflowRun | null>(
    "get_agent_queue_workflow",
    {
      request: {
        workflow_run_id: request.workflowRunId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return result ? normalizeRun(result) : null;
}

export async function listAgentQueueWorkflows(
  request: ListAgentQueueWorkflowsRequest,
): Promise<AgentQueueWorkflowRun[]> {
  const result = await invoke<TauriAgentQueueWorkflowRun[]>(
    "list_agent_queue_workflows",
    {
      request: {
        status: request.status ?? null,
        workflow_id: request.workflowId ?? null,
        workspace_id: request.workspaceId,
      },
    },
  );

  return result.map(normalizeRun);
}

export async function cancelAgentQueueWorkflow(
  request: CancelAgentQueueWorkflowRequest,
): Promise<AgentQueueWorkflowCancelResult> {
  const result = await invoke<TauriAgentQueueWorkflowCancelResult>(
    "cancel_agent_queue_workflow",
    {
      request: {
        actor_id: request.actorId ?? null,
        reason: request.reason ?? null,
        workflow_run_id: request.workflowRunId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeCancelResult(result);
}

export async function getAgentQueueWorkflowReport(
  request: GetAgentQueueWorkflowRequest,
): Promise<AgentQueueWorkflowReport | null> {
  const result = await invoke<TauriAgentQueueWorkflowReport | null>(
    "get_agent_queue_workflow_report",
    {
      request: {
        workflow_run_id: request.workflowRunId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return result ? normalizeReport(result) : null;
}

export function normalizeAgentQueueWorkflowRun(
  run: TauriAgentQueueWorkflowRun,
): AgentQueueWorkflowRun {
  return normalizeRun(run);
}

function normalizeStartResult(
  result: TauriAgentQueueWorkflowStartResult,
): AgentQueueWorkflowStartResult {
  return {
    blocker: result.blocker ? normalizeBlocker(result.blocker) : null,
    conflict: result.conflict ? normalizeConflict(result.conflict) : null,
    status: result.status,
    workflowRun: result.workflow_run ? normalizeRun(result.workflow_run) : null,
  };
}

function normalizeCancelResult(
  result: TauriAgentQueueWorkflowCancelResult,
): AgentQueueWorkflowCancelResult {
  return {
    blocker: result.blocker ? normalizeBlocker(result.blocker) : null,
    status: result.status,
    workflowRun: result.workflow_run ? normalizeRun(result.workflow_run) : null,
  };
}

function normalizeReport(
  report: TauriAgentQueueWorkflowReport,
): AgentQueueWorkflowReport {
  return {
    actions: report.actions.map(normalizeAction),
    reportSummary: report.report_summary,
    resumeAvailable: report.resume_available,
    resumeStatus: report.resume_status,
    workflowRun: normalizeRun(report.workflow_run),
  };
}

function normalizeRun(run: TauriAgentQueueWorkflowRun): AgentQueueWorkflowRun {
  return {
    actionLogSummaryJson: run.action_log_summary_json,
    actorId: run.actor_id,
    blockerReason: run.blocker_reason,
    completedAt: run.completed_at,
    createdAt: run.created_at,
    currentStep: run.current_step,
    grantSummaryJson: run.grant_summary_json,
    idempotencyKeysJson: run.idempotency_keys_json,
    inputsSnapshotJson: run.inputs_snapshot_json,
    mutationRefsJson: run.mutation_refs_json,
    pauseReason: run.pause_reason,
    phase: run.phase,
    requestHash: run.request_hash,
    requestId: run.request_id,
    schemaVersion: run.schema_version,
    slotBindingsJson: run.slot_bindings_json,
    status: run.status,
    updatedAt: run.updated_at,
    variablesJson: run.variables_json,
    version: run.version,
    workflowId: run.workflow_id,
    workflowRunId: run.workflow_run_id,
    workspaceId: run.workspace_id,
  };
}

function normalizeAction(
  action: TauriAgentQueueWorkflowAction,
): AgentQueueWorkflowAction {
  return {
    actionId: action.action_id,
    actionType: action.action_type,
    attemptCount: action.attempt_count,
    blockerCode: action.blocker_code,
    blockerMessage: action.blocker_message,
    completedAt: action.completed_at,
    createdAt: action.created_at,
    idempotencyKey: action.idempotency_key,
    resultRefsJson: action.result_refs_json,
    startedAt: action.started_at,
    status: action.status,
    stepId: action.step_id,
    targetRefsJson: action.target_refs_json,
    updatedAt: action.updated_at,
    workflowRunId: action.workflow_run_id,
    workspaceId: action.workspace_id,
  };
}

function normalizeBlocker(
  blocker: TauriAgentQueueWorkflowCommandBlocker,
): AgentQueueWorkflowCommandBlocker {
  return {
    blockerCode: blocker.blocker_code,
    blockerMessage: blocker.blocker_message,
    missingRequiredField: blocker.missing_required_field,
  };
}

function normalizeConflict(
  conflict: TauriAgentQueueWorkflowConflict,
): AgentQueueWorkflowConflict {
  return {
    conflictCode: conflict.conflict_code,
    conflictMessage: conflict.conflict_message,
    existingRequestHash: conflict.existing_request_hash,
    existingWorkflowRunId: conflict.existing_workflow_run_id,
    requestedRequestHash: conflict.requested_request_hash,
  };
}
