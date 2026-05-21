import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueItem,
  AgentQueueRunnerPolicy,
  AgentQueueRunnerSnapshot,
  AgentQueueSnapshot,
  AgentQueueTask,
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskStatus,
  AssignAgentQueueTaskToExecutorRequest,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueItemFromProposalRequest,
  CreateAgentQueueTaskRequest,
  DeleteAgentQueueTaskRequest,
  GetAgentQueueSnapshotRequest,
  GetAgentQueueTaskRequest,
  ListAgentQueueTasksRequest,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  StartAgentQueueRunnerSessionRequest,
  UpdateAgentQueueTaskRequest,
} from "./types";

type TauriAgentQueueSnapshot = {
  workspace_id: string;
  workbench_id: string;
  items: TauriAgentQueueItem[];
};

type TauriAgentQueueItem = {
  id: string;
  workspace_id: string;
  workbench_id: string;
  source_run_id: string;
  source_result_id: string;
  source_widget_instance_id: string;
  source_widget_title: string;
  title: string;
  status: string;
  decision_status: string;
  prompt_summary: string;
  proposal_summary: string;
  approved_context_summary: string;
  proposed_plan: string[];
  proposed_actions: TauriAgentQueueProposalAction[];
  proposal_only_mock: boolean;
  no_llm_called: boolean;
  no_tools_executed: boolean;
  no_mutations_performed: boolean;
  created_at: string;
  updated_at: string;
  payload_json: string;
};

type TauriAgentQueueProposalAction = {
  title: string;
  description: string;
  status: string;
  executed: boolean;
};

type TauriAgentQueueTask = {
  queue_item_id: string;
  workspace_id: string;
  title: string;
  description: string;
  prompt: string;
  status: AgentQueueTaskStatus;
  priority: number;
  execution_policy?: AgentQueueTaskExecutionPolicy | null;
  assigned_executor_widget_id: string | null;
  created_at: string;
  updated_at: string;
};

type TauriStartAssignedAgentQueueTaskResponse = {
  workspace_id: string;
  queue_item_id: string;
  workbench_id: string;
  executor_widget_instance_id: string;
  run_id: string;
  status: string;
};

type TauriAgentQueueRunnerPolicy = {
  require_operator_start: boolean;
  one_task_at_a_time: boolean;
  stop_on_failure: boolean;
  stop_on_review_needed: boolean;
  stop_on_cancel: boolean;
  allow_hidden_execution: boolean;
  durable_resume: boolean;
};

type TauriAgentQueueRunnerSnapshot = {
  session_id: string | null;
  status: string;
  is_active: boolean;
  is_session_only: boolean;
  policy: TauriAgentQueueRunnerPolicy;
  active_queue_item_id: string | null;
  waiting_run_id: string | null;
  final_run_status: string | null;
  last_reconciled_at: string | null;
  stop_reason: string | null;
};

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
      execution_policy: request.executionPolicy ?? null,
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
        execution_policy: request.executionPolicy ?? null,
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
        codex_executable: request.codexExecutable,
        repo_root: request.repoRoot,
        sandbox: request.sandbox,
        approval_policy: request.approvalPolicy,
        timeout_ms: request.timeoutMs ?? null,
        stdout_cap_bytes: request.stdoutCapBytes ?? null,
        stderr_cap_bytes: request.stderrCapBytes ?? null,
      },
    },
  );

  return normalizeStartAssignedAgentQueueTaskResponse(response);
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
    executionPolicy: normalizeExecutionPolicy(task.execution_policy),
    assignedExecutorWidgetId: task.assigned_executor_widget_id,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
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
  };
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
