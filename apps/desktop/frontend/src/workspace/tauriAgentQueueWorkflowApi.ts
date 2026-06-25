import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueWorkflowAction,
  AgentQueueWorkflowApplyRunSettingsResult,
  AgentQueueWorkflowCancelResult,
  AgentQueueWorkflowCommandBlocker,
  AgentQueueWorkflowConflict,
  AgentQueueWorkflowMaterializeTaskSlotResult,
  AgentQueueWorkflowPromoteTaskSlotResult,
  AgentQueueWorkflowReport,
  AgentQueueWorkflowResumeBlocker,
  AgentQueueWorkflowResumePlan,
  AgentQueueWorkflowRunnerReportRecordResult,
  AgentQueueWorkflowWorkerEvidenceStepResult,
  AgentQueueWorkflowWorkerEvidenceRecordResult,
  AgentQueueWorkerEvidenceBundle,
  AgentQueueTask,
  AgentQueueTaskContext,
  AgentQueueTaskExecutionPolicy,
  AgentQueueWorkflowExecutionTarget,
  AgentQueueWorkflowSlotReconciliation,
  AgentQueueWorkflowTaskResumeSnapshot,
  AgentQueueWorkflowRun,
  AgentQueueWorkflowStartResult,
  ApplyAgentQueueWorkflowRunSettingsRequest,
  CancelAgentQueueWorkflowRequest,
  GetAgentQueueWorkflowRequest,
  ListAgentQueueWorkflowsRequest,
  MaterializeAgentQueueWorkflowTaskSlotRequest,
  PlanAgentQueueWorkflowResumeRequest,
  PromoteAgentQueueWorkflowTaskSlotRequest,
  RecordAgentQueueWorkflowRunnerReportRequest,
  RecordAgentQueueWorkflowWorkerEvidenceRequest,
  StartAgentQueueWorkflowRequest,
} from "./types";
import type { TauriAgentQueueTask } from "./tauriAgentQueueDto";
import {
  normalizeAgentQueueItemAggregate,
  type TauriAgentQueueItemAggregate,
} from "./tauriAgentQueueAggregateApi";

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

type TauriAgentQueueWorkflowRunnerReportRecordResult = {
  status: string;
  workflow_run: TauriAgentQueueWorkflowRun | null;
  actions: TauriAgentQueueWorkflowAction[];
  blocker: TauriAgentQueueWorkflowCommandBlocker | null;
  conflict: TauriAgentQueueWorkflowConflict | null;
};

type TauriAgentQueueWorkerEvidenceBundle = {
  bundle_id: string;
  changed_files: string[];
  changed_files_count: number;
  changed_files_summary: string | null;
  created_at: string;
  error_summary: string | null;
  executor_widget_id: string | null;
  metadata_json: string | null;
  outcome: AgentQueueWorkerEvidenceBundle["outcome"];
  run_id: string;
  run_link_id: string | null;
  source: string;
  summary: string;
  task_id: string;
  updated_at: string;
  validation_summary: string | null;
  worker_id: string | null;
  workspace_id: string;
};

type TauriAgentQueueWorkflowWorkerEvidenceBinding = {
  evidence_action_id: string | null;
  evidence_action_idempotency_key: string;
  evidence_bundle_id: string;
  evidence_recorded_at: string;
  run_id: string;
  slot: string;
  task_id: string;
  worker_final_status: string;
  worker_outcome: string;
};

type TauriAgentQueueWorkflowWorkerEvidenceRecordResult = {
  action: TauriAgentQueueWorkflowAction | null;
  aggregate: TauriAgentQueueItemAggregate | null;
  binding: TauriAgentQueueWorkflowWorkerEvidenceBinding | null;
  blocker: TauriAgentQueueWorkflowCommandBlocker | null;
  conflict: TauriAgentQueueWorkflowConflict | null;
  evidence_bundle: TauriAgentQueueWorkerEvidenceBundle | null;
  status: string;
  workflow_run: TauriAgentQueueWorkflowRun | null;
};

