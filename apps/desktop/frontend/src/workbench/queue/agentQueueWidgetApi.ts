import type {
  AgentQueueTask,
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskItemType,
  AgentQueueTaskStatus,
  AgentQueueTaskValidationStatus,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";
import {
  normalizeItemType,
  normalizeQueueTag,
  normalizeTaskExecutionPolicy,
  normalizeTaskPriority,
  normalizeValidationStatus,
} from "../agentQueueTaskUiModel";
import { normalizeTaskDependencies } from "../agentQueueDependencyUi";
import type {
  AgentQueueWidgetApi,
  QueueCreateItemRequest,
  QueueGetSnapshotRequest,
  QueueUpdateItemRequest,
  QueueWidgetActionError,
  QueueWidgetActionName,
  QueueWidgetActionResult,
  QueueWidgetApiDependencies,
  QueueWidgetEvent,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./agentQueueWidgetApiTypes";
import {
  buildQueueWidgetSnapshot,
  queueWidgetItemSnapshot,
} from "./agentQueueWidgetSnapshotModel";

const PRIMARY_COORDINATOR_ID = "primary";
const SUPPORTED_CREATE_STATUSES = new Set<AgentQueueTaskStatus>(["draft", "queued"]);
const SUPPORTED_TASK_STATUSES = new Set<AgentQueueTaskStatus>([
  "cancelled",
  "completed",
  "draft",
  "failed",
  "queued",
  "ready",
  "review_needed",
  "running",
]);
const SUPPORTED_EXECUTION_POLICIES = new Set<AgentQueueTaskExecutionPolicy>(["after_previous_success", "auto", "manual"]);
const SUPPORTED_ITEM_TYPES = new Set<AgentQueueTaskItemType>(["diff_review", "follow_up", "implementation", "validation"]);
const SUPPORTED_VALIDATION_STATUSES = new Set<AgentQueueTaskValidationStatus>([
  "failed",
  "needs_review",
  "not_started",
  "passed",
  "validating",
]);
const SUPPORTED_SANDBOXES = new Set<DirectWorkSandbox>(["danger_full_access", "read_only", "workspace_write"]);
const SUPPORTED_APPROVAL_POLICIES = new Set<DirectWorkApprovalPolicy>(["never", "on_request", "untrusted"]);

export function createAgentQueueWidgetApi(
  dependencies: QueueWidgetApiDependencies,
): AgentQueueWidgetApi {
  const queueId = dependencies.queueId ?? queueIdForWorkspace(dependencies.workspaceId);

  return {
    createItem: (request) =>
      createItem({
        dependencies,
        queueId,
        request,
      }),
    getSnapshot: (request = {}) =>
      getSnapshot({
        dependencies,
        queueId,
        request,
      }),
    updateItem: (request) =>
      updateItem({
        dependencies,
        queueId,
        request,
      }),
  };
}

export function queueIdForWorkspace(workspaceId: string) {
  return `workspace:${workspaceId}:agent-queue`;
}

async function getSnapshot({
  dependencies,
  queueId,
  request,
}: {
  dependencies: QueueWidgetApiDependencies;
  queueId: string;
  request: Partial<QueueGetSnapshotRequest>;
}): Promise<QueueWidgetActionResult<QueueWidgetSnapshot>> {
  const timestamp = now(dependencies);
  const requestError = validateRequestScope({
    action: "queue.getSnapshot",
    dependencies,
    queueId,
    requestQueueId: request.queueId,
    requestWorkspaceId: request.workspaceId,
  });

  if (requestError) {
    return failureResult({
      action: "queue.getSnapshot",
      error: requestError,
      timestamp,
    });
  }

  try {
    const snapshot = await buildQueueWidgetSnapshot({
      dependencies,
      queueId,
      request,
      timestamp,
    });

    return {
      action: "queue.getSnapshot",
      events: [],
      item: snapshot,
      message: `Queue snapshot returned ${snapshot.items.length.toString()} item${snapshot.items.length === 1 ? "" : "s"}.`,
      ok: true,
      safetyClass: "safe_read",
      snapshot,
    };
  } catch (error) {
    return failureResult({
      action: "queue.getSnapshot",
      error: {
        code: "snapshot_failed",
        message: errorToMessage(error, "Unable to read Agent Queue snapshot."),
      },
      timestamp,
    });
  }
}

async function createItem({
  dependencies,
  queueId,
  request,
}: {
  dependencies: QueueWidgetApiDependencies;
  queueId: string;
  request: QueueCreateItemRequest;
}): Promise<QueueWidgetActionResult> {
  const timestamp = now(dependencies);
  const requestError = validateRequestScope({
    action: "queue.createItem",
    dependencies,
    queueId,
    requestQueueId: request.queueId,
    requestWorkspaceId: request.workspaceId,
  });

  if (requestError) {
    return failureResult({
      action: "queue.createItem",
      actor: request.actor,
      error: requestError,
      timestamp,
    });
  }

  const normalized = normalizeCreateRequest(request);
  if (normalized.error) {
    return failureResult({
      action: "queue.createItem",
      actor: request.actor,
      error: normalized.error,
      timestamp,
    });
  }

  try {
    const createdTask = await dependencies.createAgentQueueTask(normalized.value);
    const item = queueWidgetItemSnapshot({
      queueId,
      runLinks: [],
      task: createdTask,
      tasks: [createdTask],
    });
    const event = queueEvent({
      actionSummary: `Created Queue item "${item.title}".`,
      actor: request.actor,
      itemId: item.id,
      summary: `Created Queue item "${item.title}".`,
      timestamp,
      type: "itemCreated",
    });

    return {
      action: "queue.createItem",
      events: [event],
      item,
      message:
        "Queue item created. No task execution, Agent Executor run, Queue Autorun, Terminal command, Git action, validation, or coordinator finalization was started.",
      ok: true,
      safetyClass: "safe_create_update",
    };
  } catch (error) {
    return failureResult({
      action: "queue.createItem",
      actor: request.actor,
      error: {
        code: "create_failed",
        message: errorToMessage(error, "Unable to create Agent Queue item."),
      },
      timestamp,
    });
  }
}

async function updateItem({
  dependencies,
  queueId,
  request,
}: {
  dependencies: QueueWidgetApiDependencies;
  queueId: string;
  request: QueueUpdateItemRequest;
}): Promise<QueueWidgetActionResult> {
  const timestamp = now(dependencies);
  const requestError = validateRequestScope({
    action: "queue.updateItem",
    dependencies,
    queueId,
    requestQueueId: request.queueId,
    requestWorkspaceId: request.workspaceId,
  });

  if (requestError) {
    return failureResult({
      action: "queue.updateItem",
      actor: request.actor,
      error: requestError,
      timestamp,
    });
  }

  const unsupportedField = unsupportedUpdateField(request);
  if (unsupportedField) {
    return failureResult({
      action: "queue.updateItem",
      actor: request.actor,
      error: unsupportedField,
      timestamp,
    });
  }

  try {
    const currentTask = await dependencies.getAgentQueueTask(request.itemId);
    if (!currentTask) {
      return failureResult({
        action: "queue.updateItem",
        actor: request.actor,
        error: {
          code: "item_not_found",
          message: `Queue item "${request.itemId}" was not found.`,
        },
        timestamp,
      });
    }

    const merged = mergeUpdateRequest(currentTask, request);
    if (merged.error) {
      return failureResult({
        action: "queue.updateItem",
        actor: request.actor,
        error: merged.error,
        timestamp,
      });
    }

    const updatedTask = await dependencies.updateAgentQueueTask(merged.value);
    if (!updatedTask) {
      return failureResult({
        action: "queue.updateItem",
        actor: request.actor,
        error: {
          code: "item_not_found",
          message: `Queue item "${request.itemId}" was not found.`,
        },
        timestamp,
      });
    }

    const item = queueWidgetItemSnapshot({
      queueId,
      runLinks: [],
      task: updatedTask,
      tasks: [updatedTask],
    });
    const changedFields = Object.keys(request.patch).sort();
    const event = queueEvent({
      actionSummary:
        changedFields.length > 0
          ? `Updated fields: ${changedFields.join(", ")}.`
          : "No fields changed.",
      actor: request.actor,
      itemId: item.id,
      summary: `Updated Queue item "${item.title}".`,
      timestamp,
      type: "itemUpdated",
    });

    return {
      action: "queue.updateItem",
      events: [event],
      item,
      message:
        "Queue item updated. No task execution, Agent Executor run, Queue Autorun, Terminal command, Git action, validation, or coordinator finalization was started.",
      ok: true,
      safetyClass: "safe_create_update",
    };
  } catch (error) {
    return failureResult({
      action: "queue.updateItem",
      actor: request.actor,
      error: {
        code: "update_failed",
        message: errorToMessage(error, "Unable to update Agent Queue item."),
      },
      timestamp,
    });
  }
}

function normalizeCreateRequest(
  request: QueueCreateItemRequest,
):
  | {
      error?: never;
      value: Parameters<QueueWidgetApiDependencies["createAgentQueueTask"]>[0];
    }
  | { error: QueueWidgetActionError; value?: never } {
  const title = request.title.trim();
  const status = request.status ?? "draft";
  const prompt = request.prompt ?? "";
  const priority = normalizeTaskPriority(request.priority);
  const executionPolicy = request.executionPolicy ?? "manual";
  const itemType = request.itemType ?? "implementation";
  const validationError = validateMutableFields({
    approvalPolicy: request.approvalPolicy,
    executionPolicy,
    itemType,
    sandbox: request.sandbox,
    status,
  });

  if (!title) {
    return {
      error: {
        code: "missing_title",
        message: "Queue item title is required.",
      },
    };
  }

  if (!SUPPORTED_CREATE_STATUSES.has(status)) {
    return {
      error: {
        code: "unsupported_status",
        message: "Queue item creation supports only draft or queued status.",
      },
    };
  }

  if (status !== "draft" && !prompt.trim()) {
    return {
      error: {
        code: "missing_prompt",
        message: "Prompt is required when creating a queued Queue item.",
      },
    };
  }

  if (validationError) {
    return { error: validationError };
  }

  const queueTagName = request.queueTag?.name?.trim() ?? "";
  const queueTagId = request.queueTag?.id?.trim() || undefined;

  return {
    value: {
      approvalPolicy: request.approvalPolicy ?? null,
      codexExecutable: request.codexExecutable?.trim() || null,
      dependsOn: normalizeTaskDependencies(request.dependencies),
      description: request.description ?? "",
      executionPolicy,
      executionWorkspace: request.executionWorkspace?.trim() || null,
      itemType,
      priority,
      prompt,
      queueTagId,
      queueTagName: queueTagName || undefined,
      sandbox: request.sandbox ?? null,
      status,
      title,
      validationStatus: "not_started",
    },
  };
}

function mergeUpdateRequest(
  currentTask: AgentQueueTask,
  request: QueueUpdateItemRequest,
):
  | {
      error?: never;
      value: Parameters<QueueWidgetApiDependencies["updateAgentQueueTask"]>[0];
    }
  | { error: QueueWidgetActionError; value?: never } {
  const patch = request.patch;
  const status = patch.status ?? currentTask.status;
  const executionPolicy =
    patch.executionPolicy ?? normalizeTaskExecutionPolicy(currentTask.executionPolicy);
  const itemType = hasOwn(patch, "itemType")
    ? patch.itemType
    : normalizeItemType(currentTask.itemType);
  const validationStatus = hasOwn(patch, "validationStatus")
    ? patch.validationStatus
    : normalizeValidationStatus(currentTask.validationStatus);
  const sandbox = hasOwn(patch, "sandbox")
    ? patch.sandbox
    : currentTask.sandbox ?? null;
  const approvalPolicy = hasOwn(patch, "approvalPolicy")
    ? patch.approvalPolicy
    : currentTask.approvalPolicy ?? null;
  const validationError = validateMutableFields({
    approvalPolicy,
    executionPolicy,
    itemType,
    sandbox,
    status,
    validationStatus,
  });

  if (validationError) {
    return { error: validationError };
  }

  const title = (patch.title ?? currentTask.title).trim();
  const prompt = patch.prompt ?? currentTask.prompt;

  if (!title) {
    return {
      error: {
        code: "missing_title",
        message: "Queue item title is required.",
      },
    };
  }

  if (status !== "draft" && !prompt.trim()) {
    return {
      error: {
        code: "missing_prompt",
        message: "Prompt is required unless the Queue item is a draft.",
      },
    };
  }

  const queueTag = normalizeQueueTag(currentTask);
  const patchQueueTag = patch.queueTag;
  const workerExecutionReports = hasOwn(patch, "workerExecutionReports")
    ? Array.isArray(patch.workerExecutionReports)
      ? patch.workerExecutionReports
      : currentTask.workerExecutionReports
    : hasOwn(patch, "appendWorkerExecutionReport") && patch.appendWorkerExecutionReport
      ? [...(currentTask.workerExecutionReports ?? []), patch.appendWorkerExecutionReport]
      : currentTask.workerExecutionReports;

  return {
    value: {
      approvalPolicy,
      codexExecutable: (
        hasOwn(patch, "codexExecutable")
          ? patch.codexExecutable
          : currentTask.codexExecutable
      )?.trim() || null,
      dependsOn: hasOwn(patch, "dependencies")
        ? normalizeTaskDependencies(patch.dependencies)
        : normalizeTaskDependencies(currentTask.dependsOn),
      description: patch.description ?? currentTask.description,
      executionPolicy,
      executionWorkspace:
        (hasOwn(patch, "executionWorkspace")
          ? patch.executionWorkspace
          : currentTask.executionWorkspace
        )?.trim() || null,
      itemType: itemType ?? undefined,
      priority: normalizeTaskPriority(patch.priority ?? currentTask.priority),
      prompt,
      queueItemId: currentTask.queueItemId,
      queueTagId: patchQueueTag
        ? patchQueueTag.id?.trim() || undefined
        : queueTag.queueTagId,
      queueTagName: patchQueueTag
        ? patchQueueTag.name?.trim() || undefined
        : queueTag.queueTagName,
      sandbox,
      status,
      title,
      validationStatus: validationStatus ?? undefined,
      workerExecutionReports,
    },
  };
}

function unsupportedUpdateField(
  request: QueueUpdateItemRequest,
): QueueWidgetActionError | null {
  if (hasOwn(request.patch, "order") || hasOwn(request.patch, "index")) {
    return {
      code: "unsupported_field",
      message:
        "Queue item order/index updates are not supported by this first API slice.",
    };
  }

  return null;
}

function validateRequestScope({
  dependencies,
  queueId,
  requestQueueId,
  requestWorkspaceId,
}: {
  action: QueueWidgetActionName;
  dependencies: QueueWidgetApiDependencies;
  queueId: string;
  requestQueueId?: string;
  requestWorkspaceId?: string;
}): QueueWidgetActionError | null {
  if (requestWorkspaceId && requestWorkspaceId !== dependencies.workspaceId) {
    return {
      code: "workspace_mismatch",
      message: "Queue action workspaceId does not match the open Workspace.",
    };
  }

  if (requestQueueId && requestQueueId !== queueId) {
    return {
      code: "queue_mismatch",
      message: "Queue action queueId does not match the singleton Workspace Queue.",
    };
  }

  return null;
}

function validateMutableFields({
  approvalPolicy,
  executionPolicy,
  itemType,
  sandbox,
  status,
  validationStatus,
}: {
  approvalPolicy?: DirectWorkApprovalPolicy | null;
  executionPolicy?: AgentQueueTaskExecutionPolicy | null;
  itemType?: AgentQueueTaskItemType | null;
  sandbox?: DirectWorkSandbox | null;
  status?: AgentQueueTaskStatus | null;
  validationStatus?: AgentQueueTaskValidationStatus | null;
}): QueueWidgetActionError | null {
  if (status && !SUPPORTED_TASK_STATUSES.has(status)) {
    return {
      code: "unsupported_status",
      message: `Queue item status "${status}" is not supported.`,
    };
  }

  if (executionPolicy && !SUPPORTED_EXECUTION_POLICIES.has(executionPolicy)) {
    return {
      code: "unsupported_execution_policy",
      message: `Queue item execution policy "${executionPolicy}" is not supported.`,
    };
  }

  if (itemType && !SUPPORTED_ITEM_TYPES.has(itemType)) {
    return {
      code: "unsupported_item_type",
      message: `Queue item type "${itemType}" is not supported.`,
    };
  }

  if (validationStatus && !SUPPORTED_VALIDATION_STATUSES.has(validationStatus)) {
    return {
      code: "unsupported_validation_status",
      message: `Queue item validation status "${validationStatus}" is not supported.`,
    };
  }

  if (sandbox && !SUPPORTED_SANDBOXES.has(sandbox)) {
    return {
      code: "unsupported_sandbox",
      message: `Queue item sandbox "${sandbox}" is not supported.`,
    };
  }

  if (approvalPolicy && !SUPPORTED_APPROVAL_POLICIES.has(approvalPolicy)) {
    return {
      code: "unsupported_approval_policy",
      message: `Queue item approval policy "${approvalPolicy}" is not supported.`,
    };
  }

  return null;
}

function hasOwn<TObject extends object, TKey extends PropertyKey>(
  object: TObject,
  key: TKey,
): object is TObject & Record<TKey, unknown> {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function failureResult<T = QueueWidgetItemSnapshot>({
  action,
  actor,
  error,
  timestamp,
}: {
  action: QueueWidgetActionName;
  actor?: "operator" | "workspace_agent" | "test_harness";
  error: QueueWidgetActionError;
  timestamp: string;
}): QueueWidgetActionResult<T> {
  return {
    action,
    error,
    events: [
      queueEvent({
        actionSummary: error.message,
        actor,
        summary: error.message,
        timestamp,
        type: "actionFailed",
      }),
    ],
    message: error.message,
    ok: false,
    safetyClass: action === "queue.getSnapshot" ? "safe_read" : "safe_create_update",
  };
}

function queueEvent({
  actionSummary,
  actor,
  itemId,
  summary,
  timestamp,
  type,
}: {
  actionSummary?: string;
  actor?: "operator" | "workspace_agent" | "test_harness";
  itemId?: string;
  summary: string;
  timestamp: string;
  type: QueueWidgetEvent["type"];
}): QueueWidgetEvent {
  return {
    actionSummary,
    actor,
    coordinatorId: PRIMARY_COORDINATOR_ID,
    itemId,
    summary,
    timestamp,
    type,
  };
}

function now(dependencies: QueueWidgetApiDependencies) {
  return dependencies.now?.() ?? new Date().toISOString();
}

function errorToMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}
