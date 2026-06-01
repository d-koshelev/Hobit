import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  AgentQueueWorkerConfig,
  AssignAgentQueueTaskToExecutorRequest,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueTaskRequest,
  CreateAgentQueueWorkerRequest,
  DeleteAgentQueueTaskRequest,
  DeleteAgentQueueWorkerRequest,
  StartAgentQueueRunnerSessionRequest,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  UpdateAgentQueueTaskRequest,
  UpdateAgentQueueWorkerRequest,
} from "../../workspace/types";
import type { DirectWorkRunHandoffInput } from "../types";
import {
  flushHookEffects,
  renderHook,
} from "../test-utils/renderHook";
import { useAgentQueueController } from "./useAgentQueueController";

type AgentQueueControllerOptions = Parameters<
  typeof useAgentQueueController
>[0];

export { flushHookEffects };

export function renderQueueController(
  harness: ReturnType<typeof createQueueHarness>,
) {
  return renderHook(
    () => useAgentQueueController(harness.options),
    undefined,
  );
}

export function createQueueHarness(initialTasks: AgentQueueTask[]) {
  const tasks = new Map<string, AgentQueueTask>(
    initialTasks.map((task) => [task.queueItemId, task]),
  );
  const workers = new Map<string, AgentQueueWorkerConfig>();
  const createRequests: Array<Omit<CreateAgentQueueTaskRequest, "workspaceId">> =
    [];
  const updateRequests: Array<Omit<UpdateAgentQueueTaskRequest, "workspaceId">> =
    [];
  const assignRequests: Array<
    Omit<AssignAgentQueueTaskToExecutorRequest, "workspaceId">
  > = [];
  const clearRequests: Array<
    Omit<ClearAgentQueueTaskAssignmentRequest, "workspaceId">
  > = [];
  const startRequests: Array<
    Omit<StartAssignedAgentQueueTaskRequest, "workspaceId">
  > = [];
  const autorunStartRequests: Array<
    Omit<StartAgentQueueRunnerSessionRequest, "workspaceId">
  > = [];
  const deleteRequests: Array<Omit<DeleteAgentQueueTaskRequest, "workspaceId">> =
    [];
  const createWorkerRequests: Array<
    Omit<CreateAgentQueueWorkerRequest, "workspaceId">
  > = [];
  const updateWorkerRequests: Array<
    Omit<UpdateAgentQueueWorkerRequest, "workspaceId">
  > = [];
  const deleteWorkerRequests: Array<
    Omit<DeleteAgentQueueWorkerRequest, "workspaceId">
  > = [];
  const getRequests: string[] = [];
  const handoffs: DirectWorkRunHandoffInput[] = [];
  const runLinkRequests: string[] = [];
  let listRequests = 0;
  let autorunSnapshotRequests = 0;
  const options: AgentQueueControllerOptions = {
    agentExecutorSlots: [
      {
        label: "Local executor 1",
        widgetInstanceId: "executor-1",
      },
    ],
    onAssignAgentQueueTaskToExecutor: async (
      request: Omit<AssignAgentQueueTaskToExecutorRequest, "workspaceId">,
    ) => {
      assignRequests.push(request);
      const task = tasks.get(request.queueItemId);

      if (!task) {
        throw new Error("Queue task not found.");
      }

      const updatedTask = {
        ...task,
        assignedExecutorWidgetId: request.executorWidgetInstanceId,
        updatedAt: "2026-05-20T10:01:00.000Z",
      };
      tasks.set(updatedTask.queueItemId, updatedTask);

      return updatedTask;
    },
    onCreateAgentQueueTask: async (
      request: Omit<CreateAgentQueueTaskRequest, "workspaceId">,
    ) => {
      createRequests.push(request);
      const createdTask = queueTask({
        description: request.description,
        dependsOn: request.dependsOn ?? [],
        executionPolicy: request.executionPolicy ?? "manual",
        itemType: request.itemType,
        priority: request.priority,
        prompt: request.prompt,
        queueTagId: request.queueTagId,
        queueTagName: request.queueTagName,
        queueItemId: `queue-${tasks.size + 1}`,
        status: request.status,
        title: request.title,
        validationStatus: request.validationStatus,
      });
      tasks.set(createdTask.queueItemId, createdTask);

      return createdTask;
    },
    onDeleteAgentQueueTask: async (
      request: Omit<DeleteAgentQueueTaskRequest, "workspaceId">,
    ) => {
      deleteRequests.push(request);
      return tasks.delete(request.queueItemId);
    },
    onListAgentQueueWorkers: async () => Array.from(workers.values()),
    onCreateAgentQueueWorker: async (request) => {
      createWorkerRequests.push(request);
      const worker = agentQueueWorker({
        displayOrder: request.displayOrder,
        enabled: request.enabled,
        name: request.name,
        queueTagId: request.queueTagId ?? null,
        queueTagName: request.queueTagName ?? null,
        scopeKind: request.scopeKind,
        workerId: request.workerId ?? `worker-${workers.size + 1}`,
      });
      workers.set(worker.workerId, worker);
      return worker;
    },
    onUpdateAgentQueueWorker: async (request) => {
      updateWorkerRequests.push(request);
      const worker = workers.get(request.workerId);
      if (!worker) {
        return null;
      }
      const updatedWorker = {
        ...worker,
        displayOrder: request.displayOrder,
        enabled: request.enabled,
        name: request.name,
        queueTagId: request.queueTagId ?? null,
        queueTagName: request.queueTagName ?? null,
        scopeKind: request.scopeKind,
        updatedAt: "2026-05-20T10:01:00.000Z",
      };
      workers.set(updatedWorker.workerId, updatedWorker);
      return updatedWorker;
    },
    onDeleteAgentQueueWorker: async (request) => {
      deleteWorkerRequests.push(request);
      return workers.delete(request.workerId);
    },
    onClearAgentQueueTaskAssignment: async (request) => {
      clearRequests.push(request);
      const task = tasks.get(request.queueItemId);

      if (!task) {
        throw new Error("Queue task not found.");
      }

      const updatedTask = {
        ...task,
        assignedExecutorWidgetId: null,
        updatedAt: "2026-05-20T10:01:00.000Z",
      };
      tasks.set(updatedTask.queueItemId, updatedTask);

      return updatedTask;
    },
    onDirectWorkRunHandoffStarted: (handoff) => {
      handoffs.push(handoff);
    },
    onGetAgentQueueTask: async (queueItemId: string) => {
      getRequests.push(queueItemId);
      return tasks.get(queueItemId) ?? null;
    },
    onListAgentQueueTasks: async () => {
      listRequests += 1;
      return Array.from(tasks.values());
    },
    onStartAssignedAgentQueueTask: async (
      request: Omit<StartAssignedAgentQueueTaskRequest, "workspaceId">,
    ): Promise<StartAssignedAgentQueueTaskResponse> => {
      startRequests.push(request);
      const task = tasks.get(request.queueItemId);
      const executorWidgetInstanceId =
        request.queueOwnerWidgetInstanceId ?? task?.assignedExecutorWidgetId;

      if (!task || !executorWidgetInstanceId) {
        throw new Error("Queue task must be assigned before start.");
      }

      tasks.set(task.queueItemId, {
        ...task,
        status: "running",
        updatedAt: "2026-05-20T10:01:00.000Z",
      });

      return {
        executorWidgetInstanceId,
        queueItemId: task.queueItemId,
        runId: `run-${startRequests.length.toString()}`,
        status: "running",
        workbenchId: "workbench-1",
        workspaceId: task.workspaceId,
      };
    },
    onUpdateAgentQueueTask: async (
      request: Omit<UpdateAgentQueueTaskRequest, "workspaceId">,
    ) => {
      updateRequests.push(request);
      const task = tasks.get(request.queueItemId);

      if (!task) {
        return null;
      }

      const updatedTask: AgentQueueTask = {
        ...task,
        description: request.description,
        dependsOn: request.dependsOn ?? task.dependsOn ?? [],
        executionPolicy:
          request.executionPolicy ?? task.executionPolicy ?? "manual",
        itemType: request.itemType ?? task.itemType,
        priority: request.priority,
        prompt: request.prompt,
        queueTagId: request.queueTagId ?? task.queueTagId,
        queueTagName: request.queueTagName ?? task.queueTagName,
        status: request.status,
        title: request.title,
        validationStatus: request.validationStatus ?? task.validationStatus,
        updatedAt: "2026-05-20T10:01:00.000Z",
      };
      tasks.set(updatedTask.queueItemId, updatedTask);

      return updatedTask;
    },
    queueTaskAutoRefreshRequest: null,
  };

  return {
    assignRequests,
    autorunStartRequests,
    get autorunSnapshotRequests() {
      return autorunSnapshotRequests;
    },
    set autorunSnapshotRequests(value: number) {
      autorunSnapshotRequests = value;
    },
    clearRequests,
    createRequests,
    deleteRequests,
    createWorkerRequests,
    deleteWorkerRequests,
    get getRequests() {
      return getRequests;
    },
    handoffs,
    get listRequests() {
      return listRequests;
    },
    options,
    replaceWorker(worker: AgentQueueWorkerConfig) {
      workers.set(worker.workerId, worker);
    },
    replaceTask(task: AgentQueueTask) {
      tasks.set(task.queueItemId, task);
    },
    startRequests,
    runLinkRequests,
    updateRequests,
    updateWorkerRequests,
  };
}