type TauriAgentQueueWorkflowWorkerEvidenceStepResult = {
  action: TauriAgentQueueWorkflowAction | null;
  aggregate: TauriAgentQueueItemAggregate | null;
  binding: TauriAgentQueueWorkflowWorkerEvidenceBinding | null;
  blockers: TauriAgentQueueWorkflowCommandBlocker[];
  conflict: TauriAgentQueueWorkflowConflict | null;
  evidence_bundle: TauriAgentQueueWorkerEvidenceBundle | null;
  next_phase: string | null;
  next_step: string | null;
  status: string;
  transition: string;
  workflow_run: TauriAgentQueueWorkflowRun | null;
  workflow_run_id: string;
};

type TauriAgentQueueWorkflowTaskSlotBinding = {
  slot: string;
  task_id: string;
  task_spec_hash: string;
  dependency_spec_hash: string;
  dependency_edge_hash: string;
  depends_on_slots: string[];
  dependency_task_ids: string[];
  create_task_action_id: string | null;
  create_task_action_idempotency_key: string;
};

type TauriAgentQueueWorkflowMaterializeTaskSlotResult = {
  status: string;
  workflow_run: TauriAgentQueueWorkflowRun | null;
  task: TauriAgentQueueTask | null;
  action: TauriAgentQueueWorkflowAction | null;
  binding: TauriAgentQueueWorkflowTaskSlotBinding | null;
  blocker: TauriAgentQueueWorkflowCommandBlocker | null;
  conflict: TauriAgentQueueWorkflowConflict | null;
};

type TauriAgentQueueWorkflowRunSettingsBinding = {
  slot: string;
  task_id: string;
  settings_hash: string;
  execution_target_kind: string;
  provider_id: string;
  queue_owner_widget_instance_id: string | null;
  executor_widget_id: string | null;
  execution_target_hash: string;
  update_run_settings_action_id: string | null;
  update_run_settings_action_idempotency_key: string;
};

type TauriAgentQueueWorkflowApplyRunSettingsResult = {
  status: string;
  workflow_run: TauriAgentQueueWorkflowRun | null;
  task: TauriAgentQueueTask | null;
  action: TauriAgentQueueWorkflowAction | null;
  binding: TauriAgentQueueWorkflowRunSettingsBinding | null;
  blocker: TauriAgentQueueWorkflowCommandBlocker | null;
  conflict: TauriAgentQueueWorkflowConflict | null;
};

type TauriAgentQueueWorkflowPromoteTaskSlotBinding = {
  slot: string;
  task_id: string;
  task_spec_hash: string;
  settings_hash: string;
  promoted: boolean;
  task_status: string;
  promote_action_id: string | null;
  promote_action_idempotency_key: string;
};

type TauriAgentQueueWorkflowPromoteTaskSlotResult = {
  status: string;
  workflow_run: TauriAgentQueueWorkflowRun | null;
  task: TauriAgentQueueTask | null;
  action: TauriAgentQueueWorkflowAction | null;
  binding: TauriAgentQueueWorkflowPromoteTaskSlotBinding | null;
  blocker: TauriAgentQueueWorkflowCommandBlocker | null;
  conflict: TauriAgentQueueWorkflowConflict | null;
};

type TauriAgentQueueWorkflowReport = {
  workflow_run: TauriAgentQueueWorkflowRun;
  actions: TauriAgentQueueWorkflowAction[];
  resume_available: boolean;
  resume_status: string;
  report_summary: string;
};

type TauriAgentQueueWorkflowResumeBlocker = {
  blocker_code: string;
  blocker_message: string;
  slot: string | null;
  task_id: string | null;
  run_id: string | null;
  evidence_bundle_id: string | null;
  message_id: string | null;
  completion_decision_id: string | null;
  failure_decision_id: string | null;
  missing_required_field: string | null;
};

type TauriAgentQueueWorkflowSlotReconciliation = {
  slot: string;
  task_id: string | null;
  run_id: string | null;
  evidence_bundle_id: string | null;
  message_id: string | null;
  completion_decision_id: string | null;
  failure_decision_id: string | null;
  executor_widget_id: string | null;
  task_exists: boolean;
  run_exists: boolean;
  evidence_exists: boolean;
  review_message_exists: boolean;
  review_message_status: string | null;
  completion_decision_exists: boolean;
  failure_decision_exists: boolean;
  aggregate_ticket_state: string | null;
  aggregate_review_state: string | null;
  aggregate_evidence_state: string | null;
  aggregate_dependency_state: string | null;
  blocker_code: string | null;
};

