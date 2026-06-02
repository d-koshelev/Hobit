import type {
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskStatus,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
import type {
  QueueCreateItemRequest,
  QueueUpdateItemRequest,
  QueueWidgetActionName,
  QueueWidgetActionResult,
  QueueWidgetBlocker,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";

export type WorkspaceAgentQueueActionCardResult =
  QueueWidgetActionResult<QueueWidgetItemSnapshot | QueueWidgetSnapshot>;

export type WorkspaceAgentQueueCreateDraft = {
  approvalPolicy: DirectWorkApprovalPolicy | "";
  codexExecutable: string;
  description: string;
  executionPolicy: AgentQueueTaskExecutionPolicy;
  executionWorkspace: string;
  priority: string;
  prompt: string;
  queueTag: string;
  sandbox: DirectWorkSandbox | "";
  status: Extract<AgentQueueTaskStatus, "draft" | "queued">;
  title: string;
};

export type WorkspaceAgentQueueUpdateDraft = {
  approvalPolicy: DirectWorkApprovalPolicy | "";
  codexExecutable: string;
  description: string;
  executionPolicy: AgentQueueTaskExecutionPolicy | "";
  executionWorkspace: string;
  itemId: string;
  priority: string;
  prompt: string;
  queueTag: string;
  sandbox: DirectWorkSandbox | "";
  status: AgentQueueTaskStatus | "";
  title: string;
};

export const EMPTY_WORKSPACE_AGENT_QUEUE_CREATE_DRAFT =
  {
    approvalPolicy: "",
    codexExecutable: "",
    description: "",
    executionPolicy: "manual",
    executionWorkspace: "",
    priority: "0",
    prompt: "",
    queueTag: "",
    sandbox: "",
    status: "draft",
    title: "",
  } satisfies WorkspaceAgentQueueCreateDraft;

export const EMPTY_WORKSPACE_AGENT_QUEUE_UPDATE_DRAFT =
  {
    approvalPolicy: "",
    codexExecutable: "",
    description: "",
    executionPolicy: "",
    executionWorkspace: "",
    itemId: "",
    priority: "",
    prompt: "",
    queueTag: "",
    sandbox: "",
    status: "",
    title: "",
  } satisfies WorkspaceAgentQueueUpdateDraft;

export function workspaceAgentQueueCreateRequestFromDraft(
  draft: WorkspaceAgentQueueCreateDraft,
): Omit<QueueCreateItemRequest, "workspaceId"> {
  const request: Omit<QueueCreateItemRequest, "workspaceId"> = {
    description: draft.description,
    executionPolicy: draft.executionPolicy,
    priority: parseQueuePriority(draft.priority, 0),
    prompt: draft.prompt,
    status: draft.status,
    title: draft.title.trim(),
  };

  const queueTag = draft.queueTag.trim();
  if (queueTag) {
    request.queueTag = { name: queueTag };
  }

  const executionWorkspace = draft.executionWorkspace.trim();
  if (executionWorkspace) {
    request.executionWorkspace = executionWorkspace;
  }

  const codexExecutable = draft.codexExecutable.trim();
  if (codexExecutable) {
    request.codexExecutable = codexExecutable;
  }

  if (draft.sandbox) {
    request.sandbox = draft.sandbox;
  }

  if (draft.approvalPolicy) {
    request.approvalPolicy = draft.approvalPolicy;
  }

  return request;
}

export function workspaceAgentQueueUpdateRequestFromDraft(
  draft: WorkspaceAgentQueueUpdateDraft,
): Omit<QueueUpdateItemRequest, "workspaceId"> {
  const patch: Omit<QueueUpdateItemRequest, "workspaceId">["patch"] = {};
  const title = draft.title.trim();
  const description = draft.description.trim();
  const prompt = draft.prompt.trim();
  const queueTag = draft.queueTag.trim();
  const executionWorkspace = draft.executionWorkspace.trim();
  const codexExecutable = draft.codexExecutable.trim();

  if (title) {
    patch.title = title;
  }

  if (description) {
    patch.description = draft.description;
  }

  if (prompt) {
    patch.prompt = draft.prompt;
  }

  if (queueTag) {
    patch.queueTag = { name: queueTag };
  }

  if (draft.priority.trim()) {
    patch.priority = parseQueuePriority(draft.priority, 0);
  }

  if (draft.status) {
    patch.status = draft.status;
  }

  if (draft.executionPolicy) {
    patch.executionPolicy = draft.executionPolicy;
  }

  if (executionWorkspace) {
    patch.executionWorkspace = executionWorkspace;
  }

  if (codexExecutable) {
    patch.codexExecutable = codexExecutable;
  }

  if (draft.sandbox) {
    patch.sandbox = draft.sandbox;
  }

  if (draft.approvalPolicy) {
    patch.approvalPolicy = draft.approvalPolicy;
  }

  return {
    itemId: draft.itemId.trim(),
    patch,
  };
}

export function workspaceAgentQueueUpdateDraftHasPatch(
  draft: WorkspaceAgentQueueUpdateDraft,
) {
  return Object.keys(workspaceAgentQueueUpdateRequestFromDraft(draft).patch)
    .length > 0;
}

export function workspaceAgentQueueActionFailureResult({
  action,
  error,
}: {
  action: QueueWidgetActionName;
  error: unknown;
}): WorkspaceAgentQueueActionCardResult {
  const message = errorToMessage(error, "Queue action failed.");

  return {
    action,
    error: {
      code: "workspace_agent_queue_action_failed",
      message,
    },
    events: [],
    message,
    ok: false,
    safetyClass:
      action === "queue.getSnapshot" ? "safe_read" : "safe_create_update",
  };
}

export function workspaceAgentQueueActionCardTitle(
  result: WorkspaceAgentQueueActionCardResult,
) {
  if (!result.ok) {
    return "Queue action failed";
  }

  switch (result.action) {
    case "queue.getSnapshot":
      return "Queue snapshot loaded";
    case "queue.createItem":
      return "Queue item created";
    case "queue.updateItem":
      return "Queue item updated";
  }
}

export function workspaceAgentQueueActionSummary(
  result: WorkspaceAgentQueueActionCardResult,
) {
  if (!result.ok) {
    return result.error?.message ?? result.message;
  }

  if (result.snapshot) {
    const counts = result.snapshot.itemCounts;
    return `Queue has ${counts.total.toString()} item${counts.total === 1 ? "" : "s"}: ${counts.queued.toString()} queued, ${counts.running.toString()} running, ${counts.blocked.toString()} blocked, ${counts.reportReady.toString()} report-ready, ${counts.finalized.toString()} finalized.`;
  }

  if (result.item) {
    const item = queueItemFromResult(result.item);
    if (item) {
      return `${item.title} is ${item.status} with ${item.executionPolicy} policy.`;
    }
  }

  return result.message;
}

export function workspaceAgentQueueTopBlockers(
  snapshot: QueueWidgetSnapshot,
  limit = 3,
) {
  return snapshot.blockers.slice(0, limit);
}

export function workspaceAgentQueueNextRecommendedItem(
  snapshot: QueueWidgetSnapshot,
) {
  return (
    snapshot.items.find((item) => item.status === "ready") ??
    snapshot.items.find(
      (item) => item.status === "queued" && item.blockers.length === 0,
    ) ??
    snapshot.items.find((item) => item.status === "draft")
  );
}

export function workspaceAgentQueueBlockerLabel(blocker: QueueWidgetBlocker) {
  return blocker.itemId
    ? `${blocker.itemId}: ${blocker.message}`
    : blocker.message;
}

function parseQueuePriority(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function queueItemFromResult(
  item: WorkspaceAgentQueueActionCardResult["item"],
): QueueWidgetItemSnapshot | null {
  if (item && "queueTag" in item && "status" in item) {
    return item;
  }

  return null;
}