export function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-20T10:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: "",
    queueItemId: "queue-1",
    status: "draft",
    title: "Queue task",
    updatedAt: "2026-05-20T10:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

export function agentQueueWorker(
  overrides: Partial<AgentQueueWorkerConfig> = {},
): AgentQueueWorkerConfig {
  return {
    createdAt: "2026-05-20T10:00:00.000Z",
    displayOrder: 0,
    enabled: true,
    name: "Local executor 1",
    queueTagId: null,
    queueTagName: null,
    scopeKind: "all",
    updatedAt: "2026-05-20T10:00:00.000Z",
    workerId: "executor-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

export function queueRunLink(
  overrides: Partial<AgentQueueTaskRunLinkSummary> = {},
): AgentQueueTaskRunLinkSummary {
  const link: AgentQueueTaskRunLinkSummary = {
    completedAt: null,
    createdAt: "2026-05-20T10:01:00.000Z",
    directWorkRunId: "run-1",
    executorWidgetId: "executor-1",
    linkId: "link-1",
    queueTaskId: "queue-1",
    reviewStatus: "unknown",
    source: "manual",
    startedAt: "2026-05-20T10:01:00.000Z",
    status: "running",
    updatedAt: "2026-05-20T10:01:00.000Z",
    validationStatus: null,
    workspaceId: "workspace-1",
  };

  return {
    ...link,
    ...overrides,
  } as AgentQueueTaskRunLinkSummary;
}

export function queueRunnerSnapshot(
  overrides: Partial<AgentQueueRunnerSnapshot> = {},
): AgentQueueRunnerSnapshot {
  return {
    activeQueueItemId: null,
    finalRunStatus: null,
    isActive: false,
    isSessionOnly: true,
    lastReconciledAt: null,
    policy: {
      allowHiddenExecution: false,
      durableResume: false,
      oneTaskAtATime: true,
      requireOperatorStart: true,
      stopOnCancel: true,
      stopOnFailure: true,
      stopOnReviewNeeded: true,
    },
    sessionId: null,
    status: "idle",
    stopReason: null,
    waitingRunId: null,
    ...overrides,
  };
}

export async function flushControllerLoad() {
  await flushHookEffects();
  await flushHookEffects();
}
