import { createActionResult } from "../broker/results";
import {
  normalizeQueueWorkerEvidenceBundle,
  toLifecycleAgentFinishedInput,
  type QueueWorkerEvidenceBundle,
} from "../../queue/smartQueueWorkerEvidenceBundle";
import {
  QUEUE_START_RUN_CONFIRMATION_FIELD,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
} from "../capabilities/queueCapabilityContracts";
import type {
  HobitAgentActionHandlerMap,
  HobitAgentActionRequest,
  HobitAgentActionResult,
} from "../broker/types";
import {
  noHiddenSideEffectFlags,
  queueAgentCapabilityStatusToBrokerStatus,
  queueSideEffectFlags,
  QUEUE_ACTIVITY_EVENTS,
  type QueueAgentAdapterApi,
  type QueueAgentAdapterResult,
  type QueueAgentAddFollowUpPromptInput,
  type QueueAgentApproveValidationInput,
  type QueueAgentBlockInput,
  type QueueAgentFailInput,
  type QueueAgentLifecycleAgentFinishedInput,
  type QueueAgentLifecycleGetInput,
  type QueueAgentMarkDoneInput,
  type QueueAgentMaybePromise,
  type QueueAgentReviewAckInput,
  type QueueAgentReviewCreateMessageInput,
  type QueueAgentReviewEvidenceBundleInput,
} from "./queueAgentCapabilityTypes";

type QueueDogfoodLifecycleHandlerResult =
  | HobitAgentActionResult
  | Promise<HobitAgentActionResult>;

type ValidationResult<T> =
  | { ok: true; value: T }
  | { fieldPath?: string; message: string; ok: false };

const AGENT_OUTCOMES = new Set(["completed", "not_completed", "failed"]);

type NormalizedAgentFinishedInput = Required<
  Pick<
    QueueAgentLifecycleAgentFinishedInput,
    "finalAgentMessage" | "outcome" | "runId" | "taskId"
  >
> &
  Omit<
    QueueAgentLifecycleAgentFinishedInput,
    "finalAgentMessage" | "outcome" | "runId" | "taskId"
  >;

export function createQueueAgentDogfoodLifecycleActionHandlers(
  adapterApi: QueueAgentAdapterApi,
): HobitAgentActionHandlerMap {
  return {
    "queue.coordinator.addFollowUpPrompt": ({ request }) =>
      handleAddFollowUpPrompt(adapterApi, request),
    "queue.coordinator.approveValidation": ({ request }) =>
      handleApproveValidation(adapterApi, request),
    "queue.item.block": ({ request }) => handleBlockItem(adapterApi, request),
    "queue.item.fail": ({ request }) => handleFailItem(adapterApi, request),
    "queue.item.markDone": ({ request }) => handleMarkDone(adapterApi, request),
    "queue.lifecycle.agentFinished": ({ request }) =>
      handleAgentFinished(adapterApi, request),
    "queue.lifecycle.get": ({ request }) => handleGetLifecycle(adapterApi, request),
    "queue.review.ack": ({ request }) => handleReviewAck(adapterApi, request),
    "queue.review.createMessage": ({ request }) =>
      handleCreateReviewMessage(adapterApi, request),
    "queue.review.getEvidenceBundle": ({ request }) =>
      handleGetEvidenceBundle(adapterApi, request),
  };
}

