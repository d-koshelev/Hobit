import type { AgentContextSnapshot } from "../../agentRuntime";
import type {
  QueueCreateItemRequest,
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "../../queue/agentQueueWidgetApiTypes";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import type { WorkspaceAgentV2ContextItem } from "./WorkspaceAgentV2ContextStrip";

export const WORKSPACE_AGENT_V2_QUEUE_RUN_SOURCE = "WorkspaceAgentV2" as const;

export type WorkspaceAgentV2QueueRunDesiredStatus =
  | "draft"
  | "intake"
  | "queued";

export type WorkspaceAgentV2QueueRunContextRef = {
  readonly id: string;
  readonly label: string;
  readonly scope?: string;
  readonly source?: string;
  readonly type: string;
  readonly version?: string;
};

export type WorkspaceAgentV2QueueRunRequest = {
  readonly createdFromRunId?: string | null;
  readonly createdFromTranscriptId?: string | null;
  readonly desiredStatus: WorkspaceAgentV2QueueRunDesiredStatus;
  readonly objective: string;
  readonly priority?: number;
  readonly prompt: string;
  readonly sourceModule: typeof WORKSPACE_AGENT_V2_QUEUE_RUN_SOURCE;
  readonly tags: readonly string[];
  readonly visibleContextRefs: readonly WorkspaceAgentV2QueueRunContextRef[];
  readonly visibleContextSnapshot?: AgentContextSnapshot;
};

export type WorkspaceAgentV2QueueRunBuildResult =
  | {
      readonly ok: true;
      readonly request: WorkspaceAgentV2QueueRunRequest;
    }
  | WorkspaceAgentV2QueueRunUnsupportedResult;

export type WorkspaceAgentV2QueueRunUnsupportedResult = {
  readonly code: "missing_prompt" | "queue_create_unavailable";
  readonly message: string;
  readonly ok: false;
  readonly sourceModule: typeof WORKSPACE_AGENT_V2_QUEUE_RUN_SOURCE;
  readonly status: "unsupported";
};

export type WorkspaceAgentV2QueueRunCreatedResult = {
  readonly action: "queue.createItem";
  readonly createdItem: QueueWidgetItemSnapshot;
  readonly createdQueueItemId: string;
  readonly desiredStatus: WorkspaceAgentV2QueueRunDesiredStatus;
  readonly message: string;
  readonly ok: true;
  readonly queueCreateResult: QueueWidgetActionResult<QueueWidgetItemSnapshot>;
  readonly sourceModule: typeof WORKSPACE_AGENT_V2_QUEUE_RUN_SOURCE;
  readonly status: "created";
  readonly safetyMessage: string;
  readonly visibleContextRefs: readonly WorkspaceAgentV2QueueRunContextRef[];
};

export type WorkspaceAgentV2QueueRunFailedResult = {
  readonly action: "queue.createItem";
  readonly errorCode?: string;
  readonly message: string;
  readonly ok: false;
  readonly queueCreateResult: QueueWidgetActionResult<QueueWidgetItemSnapshot>;
  readonly sourceModule: typeof WORKSPACE_AGENT_V2_QUEUE_RUN_SOURCE;
  readonly status: "failed";
  readonly visibleContextRefs: readonly WorkspaceAgentV2QueueRunContextRef[];
};

export type WorkspaceAgentV2QueueRunResult =
  | WorkspaceAgentV2QueueRunCreatedResult
  | WorkspaceAgentV2QueueRunFailedResult
  | WorkspaceAgentV2QueueRunUnsupportedResult;

export type WorkspaceAgentV2QueueRunComposerInput = {
  readonly contextItems?: readonly WorkspaceAgentV2ContextItem[];
  readonly createdFromRunId?: string | null;
  readonly createdFromTranscriptId?: string | null;
  readonly desiredStatus?: WorkspaceAgentV2QueueRunDesiredStatus;
  readonly priority?: number;
  readonly prompt: string;
  readonly tags?: readonly string[];
  readonly visibleContextSnapshot?: AgentContextSnapshot;
};

export type WorkspaceAgentV2QueueRunDependencies = {
  readonly queueBridge?: Pick<WorkspaceAgentQueueBridge, "createItem"> | null;
};

export function buildQueueRunRequestFromComposer({
  contextItems = [],
  createdFromRunId,
  createdFromTranscriptId,
  desiredStatus = "draft",
  priority,
  prompt,
  tags = [],
  visibleContextSnapshot,
}: WorkspaceAgentV2QueueRunComposerInput): WorkspaceAgentV2QueueRunBuildResult {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    return unsupportedQueueRunResult({
      code: "missing_prompt",
      message: "Prompt is required before creating a Queue task.",
    });
  }

  return {
    ok: true,
    request: {
      createdFromRunId: createdFromRunId ?? null,
      createdFromTranscriptId: createdFromTranscriptId ?? null,
      desiredStatus,
      objective: normalizedPrompt,
      priority,
      prompt: normalizedPrompt,
      sourceModule: WORKSPACE_AGENT_V2_QUEUE_RUN_SOURCE,
      tags: normalizedTags(tags),
      visibleContextRefs: visibleContextRefsFromComposer({
        contextItems,
        visibleContextSnapshot,
      }),
      visibleContextSnapshot,
    },
  };
}

