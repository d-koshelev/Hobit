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

export type WorkspaceAgentQueueAutonomousControls = {
  runAutonomousQueue: () => Promise<WorkspaceAgentQueueAutonomousActionResult>;
  stopAutonomousQueueAfterCurrent: () => Promise<WorkspaceAgentQueueAutonomousActionResult>;
};

export type WorkspaceAgentQueueViewControls = {
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
  autonomousControls,
  queueApi,
  queueViewControls,
  workspaceId,
}: {
  autonomousControls?: WorkspaceAgentQueueAutonomousControls | null;
  queueApi: AgentQueueWidgetApi;
  queueViewControls?: WorkspaceAgentQueueViewControls | null;
  workspaceId: string;
}): WorkspaceAgentQueueBridge {
  return {
    createItem: async (request) => {
      const result = await queueApi.createItem({
        ...request,
        actor: request.actor ?? "workspace_agent",
        workspaceId,
      });

      await refreshQueueViewAfterMutation(queueViewControls, result);

      return result;
    },
    getRunSettingsDefaults: () =>
      queueViewControls?.getRunSettingsDefaults() ?? null,
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

      await refreshQueueViewAfterMutation(queueViewControls, result);

      return result;
    },
    runAutonomousQueue: () =>
      autonomousControls
        ? autonomousControls.runAutonomousQueue()
        : Promise.resolve(
            unavailableAutonomousResult(
              "queue.runAutonomousQueue",
              "Queue autonomous controls are unavailable.",
            ),
          ),
    stopAutonomousQueueAfterCurrent: () =>
      autonomousControls
        ? autonomousControls.stopAutonomousQueueAfterCurrent()
        : Promise.resolve(
            unavailableAutonomousResult(
              "queue.stopAutonomousQueueAfterCurrent",
              "Queue autonomous controls are unavailable.",
            ),
          ),
  };
}

async function refreshQueueViewAfterMutation(
  queueViewControls: WorkspaceAgentQueueViewControls | null | undefined,
  result: QueueWidgetActionResult<QueueWidgetItemSnapshot>,
) {
  if (!result.ok || !result.item) {
    return;
  }

  try {
    await queueViewControls?.refreshAfterMutation(result.item.id);
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
