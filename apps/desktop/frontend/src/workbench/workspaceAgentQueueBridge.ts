import type {
  AgentQueueWidgetApi,
  QueueCreateItemRequest,
  QueueGetSnapshotRequest,
  QueueUpdateItemRequest,
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";

export type WorkspaceAgentQueueBridge = {
  createItem: (
    request: Omit<QueueCreateItemRequest, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
  getSnapshot: (
    request?: Omit<Partial<QueueGetSnapshotRequest>, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetSnapshot>>;
  updateItem: (
    request: Omit<QueueUpdateItemRequest, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
};

export function createWorkspaceAgentQueueBridge({
  queueApi,
  workspaceId,
}: {
  queueApi: AgentQueueWidgetApi;
  workspaceId: string;
}): WorkspaceAgentQueueBridge {
  return {
    createItem: (request) =>
      queueApi.createItem({
        ...request,
        actor: request.actor ?? "workspace_agent",
        workspaceId,
      }),
    getSnapshot: (request = {}) =>
      queueApi.getSnapshot({
        ...request,
        workspaceId,
      }),
    updateItem: (request) =>
      queueApi.updateItem({
        ...request,
        actor: request.actor ?? "workspace_agent",
        workspaceId,
      }),
  };
}
