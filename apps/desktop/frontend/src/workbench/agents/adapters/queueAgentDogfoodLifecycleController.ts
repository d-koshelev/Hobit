import {
  acknowledgeReviewMessage,
  addFollowUpPrompt,
  approveValidation,
  attachCommitResult,
  blockQueueItem,
  completeAgentPrompt,
  createDogfoodLifecycleItem,
  createReviewMessage,
  failAgentPrompt,
  failQueueItem,
  markAgentPromptNotCompleted,
  markQueueItemDone,
  queueDogfoodLifecycleItem,
  requestCommit,
  startQueueItemRun,
  type SmartQueueDogfoodLifecycleItem,
  type SmartQueueLifecycleTransitionResult,
} from "../../queue/smartQueueDogfoodLifecycle";
import {
  toReviewMessageEvidenceInput,
  type QueueWorkerEvidenceBundle,
  type QueueWorkerReviewMessageEvidenceInput,
} from "../../queue/smartQueueWorkerEvidenceBundle";
import type {
  QueueAgentAdapterResult,
  QueueAgentAddFollowUpPromptInput,
  QueueAgentApproveValidationInput,
  QueueAgentBlockInput,
  QueueAgentDogfoodLifecycleAdapterApi,
  QueueAgentFailInput,
  QueueAgentLifecycleAgentFinishedInput,
  QueueAgentLifecycleGetInput,
  QueueAgentLifecycleGetOutput,
  QueueAgentLifecycleHandlerContext,
  QueueAgentLifecycleTaskSeed,
  QueueAgentLifecycleTransitionOutput,
  QueueAgentMarkDoneInput,
  QueueAgentMaybePromise,
  QueueAgentReviewAckInput,
  QueueAgentReviewCreateMessageInput,
  QueueAgentReviewEvidenceBundleInput,
  QueueAgentReviewEvidenceBundleOutput,
} from "./queueAgentCapabilityTypes";

