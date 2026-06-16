import type {
  AgentExecutorRunDetail,
  DirectWorkStreamEvent,
} from "../workspace/types";
import type {
  DirectWorkRunHandoff,
  QueueLinkedDirectWorkCompletionIdentity,
  QueueLinkedDirectWorkMetadata,
  QueueLinkedDirectWorkSource,
  WidgetInstanceId,
} from "./types";

export type QueueLinkedDirectWorkIdentityStatus =
  | "valid"
  | "invalid"
  | "not_queue_linked"
  | "run_mismatch"
  | "missing_queue_item"
  | "missing_run_id"
  | "missing_executor_widget";

export type QueueLinkedDirectWorkMetadataResult =
  | {
      readonly metadata: QueueLinkedDirectWorkMetadata;
      readonly reasons: readonly [];
      readonly status: "valid";
    }
  | {
      readonly metadata?: undefined;
      readonly reasons: readonly string[];
      readonly status: Exclude<QueueLinkedDirectWorkIdentityStatus, "valid" | "run_mismatch">;
    };

export type QueueLinkedDirectWorkCompletionIdentityResult =
  | {
      readonly handoff: DirectWorkRunHandoff | null;
      readonly identity: QueueLinkedDirectWorkCompletionIdentity;
      readonly metadata: QueueLinkedDirectWorkMetadata;
      readonly reasons: readonly [];
      readonly status: "valid";
    }
  | {
      readonly handoff?: DirectWorkRunHandoff | null;
      readonly identity?: undefined;
      readonly metadata?: QueueLinkedDirectWorkMetadata;
      readonly reasons: readonly string[];
      readonly status: Exclude<QueueLinkedDirectWorkIdentityStatus, "valid">;
    };

export type QueueLinkedDirectWorkKeyInput = {
  readonly attemptId?: string | null;
  readonly queueItemId: string;
  readonly runId: string;
  readonly workspaceId?: string | null;
};

export type QueueLinkedDirectWorkMetadataInput = {
  readonly attemptId?: string | null;
  readonly completedAt?: string | null;
  readonly executorWidgetId?: string | null;
  readonly linkedAt?: string | null;
  readonly queueItemId?: string | null;
  readonly runId?: string | null;
  readonly source?: QueueLinkedDirectWorkSource | null;
  readonly workbenchId?: string | null;
  readonly workspaceId?: string | null;
};

export type QueueLinkedDirectWorkCompletionInput = {
  readonly completedAt?: string | null;
  readonly finalStatus?: string | null;
  readonly handoff?: DirectWorkRunHandoff | null;
  readonly metadata?: QueueLinkedDirectWorkMetadata | null;
  readonly runDetail?: AgentExecutorRunDetail | null;
  readonly source?: QueueLinkedDirectWorkSource | null;
  readonly streamEvent?: DirectWorkStreamEvent | null;
};

const METADATA_KIND = "queue_linked_direct_work_metadata" as const;
const COMPLETION_IDENTITY_KIND =
  "queue_linked_direct_work_completion_identity" as const;
const DEFAULT_SOURCE: QueueLinkedDirectWorkSource = "queue_handoff";
const FRONTEND_SESSION_SCOPE = "frontend-session";
const HUMAN_SUMMARY_MAX_LENGTH = 220;

export function createQueueLinkedDirectWorkMetadata(
  input: QueueLinkedDirectWorkMetadataInput,
): QueueLinkedDirectWorkMetadataResult {
  const queueItemId = trimmed(input.queueItemId);
  const runId = trimmed(input.runId);
  const executorWidgetId = trimmed(input.executorWidgetId);

  if (!queueItemId) {
    return invalidMetadata(
      "not_queue_linked",
      "Explicit Queue item id is required for Queue-linked Direct Work metadata.",
    );
  }

  if (!runId) {
    return invalidMetadata(
      "missing_run_id",
      "Explicit Direct Work run id is required for Queue-linked Direct Work metadata.",
    );
  }

  if (!executorWidgetId) {
    return invalidMetadata(
      "missing_executor_widget",
      "Explicit Agent Executor widget id is required for Queue-linked Direct Work metadata.",
    );
  }

  const workspaceId = optionalTrimmed(input.workspaceId);
  const attemptId = optionalTrimmed(input.attemptId);
  const idempotencyKey = getQueueLinkedDirectWorkIngestionKey({
    attemptId,
    queueItemId,
    runId,
    workspaceId,
  });

  return {
    metadata: {
      attemptId,
      completedAt: optionalTrimmed(input.completedAt),
      durable: false,
      executorWidgetId,
      frontendOnly: true,
      idempotencyKey,
      ingestionId: idempotencyKey,
      kind: METADATA_KIND,
      linkedAt: optionalTrimmed(input.linkedAt) ?? new Date().toISOString(),
      queueItemId,
      runId,
      source: input.source ?? DEFAULT_SOURCE,
      version: 1,
      workbenchId: optionalTrimmed(input.workbenchId),
      workspaceId,
    },
    reasons: [],
    status: "valid",
  };
}

