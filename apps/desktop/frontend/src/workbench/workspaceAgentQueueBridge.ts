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

export type WorkspaceQueueStateAccess = {
  getRunSettingsDefaults: () => AgentQueueTaskRunSettingsDefaults;
  refreshAfterMutation: (queueItemId: string) => Promise<void> | void;
};

export type WorkspaceAgentQueueBridge = {
  createItem: (
    request: Omit<QueueCreateItemRequest, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
  getRunSettingsDefaults?: () => AgentQueueTaskRunSettingsDefaults | null;
  getSnapshot: (
    request?: Omit<Partial<QueueGetSnapshotRequest>, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetSnapshot>>;
  updateItem: (
    request: Omit<QueueUpdateItemRequest, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
  runAutonomousQueue?: () => Promise<WorkspaceAgentQueueAutonomousActionResult>;
  stopAutonomousQueueAfterCurrent?: () => Promise<WorkspaceAgentQueueAutonomousActionResult>;
};

export function createWorkspaceAgentQueueBridge({
  autonomousActions,
  queueApi,
  queueState,
  workspaceId,
}: {
  autonomousActions?: WorkspaceQueueAutonomousActions | null;
  queueApi: AgentQueueWidgetApi;
  queueState?: WorkspaceQueueStateAccess | null;
  workspaceId: string;
}): WorkspaceAgentQueueBridge {
  return {
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
    getSnapshot: (request = {}) =>
      queueApi.getSnapshot({
        ...request,
        workspaceId,
      }),
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
