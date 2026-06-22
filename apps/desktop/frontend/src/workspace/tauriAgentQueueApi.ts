import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueItem,
  AgentQueueRunnerPolicy,
  AgentQueueRunnerSnapshot,
  AgentQueueSnapshot,
  AgentQueueTask,
  AgentQueueTaskContext,
  AgentQueueTaskRunLinkSummary,
  AgentQueueTaskRunReviewStatus,
  AgentQueueTaskRunSource,
  AgentQueueTaskRunStatus,
  AgentQueueTaskExecutionPolicy,
  AgentQueueWorkerConfig,
  AgentQueueWorkerScopeKind,
  AttachKnowledgeToQueueTaskRequest, AttachSkillToQueueTaskRequest,
  AssignAgentQueueTaskToExecutorRequest,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueItemFromProposalRequest,
  CreateAgentQueueTaskRequest,
  CreateAgentQueueWorkerRequest,
  DeleteAgentQueueTaskRequest,
  DeleteAgentQueueWorkerRequest,
  DetachKnowledgeFromQueueTaskRequest, DetachSkillFromQueueTaskRequest,
  GetAgentQueueSnapshotRequest,
  GetAgentQueueTaskRequest,
  GetAgentQueueTaskLatestRunLinkRequest,
  ListAgentQueueTaskRunLinksRequest,
  ListAgentQueueTasksRequest,
  ListAgentQueueWorkersRequest,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  StartAgentQueueRunnerSessionRequest,
  UpdateAgentQueueTaskRequest,
  UpdateAgentQueueWorkerRequest,
} from "./types";
import type {
  TauriAgentQueueItem,
  TauriAgentQueueRunnerPolicy,
  TauriAgentQueueRunnerSnapshot,
  TauriAgentQueueSnapshot,
  TauriAgentQueueTask,
  TauriAgentQueueTaskRunLink,
  TauriAgentQueueWorker,
  TauriStartAssignedAgentQueueTaskResponse,
} from "./tauriAgentQueueDto";

export async function createAgentQueueItemFromProposal(
  request: CreateAgentQueueItemFromProposalRequest,
): Promise<AgentQueueItem | null> {
  const item = await invoke<TauriAgentQueueItem | null>(
    "create_agent_queue_item_from_proposal",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        source_run_id: request.sourceRunId,
        source_result_id: request.sourceResultId,
      },
    },
  );

  return item ? normalizeAgentQueueItem(item) : null;
}

export async function getAgentQueueSnapshot(
  request: GetAgentQueueSnapshotRequest,
): Promise<AgentQueueSnapshot | null> {
  const snapshot = await invoke<TauriAgentQueueSnapshot | null>(
    "get_agent_queue_snapshot",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
      },
    },
  );

  return snapshot ? normalizeAgentQueueSnapshot(snapshot) : null;
}

export async function createAgentQueueTask(
  request: CreateAgentQueueTaskRequest,
): Promise<AgentQueueTask> {
  const task = await invoke<TauriAgentQueueTask>("create_agent_queue_task", {
    request: {
      workspace_id: request.workspaceId,
      title: request.title,
      description: request.description,
      prompt: request.prompt,
      status: request.status,
      priority: request.priority,
      depends_on: request.dependsOn ?? [],
      execution_policy: request.executionPolicy ?? null,
      execution_workspace: request.executionWorkspace ?? null,
      codex_executable: request.codexExecutable ?? null,
      sandbox: request.sandbox ?? null,
      approval_policy: request.approvalPolicy ?? null,
    },
  });

  return normalizeAgentQueueTask(task);
}

export async function listAgentQueueTasks(
  request: ListAgentQueueTasksRequest,
): Promise<AgentQueueTask[]> {
  const tasks = await invoke<TauriAgentQueueTask[]>("list_agent_queue_tasks", {
    request: {
      workspace_id: request.workspaceId,
    },
  });

  return tasks.map(normalizeAgentQueueTask);
}

export async function getAgentQueueTask(
  request: GetAgentQueueTaskRequest,
): Promise<AgentQueueTask | null> {
  const task = await invoke<TauriAgentQueueTask | null>(
    "get_agent_queue_task",
    {
      request: {
        workspace_id: request.workspaceId,
        queue_item_id: request.queueItemId,
      },
    },
  );

  return task ? normalizeAgentQueueTask(task) : null;
}