export function createQueueLinkedDirectWorkMetadataFromHandoff(
  handoff: DirectWorkRunHandoff,
  options: {
    readonly completedAt?: string | null;
    readonly linkedAt?: string | null;
    readonly source?: QueueLinkedDirectWorkSource | null;
  } = {},
): QueueLinkedDirectWorkMetadataResult {
  return createQueueLinkedDirectWorkMetadata({
    attemptId: handoff.attemptId,
    completedAt:
      options.completedAt ?? handoff.queueLinkedMetadata?.completedAt,
    executorWidgetId: handoff.executorWidgetInstanceId,
    linkedAt:
      options.linkedAt ??
      handoff.queueLinkedMetadata?.linkedAt ??
      handoff.startedAt,
    queueItemId: handoff.queueItemId,
    runId: handoff.runId,
    source:
      options.source ??
      handoff.queueLinkedSource ??
      handoff.queueLinkedMetadata?.source ??
      DEFAULT_SOURCE,
    workbenchId: handoff.workbenchId,
    workspaceId: handoff.workspaceId,
  });
}

export function withQueueLinkedDirectWorkMetadata(
  handoff: DirectWorkRunHandoff,
  options: {
    readonly completedAt?: string | null;
    readonly linkedAt?: string | null;
    readonly source?: QueueLinkedDirectWorkSource | null;
  } = {},
): DirectWorkRunHandoff {
  const metadataResult = createQueueLinkedDirectWorkMetadataFromHandoff(
    handoff,
    options,
  );

  if (metadataResult.status !== "valid") {
    return {
      ...handoff,
      executorWidgetInstanceId: handoff.executorWidgetInstanceId.trim(),
      queueItemId: handoff.queueItemId.trim(),
      repoRoot: handoff.repoRoot.trim(),
      runId: handoff.runId.trim(),
      taskTitle: handoff.taskTitle.trim() || "Queue task",
    };
  }

  return {
    ...handoff,
    attemptId: metadataResult.metadata.attemptId,
    executorWidgetInstanceId: metadataResult.metadata.executorWidgetId,
    queueItemId: metadataResult.metadata.queueItemId,
    queueLinkedMetadata: metadataResult.metadata,
    queueLinkedSource: metadataResult.metadata.source,
    repoRoot: handoff.repoRoot.trim(),
    runId: metadataResult.metadata.runId,
    taskTitle: handoff.taskTitle.trim() || "Queue task",
  };
}

export function validateQueueLinkedDirectWorkMetadata(
  value: unknown,
): QueueLinkedDirectWorkMetadataResult {
  if (!isRecord(value)) {
    return invalidMetadata(
      "not_queue_linked",
      "Queue-linked Direct Work metadata is missing.",
    );
  }

  if (value.kind !== METADATA_KIND || value.version !== 1) {
    return invalidMetadata(
      "invalid",
      "Queue-linked Direct Work metadata kind or version is invalid.",
    );
  }

  if (value.frontendOnly !== true || value.durable !== false) {
    return invalidMetadata(
      "invalid",
      "Queue-linked Direct Work metadata durability flags are invalid.",
    );
  }

  if (!optionalTrimmed(stringOrNull(value.linkedAt))) {
    return invalidMetadata(
      "invalid",
      "Queue-linked Direct Work metadata linked timestamp is missing.",
    );
  }

  if (!isQueueLinkedDirectWorkSource(value.source)) {
    return invalidMetadata(
      "invalid",
      "Queue-linked Direct Work metadata source is invalid.",
    );
  }

  const result = createQueueLinkedDirectWorkMetadata({
    attemptId: stringOrNull(value.attemptId),
    completedAt: stringOrNull(value.completedAt),
    executorWidgetId: stringOrNull(value.executorWidgetId),
    linkedAt: stringOrNull(value.linkedAt),
    queueItemId: stringOrNull(value.queueItemId),
    runId: stringOrNull(value.runId),
    source: value.source,
    workbenchId: stringOrNull(value.workbenchId),
    workspaceId: stringOrNull(value.workspaceId),
  });

  if (result.status !== "valid") {
    return result.status === "not_queue_linked"
      ? invalidMetadata(
          "missing_queue_item",
          "Queue-linked Direct Work metadata is missing the Queue item id.",
        )
      : result;
  }

  if (
    value.idempotencyKey !== result.metadata.idempotencyKey ||
    value.ingestionId !== result.metadata.ingestionId
  ) {
    return invalidMetadata(
      "invalid",
      "Queue-linked Direct Work metadata idempotency key is not stable for its task and run.",
    );
  }

  return result;
}

