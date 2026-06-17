import type {
  AgentExecutorRunDetail,
  DirectWorkStreamEvent,
} from "../workspace/types";
import type {
  DirectWorkRunHandoff,
  QueueLinkedDirectWorkCompletionIdentity,
  QueueLinkedDirectWorkSource,
} from "./types";
import {
  createQueueLinkedDirectWorkCompletionIdentity,
  type QueueLinkedDirectWorkCompletionIdentityResult,
} from "./queueLinkedDirectWorkMetadata";
import type {
  QueueLinkedAgentExecutorIngestionInput,
  QueueWorkerEvidenceIngestionResult,
} from "./queue/smartQueueWorkerEvidenceIngestion";

export type QueueLinkedDirectWorkEvidenceWiringStatus =
  | "success"
  | "not_queue_linked"
  | "missing_queue_item"
  | "missing_run_id"
  | "missing_executor_widget"
  | "run_detail_unavailable"
  | "run_mismatch"
  | "evidence_invalid"
  | "ingestion_unavailable"
  | "duplicate_ignored"
  | "broker_failed";

export type QueueLinkedDirectWorkEvidenceIngestionCallback = (
  input: QueueLinkedAgentExecutorIngestionInput,
) => Promise<QueueWorkerEvidenceIngestionResult>;

export type QueueLinkedDirectWorkEvidenceWiringInput = {
  readonly finalStatus?: string | null;
  readonly handoff?: DirectWorkRunHandoff | null;
  readonly handledIngestionKeys?: Set<string>;
  readonly ingestEvidence?: QueueLinkedDirectWorkEvidenceIngestionCallback;
  readonly runDetail?: AgentExecutorRunDetail | null;
  readonly source?: QueueLinkedDirectWorkSource | null;
  readonly streamEvent?: DirectWorkStreamEvent | null;
};

export type QueueLinkedDirectWorkEvidenceWiringResult = {
  readonly activityTitle: string;
  readonly executorWidgetId?: string;
  readonly idempotencyKey?: string;
  readonly ingestionResult?: QueueWorkerEvidenceIngestionResult;
  readonly message: string;
  readonly productStatusLabel: string;
  readonly reasons: readonly string[];
  readonly runId?: string;
  readonly status: QueueLinkedDirectWorkEvidenceWiringStatus;
  readonly taskId?: string;
};

export async function ingestQueueLinkedDirectWorkCompletionEvidence(
  input: QueueLinkedDirectWorkEvidenceWiringInput,
): Promise<QueueLinkedDirectWorkEvidenceWiringResult> {
  const identityResult = createQueueLinkedDirectWorkCompletionIdentity({
    finalStatus: input.finalStatus,
    handoff: input.handoff,
    runDetail: input.runDetail,
    source: input.source,
    streamEvent: input.streamEvent,
  });

  if (identityResult.status !== "valid") {
    return identityFailureResult(identityResult, input.handoff ?? null);
  }

  const identity = identityResult.identity;
  const runDetail = input.runDetail;

  if (!runDetail) {
    return failedResult({
      identity,
      message:
        "Queue-linked Direct Work evidence ingestion requires final Agent Executor run detail.",
      reasons: ["AgentExecutorRunDetail is unavailable."],
      status: "run_detail_unavailable",
    });
  }

  if (runDetail.summary.runId !== identity.runId) {
    return failedResult({
      identity,
      message:
        "Queue-linked Direct Work evidence ingestion requires matching Agent Executor run detail.",
      reasons: [
        "AgentExecutorRunDetail runId does not match the Queue-linked Direct Work run id.",
      ],
      status: "run_mismatch",
    });
  }

  if (!isFinalRunDetailStatus(runDetail.summary.status)) {
    return failedResult({
      identity,
      message:
        "Queue-linked Direct Work evidence ingestion requires final Agent Executor run detail.",
      reasons: ["AgentExecutorRunDetail is not in a final state."],
      status: "run_detail_unavailable",
    });
  }

  const handledIngestionKeys = input.handledIngestionKeys;
  if (handledIngestionKeys?.has(identity.idempotencyKey)) {
    return skippedResult({
      identity,
      message:
        "Queue-linked Direct Work evidence ingestion was already handled in this UI session.",
      reasons: ["Duplicate completion idempotency key ignored."],
      status: "duplicate_ignored",
    });
  }

  if (!input.ingestEvidence) {
    return failedResult({
      identity,
      message: "Queue worker evidence ingestion dependency is unavailable.",
      reasons: ["Evidence ingestion callback is required."],
      status: "ingestion_unavailable",
    });
  }

  handledIngestionKeys?.add(identity.idempotencyKey);

  try {
    const ingestionResult = await input.ingestEvidence({
      attemptId: identity.attemptId ?? undefined,
      detail: runDetail,
      logReference: queueLinkedRunLogReference(identity.runId),
      requestId: identity.ingestionId,
      taskId: identity.queueItemId,
      threadId: trimmed(input.streamEvent?.codexThreadId) ?? undefined,
      workerId: identity.executorWidgetId,
    });

    return resultFromBridge(identity, ingestionResult);
  } catch (error) {
    return failedResult({
      identity,
      message: errorToMessage(
        error,
        "Queue worker evidence ingestion failed before the broker returned a result.",
      ),
      reasons: ["Evidence ingestion callback threw before broker completion."],
      status: "broker_failed",
    });
  }
}