export async function createQueueTaskFromAgentRequest(
  request: WorkspaceAgentV2QueueRunRequest,
  dependencies: WorkspaceAgentV2QueueRunDependencies,
): Promise<WorkspaceAgentV2QueueRunResult> {
  if (!dependencies.queueBridge?.createItem) {
    return unsupportedQueueRunResult({
      code: "queue_create_unavailable",
      message:
        "Queue task creation is unavailable in this Workspace Agent v2 host.",
    });
  }

  const createRequest = queueCreateRequestFromAgentRequest(request);
  const created = await dependencies.queueBridge.createItem(createRequest);

  return mapQueueTaskCreatedResult({
    queueCreateResult: created,
    request,
  });
}

export function mapQueueTaskCreatedResult({
  queueCreateResult,
  request,
}: {
  readonly queueCreateResult: QueueWidgetActionResult<QueueWidgetItemSnapshot>;
  readonly request: WorkspaceAgentV2QueueRunRequest;
}): WorkspaceAgentV2QueueRunResult {
  if (queueCreateResult.ok && queueCreateResult.item) {
    return {
      action: "queue.createItem",
      createdItem: queueCreateResult.item,
      createdQueueItemId: queueCreateResult.item.id,
      desiredStatus: request.desiredStatus,
      message: queueCreateResult.message,
      ok: true,
      queueCreateResult,
      sourceModule: WORKSPACE_AGENT_V2_QUEUE_RUN_SOURCE,
      status: "created",
      safetyMessage:
        "Queue task created only. No Direct Run, Agent Executor run, Queue Autorun, Terminal command, Git action, validation, or finalization was started.",
      visibleContextRefs: request.visibleContextRefs,
    };
  }

  return {
    action: "queue.createItem",
    errorCode: queueCreateResult.error?.code,
    message: queueCreateResult.message,
    ok: false,
    queueCreateResult,
    sourceModule: WORKSPACE_AGENT_V2_QUEUE_RUN_SOURCE,
    status: "failed",
    visibleContextRefs: request.visibleContextRefs,
  };
}

function queueCreateRequestFromAgentRequest(
  request: WorkspaceAgentV2QueueRunRequest,
): Omit<QueueCreateItemRequest, "workspaceId"> {
  const queueTagName = request.tags[0];

  return {
    actor: "workspace_agent",
    description: descriptionFromAgentRequest(request),
    priority: request.priority,
    prompt: request.prompt,
    queueTag: queueTagName ? { name: queueTagName } : undefined,
    status: queueStatusFromDesiredStatus(request.desiredStatus),
    title: titleFromObjective(request.objective),
  };
}

function queueStatusFromDesiredStatus(
  desiredStatus: WorkspaceAgentV2QueueRunDesiredStatus,
): "draft" | "queued" {
  return desiredStatus === "queued" ? "queued" : "draft";
}

function descriptionFromAgentRequest(
  request: WorkspaceAgentV2QueueRunRequest,
) {
  const details = [
    `Source: ${request.sourceModule}`,
    request.createdFromTranscriptId
      ? `Created from transcript: ${request.createdFromTranscriptId}`
      : null,
    request.createdFromRunId ? `Created from run: ${request.createdFromRunId}` : null,
    request.visibleContextRefs.length > 0
      ? `Visible context refs: ${request.visibleContextRefs
          .map((ref) => `${ref.type}:${ref.id}`)
          .join(", ")}`
      : "Visible context refs: none",
  ].filter((detail): detail is string => Boolean(detail));

  return details.join("\n");
}

function titleFromObjective(objective: string) {
  const firstLine = objective.split(/\r?\n/, 1)[0]?.trim() ?? "Workspace Agent task";
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

function visibleContextRefsFromComposer({
  contextItems,
  visibleContextSnapshot,
}: {
  readonly contextItems: readonly WorkspaceAgentV2ContextItem[];
  readonly visibleContextSnapshot?: AgentContextSnapshot;
}) {
  const refs = new Map<string, WorkspaceAgentV2QueueRunContextRef>();

  for (const ref of visibleContextSnapshot?.contextRefs ?? []) {
    refs.set(`snapshot:${ref.kind}:${ref.id}`, {
      id: ref.id,
      label: ref.label,
      scope: ref.scope,
      type: ref.kind,
    });
  }

  for (const item of contextItems) {
    refs.set(`item:${item.type}:${item.id}`, {
      id: item.id,
      label: item.label,
      scope: item.scope,
      source: item.source,
      type: item.type,
      version: item.version,
    });
  }

  return Array.from(refs.values());
}

function normalizedTags(tags: readonly string[]) {
  return tags.map((tag) => tag.trim()).filter(Boolean);
}

function unsupportedQueueRunResult({
  code,
  message,
}: {
  readonly code: WorkspaceAgentV2QueueRunUnsupportedResult["code"];
  readonly message: string;
}): WorkspaceAgentV2QueueRunUnsupportedResult {
  return {
    code,
    message,
    ok: false,
    sourceModule: WORKSPACE_AGENT_V2_QUEUE_RUN_SOURCE,
    status: "unsupported",
  };
}
