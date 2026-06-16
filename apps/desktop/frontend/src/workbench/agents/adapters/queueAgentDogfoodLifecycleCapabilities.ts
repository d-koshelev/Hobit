import { createActionResult } from "../broker/results";
import type {
  HobitAgentActionHandlerMap,
  HobitAgentActionRequest,
  HobitAgentActionResult,
  HobitAgentActionStatus,
} from "../broker/types";
import {
  noHiddenSideEffectFlags,
  queueSideEffectFlags,
  QUEUE_ACTIVITY_EVENTS,
  type QueueAgentAdapterApi,
  type QueueAgentAdapterResult,
  type QueueAgentAddFollowUpPromptInput,
  type QueueAgentApproveValidationInput,
  type QueueAgentBlockInput,
  type QueueAgentCapabilityStatus,
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
  | { message: string; ok: false };

const AGENT_OUTCOMES = new Set(["completed", "not_completed", "failed"]);

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
  const validation = readInput<QueueAgentLifecycleAgentFinishedInput>(
    request,
    ["taskId", "outcome", "finalAgentMessage"],
    [
      "taskId",
      "outcome",
      "finalAgentMessage",
      "attemptId",
      "validationSummary",
      "changedFilesSummary",
      "finishedAt",
    ],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message);
  }

  const outcome = validation.value.outcome ?? "";
  if (!AGENT_OUTCOMES.has(outcome)) {
    return invalidInput(
      request,
      "Queue lifecycle outcome must be completed, not_completed, or failed.",
    );
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.agentFinished(
      {
        ...validation.value,
        finalAgentMessage: validation.value.finalAgentMessage as string,
        outcome: outcome as "completed" | "not_completed" | "failed",
        taskId: validation.value.taskId as string,
      },
      context,
    ),
  );
}

function handleCreateReviewMessage(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readInput<QueueAgentReviewCreateMessageInput>(
    request,
    ["taskId", "coordinatorAgentId"],
    [
      "taskId",
      "coordinatorAgentId",
      "messageId",
      "createdAt",
      "attemptId",
      "finalAgentMessage",
      "validationSummary",
      "changedFilesSummary",
    ],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message);
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.createReviewMessage(
      {
        ...validation.value,
        coordinatorAgentId: validation.value.coordinatorAgentId as string,
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
    ["taskId", "messageId", "coordinatorAgentId"],
    ["taskId", "messageId", "coordinatorAgentId", "ackId", "receivedAt"],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message);
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.ackReview(
      {
        ...validation.value,
        coordinatorAgentId: validation.value.coordinatorAgentId as string,
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
    return invalidInput(request, validation.message);
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
    return invalidInput(request, validation.message);
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
    ["taskId", "coordinatorAgentId", "validationApproved"],
    [
      "taskId",
      "coordinatorAgentId",
      "validationApproved",
      "validationSummary",
      "validationApprovalId",
      "commit",
      "completedAt",
      "decisionId",
      "reason",
    ],
    { booleanFields: ["validationApproved"] },
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message);
  }

  if (validation.value.validationApproved !== true) {
    return invalidInput(request, "validationApproved must be true.");
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.markDone(
      {
        ...validation.value,
        coordinatorAgentId: validation.value.coordinatorAgentId as string,
        taskId: validation.value.taskId as string,
        validationApproved: true,
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
    return invalidInput(request, validation.message);
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
    ["taskId", "coordinatorAgentId", "reason"],
    ["taskId", "coordinatorAgentId", "reason", "failedAt", "decisionId"],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message);
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.failItem(
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

function handleGetLifecycle(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readOptionalInput<QueueAgentLifecycleGetInput>(request, [
    "taskId",
  ]);
  if (!validation.ok) {
    return invalidInput(request, validation.message);
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.getLifecycle(validation.value, context),
  );
}

function handleGetEvidenceBundle(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueDogfoodLifecycleHandlerResult {
  const validation = readInput<QueueAgentReviewEvidenceBundleInput>(
    request,
    ["taskId"],
    ["taskId"],
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message);
  }

  return invokeLifecycle(adapterApi, request, (lifecycle, context) =>
    lifecycle.getEvidenceBundle(
      {
        taskId: validation.value.taskId as string,
      },
      context,
    ),
  );
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
  const status = brokerStatus(adapterResult.status);

  return createActionResult({
    auditEvents: [],
    capabilityId,
    dryRun,
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
    requestId,
    status,
  });
}

function brokerStatus(status: QueueAgentCapabilityStatus): HobitAgentActionStatus {
  if (status === "confirmation_required") {
    return "needs_confirmation";
  }

  return status;
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
        return { ok: false, message: `${field} must be a boolean.` };
      }
      continue;
    }

    if (typeof value[field] !== "string" || !value[field].trim()) {
      return { ok: false, message: `${field} is required.` };
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
      message: "Queue lifecycle action input is required.",
      ok: false,
    };
  }

  for (const field of Object.keys(request.input)) {
    if (!acceptedFields.includes(field)) {
      return {
        message: `${field} is not supported by ${request.capabilityId}.`,
        ok: false,
      };
    }
  }

  return { ok: true, value: request.input as T };
}

function invalidInput(
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
    requestId: request.requestId,
    status: "invalid_input",
  });
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