export async function updateAgentQueueTask(
  request: UpdateAgentQueueTaskRequest,
): Promise<AgentQueueTask | null> {
  const task = await invoke<TauriAgentQueueTask | null>(
    "update_agent_queue_task",
    {
      request: {
        workspace_id: request.workspaceId,
        queue_item_id: request.queueItemId,
        title: request.title,
        description: request.description,
        prompt: request.prompt,
        status: request.status,
        priority: request.priority,
        depends_on: request.dependsOn ?? null,
        execution_policy: request.executionPolicy ?? null,
        execution_workspace: request.executionWorkspace ?? null,
        codex_executable: request.codexExecutable ?? null,
        sandbox: request.sandbox ?? null,
        approval_policy: request.approvalPolicy ?? null,
      },
    },
  );

  return task ? normalizeAgentQueueTask(task) : null;
}

export async function deleteAgentQueueTask(
  request: DeleteAgentQueueTaskRequest,
): Promise<boolean> {
  return invoke<boolean>("delete_agent_queue_task", {
    request: {
      workspace_id: request.workspaceId,
      queue_item_id: request.queueItemId,
    },
  });
}

export const attachKnowledgeToQueueTask = (request: AttachKnowledgeToQueueTaskRequest): Promise<AgentQueueTask> =>
  invokeQueueTaskContextMutation("attach_knowledge_to_queue_task", request, "knowledge_id", request.knowledgeId);

export const detachKnowledgeFromQueueTask = (request: DetachKnowledgeFromQueueTaskRequest): Promise<AgentQueueTask> =>
  invokeQueueTaskContextMutation("detach_knowledge_from_queue_task", request, "knowledge_id", request.knowledgeId);

export const attachSkillToQueueTask = (request: AttachSkillToQueueTaskRequest): Promise<AgentQueueTask> =>
  invokeQueueTaskContextMutation("attach_skill_to_queue_task", request, "skill_id", request.skillId);

export const detachSkillFromQueueTask = (request: DetachSkillFromQueueTaskRequest): Promise<AgentQueueTask> =>
  invokeQueueTaskContextMutation("detach_skill_from_queue_task", request, "skill_id", request.skillId);

async function invokeQueueTaskContextMutation(
  command: string,
  request: { workspaceId: string; queueItemId: string },
  refKey: "knowledge_id" | "skill_id",
  refId: string,
): Promise<AgentQueueTask> {
  const task = await invoke<TauriAgentQueueTask>(command, {
    request: {
      workspace_id: request.workspaceId,
      queue_item_id: request.queueItemId,
      [refKey]: refId,
    },
  });
  return normalizeAgentQueueTask(task);
}

export async function listAgentQueueWorkers(
  request: ListAgentQueueWorkersRequest,
): Promise<AgentQueueWorkerConfig[]> {
  const workers = await invoke<TauriAgentQueueWorker[]>("list_agent_queue_workers", {
    request: {
      workspace_id: request.workspaceId,
    },
  });

  return workers.map(normalizeAgentQueueWorker);
}

export async function createAgentQueueWorker(
  request: CreateAgentQueueWorkerRequest,
): Promise<AgentQueueWorkerConfig> {
  const worker = await invoke<TauriAgentQueueWorker>("create_agent_queue_worker", {
    request: {
      workspace_id: request.workspaceId,
      worker_id: request.workerId ?? null,
      name: request.name,
      enabled: request.enabled,
      scope_kind: request.scopeKind,
      queue_tag_id: request.queueTagId ?? null,
      queue_tag_name: request.queueTagName ?? null,
      display_order: request.displayOrder,
    },
  });

  return normalizeAgentQueueWorker(worker);
}

export async function updateAgentQueueWorker(
  request: UpdateAgentQueueWorkerRequest,
): Promise<AgentQueueWorkerConfig | null> {
  const worker = await invoke<TauriAgentQueueWorker | null>(
    "update_agent_queue_worker",
    {
      request: {
        workspace_id: request.workspaceId,
        worker_id: request.workerId,
        name: request.name,
        enabled: request.enabled,
        scope_kind: request.scopeKind,
        queue_tag_id: request.queueTagId ?? null,
        queue_tag_name: request.queueTagName ?? null,
        display_order: request.displayOrder,
      },
    },
  );

  return worker ? normalizeAgentQueueWorker(worker) : null;
}

export async function deleteAgentQueueWorker(
  request: DeleteAgentQueueWorkerRequest,
): Promise<boolean> {
  return invoke<boolean>("delete_agent_queue_worker", {
    request: {
      workspace_id: request.workspaceId,
      worker_id: request.workerId,
    },
  });
}