export type QueueAgentDogfoodLifecycleControllerInput = {
  getTaskSeed?: (
    taskId: string,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTaskSeed>>;
  initialLifecycles?: readonly SmartQueueDogfoodLifecycleItem[];
  initialTaskSeeds?: readonly QueueAgentLifecycleTaskSeed[];
  now?: () => string;
};

type LifecycleResolverResult =
  QueueAgentAdapterResult<SmartQueueDogfoodLifecycleItem>;

type RequiredAgentFinishedInput = Required<
  Pick<
    QueueAgentLifecycleAgentFinishedInput,
    "finalAgentMessage" | "outcome" | "runId" | "taskId"
  >
> &
  Omit<
    QueueAgentLifecycleAgentFinishedInput,
    "finalAgentMessage" | "outcome" | "runId" | "taskId"
  >;

type RequiredReviewMessageInput = Required<
  Pick<QueueAgentReviewCreateMessageInput, "taskId">
> &
  Omit<QueueAgentReviewCreateMessageInput, "taskId">;

type RequiredReviewAckInput = Required<
  Pick<QueueAgentReviewAckInput, "messageId" | "taskId">
> &
  Omit<QueueAgentReviewAckInput, "messageId" | "taskId">;

type RequiredValidationInput = Required<
  Pick<QueueAgentApproveValidationInput, "coordinatorAgentId" | "taskId">
> &
  Omit<QueueAgentApproveValidationInput, "coordinatorAgentId" | "taskId">;

type RequiredFollowUpInput = Required<
  Pick<
    QueueAgentAddFollowUpPromptInput,
    "coordinatorAgentId" | "prompt" | "taskId"
  >
> &
  Omit<
    QueueAgentAddFollowUpPromptInput,
    "coordinatorAgentId" | "prompt" | "taskId"
  >;

type RequiredMarkDoneInput = Required<
  Pick<
    QueueAgentMarkDoneInput,
    "coordinatorAgentId" | "taskId" | "validationApproved"
  >
> &
  Omit<
    QueueAgentMarkDoneInput,
    "coordinatorAgentId" | "taskId" | "validationApproved"
  >;

type RequiredBlockInput = Required<
  Pick<QueueAgentBlockInput, "coordinatorAgentId" | "reason" | "taskId">
> &
  Omit<QueueAgentBlockInput, "coordinatorAgentId" | "reason" | "taskId">;

type RequiredFailInput = Required<
  Pick<QueueAgentFailInput, "coordinatorAgentId" | "reason" | "taskId">
> &
  Omit<QueueAgentFailInput, "coordinatorAgentId" | "reason" | "taskId">;

export function createInMemoryQueueDogfoodLifecycleAdapterApi({
  getTaskSeed,
  initialLifecycles = [],
  initialTaskSeeds = [],
  now = () => new Date().toISOString(),
}: QueueAgentDogfoodLifecycleControllerInput = {}): QueueAgentDogfoodLifecycleAdapterApi {
  const lifecycles = new Map(
    initialLifecycles.map((item) => [item.taskId, item]),
  );
  const taskSeeds = new Map(
    initialTaskSeeds.map((item) => [item.taskId, item]),
  );

  const resolveLifecycle = (
    taskId: string,
  ): QueueAgentMaybePromise<LifecycleResolverResult> => {
    const existing = lifecycles.get(taskId);
    if (existing) {
      return success("Queue dogfood lifecycle loaded.", existing);
    }

    const seeded = taskSeeds.get(taskId);
    if (seeded) {
      const lifecycle = lifecycleFromTaskSeed(seeded, now());
      lifecycles.set(taskId, lifecycle);
      return success("Queue dogfood lifecycle derived from task.", lifecycle);
    }

    if (!getTaskSeed) {
      return failed(`Queue dogfood lifecycle item "${taskId}" was not found.`);
    }

    return withMaybe(getTaskSeed(taskId), (seedResult) => {
      if (seedResult.status !== "succeeded" || !seedResult.output) {
        return {
          message: seedResult.message,
          reasons: seedResult.reasons,
          status: seedResult.status,
        };
      }

      const lifecycle = lifecycleFromTaskSeed(seedResult.output, now());
      lifecycles.set(taskId, lifecycle);
      return success("Queue dogfood lifecycle derived from task.", lifecycle);
    });
  };

  const applyTransition = <TValue>(
    input: { taskId: string },
    context: QueueAgentLifecycleHandlerContext,
    actionLabel: string,
    transition: (
      item: SmartQueueDogfoodLifecycleItem,
    ) => SmartQueueLifecycleTransitionResult<TValue>,
  ): QueueAgentMaybePromise<
    QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>
  > =>
    withMaybe(resolveLifecycle(input.taskId), (resolved) => {
      if (resolved.status !== "succeeded" || !resolved.output) {
        return {
          message: resolved.message,
          reasons: resolved.reasons,
          status: resolved.status,
        };
      }

      const previous = resolved.output;
      const transitionResult = transition(previous);
      if (!transitionResult.ok) {
        return failed(
          transitionResult.error?.message ??
            "Queue dogfood lifecycle transition failed.",
        );
      }

      const next = transitionResult.item;
      if (!context.dryRun) {
        lifecycles.set(next.taskId, next);
      }

      return success(
        context.dryRun
          ? `${actionLabel} preview prepared`
          : `${actionLabel}.`,
        lifecycleTransitionOutput({
          actionLabel,
          context,
          previous,
          next,
          value: transitionResult.value,
        }),
      );
    });

  return {
    ackReview: (input: RequiredReviewAckInput, context) =>
      applyTransition(
        input,
        context,
        "Queue review acknowledged",
        (item) =>
          acknowledgeReviewMessage(item, {
            ackId:
              input.ackId ??
              idFromParts("review-ack", input.taskId, input.messageId),
            coordinatorAgentId: reviewActorId(input.coordinatorAgentId, context),
            messageId: input.messageId,
            receivedAt: input.receivedAt ?? context.requestedAt,
          }),
      ),
    addFollowUpPrompt: (input: RequiredFollowUpInput, context) =>
      applyTransition(
        input,
        context,
        "Queue follow-up prompt added",
        (item) =>
          addFollowUpPrompt(item, {
            createdAt: input.createdAt ?? context.requestedAt,
            createdByCoordinatorAgentId: input.coordinatorAgentId,
            followUpPromptId:
              input.followUpPromptId ??
              idFromParts("follow-up", input.taskId, context.requestId),
            parentAttemptId: input.parentAttemptId,
            prompt: input.prompt,
            threadId: input.threadId,
          }),
      ),
    agentFinished: (input: RequiredAgentFinishedInput, context) =>
      applyTransition(
        input,
        context,
        "Queue lifecycle agent finished",
        (item) => {
          const finishedAt = input.finishedAt ?? context.requestedAt;
          const sharedInput = {
            attemptId: input.attemptId,
            changedFilesSummary: normalizeChangedFilesSummary(
              input.changedFilesSummary,
            ),
            finalAgentMessage: input.finalAgentMessage,
            threadId: input.threadId,
            validationSummary: input.validationSummary,
            workerEvidenceBundle: normalizedEvidenceBundle(input.evidenceBundle),
          };

          switch (input.outcome) {
            case "completed":
              return completeAgentPrompt(item, {
                ...sharedInput,
                completedAt: finishedAt,
              });
            case "not_completed":
              return markAgentPromptNotCompleted(item, {
                ...sharedInput,
                completedAt: finishedAt,
              });
            case "failed":
              return failAgentPrompt(item, {
                ...sharedInput,
                failedAt: finishedAt,
              });
          }
        },
      ),
    approveValidation: (input: RequiredValidationInput, context) =>
      applyTransition(
        input,
        context,
        "Queue validation approved",
        (item) =>
          approveValidation(item, {
            approvedAt: input.approvedAt ?? context.requestedAt,
            approvedByCoordinatorAgentId: input.coordinatorAgentId,
            summary: input.summary ?? "Validation approved.",
            validationApprovalId:
              input.validationApprovalId ??
              idFromParts("validation", input.taskId, context.requestId),
          }),
      ),
    blockItem: (input: RequiredBlockInput, context) =>
      applyTransition(input, context, "Queue item blocked", (item) =>
        blockQueueItem(item, {
          blockedAt: input.blockedAt ?? context.requestedAt,
          coordinatorAgentId: input.coordinatorAgentId,
          decisionId:
            input.decisionId ??
            idFromParts("decision-block", input.taskId, context.requestId),
          reason: input.reason,
        }),
      ),
    createReviewMessage: (input: RequiredReviewMessageInput, context) =>
      applyTransition(
        input,
        context,
        "Queue review message created",
        (item) => {
          const evidence = reviewEvidenceInput(
            normalizedEvidenceBundle(input.evidenceBundle),
          );

          return createReviewMessage(item, {
            ...evidence,
            attemptId: input.attemptId ?? evidence.attemptId,
            changedFilesSummary:
              normalizeChangedFilesSummary(input.changedFilesSummary) ??
              evidence.changedFilesSummary,
            createdAt: input.createdAt ?? context.requestedAt,
            finalAgentMessage:
              input.finalAgentMessage ?? evidence.finalAgentMessage,
            messageId:
              input.messageId ??
              idFromParts("review-message", input.taskId, context.requestId),
            toCoordinatorAgentId: reviewActorId(input.coordinatorAgentId, context),
            validationSummary:
              input.validationSummary ?? evidence.validationSummary,
          });
        },
      ),
    failItem: (input: RequiredFailInput, context) =>
      applyTransition(input, context, "Queue item failed", (item) =>
        failQueueItem(item, {
          coordinatorAgentId: input.coordinatorAgentId,
          decisionId:
            input.decisionId ??
            idFromParts("decision-fail", input.taskId, context.requestId),
          failedAt: input.failedAt ?? context.requestedAt,
          reason: input.reason,
        }),
      ),
    getEvidenceBundle: (
      input: Required<Pick<QueueAgentReviewEvidenceBundleInput, "taskId">>,
    ) =>
      withMaybe(resolveLifecycle(input.taskId), (resolved) => {
        if (resolved.status !== "succeeded" || !resolved.output) {
          return {
            message: resolved.message,
            reasons: resolved.reasons,
            status: resolved.status,
          };
        }

        const lifecycle = resolved.output;
        const reviewMessages = [...lifecycle.reviewMessages];
        return success("Queue review evidence bundle loaded.", {
          changedFilesSummary: lifecycle.changedFilesSummary,
          evidenceBundle: lifecycle.workerEvidenceBundle ?? null,
          evidenceBundlePersistence: "frontend_only_not_durable",
          evidenceSummary: lifecycle.workerEvidenceSummary,
          finalAgentMessage: lifecycle.finalAgentMessage,
          latestReviewMessage:
            reviewMessages[reviewMessages.length - 1] ?? null,
          lifecycle,
          reviewMessages,
          reviewOutcome: lifecycle.reviewOutcome ?? null,
          taskId: lifecycle.taskId,
          validationApprovals: [...lifecycle.validationApprovals],
          validationSummary: lifecycle.validationSummary,
        });
      }),
    getLifecycle: (input: QueueAgentLifecycleGetInput) => {
      if (input.taskId) {
        return withMaybe(resolveLifecycle(input.taskId), (resolved) => {
          if (resolved.status !== "succeeded" || !resolved.output) {
            return {
              message: resolved.message,
              reasons: resolved.reasons,
              status: resolved.status,
            };
          }

          return success("Queue dogfood lifecycle loaded.", {
            lifecycle: resolved.output,
          });
        });
      }

      return success<QueueAgentLifecycleGetOutput>(
        "Queue dogfood lifecycles loaded.",
        {
          lifecycle: null,
          lifecycles: [...lifecycles.values()],
        },
      );
    },
    markDone: (input: RequiredMarkDoneInput, context) =>
      applyTransition<unknown>(input, context, "Queue item marked done", (item) => {
        if (!input.validationApproved) {
          return transitionFailure(
            item,
            "markQueueItemDone",
            "Done requires validationApproved: true.",
          );
        }

        const validationApproved =
          item.validationApprovals.length > 0
            ? { item, ok: true as const }
            : approveValidation(item, {
                approvedAt: context.requestedAt,
                approvedByCoordinatorAgentId: input.coordinatorAgentId,
                summary: input.validationSummary ?? "Validation approved.",
                validationApprovalId:
                  input.validationApprovalId ??
                  idFromParts("validation", input.taskId, context.requestId),
              });
        if (!validationApproved.ok) {
          return validationApproved;
        }

        const commitRequested =
          validationApproved.item.commitRequests.length > 0
            ? { item: validationApproved.item, ok: true as const }
            : requestCommit(validationApproved.item, {
                commitRequestId: idFromParts(
                  "commit-request",
                  input.taskId,
                  context.requestId,
                ),
                createdAt: context.requestedAt,
                reason: "Attach fake commit result. No Git mutation.",
                requestedByCoordinatorAgentId: input.coordinatorAgentId,
              });
        if (!commitRequested.ok) {
          return commitRequested;
        }

        const commitAttached = commitRequested.item.commitResults.some(
          (result) => result.status === "success",
        )
          ? { item: commitRequested.item, ok: true as const }
          : attachCommitResult(commitRequested.item, {
              attachedAt: context.requestedAt,
              commitHash: input.commit?.commitHash,
              commitRequestId:
                commitRequested.item.commitRequests[
                  commitRequested.item.commitRequests.length - 1
                ]?.commitRequestId,
              commitResultId:
                input.commit?.commitResultId ??
                idFromParts("commit-result", input.taskId, context.requestId),
              status: "success",
              summary: input.commit?.commitTitle
                ? `Fake commit result: ${input.commit.commitTitle}.`
                : "Fake commit result attached. No Git mutation.",
            });
        if (!commitAttached.ok) {
          return commitAttached;
        }

        return markQueueItemDone(commitAttached.item, {
          completedAt: input.completedAt ?? context.requestedAt,
          coordinatorAgentId: input.coordinatorAgentId,
          decisionId:
            input.decisionId ??
            idFromParts("decision-done", input.taskId, context.requestId),
          reason: input.reason ?? "Accepted by coordinator.",
        });
      }),
  };
}

function lifecycleFromTaskSeed(
  seed: QueueAgentLifecycleTaskSeed,
  fallbackTime: string,
) {
  const createdAt = seed.createdAt ?? fallbackTime;
  const base = createDogfoodLifecycleItem({
    createdAt,
    originalPrompt: seed.prompt,
    taskId: seed.taskId,
    title: seed.title,
  });

  if (seed.status === "queued" || seed.status === "ready") {
    return resultItem(
      queueDogfoodLifecycleItem(base, seed.updatedAt ?? fallbackTime),
      base,
    );
  }

  if (seed.status === "running") {
    const queued = resultItem(
      queueDogfoodLifecycleItem(base, seed.updatedAt ?? fallbackTime),
      base,
    );
    return resultItem(
      startQueueItemRun(queued, {
        runnablePrompt: seed.prompt,
        startedAt: seed.updatedAt ?? fallbackTime,
      }),
      queued,
    );
  }

  return base;
}

function resultItem(
  result: SmartQueueLifecycleTransitionResult,
  fallback: SmartQueueDogfoodLifecycleItem,
) {
  return result.ok ? result.item : fallback;
}

function lifecycleTransitionOutput({
  actionLabel,
  context,
  next,
  previous,
  value,
}: {
  actionLabel: string;
  context: QueueAgentLifecycleHandlerContext;
  next: SmartQueueDogfoodLifecycleItem;
  previous: SmartQueueDogfoodLifecycleItem;
  value: unknown;
}): QueueAgentLifecycleTransitionOutput {
  return {
    actionLabel,
    additionalPromptCount: next.additionalPromptCount,
    agentPromptState: next.agentPromptState,
    dryRunOnly: context.dryRun,
    lifecycle: next,
    previousAgentPromptState: previous.agentPromptState,
    previousTicketState: previous.ticketState,
    queueMutation: context.dryRun ? "none" : "frontend_controller_overlay",
    reviewOutcome: next.reviewOutcome ?? null,
    taskId: next.taskId,
    ticketState: next.ticketState,
    value,
    wouldAutoRunWorkers: false,
    wouldCallGit: false,
    wouldExecuteRollback: false,
    wouldLaunchTerminal: false,
    wouldPersistBackend: false,
    wouldRunValidation: false,
    wouldStartWorkers: false,
  };
}

function normalizeChangedFilesSummary(value: readonly string[] | string | undefined) {
  if (Array.isArray(value)) {
    const changedFiles = (value as readonly string[])
      .map((item) => item.trim())
      .filter(Boolean);
    return changedFiles.length > 0 ? changedFiles.join(", ") : undefined;
  }

  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function reviewEvidenceInput(
  evidenceBundle: QueueWorkerEvidenceBundle | undefined,
): Partial<QueueWorkerReviewMessageEvidenceInput> {
  return evidenceBundle ? toReviewMessageEvidenceInput(evidenceBundle) : {};
}

function normalizedEvidenceBundle(
  evidenceBundle:
    | QueueAgentLifecycleAgentFinishedInput["evidenceBundle"]
    | QueueAgentReviewCreateMessageInput["evidenceBundle"],
): QueueWorkerEvidenceBundle | undefined {
  return evidenceBundle &&
    "kind" in evidenceBundle &&
    "version" in evidenceBundle &&
    evidenceBundle.kind === "queue_worker_evidence_bundle" &&
    evidenceBundle.version === 1
    ? evidenceBundle
    : undefined;
}

function success<TOutput>(
  message: string,
  output: TOutput,
): QueueAgentAdapterResult<TOutput> {
  return {
    message,
    output,
    status: "succeeded",
  };
}

function failed(message: string): QueueAgentAdapterResult<never> {
  return {
    message,
    reasons: [message],
    status: "failed",
  };
}

function transitionFailure(
  item: SmartQueueDogfoodLifecycleItem,
  action: string,
  message: string,
): SmartQueueLifecycleTransitionResult {
  return {
    error: {
      action,
      code: "invalid_state",
      currentAgentPromptState: item.agentPromptState,
      currentTicketState: item.ticketState,
      message,
    },
    item,
    ok: false,
  };
}

function idFromParts(...parts: readonly string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(":");
}

function reviewActorId(
  coordinatorAgentId: string | undefined,
  context: QueueAgentLifecycleHandlerContext,
) {
  return coordinatorAgentId?.trim() || context.agentId.trim() || "workspace-agent";
}

function withMaybe<TValue, TResult>(
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