function handleAgentFinished(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readOptionalInput<QueueAgentLifecycleAgentFinishedInput>(
    request,
    [
      "taskId",
      "outcome",
      "finalAgentMessage",
      "runId",
      "attemptId",
      "threadId",
      "validationSummary",
      "changedFilesSummary",
      "finishedAt",
      "evidenceBundle",
      "source",
      "workerId",
    ],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  const normalized = normalizeAgentFinishedInput(validation.value);
  if (!normalized.ok) {
    return invalidInput(request, normalized.message, {
      fieldPath: normalized.fieldPath,
    });
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.agentFinished(normalized.value, context),
  );
}

function handleCreateReviewMessage(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readInput<QueueAgentReviewCreateMessageInput>(
    request,
    ["taskId"],
    [
      "taskId",
      "coordinatorAgentId",
      "messageId",
      "runId",
      "evidenceBundleId",
      "createdAt",
      "attemptId",
      "evidenceBundle",
      "finalAgentMessage",
      "validationSummary",
      "changedFilesSummary",
    ],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  const evidence = normalizeOptionalEvidenceBundle({
    attemptId: validation.value.attemptId,
    evidenceBundle: validation.value.evidenceBundle,
    taskId: validation.value.taskId,
  });
  if (!evidence.ok) {
    return invalidInput(request, evidence.message, {
      fieldPath: evidence.fieldPath,
    });
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.createReviewMessage(
      {
        ...validation.value,
        evidenceBundle: evidence.value,
        taskId: validation.value.taskId as string,
      },
      context,
    ),
  );
}

function handleReviewAck(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readInput<QueueAgentReviewAckInput>(
    request,
    ["taskId", "messageId"],
    ["taskId", "messageId", "coordinatorAgentId", "ackId", "receivedAt"],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.ackReview(
      {
        ...validation.value,
        messageId: validation.value.messageId as string,
        taskId: validation.value.taskId as string,
      },
      context,
    ),
  );
}

function handleApproveValidation(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readInput<QueueAgentApproveValidationInput>(
    request,
    ["taskId", "coordinatorAgentId"],
    [
      "taskId",
      "coordinatorAgentId",
      "summary",
      "validationApprovalId",
      "approvedAt",
    ],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.approveValidation(
      {
        ...validation.value,
        coordinatorAgentId: validation.value.coordinatorAgentId as string,
        taskId: validation.value.taskId as string,
      },
      context,
    ),
  );
}

function handleAddFollowUpPrompt(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readInput<QueueAgentAddFollowUpPromptInput>(
    request,
    ["taskId", "coordinatorAgentId", "prompt"],
    [
      "taskId",
      "coordinatorAgentId",
      "prompt",
      "followUpPromptId",
      "createdAt",
      "parentAttemptId",
      "threadId",
    ],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.addFollowUpPrompt(
      {
        ...validation.value,
        coordinatorAgentId: validation.value.coordinatorAgentId as string,
        prompt: validation.value.prompt as string,
        taskId: validation.value.taskId as string,
      },
      context,
    ),
  );
}

function handleMarkDone(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readInput<QueueAgentMarkDoneInput>(
    request,
    ["taskId"],
    [
      "taskId",
      "reason",
      "runId",
      "messageId",
      "reviewMessageId",
    ],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  const confirmationError = exactQueueConfirmationError(request);
  if (confirmationError) {
    return invalidInput(request, confirmationError, {
      fieldPath: QUEUE_START_RUN_CONFIRMATION_FIELD,
    });
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.markDone(
      {
        ...validation.value,
        confirmationToken: request.confirmationToken as string,
        taskId: validation.value.taskId as string,
      },
      context,
    ),
  );
}

function handleBlockItem(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readInput<QueueAgentBlockInput>(
    request,
    ["taskId", "coordinatorAgentId", "reason"],
    ["taskId", "coordinatorAgentId", "reason", "blockedAt", "decisionId"],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.blockItem(
      {
        ...validation.value,
        coordinatorAgentId: validation.value.coordinatorAgentId as string,
        reason: validation.value.reason as string,
        taskId: validation.value.taskId as string,
      },
      context,
    ),
  );
}

function handleFailItem(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readInput<QueueAgentFailInput>(
    request,
    ["taskId", "reason"],
    [
      "taskId",
      "reason",
      "runId",
      "evidenceBundleId",
      "messageId",
      "reviewMessageId",
    ],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  const confirmationError = exactQueueConfirmationError(request);
  if (confirmationError) {
    return invalidInput(request, confirmationError, {
      fieldPath: QUEUE_START_RUN_CONFIRMATION_FIELD,
    });
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.failItem(
      {
        ...validation.value,
        confirmationToken: request.confirmationToken as string,
        reason: validation.value.reason as string,
        taskId: validation.value.taskId as string,
      },
      context,
    ),
  );
}

function handleGetLifecycle(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readInput<QueueAgentLifecycleGetInput>(
    request,
    ["taskId"],
    ["taskId"],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.getLifecycle(
      {
        taskId: validation.value.taskId as string,
      },
      context,
    ),
  );
}

function handleGetEvidenceBundle(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readInput<QueueAgentReviewEvidenceBundleInput>(
    request,
    ["taskId"],
    ["taskId", "runId"],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.getEvidenceBundle(
      {
        runId: validation.value.runId,
        taskId: validation.value.taskId as string,
      },
      context,
    ),
  );
}

function normalizeAgentFinishedInput(
  input: QueueAgentLifecycleAgentFinishedInput,
): ValidationResult<NormalizedAgentFinishedInput> {
  const evidence = normalizeOptionalEvidenceBundle({
    attemptId: input.attemptId,
    evidenceBundle: input.evidenceBundle,
    taskId: input.taskId,
  });
  if (!evidence.ok) {
    return evidence;
  }

  const evidenceBundle = evidence.value;
  if (evidenceBundle) {
    const explicitOutcome = cleanString(input.outcome);
    if (explicitOutcome && !AGENT_OUTCOMES.has(explicitOutcome)) {
      return {
        fieldPath: "input.outcome",
        message:
          "Queue lifecycle outcome must be completed, not_completed, or failed.",
        ok: false,
      };
    }

    if (explicitOutcome && explicitOutcome !== evidenceBundle.outcome) {
      return {
        fieldPath: "input.outcome",
        message:
          "Queue lifecycle outcome does not match the evidence bundle outcome.",
        ok: false,
      };
    }

    const explicitThreadId = cleanString(input.threadId);
    if (
      explicitThreadId &&
      evidenceBundle.threadId &&
      explicitThreadId !== evidenceBundle.threadId
    ) {
      return {
        fieldPath: "input.threadId",
        message:
          "Queue lifecycle threadId does not match the evidence bundle threadId.",
        ok: false,
      };
    }

    const explicitRunId = cleanString(input.runId);
    if (
      explicitRunId &&
      evidenceBundle.runId &&
      explicitRunId !== evidenceBundle.runId
    ) {
      return {
        fieldPath: "input.runId",
        message: "Queue lifecycle runId does not match the evidence bundle runId.",
        ok: false,
      };
    }

    const runId = explicitRunId ?? cleanString(evidenceBundle.runId);
    if (!runId) {
      return { fieldPath: "input.runId", message: "runId is required.", ok: false };
    }

    const lifecycleInput = toLifecycleAgentFinishedInput(evidenceBundle, {
      attemptId: cleanString(input.attemptId) ?? undefined,
      changedFilesSummary: normalizeActionChangedFilesSummary(
        input.changedFilesSummary,
      ),
      finalAgentMessage: cleanString(input.finalAgentMessage) ?? undefined,
      finishedAt: cleanString(input.finishedAt) ?? undefined,
      outcome: explicitOutcome
        ? (explicitOutcome as QueueWorkerEvidenceBundle["outcome"])
        : undefined,
      taskId: cleanString(input.taskId) ?? undefined,
      threadId: explicitThreadId ?? undefined,
      validationSummary: cleanString(input.validationSummary) ?? undefined,
    });

    return {
      ok: true,
      value: {
        ...input,
        attemptId: lifecycleInput.attemptId,
        changedFilesSummary: lifecycleInput.changedFilesSummary,
        evidenceBundle,
        finalAgentMessage: lifecycleInput.finalAgentMessage,
        finishedAt: lifecycleInput.finishedAt,
        outcome: lifecycleInput.outcome,
        runId,
        source: cleanString(input.source) ?? undefined,
        taskId: lifecycleInput.taskId,
        threadId: lifecycleInput.threadId,
        validationSummary: lifecycleInput.validationSummary,
        workerId: cleanString(input.workerId) ?? undefined,
      },
    };
  }

  const taskId = cleanString(input.taskId);
  const runId = cleanString(input.runId);
  const outcome = cleanString(input.outcome);
  const finalAgentMessage = cleanString(input.finalAgentMessage);

  if (!taskId) {
    return { fieldPath: "input.taskId", message: "taskId is required.", ok: false };
  }

  if (!outcome) {
    return { fieldPath: "input.outcome", message: "outcome is required.", ok: false };
  }

  if (!runId) {
    return { fieldPath: "input.runId", message: "runId is required.", ok: false };
  }

  if (!AGENT_OUTCOMES.has(outcome)) {
    return {
      fieldPath: "input.outcome",
      message:
        "Queue lifecycle outcome must be completed, not_completed, or failed.",
      ok: false,
    };
  }

  if (!finalAgentMessage) {
    return {
      fieldPath: "input.finalAgentMessage",
      message: "finalAgentMessage is required.",
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      ...input,
      finalAgentMessage,
      outcome: outcome as QueueWorkerEvidenceBundle["outcome"],
      runId,
      source: cleanString(input.source) ?? undefined,
      taskId,
      workerId: cleanString(input.workerId) ?? undefined,
    },
  };
}

function normalizeOptionalEvidenceBundle({
  attemptId,
  evidenceBundle,
  taskId,
}: {
  readonly attemptId?: string;
  readonly evidenceBundle?: QueueAgentLifecycleAgentFinishedInput["evidenceBundle"];
  readonly taskId?: string;
}): ValidationResult<QueueWorkerEvidenceBundle | undefined> {
  if (evidenceBundle === undefined) {
    return { ok: true, value: undefined };
  }

  const validation = normalizeQueueWorkerEvidenceBundle(evidenceBundle, {
    expectedAttemptId: cleanString(attemptId) ?? undefined,
    expectedTaskId: cleanString(taskId) ?? undefined,
  });

  if (!validation.ok) {
    return {
      fieldPath: "input.evidenceBundle",
      message: validation.reasons[0] ?? "Evidence bundle is invalid.",
      ok: false,
    };
  }

  return { ok: true, value: validation.bundle };
}

function invokeLifecycle<TOutput>(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
  invoke: (
    lifecycle: NonNullable<QueueAgentAdapterApi["dogfoodLifecycle"]>,
    context: {
      agentId: string;
      dryRun: boolean;
      requestedAt: string;
      requestId: string;
    },
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<TOutput>>,
): QueueDogfoodLifecycleHandlerResult {
  if (!adapterApi.dogfoodLifecycle) {
    return unavailable(
      request,
      "Queue dogfood lifecycle controller is unavailable.",
    );
  }

  return actionResultFromMaybeAdapter({
    adapterResult: invoke(adapterApi.dogfoodLifecycle, {
      agentId: request.agentId,
      dryRun: request.dryRun,
      requestedAt: request.createdAt,
      requestId: request.requestId,
    }),
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    requestId: request.requestId,
  });
}

function actionResultFromMaybeAdapter<TOutput>({
  adapterResult,
  capabilityId,
  dryRun,
  requestId,
}: {
  adapterResult: QueueAgentMaybePromise<QueueAgentAdapterResult<TOutput>>;
  capabilityId: string;
  dryRun: boolean;
  requestId: string;
}): QueueDogfoodLifecycleHandlerResult {
  return withAdapterResult(adapterResult, (resolvedResult) =>
    actionResultFromAdapter({
      adapterResult: resolvedResult,
      capabilityId,
      dryRun,
      requestId,
    }),
  );
}

function actionResultFromAdapter<TOutput>({
  adapterResult,
  capabilityId,
  dryRun,
  requestId,
}: {
  adapterResult: QueueAgentAdapterResult<TOutput>;
  capabilityId: string;
  dryRun: boolean;
  requestId: string;
}): HobitAgentActionResult {
  const status = queueAgentCapabilityStatusToBrokerStatus(adapterResult.status);

  return createActionResult({
    auditEvents: [],
    capabilityId,
    dryRun,
    fieldPath: adapterResult.fieldPath,
    fieldPaths: adapterResult.fieldPaths,
    hiddenSideEffectFlags: noHiddenSideEffectFlags(),
    message: adapterResult.message,
    output: {
      activityEventNames: adapterResult.activityEventNames ?? activityEventsFor(
        capabilityId,
      ),
      hiddenSideEffectFlags: queueSideEffectFlags(),
      ...(adapterResult.output && isRecord(adapterResult.output)
        ? adapterResult.output
        : { result: adapterResult.output }),
    },
    policyReasons:
      adapterResult.reasons ?? (status === "succeeded" ? [] : [adapterResult.message]),
    reasonCode: adapterResult.reasonCode,
    requestId,
    status,
  });
}

function activityEventsFor(capabilityId: string): string[] {
  switch (capabilityId) {
    case "queue.lifecycle.agentFinished":
      return [...QUEUE_ACTIVITY_EVENTS.lifecycleAgentFinished];
    case "queue.review.createMessage":
      return [...QUEUE_ACTIVITY_EVENTS.lifecycleReviewCreateMessage];
    case "queue.review.ack":
      return [...QUEUE_ACTIVITY_EVENTS.lifecycleReviewAck];
    case "queue.coordinator.approveValidation":
      return [...QUEUE_ACTIVITY_EVENTS.lifecycleValidationApproved];
    case "queue.coordinator.addFollowUpPrompt":
      return [...QUEUE_ACTIVITY_EVENTS.lifecycleFollowUpPromptAdded];
    case "queue.item.markDone":
      return [...QUEUE_ACTIVITY_EVENTS.lifecycleItemMarkDone];
    case "queue.item.block":
      return [...QUEUE_ACTIVITY_EVENTS.lifecycleItemBlock];
    case "queue.item.fail":
      return [...QUEUE_ACTIVITY_EVENTS.lifecycleItemFail];
    case "queue.lifecycle.get":
      return [...QUEUE_ACTIVITY_EVENTS.lifecycleGet];
    case "queue.review.getEvidenceBundle":
      return [...QUEUE_ACTIVITY_EVENTS.lifecycleReviewEvidenceBundle];
    default:
      return [];
  }
}

function readInput<T extends object>(
  request: HobitAgentActionRequest,
  requiredFields: readonly (keyof T & string)[],
  acceptedFields: readonly string[],
  options: { booleanFields?: readonly string[] } = {},
): ValidationResult<T> {
  const base = readOptionalInput<T>(request, acceptedFields);
  if (!base.ok) {
    return base;
  }
  const value = base.value as Record<string, unknown>;

  for (const field of requiredFields) {
    if (options.booleanFields?.includes(field)) {
      if (typeof value[field] !== "boolean") {
        return {
          fieldPath: `input.${field}`,
          ok: false,
          message: `${field} must be a boolean.`,
        };
      }
      continue;
    }

    if (typeof value[field] !== "string" || !value[field].trim()) {
      return {
        fieldPath: `input.${field}`,
        ok: false,
        message: `${field} is required.`,
      };
    }
  }

  return { ok: true, value: base.value };
}

function readOptionalInput<T extends object>(
  request: HobitAgentActionRequest,
  acceptedFields: readonly string[],
): ValidationResult<T> {
  if (!isRecord(request.input)) {
    return {
      fieldPath: "input",
      message: "Queue lifecycle action input is required.",
      ok: false,
    };
  }

  for (const field of Object.keys(request.input)) {
    if (!acceptedFields.includes(field)) {
      return {
        fieldPath: `input.${field}`,
        message: `${field} is not supported by ${request.capabilityId}.`,
        ok: false,
      };
    }
  }

  return { ok: true, value: request.input as T };
}

function normalizeActionChangedFilesSummary(
  value: readonly string[] | string | undefined,
) {
  if (Array.isArray(value)) {
    const changedFiles = value
      .map((item) => item.trim())
      .filter(Boolean);
    return changedFiles.length > 0 ? changedFiles.join(", ") : undefined;
  }

  return cleanString(value) ?? undefined;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function invalidInput(
  request: HobitAgentActionRequest,
  message: string,
  options: { fieldPath?: string; fieldPaths?: string[] } = {},
): HobitAgentActionResult {
  return createActionResult({
    auditEvents: [],
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    fieldPath: options.fieldPath,
    fieldPaths: options.fieldPaths,
    hiddenSideEffectFlags: noHiddenSideEffectFlags(),
    message,
    policyReasons: [message],
    reasonCode: "invalid_payload",
    requestId: request.requestId,
    status: "invalid_input",
  });
}

function exactQueueConfirmationError(request: HobitAgentActionRequest) {
  return request.confirmationToken === QUEUE_START_RUN_CONFIRMATION_TOKEN
    ? null
    : `${request.capabilityId} requires top-level ${QUEUE_START_RUN_CONFIRMATION_FIELD} "${QUEUE_START_RUN_CONFIRMATION_TOKEN}".`;
}

function unavailable(
  request: HobitAgentActionRequest,
  message: string,
): HobitAgentActionResult {
  return createActionResult({
    auditEvents: [],
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    hiddenSideEffectFlags: noHiddenSideEffectFlags(),
    message,
    policyReasons: [message],
    reasonCode: "capability_unavailable",
    requestId: request.requestId,
    status: "unavailable",
  });
}

function withAdapterResult<TValue, TResult>(
  value: QueueAgentMaybePromise<TValue>,
  mapper: (resolvedValue: TValue) => TResult,
): TResult | Promise<Awaited<TResult>> {
  return isPromiseLike(value)
    ? (value.then((resolvedValue) => mapper(resolvedValue)) as Promise<
        Awaited<TResult>
      >)
    : mapper(value);
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
