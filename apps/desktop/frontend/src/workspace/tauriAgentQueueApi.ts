import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueItem,
  AgentQueueSnapshot,
  AgentQueueTask,
  CreateAgentQueueItemFromProposalRequest,
  CreateAgentQueueTaskRequest,
  GetAgentQueueSnapshotRequest,
  GetAgentQueueTaskRequest,
  ListAgentQueueTasksRequest,
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
  status: string;
  priority: number;
  created_at: string;
  updated_at: string;
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
      },
    },
  );

  return task ? normalizeAgentQueueTask(task) : null;
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
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}
