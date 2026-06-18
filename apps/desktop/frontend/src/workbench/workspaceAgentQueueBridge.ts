import type {
  AgentQueueWidgetApi,
  QueueCreateItemRequest,
  QueueGetSnapshotRequest,
  QueueUpdateItemRequest,
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import type { AgentQueueTaskRunSettingsDefaults } from "./queue/agentQueueRunSettingsDefaults";
import type {
  AgentQueueTask,
  AgentQueueItemAggregate,
  AgentQueueReviewCommandResult,
  AckAgentQueueReviewMessageRequest,
  CreateAgentQueueReviewMessageRequest,
  GetAgentQueueItemAggregateRequest,
  ListAgentQueueItemAggregatesRequest,
  AttachKnowledgeToQueueTaskRequest,
  AttachSkillToQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
} from "../workspace/types";
import type { AgentExecutorSlot } from "./types";

export type WorkspaceAgentQueueAutonomousActionName =
  | "queue.runAutonomousQueue"
  | "queue.stopAutonomousQueueAfterCurrent";

export type WorkspaceAgentQueueAutonomousActionResult = {
  action: WorkspaceAgentQueueAutonomousActionName;
  error?: {
    code: string;
    message: string;
  };
  message: string;
  ok: boolean;
  status?: string;
};

export type WorkspaceQueueAutonomousActions = {
  runAutonomousQueue: () => Promise<WorkspaceAgentQueueAutonomousActionResult>;
  stopAutonomousQueueAfterCurrent: () => Promise<WorkspaceAgentQueueAutonomousActionResult>;
};

export type WorkspaceAgentQueueEnableRequest = {
  dryRun: boolean;
};

export type WorkspaceAgentQueueEnableResult = {
  blockerReasons?: string[];
  didAutoRunWorkers: false;
  didStartWorkers: false;
  globalExecutionState?: string;
  message: string;
  ok: boolean;
  queueEnabled: boolean;
  status: "blocked" | "enabled" | "preview" | "unavailable";
};

export type WorkspaceAgentQueueStartRunRequest = {
  dryRun: boolean;
  executorWidgetId: string;
  queueId?: string;
  taskId: string;
};

export type WorkspaceAgentQueueStartRunResult = {
  blockerReasons?: string[];
  executorWidgetId?: string;
  message: string;
  ok: boolean;
  response?: StartAssignedAgentQueueTaskResponse;
  status:
    | "blocked"
    | "confirmation_required"
    | "preview"
    | "started"
    | "unavailable";
};

export type WorkspaceQueueControlActions = {
  enableQueue: (
    request: WorkspaceAgentQueueEnableRequest,
  ) => Promise<WorkspaceAgentQueueEnableResult>;
  getAvailableExecutorTargets?: () => AgentExecutorSlot[];
  startQueueLinkedRun: (
    request: WorkspaceAgentQueueStartRunRequest,
  ) => Promise<WorkspaceAgentQueueStartRunResult>;
};

export type WorkspaceQueueStateAccess = {
  getCurrentWorkspaceRoot?: () => string | null;
  getRunSettingsDefaults: () => AgentQueueTaskRunSettingsDefaults;
  refreshAfterMutation: (queueItemId: string) => Promise<void> | void;
};

export type WorkspaceQueueContextActions = {
  attachKnowledgeToQueueTask: (
    request: AttachKnowledgeToQueueTaskRequest,
  ) => Promise<AgentQueueTask>;
  attachSkillToQueueTask: (
    request: AttachSkillToQueueTaskRequest,
  ) => Promise<AgentQueueTask>;
};

export type WorkspaceQueueAggregateReadActions = {
  getAgentQueueItemAggregate: (
    request: GetAgentQueueItemAggregateRequest,
  ) => Promise<AgentQueueItemAggregate | null>;
  listAgentQueueItemAggregates: (
    request: ListAgentQueueItemAggregatesRequest,
  ) => Promise<AgentQueueItemAggregate[]>;
};

export type WorkspaceQueueReviewActions = {
  ackAgentQueueReviewMessage: (
    request: AckAgentQueueReviewMessageRequest,
  ) => Promise<AgentQueueReviewCommandResult>;
  createAgentQueueReviewMessage: (
    request: CreateAgentQueueReviewMessageRequest,
  ) => Promise<AgentQueueReviewCommandResult>;
};

export type WorkspaceAgentQueueBridge = {
  attachKnowledgeToQueueTask?: (
    request: Omit<AttachKnowledgeToQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  attachSkillToQueueTask?: (
    request: Omit<AttachSkillToQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  createItem: (
    request: Omit<QueueCreateItemRequest, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
  getCurrentWorkspaceRoot?: () => string | null;
  getRunSettingsDefaults?: () => AgentQueueTaskRunSettingsDefaults | null;
  getAvailableExecutorTargets?: () => AgentExecutorSlot[];
  getSnapshot: (
    request?: Omit<Partial<QueueGetSnapshotRequest>, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetSnapshot>>;
  getItemAggregate?: (
    request: Omit<GetAgentQueueItemAggregateRequest, "workspaceId">,
  ) => Promise<AgentQueueItemAggregate | null>;
  listItemAggregates?: () => Promise<AgentQueueItemAggregate[]>;
  ackReviewMessage?: (
    request: Omit<AckAgentQueueReviewMessageRequest, "workspaceId">,
  ) => Promise<AgentQueueReviewCommandResult>;
  createReviewMessage?: (
    request: Omit<CreateAgentQueueReviewMessageRequest, "workspaceId">,
  ) => Promise<AgentQueueReviewCommandResult>;
  updateItem: (
    request: Omit<QueueUpdateItemRequest, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
  runAutonomousQueue?: () => Promise<WorkspaceAgentQueueAutonomousActionResult>;
  enableQueue?: (
    request: WorkspaceAgentQueueEnableRequest,
  ) => Promise<WorkspaceAgentQueueEnableResult>;
  startQueueLinkedRun?: (
    request: WorkspaceAgentQueueStartRunRequest,
  ) => Promise<WorkspaceAgentQueueStartRunResult>;
  stopAutonomousQueueAfterCurrent?: () => Promise<WorkspaceAgentQueueAutonomousActionResult>;
};

export function createWorkspaceAgentQueueBridge({
  autonomousActions,
  aggregateReadActions,
  contextActions,
  controlActions,
  queueApi,
  reviewActions,
  queueState,
  workspaceId,
}: {
  autonomousActions?: WorkspaceQueueAutonomousActions | null;
  aggregateReadActions?: WorkspaceQueueAggregateReadActions | null;
  contextActions?: WorkspaceQueueContextActions | null;
  controlActions?: WorkspaceQueueControlActions | null;
  queueApi: AgentQueueWidgetApi;
  reviewActions?: WorkspaceQueueReviewActions | null;
  queueState?: WorkspaceQueueStateAccess | null;
  workspaceId: string;
}): WorkspaceAgentQueueBridge {
  return {
    attachKnowledgeToQueueTask: contextActions
      ? async (request) => {
          const task = await contextActions.attachKnowledgeToQueueTask({
            ...request,
            workspaceId,
          });
          await refreshQueueStateAfterContextMutation(queueState, task);
          return task;
        }
      : undefined,
    attachSkillToQueueTask: contextActions
      ? async (request) => {
          const task = await contextActions.attachSkillToQueueTask({
            ...request,
            workspaceId,
          });
          await refreshQueueStateAfterContextMutation(queueState, task);
          return task;
        }
      : undefined,
    createItem: async (request) => {
      const result = await queueApi.createItem({
        ...request,
        actor: request.actor ?? "workspace_agent",
        workspaceId,
      });

      await refreshQueueStateAfterMutation(queueState, result);

      return result;
    },
    getRunSettingsDefaults: () =>
      queueState?.getRunSettingsDefaults() ?? null,
    getAvailableExecutorTargets: () =>
      controlActions?.getAvailableExecutorTargets?.() ?? [],
    getCurrentWorkspaceRoot: () =>
      queueState?.getCurrentWorkspaceRoot?.() ?? null,
    getSnapshot: (request = {}) =>
      queueApi.getSnapshot({
        ...request,
        workspaceId,
      }),
    getItemAggregate: aggregateReadActions
      ? (request) =>
          aggregateReadActions.getAgentQueueItemAggregate({
            ...request,
            workspaceId,
          })
      : undefined,
    listItemAggregates: aggregateReadActions
      ? () => aggregateReadActions.listAgentQueueItemAggregates({ workspaceId })
      : undefined,
    ackReviewMessage: reviewActions
      ? (request) =>
          reviewActions.ackAgentQueueReviewMessage({
            ...request,
            workspaceId,
          })
      : undefined,
    createReviewMessage: reviewActions
      ? (request) =>
          reviewActions.createAgentQueueReviewMessage({
            ...request,
            workspaceId,
          })
      : undefined,
    updateItem: async (request) => {
      const result = await queueApi.updateItem({
        ...request,
        actor: request.actor ?? "workspace_agent",
        workspaceId,
      });

      await refreshQueueStateAfterMutation(queueState, result);

      return result;
    },
    runAutonomousQueue: () =>
      autonomousActions
        ? autonomousActions.runAutonomousQueue()
        : Promise.resolve(
            unavailableAutonomousResult(
              "queue.runAutonomousQueue",
              "Queue autonomous controls are unavailable.",
            ),
          ),
    enableQueue: (request) =>
      controlActions
        ? controlActions.enableQueue(request)
        : Promise.resolve(
            unavailableQueueEnableResult(
              "Queue enable controls are unavailable.",
            ),
          ),
    startQueueLinkedRun: (request) =>
      controlActions
        ? controlActions.startQueueLinkedRun(request)
        : Promise.resolve(
            unavailableQueueStartResult(
              "Queue-linked start controls are unavailable.",
            ),
          ),
    stopAutonomousQueueAfterCurrent: () =>
      autonomousActions
        ? autonomousActions.stopAutonomousQueueAfterCurrent()
        : Promise.resolve(
            unavailableAutonomousResult(
              "queue.stopAutonomousQueueAfterCurrent",
              "Queue autonomous controls are unavailable.",
            ),
          ),
  };
}

function unavailableQueueEnableResult(
  message: string,
): WorkspaceAgentQueueEnableResult {
  return {
    blockerReasons: [message],
    didAutoRunWorkers: false,
    didStartWorkers: false,
    message,
    ok: false,
    queueEnabled: false,
    status: "unavailable",
  };
}

function unavailableQueueStartResult(
  message: string,
): WorkspaceAgentQueueStartRunResult {
  return {
    blockerReasons: [message],
    message,
    ok: false,
    status: "unavailable",
  };
}

async function refreshQueueStateAfterMutation(
  queueState: WorkspaceQueueStateAccess | null | undefined,
  result: QueueWidgetActionResult<QueueWidgetItemSnapshot>,
) {
  if (!result.ok || !result.item) {
    return;
  }

  try {
    await queueState?.refreshAfterMutation(result.item.id);
  } catch {
    // Queue CRUD already succeeded; refresh failures are non-mutating UI state.
  }
}

async function refreshQueueStateAfterContextMutation(
  queueState: WorkspaceQueueStateAccess | null | undefined,
  task: AgentQueueTask,
) {
  try {
    await queueState?.refreshAfterMutation(task.queueItemId);
  } catch {
    // Context attach succeeded; refresh failures are non-mutating UI state.
  }
}

function unavailableAutonomousResult(
  action: WorkspaceAgentQueueAutonomousActionName,
  message: string,
): WorkspaceAgentQueueAutonomousActionResult {
  return {
    action,
    error: {
      code: "autonomous_controls_unavailable",
      message,
    },
    message,
    ok: false,
    status: "unavailable",
  };
}