export function isQueueLinkedDirectWorkMetadata(
  value: unknown,
): value is QueueLinkedDirectWorkMetadata {
  return validateQueueLinkedDirectWorkMetadata(value).status === "valid";
}

export function assertQueueLinkedRunDetailMatches(
  metadataOrHandoff: QueueLinkedDirectWorkMetadata | DirectWorkRunHandoff,
  runDetail?: AgentExecutorRunDetail | null,
): QueueLinkedDirectWorkCompletionIdentityResult {
  if (!runDetail) {
    return invalidCompletion(
      "invalid",
      "Agent Executor run detail is not available.",
    );
  }

  return createQueueLinkedDirectWorkCompletionIdentity({
    metadata: isQueueLinkedDirectWorkMetadata(metadataOrHandoff)
      ? metadataOrHandoff
      : metadataOrHandoff.queueLinkedMetadata,
    handoff: isQueueLinkedDirectWorkMetadata(metadataOrHandoff)
      ? null
      : metadataOrHandoff,
    runDetail,
  });
}

export function createQueueLinkedDirectWorkCompletionIdentity(
  input: QueueLinkedDirectWorkCompletionInput,
): QueueLinkedDirectWorkCompletionIdentityResult {
  const metadataResult = metadataForCompletionInput(input);

  if (metadataResult.status !== "valid") {
    return invalidCompletion(metadataResult.status, metadataResult.reasons[0]);
  }

  const metadata = metadataResult.metadata;
  const detailRunId = input.runDetail?.summary.runId ?? null;
  const streamRunId = input.streamEvent?.runId ?? null;

  if (detailRunId && detailRunId !== metadata.runId) {
    return invalidCompletion(
      "run_mismatch",
      "Agent Executor run detail does not match the Queue-linked Direct Work run id.",
      metadata,
      input.handoff ?? null,
    );
  }

  if (streamRunId && streamRunId !== metadata.runId) {
    return invalidCompletion(
      "run_mismatch",
      "Direct Work stream event does not match the Queue-linked Direct Work run id.",
      metadata,
      input.handoff ?? null,
    );
  }

  if (input.streamEvent && !input.streamEvent.isFinal) {
    return invalidCompletion(
      "invalid",
      "Direct Work stream event is not a final event.",
      metadata,
      input.handoff ?? null,
    );
  }

  const completedAt =
    optionalTrimmed(input.completedAt) ??
    optionalTrimmed(input.runDetail?.summary.finishedAt) ??
    optionalTrimmed(metadata.completedAt);
  const source = input.source ?? metadata.source;
  const completionMetadata =
    completedAt || source !== metadata.source
      ? createQueueLinkedDirectWorkMetadata({
          attemptId: metadata.attemptId,
          completedAt,
          executorWidgetId: metadata.executorWidgetId,
          linkedAt: metadata.linkedAt,
          queueItemId: metadata.queueItemId,
          runId: metadata.runId,
          source: metadata.source,
          workbenchId: metadata.workbenchId,
          workspaceId: metadata.workspaceId,
        })
      : { metadata, status: "valid" as const };
  const resolvedMetadata =
    completionMetadata.status === "valid"
      ? completionMetadata.metadata
      : metadata;
  const handoff = input.handoff
    ? withQueueLinkedDirectWorkMetadata(input.handoff, {
        completedAt,
        source: metadata.source,
      })
    : null;

  return {
    handoff,
    identity: {
      attemptId: resolvedMetadata.attemptId,
      completedAt,
      detailRunId,
      durable: false,
      executorWidgetId: resolvedMetadata.executorWidgetId,
      finalStatus:
        optionalTrimmed(input.finalStatus) ??
        optionalTrimmed(input.streamEvent?.finalStatus) ??
        optionalTrimmed(input.streamEvent?.status) ??
        optionalTrimmed(input.streamEvent?.eventKind) ??
        optionalTrimmed(input.runDetail?.summary.status),
      frontendOnly: true,
      idempotencyKey: resolvedMetadata.idempotencyKey,
      ingestionId: resolvedMetadata.ingestionId,
      kind: COMPLETION_IDENTITY_KIND,
      linkedAt: resolvedMetadata.linkedAt,
      metadata: resolvedMetadata,
      queueItemId: resolvedMetadata.queueItemId,
      runId: resolvedMetadata.runId,
      source,
      streamRunId,
      version: 1,
      workbenchId: resolvedMetadata.workbenchId,
      workspaceId: resolvedMetadata.workspaceId,
    },
    metadata: resolvedMetadata,
    reasons: [],
    status: "valid",
  };
}

