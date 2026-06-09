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

export type WorkspaceAgentV2QueueRunContextAttachment = {
  readonly id: string;
  readonly label: string;
  readonly sourceLabel: string;
  readonly type: WorkspaceAgentV2QueueRunContextRef["type"];
};

export type WorkspaceAgentV2QueueRunContextSkip = {
  readonly id: string;
  readonly label: string;
  readonly reason: string;
  readonly sourceLabel: string;
  readonly type: WorkspaceAgentV2QueueRunContextRef["type"];
};

export type WorkspaceAgentV2QueueRunContextAttachmentReport = {
  readonly attached: readonly WorkspaceAgentV2QueueRunContextAttachment[];
  readonly skipped: readonly WorkspaceAgentV2QueueRunContextSkip[];
  readonly sourceLabels: readonly string[];
  readonly warnings: readonly string[];
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
  readonly visibleContextItems: readonly WorkspaceAgentV2ContextItem[];
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
  readonly contextAttachmentReport: WorkspaceAgentV2QueueRunContextAttachmentReport;
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
  readonly contextAttachmentReport: WorkspaceAgentV2QueueRunContextAttachmentReport;
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
  readonly queueBridge?: Pick<
    WorkspaceAgentQueueBridge,
    "attachKnowledgeToQueueTask" | "attachSkillToQueueTask" | "createItem"
  > | null;
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
      visibleContextItems: contextItems,
      visibleContextRefs: visibleContextRefsFromComposer({
        contextItems,
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
  const attachmentReport =
    created.ok && created.item
      ? await attachVisibleContextToCreatedQueueTask({
          queueBridge: dependencies.queueBridge,
          queueItemId: created.item.id,
          visibleContextItems: request.visibleContextItems,
        })
      : emptyContextAttachmentReport(request.visibleContextItems);

  return mapQueueTaskCreatedResult({
    contextAttachmentReport: attachmentReport,
    queueCreateResult: created,
    request,
  });
}

export function mapQueueTaskCreatedResult({
  contextAttachmentReport,
  queueCreateResult,
  request,
}: {
  readonly contextAttachmentReport?: WorkspaceAgentV2QueueRunContextAttachmentReport;
  readonly queueCreateResult: QueueWidgetActionResult<QueueWidgetItemSnapshot>;
  readonly request: WorkspaceAgentV2QueueRunRequest;
}): WorkspaceAgentV2QueueRunResult {
  const report =
    contextAttachmentReport ?? emptyContextAttachmentReport(request.visibleContextItems);

  if (queueCreateResult.ok && queueCreateResult.item) {
    return {
      action: "queue.createItem",
      contextAttachmentReport: report,
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
    contextAttachmentReport: report,
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
    `Visible context refs selected: ${request.visibleContextRefs.length.toString()}`,
  ].filter((detail): detail is string => Boolean(detail));

  return details.join("\n");
}

function titleFromObjective(objective: string) {
  const firstLine = objective.split(/\r?\n/, 1)[0]?.trim() ?? "Workspace Agent task";
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

function visibleContextRefsFromComposer({
  contextItems,
}: {
  readonly contextItems: readonly WorkspaceAgentV2ContextItem[];
}) {
  const refs = new Map<string, WorkspaceAgentV2QueueRunContextRef>();

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

async function attachVisibleContextToCreatedQueueTask({
  queueBridge,
  queueItemId,
  visibleContextItems,
}: {
  readonly queueBridge: NonNullable<WorkspaceAgentV2QueueRunDependencies["queueBridge"]>;
  readonly queueItemId: string;
  readonly visibleContextItems: readonly WorkspaceAgentV2ContextItem[];
}): Promise<WorkspaceAgentV2QueueRunContextAttachmentReport> {
  const attached: WorkspaceAgentV2QueueRunContextAttachment[] = [];
  const skipped: WorkspaceAgentV2QueueRunContextSkip[] = [];
  const warnings: string[] = [];

  for (const item of visibleContextItems) {
    const sourceLabel = contextSourceLabel(item);
    const blockedReason = blockedContextReason(item);

    if (blockedReason) {
      skipped.push(contextSkip(item, sourceLabel, blockedReason));
      warnings.push(`${item.label}: ${blockedReason}`);
      continue;
    }

    for (const warning of warningContextReasons(item)) {
      warnings.push(`${item.label}: ${warning}`);
    }

    try {
      if (item.type === "knowledge") {
        if (!queueBridge.attachKnowledgeToQueueTask) {
          const reason =
            "Knowledge context could not be durably attached because the Queue Knowledge attach API is unavailable; no document body was copied into the prompt.";
          skipped.push(contextSkip(item, sourceLabel, reason));
          warnings.push(`${item.label}: ${reason}`);
          continue;
        }

        await queueBridge.attachKnowledgeToQueueTask({
          knowledgeId: item.id,
          queueItemId,
        });
        attached.push(contextAttachment(item, sourceLabel));
        continue;
      }

      if (item.type === "skill") {
        if (!queueBridge.attachSkillToQueueTask) {
          const reason =
            "Skill context could not be durably attached because the Queue Skill attach API is unavailable; no Skill body was copied into the prompt.";
          skipped.push(contextSkip(item, sourceLabel, reason));
          warnings.push(`${item.label}: ${reason}`);
          continue;
        }

        await queueBridge.attachSkillToQueueTask({
          queueItemId,
          skillId: item.id,
        });
        attached.push(contextAttachment(item, sourceLabel));
        continue;
      }

      const reason = unsupportedContextReason(item.type);
      skipped.push(contextSkip(item, sourceLabel, reason));
      warnings.push(`${item.label}: ${reason}`);
    } catch (error) {
      const reason = `Durable context attach failed: ${errorToMessage(error)}`;
      skipped.push(contextSkip(item, sourceLabel, reason));
      warnings.push(`${item.label}: ${reason}`);
    }
  }

  return {
    attached,
    skipped,
    sourceLabels: Array.from(
      new Set([...attached, ...skipped].map((item) => item.sourceLabel)),
    ),
    warnings,
  };
}

function emptyContextAttachmentReport(
  visibleContextItems: readonly WorkspaceAgentV2ContextItem[],
): WorkspaceAgentV2QueueRunContextAttachmentReport {
  return {
    attached: [],
    skipped: [],
    sourceLabels: Array.from(
      new Set(visibleContextItems.map((item) => contextSourceLabel(item))),
    ),
    warnings: [],
  };
}

function contextAttachment(
  item: WorkspaceAgentV2ContextItem,
  sourceLabel: string,
): WorkspaceAgentV2QueueRunContextAttachment {
  return {
    id: item.id,
    label: item.label,
    sourceLabel,
    type: item.type,
  };
}

function contextSkip(
  item: WorkspaceAgentV2ContextItem,
  sourceLabel: string,
  reason: string,
): WorkspaceAgentV2QueueRunContextSkip {
  return {
    id: item.id,
    label: item.label,
    reason,
    sourceLabel,
    type: item.type,
  };
}

function contextSourceLabel(item: WorkspaceAgentV2ContextItem) {
  return item.source?.trim() || item.label;
}

function blockedContextReason(item: WorkspaceAgentV2ContextItem) {
  const warnings = item.warnings ?? [];

  if (warnings.includes("disabled")) {
    return "Disabled context was skipped and was not attached.";
  }

  if (warnings.includes("rejected")) {
    return "Rejected context was skipped and was not attached.";
  }

  if (warnings.includes("secret")) {
    return "Secret-bearing context was skipped and was not attached.";
  }

  return null;
}

function warningContextReasons(item: WorkspaceAgentV2ContextItem) {
  return (item.warnings ?? []).flatMap((warning) => {
    if (warning === "stale") {
      return ["Stale context was attached with a visible warning."];
    }
    if (warning === "large") {
      return ["Large context was attached only by ref/API; no full text was copied."];
    }
    return [];
  });
}

function unsupportedContextReason(type: WorkspaceAgentV2QueueRunContextRef["type"]) {
  if (type === "file") {
    return "File context cannot be durably attached by WorkspaceAgentV2 Queue Run yet; no file content was copied into the prompt.";
  }
  if (type === "note" || type === "manual") {
    return "Notes/manual context cannot be durably attached by WorkspaceAgentV2 Queue Run yet; no full text was copied into the prompt.";
  }
  if (type === "queue-task-context") {
    return "Queue task context refs cannot be durably attached by WorkspaceAgentV2 Queue Run yet; no context body was copied into the prompt.";
  }
  return "This context type has no durable Queue attach API in WorkspaceAgentV2 Queue Run; no text was copied into the prompt.";
}

function errorToMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Unknown attach error.";
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