export async function assignAgentQueueTaskToExecutor(
  request: AssignAgentQueueTaskToExecutorRequest,
): Promise<AgentQueueTask> {
  const task = await invoke<TauriAgentQueueTask>(
    "assign_agent_queue_task_to_executor",
    {
      request: {
        workspace_id: request.workspaceId,
        queue_item_id: request.queueItemId,
        executor_widget_instance_id: request.executorWidgetInstanceId,
      },
    },
  );

  return normalizeAgentQueueTask(task);
}

export async function clearAgentQueueTaskAssignment(
  request: ClearAgentQueueTaskAssignmentRequest,
): Promise<AgentQueueTask> {
  const task = await invoke<TauriAgentQueueTask>(
    "clear_agent_queue_task_assignment",
    {
      request: {
        workspace_id: request.workspaceId,
        queue_item_id: request.queueItemId,
      },
    },
  );

  return normalizeAgentQueueTask(task);
}

export async function startAssignedAgentQueueTask(
  request: StartAssignedAgentQueueTaskRequest,
): Promise<StartAssignedAgentQueueTaskResponse> {
  const response = await invoke<TauriStartAssignedAgentQueueTaskResponse>(
    "start_assigned_agent_queue_task",
    {
      request: {
        workspace_id: request.workspaceId,
        queue_item_id: request.queueItemId,
        queue_owner_widget_instance_id: request.queueOwnerWidgetInstanceId ?? null,
        codex_executable: request.codexExecutable,
        repo_root: request.repoRoot,
        sandbox: request.sandbox,
        approval_policy: request.approvalPolicy,
        timeout_ms: request.timeoutMs ?? null,
        stdout_cap_bytes: request.stdoutCapBytes ?? null,
        stderr_cap_bytes: request.stderrCapBytes ?? null,
        workflow_start_context: request.workflowStartContext
          ? {
              workflow_run_id: request.workflowStartContext.workflowRunId,
              workflow_action_id: request.workflowStartContext.workflowActionId ?? null,
              action_idempotency_key:
                request.workflowStartContext.actionIdempotencyKey ?? null,
              task_id: request.workflowStartContext.taskId,
              executor_widget_id: request.workflowStartContext.executorWidgetId,
              settings_hash: request.workflowStartContext.settingsHash,
              expected_queue_control_version:
                request.workflowStartContext.expectedQueueControlVersion ?? null,
              actor_id: request.workflowStartContext.actorId ?? null,
              confirmation_token: request.workflowStartContext.confirmationToken ?? null,
            }
          : null,
      },
    },
  );

  return normalizeStartAssignedAgentQueueTaskResponse(response);
}

export async function getAgentQueueTaskLatestRunLink(
  request: GetAgentQueueTaskLatestRunLinkRequest,
): Promise<AgentQueueTaskRunLinkSummary | null> {
  const link = await invoke<TauriAgentQueueTaskRunLink | null>(
    "get_agent_queue_task_latest_run_link",
    {
      request: {
        workspace_id: request.workspaceId,
        queue_item_id: request.queueItemId,
      },
    },
  );

  return link ? normalizeAgentQueueTaskRunLink(link) : null;
}

export async function listAgentQueueTaskRunLinks(
  request: ListAgentQueueTaskRunLinksRequest,
): Promise<AgentQueueTaskRunLinkSummary[]> {
  const links = await invoke<TauriAgentQueueTaskRunLink[]>(
    "list_agent_queue_task_run_links",
    {
      request: {
        workspace_id: request.workspaceId,
        queue_item_id: request.queueItemId,
      },
    },
  );

  return links.map(normalizeAgentQueueTaskRunLink);
}

export async function startAgentQueueRunnerSession(
  request: StartAgentQueueRunnerSessionRequest,
): Promise<AgentQueueRunnerSnapshot> {
  const snapshot = await invoke<TauriAgentQueueRunnerSnapshot>(
    "start_agent_queue_runner_session",
    {
      request: {
        workspace_id: request.workspaceId,
        executor_widget_instance_id: request.executorWidgetInstanceId,
        codex_executable: request.codexExecutable,
        repo_root: request.repoRoot,
        sandbox: request.sandbox,
        approval_policy: request.approvalPolicy,
        timeout_ms: request.timeoutMs ?? null,
        stdout_cap_bytes: request.stdoutCapBytes ?? null,
        stderr_cap_bytes: request.stderrCapBytes ?? null,
        policy: request.policy
          ? {
              stop_on_failure: request.policy.stopOnFailure ?? null,
              stop_on_review_needed: request.policy.stopOnReviewNeeded ?? null,
              stop_on_cancel: request.policy.stopOnCancel ?? null,
            }
          : null,
      },
    },
  );

  return normalizeAgentQueueRunnerSnapshot(snapshot);
}