export function getQueueLinkedDirectWorkIngestionKey({
  attemptId,
  queueItemId,
  runId,
  workspaceId,
}: QueueLinkedDirectWorkKeyInput): string {
  const workspaceScope = optionalTrimmed(workspaceId) ?? FRONTEND_SESSION_SCOPE;
  const attemptScope = optionalTrimmed(attemptId) ?? runId.trim();

  return [
    "queue-linked-direct-work",
    `workspace:${workspaceScope}`,
    `queue-item:${queueItemId.trim()}`,
    `run:${runId.trim()}`,
    `attempt:${attemptScope}`,
  ]
    .map(encodeURIComponent)
    .join(":");
}

export function getQueueLinkedDirectWorkHumanSummary(
  metadata: QueueLinkedDirectWorkMetadata,
  maxLength = HUMAN_SUMMARY_MAX_LENGTH,
): string {
  const summary = [
    `Queue-linked Direct Work run ${metadata.runId}.`,
    "Frontend-only metadata, not durable.",
    `Queue item ${metadata.queueItemId}; executor ${metadata.executorWidgetId}.`,
  ].join(" ");

  return boundText(summary, maxLength);
}

function metadataForCompletionInput(
  input: QueueLinkedDirectWorkCompletionInput,
): QueueLinkedDirectWorkMetadataResult {
  const suppliedMetadata = input.metadata ?? input.handoff?.queueLinkedMetadata;
  const suppliedValidation = suppliedMetadata
    ? validateQueueLinkedDirectWorkMetadata(suppliedMetadata)
    : null;

  if (suppliedValidation?.status === "valid") {
    return suppliedValidation;
  }

  if (!input.handoff) {
    return invalidMetadata(
      "not_queue_linked",
      "Explicit Queue-linked Direct Work handoff metadata is required.",
    );
  }

  return createQueueLinkedDirectWorkMetadataFromHandoff(input.handoff, {
    completedAt: input.completedAt,
    source: input.source ?? input.handoff.queueLinkedSource,
  });
}

function isQueueLinkedDirectWorkSource(
  value: unknown,
): value is QueueLinkedDirectWorkSource {
  return (
    value === "queue_handoff" ||
    value === "queue_manual_start" ||
    value === "queue_sequential_start" ||
    value === "queue_autonomous_start" ||
    value === "queue_autorun_start" ||
    value === "recovered_handoff"
  );
}

function invalidMetadata(
  status: QueueLinkedDirectWorkMetadataResult["status"],
  reason: string,
): QueueLinkedDirectWorkMetadataResult {
  return {
    reasons: [reason],
    status,
  } as QueueLinkedDirectWorkMetadataResult;
}

function invalidCompletion(
  status: Exclude<QueueLinkedDirectWorkIdentityStatus, "valid">,
  reason = "Queue-linked Direct Work completion identity is invalid.",
  metadata?: QueueLinkedDirectWorkMetadata,
  handoff?: DirectWorkRunHandoff | null,
): QueueLinkedDirectWorkCompletionIdentityResult {
  return {
    handoff,
    metadata,
    reasons: [reason],
    status,
  };
}

function optionalTrimmed(value: string | null | undefined): string | null {
  const text = trimmed(value);

  return text || null;
}

function trimmed(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function boundText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
