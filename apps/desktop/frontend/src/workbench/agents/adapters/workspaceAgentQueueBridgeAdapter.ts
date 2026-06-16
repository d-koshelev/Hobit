import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import { createInMemoryQueueDogfoodLifecycleAdapterApi } from "./queueAgentDogfoodLifecycleController";
import { createDefaultQueueAgentAdapterApi } from "./queueAgentCapabilities";
import {
  createQueueAgentItemsPreview,
  queueAgentCreatedItem,
  QUEUE_ACTIVITY_EVENTS,
  type QueueAgentAdapterApi,
  type QueueAgentAdapterResult,
  type QueueAgentCreateItemsRequest,
  type QueueAgentCreateItemsResult,
  type QueueAgentCreatedItem,
  type QueueAgentLifecycleTaskSeed,
  type QueueAgentPromptPackInput,
} from "./queueAgentCapabilityTypes";

export function createWorkspaceAgentQueueBridgeAdapterApi(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
): QueueAgentAdapterApi {
  const defaultAdapter = createDefaultQueueAgentAdapterApi();

  return {
    ...defaultAdapter,
    createItems: (request) => createQueueItemsThroughBridge(bridge, request),
    dogfoodLifecycle: bridge
      ? createInMemoryQueueDogfoodLifecycleAdapterApi({
          getTaskSeed: (taskId) => getLifecycleTaskSeed(bridge, taskId),
        })
      : undefined,
    importPromptPack: async (input, request) => {
      const preview = await defaultAdapter.previewPromptPack(input);
      if (preview.status !== "succeeded" || !preview.output) {
        return {
          activityEventNames: preview.activityEventNames,
          message: preview.message,
          reasons: preview.reasons,
          status: preview.status,
        };
      }

      const createResult = await createQueueItemsThroughBridge(bridge, request);
      if (createResult.status !== "succeeded" || !createResult.output) {
        return {
          activityEventNames: createResult.activityEventNames,
          message: createResult.message,
          reasons: createResult.reasons,
          status: createResult.status,
        };
      }

      return {
        activityEventNames: [...QUEUE_ACTIVITY_EVENTS.importPromptPack],
        message: "Queue items created",
        output: {
          ...preview.output,
          createdItems: createResult.output.createdItems,
          dependencyEdgesPreserved: createResult.output.dependencyEdgesPreserved,
        },
        status: "succeeded",
      };
    },
    supportsDependencyEdges: true,
    supportsSafeMutationSandbox: false,
  };
}

async function getLifecycleTaskSeed(
  bridge: WorkspaceAgentQueueBridge,
  taskId: string,
): Promise<QueueAgentAdapterResult<QueueAgentLifecycleTaskSeed>> {
  const snapshotResult = await bridge.getSnapshot({
    includeSelectedItem: true,
    itemLimit: 200,
    selectedItemId: taskId,
  });
  if (!snapshotResult.ok || !snapshotResult.snapshot) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleGet],
      message:
        snapshotResult.error?.message ??
        snapshotResult.message ??
        "Queue snapshot is unavailable.",
      reasons: [
        snapshotResult.error?.message ??
          snapshotResult.message ??
          "Queue snapshot is unavailable.",
      ],
      status: "unavailable",
    };
  }

  const item =
    snapshotResult.snapshot.selectedItem?.id === taskId
      ? snapshotResult.snapshot.selectedItem
      : snapshotResult.snapshot.items.find((candidate) => candidate.id === taskId);

  if (!item) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleGet],
      message: `Queue item "${taskId}" was not found.`,
      reasons: [`Queue item "${taskId}" was not found.`],
      status: "failed",
    };
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleGet],
    message: "Queue dogfood lifecycle task seed loaded.",
    output: {
      createdAt: item.createdAt,
      prompt: item.prompt,
      status: item.status,
      taskId: item.id,
      title: item.title,
      updatedAt: item.updatedAt,
    },
    status: "succeeded",
  };
}

async function createQueueItemsThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  request: QueueAgentCreateItemsRequest,
): Promise<QueueAgentAdapterResult<QueueAgentCreateItemsResult>> {
  if (!bridge) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.createItems],
      message: "Queue capability unavailable",
      reasons: ["Workspace Queue bridge is unavailable."],
      status: "unavailable",
    };
  }

  const createdItems: QueueAgentCreatedItem[] = [];

  for (const item of request.items) {
    const result = await bridge.createItem({
      dependencies: item.dependencies,
      description: item.description,
      prompt: item.prompt,
      status: item.status,
      title: item.title,
    });

    if (!result.ok || !result.item) {
      return {
        activityEventNames: [...QUEUE_ACTIVITY_EVENTS.createItems],
        message: result.error?.message ?? result.message,
        reasons: [result.error?.message ?? result.message],
        status: "failed",
      };
    }

    createdItems.push({
      ...queueAgentCreatedItem(item),
      dependencies: [...result.item.dependencies],
      id: result.item.id,
      prompt: result.item.prompt,
      status: result.item.status === "draft" ? "draft" : "queued",
      title: result.item.title,
    });
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.createItems],
    message: "Queue items created",
    output: {
      ...createQueueAgentItemsPreview(request.items),
      createdItems,
      dependencyEdgesPreserved: true,
    },
    status: "succeeded",
  };
}