export async function stopAgentQueueRunnerSession(): Promise<AgentQueueRunnerSnapshot> {
  const snapshot = await invoke<TauriAgentQueueRunnerSnapshot>(
    "stop_agent_queue_runner_session",
  );

  return normalizeAgentQueueRunnerSnapshot(snapshot);
}

export async function getAgentQueueRunnerSnapshot(): Promise<AgentQueueRunnerSnapshot> {
  const snapshot = await invoke<TauriAgentQueueRunnerSnapshot>(
    "get_agent_queue_runner_snapshot",
  );

  return normalizeAgentQueueRunnerSnapshot(snapshot);
}

function normalizeAgentQueueSnapshot(
  snapshot: TauriAgentQueueSnapshot,
): AgentQueueSnapshot {
  return {
    workspaceId: snapshot.workspace_id,
    workbenchId: snapshot.workbench_id,
    items: snapshot.items.map(normalizeAgentQueueItem),
  };
}

function normalizeAgentQueueItem(item: TauriAgentQueueItem): AgentQueueItem {
  return {
    id: item.id,
    workspaceId: item.workspace_id,
    workbenchId: item.workbench_id,
    sourceRunId: item.source_run_id,
    sourceResultId: item.source_result_id,
    sourceWidgetInstanceId: item.source_widget_instance_id,
    sourceWidgetTitle: item.source_widget_title,
    title: item.title,
    status: item.status,
    decisionStatus: item.decision_status,
    promptSummary: item.prompt_summary,
    proposalSummary: item.proposal_summary,
    approvedContextSummary: item.approved_context_summary,
    proposedPlan: item.proposed_plan,
    proposedActions: item.proposed_actions.map((action) => ({
      title: action.title,
      description: action.description,
      status: action.status,
      executed: action.executed,
    })),
    proposalOnlyMock: item.proposal_only_mock,
    noLlmCalled: item.no_llm_called,
    noToolsExecuted: item.no_tools_executed,
    noMutationsPerformed: item.no_mutations_performed,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    payloadJson: item.payload_json,
  };
}