type TauriAgentQueueWorkflowTaskResumeSnapshot = {
  task_id: string;
  ticket_state: string;
  worker_run_state: string;
  review_state: string;
  evidence_state: string;
  validation_state: string;
  commit_state: string;
  dependency_state: string;
  latest_run_id: string | null;
  latest_run_status: string | null;
  latest_evidence_bundle_id: string | null;
  latest_review_message_id: string | null;
  latest_review_message_status: string | null;
  latest_completion_decision_id: string | null;
  latest_failure_decision_id: string | null;
};

type TauriAgentQueueWorkflowResumePlan = {
  status: string;
  resume_available: boolean;
  workflow_run: TauriAgentQueueWorkflowRun;
  actions: TauriAgentQueueWorkflowAction[];
  reconciled_variables_json: string | null;
  slot_reconciliations: TauriAgentQueueWorkflowSlotReconciliation[];
  task_snapshots: TauriAgentQueueWorkflowTaskResumeSnapshot[];
  next_phase: string | null;
  next_step: string | null;
  blockers: TauriAgentQueueWorkflowResumeBlocker[];
  required_fresh_grant: boolean;
  required_confirmation: boolean;
  terminal_status: string | null;
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

export async function planAgentQueueWorkflowResume(
  request: PlanAgentQueueWorkflowResumeRequest,
): Promise<AgentQueueWorkflowResumePlan | null> {
  const result = await invoke<TauriAgentQueueWorkflowResumePlan | null>(
    "plan_agent_queue_workflow_resume",
    {
      request: {
        expected_version: request.expectedVersion ?? null,
        workflow_run_id: request.workflowRunId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return result ? normalizeResumePlan(result) : null;
}

export async function recordAgentQueueWorkflowRunnerReport(
  request: RecordAgentQueueWorkflowRunnerReportRequest,
): Promise<AgentQueueWorkflowRunnerReportRecordResult> {
  const result = await invoke<TauriAgentQueueWorkflowRunnerReportRecordResult>(
    "record_agent_queue_workflow_runner_report",
    {
      request: {
        action_log_summary: request.actionLogSummary ?? null,
        actions: request.actions.map((action) => ({
          action_type: action.actionType,
          blocker_code: action.blockerCode ?? null,
          blocker_message: action.blockerMessage ?? null,
          idempotency_key: action.idempotencyKey,
          result_refs: action.resultRefs ?? null,
          status: action.status,
          step_id: action.stepId,
          target_refs: action.targetRefs ?? null,
        })),
        blocker_reason: request.blockerReason ?? null,
        current_step: request.currentStep ?? null,
        idempotency_keys: request.idempotencyKeys ?? null,
        mutation_refs: request.mutationRefs ?? null,
        pause_reason: request.pauseReason ?? null,
        phase: request.phase ?? null,
        slot_bindings: request.slotBindings ?? null,
        status: request.status,
        variables: request.variables ?? null,
        workflow_run_id: request.workflowRunId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeRunnerReportRecordResult(result);
}

export async function recordAgentQueueWorkflowWorkerEvidence(
  request: RecordAgentQueueWorkflowWorkerEvidenceRequest,
): Promise<AgentQueueWorkflowWorkerEvidenceRecordResult> {
  const result = await invoke<TauriAgentQueueWorkflowWorkerEvidenceRecordResult>(
    "record_agent_queue_workflow_worker_evidence",
    {
      request: toTauriWorkerEvidenceRequest(request),
    },
  );

  return normalizeWorkerEvidenceRecordResult(result);
}

export async function executeAgentQueueWorkflowWorkerEvidenceStep(
  request: RecordAgentQueueWorkflowWorkerEvidenceRequest,
): Promise<AgentQueueWorkflowWorkerEvidenceStepResult> {
  const result = await invoke<TauriAgentQueueWorkflowWorkerEvidenceStepResult>(
    "execute_agent_queue_workflow_worker_evidence_step",
    {
      request: toTauriWorkerEvidenceRequest(request),
    },
  );

  return normalizeWorkerEvidenceStepResult(result);
}

export async function materializeAgentQueueWorkflowTaskSlot(
  request: MaterializeAgentQueueWorkflowTaskSlotRequest,
): Promise<AgentQueueWorkflowMaterializeTaskSlotResult> {
  const result = await invoke<TauriAgentQueueWorkflowMaterializeTaskSlotResult>(
    "materialize_agent_queue_workflow_task_slot",
    {
      request: {
        action_idempotency_key: request.actionIdempotencyKey ?? null,
        actor_id: request.actorId ?? null,
        depends_on_slots: request.dependsOnSlots ?? [],
        slot: request.slot,
        task_spec: {
          description: request.taskSpec.description ?? null,
          priority: request.taskSpec.priority ?? null,
          prompt: request.taskSpec.prompt,
          status: request.taskSpec.status ?? null,
          title: request.taskSpec.title,
        },
        task_spec_hash: request.taskSpecHash ?? null,
        workflow_run_id: request.workflowRunId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeMaterializeTaskSlotResult(result);
}

export async function applyAgentQueueWorkflowRunSettings(
  request: ApplyAgentQueueWorkflowRunSettingsRequest,
): Promise<AgentQueueWorkflowApplyRunSettingsResult> {
  const result = await invoke<TauriAgentQueueWorkflowApplyRunSettingsResult>(
    "apply_agent_queue_workflow_run_settings",
    {
      request: {
        action_idempotency_key: request.actionIdempotencyKey ?? null,
        actor_id: request.actorId ?? null,
        run_settings: {
          approval_policy: request.runSettings.approvalPolicy,
          codex_executable: request.runSettings.codexExecutable,
          execution_policy: request.runSettings.executionPolicy,
          execution_workspace: request.runSettings.executionWorkspace,
          execution_target: toTauriExecutionTarget(
            request.runSettings.executionTarget,
          ),
          executor_widget_id: request.runSettings.executorWidgetId ?? "",
          sandbox: request.runSettings.sandbox,
        },
        settings_hash: request.settingsHash ?? null,
        slot: request.slot,
        task_id: request.taskId ?? null,
        workflow_run_id: request.workflowRunId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeApplyRunSettingsResult(result);
}

export async function promoteAgentQueueWorkflowTaskSlot(
  request: PromoteAgentQueueWorkflowTaskSlotRequest,
): Promise<AgentQueueWorkflowPromoteTaskSlotResult> {
  const result = await invoke<TauriAgentQueueWorkflowPromoteTaskSlotResult>(
    "promote_agent_queue_workflow_task_slot",
    {
      request: {
        action_idempotency_key: request.actionIdempotencyKey ?? null,
        actor_id: request.actorId ?? null,
        settings_hash: request.settingsHash,
        slot: request.slot,
        task_id: request.taskId ?? null,
        task_spec_hash: request.taskSpecHash,
        workflow_run_id: request.workflowRunId,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizePromoteTaskSlotResult(result);
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

function normalizeRunnerReportRecordResult(
  result: TauriAgentQueueWorkflowRunnerReportRecordResult,
): AgentQueueWorkflowRunnerReportRecordResult {
  return {
    actions: result.actions.map(normalizeAction),
    blocker: result.blocker ? normalizeBlocker(result.blocker) : null,
    conflict: result.conflict ? normalizeConflict(result.conflict) : null,
    status: result.status,
    workflowRun: result.workflow_run ? normalizeRun(result.workflow_run) : null,
  };
}

function normalizeWorkerEvidenceRecordResult(
  result: TauriAgentQueueWorkflowWorkerEvidenceRecordResult,
): AgentQueueWorkflowWorkerEvidenceRecordResult {
  return {
    action: result.action ? normalizeAction(result.action) : null,
    aggregate: result.aggregate
      ? normalizeAgentQueueItemAggregate(result.aggregate)
      : null,
    binding: result.binding
      ? {
          evidenceActionId: result.binding.evidence_action_id,
          evidenceActionIdempotencyKey:
            result.binding.evidence_action_idempotency_key,
          evidenceBundleId: result.binding.evidence_bundle_id,
          evidenceRecordedAt: result.binding.evidence_recorded_at,
          runId: result.binding.run_id,
          slot: result.binding.slot,
          taskId: result.binding.task_id,
          workerFinalStatus: result.binding.worker_final_status,
          workerOutcome: result.binding.worker_outcome,
        }
      : null,
    blocker: result.blocker ? normalizeBlocker(result.blocker) : null,
    conflict: result.conflict ? normalizeConflict(result.conflict) : null,
    evidenceBundle: result.evidence_bundle
      ? normalizeWorkerEvidenceBundle(result.evidence_bundle)
      : null,
    status: result.status,
    workflowRun: result.workflow_run ? normalizeRun(result.workflow_run) : null,
  };
}

function normalizeWorkerEvidenceStepResult(
  result: TauriAgentQueueWorkflowWorkerEvidenceStepResult,
): AgentQueueWorkflowWorkerEvidenceStepResult {
  return {
    action: result.action ? normalizeAction(result.action) : null,
    aggregate: result.aggregate
      ? normalizeAgentQueueItemAggregate(result.aggregate)
      : null,
    binding: result.binding
      ? {
          evidenceActionId: result.binding.evidence_action_id,
          evidenceActionIdempotencyKey:
            result.binding.evidence_action_idempotency_key,
          evidenceBundleId: result.binding.evidence_bundle_id,
          evidenceRecordedAt: result.binding.evidence_recorded_at,
          runId: result.binding.run_id,
          slot: result.binding.slot,
          taskId: result.binding.task_id,
          workerFinalStatus: result.binding.worker_final_status,
          workerOutcome: result.binding.worker_outcome,
        }
      : null,
    blockers: result.blockers.map(normalizeBlocker),
    conflict: result.conflict ? normalizeConflict(result.conflict) : null,
    evidenceBundle: result.evidence_bundle
      ? normalizeWorkerEvidenceBundle(result.evidence_bundle)
      : null,
    nextPhase: result.next_phase,
    nextStep: result.next_step,
    status: result.status,
    transition: result.transition,
    workflowRun: result.workflow_run ? normalizeRun(result.workflow_run) : null,
    workflowRunId: result.workflow_run_id,
  };
}

function toTauriWorkerEvidenceRequest(
  request: RecordAgentQueueWorkflowWorkerEvidenceRequest,
) {
  return {
    action_idempotency_key: request.actionIdempotencyKey ?? null,
    actor_id: request.actorId ?? null,
    changed_files: request.changedFiles ?? [],
    changed_files_summary: request.changedFilesSummary ?? null,
    error_summary: request.errorSummary ?? null,
    finished_at: request.finishedAt ?? null,
    metadata_json: request.metadataJson ?? null,
    outcome: request.outcome,
    run_id: request.runId,
    slot: request.slot,
    source: request.source ?? null,
    summary: request.summary ?? null,
    task_id: request.taskId,
    validation_summary: request.validationSummary ?? null,
    worker_id: request.workerId ?? null,
    workflow_run_id: request.workflowRunId,
    workspace_id: request.workspaceId,
  };
}

function normalizeWorkerEvidenceBundle(
  bundle: TauriAgentQueueWorkerEvidenceBundle,
): AgentQueueWorkerEvidenceBundle {
  return {
    bundleId: bundle.bundle_id,
    changedFiles: bundle.changed_files,
    changedFilesCount: bundle.changed_files_count,
    changedFilesSummary: bundle.changed_files_summary,
    createdAt: bundle.created_at,
    errorSummary: bundle.error_summary,
    executorWidgetId: bundle.executor_widget_id,
    metadataJson: bundle.metadata_json,
    outcome: bundle.outcome,
    runId: bundle.run_id,
    runLinkId: bundle.run_link_id,
    source: bundle.source,
    summary: bundle.summary,
    taskId: bundle.task_id,
    updatedAt: bundle.updated_at,
    validationSummary: bundle.validation_summary,
    workerId: bundle.worker_id,
    workspaceId: bundle.workspace_id,
  };
}

function normalizeMaterializeTaskSlotResult(
  result: TauriAgentQueueWorkflowMaterializeTaskSlotResult,
): AgentQueueWorkflowMaterializeTaskSlotResult {
  return {
    action: result.action ? normalizeAction(result.action) : null,
    binding: result.binding
      ? {
          createTaskActionId: result.binding.create_task_action_id,
          createTaskActionIdempotencyKey:
            result.binding.create_task_action_idempotency_key,
          dependencyEdgeHash: result.binding.dependency_edge_hash,
          dependencySpecHash: result.binding.dependency_spec_hash,
          dependencyTaskIds: result.binding.dependency_task_ids,
          dependsOnSlots: result.binding.depends_on_slots,
          slot: result.binding.slot,
          taskId: result.binding.task_id,
          taskSpecHash: result.binding.task_spec_hash,
        }
      : null,
    blocker: result.blocker ? normalizeBlocker(result.blocker) : null,
    conflict: result.conflict ? normalizeConflict(result.conflict) : null,
    status: result.status,
    task: result.task ? normalizeAgentQueueTask(result.task) : null,
    workflowRun: result.workflow_run ? normalizeRun(result.workflow_run) : null,
  };
}

function normalizeApplyRunSettingsResult(
  result: TauriAgentQueueWorkflowApplyRunSettingsResult,
): AgentQueueWorkflowApplyRunSettingsResult {
  return {
    action: result.action ? normalizeAction(result.action) : null,
    binding: result.binding
      ? {
          executionTargetHash: result.binding.execution_target_hash,
          executionTargetKind: result.binding.execution_target_kind,
          executorWidgetId: result.binding.executor_widget_id,
          providerId: result.binding.provider_id,
          queueOwnerWidgetInstanceId:
            result.binding.queue_owner_widget_instance_id,
          settingsHash: result.binding.settings_hash,
          slot: result.binding.slot,
          taskId: result.binding.task_id,
          updateRunSettingsActionId:
            result.binding.update_run_settings_action_id,
          updateRunSettingsActionIdempotencyKey:
            result.binding.update_run_settings_action_idempotency_key,
        }
      : null,
    blocker: result.blocker ? normalizeBlocker(result.blocker) : null,
    conflict: result.conflict ? normalizeConflict(result.conflict) : null,
    status: result.status,
    task: result.task ? normalizeAgentQueueTask(result.task) : null,
    workflowRun: result.workflow_run ? normalizeRun(result.workflow_run) : null,
  };
}

function toTauriExecutionTarget(
  target: AgentQueueWorkflowExecutionTarget | undefined,
):
  | {
      kind: string;
      provider_id: string;
      queue_owner_widget_instance_id?: string | null;
      executor_widget_id?: string | null;
    }
  | null {
  if (!target) {
    return null;
  }

  if (target.kind === "queue_local") {
    return {
      kind: target.kind,
      provider_id: target.providerId,
      queue_owner_widget_instance_id: target.queueOwnerWidgetInstanceId ?? null,
      executor_widget_id: null,
    };
  }

  return {
    kind: target.kind,
    provider_id: target.providerId,
    queue_owner_widget_instance_id: null,
    executor_widget_id: target.executorWidgetId,
  };
}

function normalizePromoteTaskSlotResult(
  result: TauriAgentQueueWorkflowPromoteTaskSlotResult,
): AgentQueueWorkflowPromoteTaskSlotResult {
  return {
    action: result.action ? normalizeAction(result.action) : null,
    binding: result.binding
      ? {
          promoteActionId: result.binding.promote_action_id,
          promoteActionIdempotencyKey:
            result.binding.promote_action_idempotency_key,
          promoted: result.binding.promoted,
          settingsHash: result.binding.settings_hash,
          slot: result.binding.slot,
          taskId: result.binding.task_id,
          taskSpecHash: result.binding.task_spec_hash,
          taskStatus: result.binding.task_status,
        }
      : null,
    blocker: result.blocker ? normalizeBlocker(result.blocker) : null,
    conflict: result.conflict ? normalizeConflict(result.conflict) : null,
    status: result.status,
    task: result.task ? normalizeAgentQueueTask(result.task) : null,
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

function normalizeResumePlan(
  plan: TauriAgentQueueWorkflowResumePlan,
): AgentQueueWorkflowResumePlan {
  return {
    actions: plan.actions.map(normalizeAction),
    blockers: plan.blockers.map(normalizeResumeBlocker),
    nextPhase: plan.next_phase,
    nextStep: plan.next_step,
    reconciledVariablesJson: plan.reconciled_variables_json,
    reportSummary: plan.report_summary,
    requiredConfirmation: plan.required_confirmation,
    requiredFreshGrant: plan.required_fresh_grant,
    resumeAvailable: plan.resume_available,
    slotReconciliations: plan.slot_reconciliations.map(
      normalizeSlotReconciliation,
    ),
    status: plan.status,
    taskSnapshots: plan.task_snapshots.map(normalizeTaskResumeSnapshot),
    terminalStatus: plan.terminal_status,
    workflowRun: normalizeRun(plan.workflow_run),
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

function normalizeAgentQueueTask(task: TauriAgentQueueTask): AgentQueueTask {
  return {
    approvalPolicy: normalizeApprovalPolicy(task.approval_policy),
    assignedExecutorWidgetId: task.assigned_executor_widget_id,
    codexExecutable: task.codex_executable ?? null,
    context: normalizeAgentQueueTaskContext(task.context_json),
    createdAt: task.created_at,
    dependsOn: normalizeDependsOn(task.depends_on),
    description: task.description,
    executionPolicy: normalizeExecutionPolicy(task.execution_policy),
    executionWorkspace: task.execution_workspace ?? null,
    priority: task.priority,
    prompt: task.prompt,
    queueItemId: task.queue_item_id,
    sandbox: normalizeSandbox(task.sandbox),
    status: task.status,
    title: task.title,
    updatedAt: task.updated_at,
    workspaceId: task.workspace_id,
  };
}

function normalizeDependsOn(dependsOn: string[] | null | undefined): string[] {
  return Array.isArray(dependsOn)
    ? dependsOn.filter((dependencyId) => typeof dependencyId === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAgentQueueTaskContext(
  contextJson: string | null | undefined,
): AgentQueueTaskContext | undefined {
  if (!contextJson) {
    return undefined;
  }

  try {
    const value = JSON.parse(contextJson);
    if (!isRecord(value)) {
      return undefined;
    }

    return {
      attachedKnowledgeRefs: Array.isArray(value.attachedKnowledgeRefs)
        ? (value.attachedKnowledgeRefs as AgentQueueTaskContext["attachedKnowledgeRefs"])
        : [],
      attachedSkillRefs: Array.isArray(value.attachedSkillRefs)
        ? (value.attachedSkillRefs as AgentQueueTaskContext["attachedSkillRefs"])
        : [],
      attachedKnowledgeSnapshots: Array.isArray(value.attachedKnowledgeSnapshots)
        ? (value.attachedKnowledgeSnapshots as AgentQueueTaskContext["attachedKnowledgeSnapshots"])
        : [],
      contextWarnings: Array.isArray(value.contextWarnings)
        ? (value.contextWarnings as AgentQueueTaskContext["contextWarnings"])
        : [],
      contextTokenBudget: isRecord(value.contextTokenBudget)
        ? {
            estimatedTokens:
              typeof value.contextTokenBudget.estimatedTokens === "number"
                ? value.contextTokenBudget.estimatedTokens
                : 0,
            maxTokens:
              typeof value.contextTokenBudget.maxTokens === "number"
                ? value.contextTokenBudget.maxTokens
                : 0,
            overBudget:
              typeof value.contextTokenBudget.overBudget === "boolean"
                ? value.contextTokenBudget.overBudget
                : false,
          }
        : { estimatedTokens: 0, maxTokens: 0, overBudget: false },
      materializedAt:
        typeof value.materializedAt === "string" ? value.materializedAt : null,
    };
  } catch {
    return undefined;
  }
}

function normalizeSandbox(
  sandbox: string | null | undefined,
): AgentQueueTask["sandbox"] {
  if (
    sandbox === "read_only" ||
    sandbox === "workspace_write" ||
    sandbox === "danger_full_access"
  ) {
    return sandbox;
  }

  return null;
}

function normalizeApprovalPolicy(
  approvalPolicy: string | null | undefined,
): AgentQueueTask["approvalPolicy"] {
  if (
    approvalPolicy === "never" ||
    approvalPolicy === "on_request" ||
    approvalPolicy === "untrusted"
  ) {
    return approvalPolicy;
  }

  return null;
}

function normalizeExecutionPolicy(
  executionPolicy: string | null | undefined,
): AgentQueueTaskExecutionPolicy {
  return isAgentQueueTaskExecutionPolicy(executionPolicy)
    ? executionPolicy
    : "manual";
}

function isAgentQueueTaskExecutionPolicy(
  executionPolicy: string | null | undefined,
): executionPolicy is AgentQueueTaskExecutionPolicy {
  return (
    executionPolicy === "manual" ||
    executionPolicy === "auto" ||
    executionPolicy === "after_previous_success"
  );
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

function normalizeResumeBlocker(
  blocker: TauriAgentQueueWorkflowResumeBlocker,
): AgentQueueWorkflowResumeBlocker {
  return {
    blockerCode: blocker.blocker_code,
    blockerMessage: blocker.blocker_message,
    completionDecisionId: blocker.completion_decision_id,
    evidenceBundleId: blocker.evidence_bundle_id,
    failureDecisionId: blocker.failure_decision_id,
    messageId: blocker.message_id,
    missingRequiredField: blocker.missing_required_field,
    runId: blocker.run_id,
    slot: blocker.slot,
    taskId: blocker.task_id,
  };
}

function normalizeSlotReconciliation(
  reconciliation: TauriAgentQueueWorkflowSlotReconciliation,
): AgentQueueWorkflowSlotReconciliation {
  return {
    aggregateDependencyState: reconciliation.aggregate_dependency_state,
    aggregateEvidenceState: reconciliation.aggregate_evidence_state,
    aggregateReviewState: reconciliation.aggregate_review_state,
    aggregateTicketState: reconciliation.aggregate_ticket_state,
    blockerCode: reconciliation.blocker_code,
    completionDecisionExists: reconciliation.completion_decision_exists,
    completionDecisionId: reconciliation.completion_decision_id,
    evidenceBundleId: reconciliation.evidence_bundle_id,
    evidenceExists: reconciliation.evidence_exists,
    executorWidgetId: reconciliation.executor_widget_id,
    failureDecisionExists: reconciliation.failure_decision_exists,
    failureDecisionId: reconciliation.failure_decision_id,
    messageId: reconciliation.message_id,
    reviewMessageExists: reconciliation.review_message_exists,
    reviewMessageStatus: reconciliation.review_message_status,
    runExists: reconciliation.run_exists,
    runId: reconciliation.run_id,
    slot: reconciliation.slot,
    taskExists: reconciliation.task_exists,
    taskId: reconciliation.task_id,
  };
}

function normalizeTaskResumeSnapshot(
  snapshot: TauriAgentQueueWorkflowTaskResumeSnapshot,
): AgentQueueWorkflowTaskResumeSnapshot {
  return {
    commitState: snapshot.commit_state,
    dependencyState: snapshot.dependency_state,
    evidenceState: snapshot.evidence_state,
    latestCompletionDecisionId: snapshot.latest_completion_decision_id,
    latestEvidenceBundleId: snapshot.latest_evidence_bundle_id,
    latestFailureDecisionId: snapshot.latest_failure_decision_id,
    latestReviewMessageId: snapshot.latest_review_message_id,
    latestReviewMessageStatus: snapshot.latest_review_message_status,
    latestRunId: snapshot.latest_run_id,
    latestRunStatus: snapshot.latest_run_status,
    reviewState: snapshot.review_state,
    taskId: snapshot.task_id,
    ticketState: snapshot.ticket_state,
    validationState: snapshot.validation_state,
    workerRunState: snapshot.worker_run_state,
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