function resultFromBridge(
  identity: QueueLinkedDirectWorkCompletionIdentity,
  ingestionResult: QueueWorkerEvidenceIngestionResult,
): QueueLinkedDirectWorkEvidenceWiringResult {
  const status = wiringStatusFromIngestion(ingestionResult.status);
  const success = status === "success";

  return {
    activityTitle: success
      ? "Queue worker evidence ingested"
      : status === "ingestion_unavailable"
        ? "Queue worker evidence ingestion failed"
        : "Queue worker evidence ingestion failed",
    executorWidgetId: identity.executorWidgetId,
    idempotencyKey: identity.idempotencyKey,
    ingestionResult,
    message: ingestionResult.message,
    productStatusLabel: ingestionResult.productStatusLabel,
    reasons: ingestionResult.reasons,
    runId: identity.runId,
    status,
    taskId: identity.queueItemId,
  };
}

function identityFailureResult(
  identityResult: Exclude<
    QueueLinkedDirectWorkCompletionIdentityResult,
    { status: "valid" }
  >,
  handoff: DirectWorkRunHandoff | null,
): QueueLinkedDirectWorkEvidenceWiringResult {
  const status = identityFailureStatus(identityResult.status, handoff);

  if (status === "run_mismatch") {
    return failedResult({
      message: identityFailureMessage(status),
      reasons: identityResult.reasons,
      status,
    });
  }

  return skippedResult({
    message: identityFailureMessage(status),
    reasons: identityResult.reasons,
    status,
  });
}

function identityFailureStatus(
  status: Exclude<QueueLinkedDirectWorkCompletionIdentityResult["status"], "valid">,
  handoff: DirectWorkRunHandoff | null,
): Extract<
  QueueLinkedDirectWorkEvidenceWiringStatus,
  | "not_queue_linked"
  | "missing_queue_item"
  | "missing_run_id"
  | "missing_executor_widget"
  | "run_mismatch"
> {
  if (status === "run_mismatch") {
    return "run_mismatch";
  }

  if (status === "missing_run_id") {
    return "missing_run_id";
  }

  if (status === "missing_executor_widget") {
    return "missing_executor_widget";
  }

  if (status === "missing_queue_item") {
    return "missing_queue_item";
  }

  if (status === "not_queue_linked") {
    return handoff ? "missing_queue_item" : "not_queue_linked";
  }

  return "not_queue_linked";
}

function identityFailureMessage(
  status: QueueLinkedDirectWorkEvidenceWiringStatus,
) {
  switch (status) {
    case "missing_queue_item":
      return "Queue-linked Direct Work evidence ingestion requires an explicit Queue item id.";
    case "missing_run_id":
      return "Queue-linked Direct Work evidence ingestion requires an explicit Direct Work run id.";
    case "missing_executor_widget":
      return "Queue-linked Direct Work evidence ingestion requires an explicit Agent Executor widget id.";
    case "run_mismatch":
      return "Queue-linked Direct Work evidence ingestion requires matching run identity.";
    default:
      return "Run is not explicitly linked to a Queue task.";
  }
}

function wiringStatusFromIngestion(
  status: QueueWorkerEvidenceIngestionResult["status"],
): QueueLinkedDirectWorkEvidenceWiringStatus {
  if (status === "success") {
    return "success";
  }

  if (status === "invalid_input" || status === "not_linked") {
    return "evidence_invalid";
  }

  if (status === "unavailable") {
    return "ingestion_unavailable";
  }

  return "broker_failed";
}

function failedResult({
  identity,
  message,
  reasons,
  status,
}: {
  readonly identity?: {
    readonly executorWidgetId: string;
    readonly idempotencyKey: string;
    readonly queueItemId: string;
    readonly runId: string;
  };
  readonly message: string;
  readonly reasons: readonly string[];
  readonly status: Exclude<
    QueueLinkedDirectWorkEvidenceWiringStatus,
    "success" | "duplicate_ignored" | "not_queue_linked" | "missing_queue_item" | "missing_run_id" | "missing_executor_widget"
  >;
}): QueueLinkedDirectWorkEvidenceWiringResult {
  return {
    activityTitle: "Queue worker evidence ingestion failed",
    ...(identity
      ? {
          executorWidgetId: identity.executorWidgetId,
          idempotencyKey: identity.idempotencyKey,
          runId: identity.runId,
          taskId: identity.queueItemId,
        }
      : {}),
    message,
    productStatusLabel: "Queue worker evidence ingestion failed",
    reasons,
    status,
  };
}

function skippedResult({
  identity,
  message,
  reasons,
  status,
}: {
  readonly identity?: {
    readonly executorWidgetId: string;
    readonly idempotencyKey: string;
    readonly queueItemId: string;
    readonly runId: string;
  };
  readonly message: string;
  readonly reasons: readonly string[];
  readonly status: Extract<
    QueueLinkedDirectWorkEvidenceWiringStatus,
    | "duplicate_ignored"
    | "not_queue_linked"
    | "missing_queue_item"
    | "missing_run_id"
    | "missing_executor_widget"
  >;
}): QueueLinkedDirectWorkEvidenceWiringResult {
  return {
    activityTitle: "Queue worker evidence ingestion skipped",
    ...(identity
      ? {
          executorWidgetId: identity.executorWidgetId,
          idempotencyKey: identity.idempotencyKey,
          runId: identity.runId,
          taskId: identity.queueItemId,
        }
      : {}),
    message,
    productStatusLabel: "Queue worker evidence ingestion skipped",
    reasons,
    status,
  };
}

function queueLinkedRunLogReference(runId: string) {
  return `Agent Executor run detail: ${runId}`;
}

function isFinalRunDetailStatus(status: string) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "timed_out" ||
    status === "cancelled" ||
    status === "canceled"
  );
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

function trimmed(value: string | null | undefined) {
  const text = value?.trim() ?? "";

  return text || null;
}