function normalizeAgentQueueTask(task: TauriAgentQueueTask): AgentQueueTask {
  return {
    queueItemId: task.queue_item_id,
    workspaceId: task.workspace_id,
    title: task.title,
    description: task.description,
    prompt: task.prompt,
    status: task.status,
    priority: task.priority,
    dependsOn: normalizeDependsOn(task.depends_on),
    executionPolicy: normalizeExecutionPolicy(task.execution_policy),
    executionWorkspace: task.execution_workspace ?? null,
    codexExecutable: task.codex_executable ?? null,
    sandbox: normalizeSandbox(task.sandbox),
    approvalPolicy: normalizeApprovalPolicy(task.approval_policy),
    context: normalizeAgentQueueTaskContext(task.context_json),
    assignedExecutorWidgetId: task.assigned_executor_widget_id,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

function normalizeDependsOn(dependsOn: string[] | null | undefined): string[] {
  return Array.isArray(dependsOn)
    ? dependsOn.filter((dependencyId) => typeof dependencyId === "string")
    : [];
}

function normalizeAgentQueueTaskContext(
  contextJson: string | null | undefined,
): AgentQueueTaskContext | undefined {
  if (!contextJson) {
    return undefined;
  }

  try {
    const value = JSON.parse(contextJson) as unknown;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function normalizeAgentQueueWorker(
  worker: TauriAgentQueueWorker,
): AgentQueueWorkerConfig {
  return {
    workerId: worker.worker_id,
    workspaceId: worker.workspace_id,
    name: worker.name,
    enabled: worker.enabled,
    scopeKind: normalizeWorkerScopeKind(worker.scope_kind),
    queueTagId: worker.queue_tag_id,
    queueTagName: worker.queue_tag_name,
    displayOrder: worker.display_order,
    createdAt: worker.created_at,
    updatedAt: worker.updated_at,
  };
}

function normalizeWorkerScopeKind(scopeKind: string): AgentQueueWorkerScopeKind {
  return scopeKind === "queue_tag" ? "queue_tag" : "all";
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

function normalizeStartAssignedAgentQueueTaskResponse(
  response: TauriStartAssignedAgentQueueTaskResponse,
): StartAssignedAgentQueueTaskResponse {
  return {
    workspaceId: response.workspace_id,
    queueItemId: response.queue_item_id,
    workbenchId: response.workbench_id,
    executorWidgetInstanceId: response.executor_widget_instance_id,
    runId: response.run_id,
    status: response.status,
    workflowRunId: response.workflow_run_id,
    workflowActionId: response.workflow_action_id,
    actionIdempotencyKey: response.action_idempotency_key,
    settingsHash: response.settings_hash,
    currentRunState: response.current_run_state,
    blocker: response.blocker
      ? {
          blockerCode: response.blocker.blocker_code,
          blockerMessage: response.blocker.blocker_message,
          taskId: response.blocker.task_id,
          executorWidgetId: response.blocker.executor_widget_id,
          runId: response.blocker.run_id,
          workflowRunId: response.blocker.workflow_run_id,
          workflowActionId: response.blocker.workflow_action_id,
          actionIdempotencyKey: response.blocker.action_idempotency_key,
          currentRunState: response.blocker.current_run_state,
          expectedQueueControlVersion:
            response.blocker.expected_queue_control_version,
          actualQueueControlVersion: response.blocker.actual_queue_control_version,
          expectedSettingsHash: response.blocker.expected_settings_hash,
          actualSettingsHash: response.blocker.actual_settings_hash,
          missingRequiredField: response.blocker.missing_required_field,
        }
      : null,
  };
}

function normalizeAgentQueueTaskRunLink(
  link: TauriAgentQueueTaskRunLink,
): AgentQueueTaskRunLinkSummary {
  return {
    linkId: link.link_id,
    workspaceId: link.workspace_id,
    queueTaskId: link.queue_task_id,
    executorWidgetId: link.executor_widget_id,
    directWorkRunId: link.direct_work_run_id,
    source: normalizeRunSource(link.source),
    status: normalizeRunStatus(link.status),
    startedAt: link.started_at,
    completedAt: link.completed_at,
    validationStatus: link.validation_status,
    reviewStatus: normalizeReviewStatus(link.review_status),
    createdAt: link.created_at,
    updatedAt: link.updated_at,
  };
}

function normalizeRunSource(source: string): AgentQueueTaskRunSource {
  if (
    source === "manual" ||
    source === "autorun" ||
    source === "sequential_runner" ||
    source === "unknown"
  ) {
    return source;
  }

  return "unknown";
}

function normalizeRunStatus(status: string): AgentQueueTaskRunStatus {
  if (
    status === "running" ||
    status === "completed" ||
    status === "failed" ||
    status === "timed_out" ||
    status === "cancelled" ||
    status === "review_needed" ||
    status === "unknown"
  ) {
    return status;
  }

  return "unknown";
}

function normalizeReviewStatus(
  reviewStatus: string | null,
): AgentQueueTaskRunReviewStatus | null {
  if (reviewStatus === "review_needed" || reviewStatus === "unknown") {
    return reviewStatus;
  }

  return null;
}

function normalizeAgentQueueRunnerSnapshot(
  snapshot: TauriAgentQueueRunnerSnapshot,
): AgentQueueRunnerSnapshot {
  return {
    sessionId: snapshot.session_id,
    status: snapshot.status,
    isActive: snapshot.is_active,
    isSessionOnly: snapshot.is_session_only,
    policy: normalizeAgentQueueRunnerPolicy(snapshot.policy),
    activeQueueItemId: snapshot.active_queue_item_id,
    waitingRunId: snapshot.waiting_run_id,
    finalRunStatus: snapshot.final_run_status,
    lastReconciledAt: snapshot.last_reconciled_at,
    stopReason: snapshot.stop_reason,
  };
}

function normalizeAgentQueueRunnerPolicy(
  policy: TauriAgentQueueRunnerPolicy,
): AgentQueueRunnerPolicy {
  return {
    requireOperatorStart: policy.require_operator_start,
    oneTaskAtATime: policy.one_task_at_a_time,
    stopOnFailure: policy.stop_on_failure,
    stopOnReviewNeeded: policy.stop_on_review_needed,
    stopOnCancel: policy.stop_on_cancel,
    allowHiddenExecution: policy.allow_hidden_execution,
    durableResume: policy.durable_resume,
  };
}
