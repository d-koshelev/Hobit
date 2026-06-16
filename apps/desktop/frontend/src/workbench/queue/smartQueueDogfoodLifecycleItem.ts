import type {
  SmartQueueDogfoodAgentPromptState,
  SmartQueueDogfoodLifecycleItem,
  SmartQueueDogfoodReviewOutcome,
  SmartQueueLifecycleTransitionResult,
} from "./smartQueueDogfoodLifecycleTypes";
import {
  NO_DOGFOOD_LIFECYCLE_SIDE_EFFECTS,
  assertTicketState,
  cleanOptionalText,
  cleanText,
  failure,
  success,
  transitionError,
} from "./smartQueueDogfoodLifecycleInternal";

export type CreateDogfoodLifecycleItemInput = {
  readonly taskId: string;
  readonly title?: string;
  readonly originalPrompt?: string;
  readonly createdAt: string;
};

export type StartQueueItemRunInput = {
  readonly attemptId?: string;
  readonly threadId?: string;
  readonly runnablePrompt?: string;
  readonly startedAt: string;
};

export type CompleteAgentPromptInput = {
  readonly attemptId?: string;
  readonly finalAgentMessage: string;
  readonly validationSummary?: string;
  readonly changedFilesSummary?: string;
  readonly completedAt: string;
};

export type FailAgentPromptInput = {
  readonly attemptId?: string;
  readonly finalAgentMessage: string;
  readonly validationSummary?: string;
  readonly changedFilesSummary?: string;
  readonly failedAt: string;
};

type FinishAgentPromptInput = {
  readonly agentPromptState: Extract<
    SmartQueueDogfoodAgentPromptState,
    "completed" | "not_completed" | "failed"
  >;
  readonly attemptId?: string;
  readonly changedFilesSummary?: string;
  readonly finalAgentMessage: string;
  readonly finishedAt: string;
  readonly reviewOutcome: SmartQueueDogfoodReviewOutcome;
  readonly transitionAction: string;
  readonly validationSummary?: string;
};

export function createDogfoodLifecycleItem(
  input: CreateDogfoodLifecycleItemInput,
): SmartQueueDogfoodLifecycleItem {
  return {
    additionalPromptCount: 0,
    agentPromptState: "idle",
    commitRequests: [],
    commitResults: [],
    coordinatorDecisions: [],
    createdAt: input.createdAt,
    currentRunnablePrompt: input.originalPrompt,
    followUpPrompts: [],
    originalPrompt: input.originalPrompt,
    reviewAcks: [],
    reviewMessages: [],
    sideEffects: NO_DOGFOOD_LIFECYCLE_SIDE_EFFECTS,
    taskId: input.taskId,
    ticketState: "draft",
    title: input.title,
    updatedAt: input.createdAt,
    validationApprovals: [],
  };
}

export function queueDogfoodLifecycleItem(
  item: SmartQueueDogfoodLifecycleItem,
  queuedAt: string,
): SmartQueueLifecycleTransitionResult {
  const stateError = assertTicketState(item, "queueDogfoodLifecycleItem", [
    "draft",
  ]);

  if (stateError) {
    return failure(item, stateError);
  }

  return success({
    ...item,
    ticketState: "queued",
    updatedAt: queuedAt,
  });
}

export function startQueueItemRun(
  item: SmartQueueDogfoodLifecycleItem,
  input: StartQueueItemRunInput,
): SmartQueueLifecycleTransitionResult {
  const stateError = assertTicketState(item, "startQueueItemRun", ["queued"]);

  if (stateError) {
    return failure(item, stateError);
  }

  const runnablePrompt = cleanText(
    input.runnablePrompt ?? item.currentRunnablePrompt ?? item.originalPrompt,
  );

  if (!runnablePrompt) {
    return failure(
      item,
      transitionError({
        action: "startQueueItemRun",
        code: "empty_prompt",
        item,
        message: "A queued item needs a runnable prompt before it can enter Running.",
      }),
    );
  }

  return success({
    ...item,
    agentPromptState: "running",
    currentAttemptId: input.attemptId ?? item.currentAttemptId,
    currentRunnablePrompt: runnablePrompt,
    currentThreadId: input.threadId ?? item.currentThreadId,
    ticketState: "running",
    updatedAt: input.startedAt,
  });
}

export function completeAgentPrompt(
  item: SmartQueueDogfoodLifecycleItem,
  input: CompleteAgentPromptInput,
): SmartQueueLifecycleTransitionResult {
  return finishAgentPrompt(item, {
    agentPromptState: "completed",
    attemptId: input.attemptId,
    changedFilesSummary: input.changedFilesSummary,
    finishedAt: input.completedAt,
    finalAgentMessage: input.finalAgentMessage,
    reviewOutcome: "completed",
    transitionAction: "completeAgentPrompt",
    validationSummary: input.validationSummary,
  });
}

export function markAgentPromptNotCompleted(
  item: SmartQueueDogfoodLifecycleItem,
  input: CompleteAgentPromptInput,
): SmartQueueLifecycleTransitionResult {
  return finishAgentPrompt(item, {
    agentPromptState: "not_completed",
    attemptId: input.attemptId,
    changedFilesSummary: input.changedFilesSummary,
    finishedAt: input.completedAt,
    finalAgentMessage: input.finalAgentMessage,
    reviewOutcome: "not_completed",
    transitionAction: "markAgentPromptNotCompleted",
    validationSummary: input.validationSummary,
  });
}

export function failAgentPrompt(
  item: SmartQueueDogfoodLifecycleItem,
  input: FailAgentPromptInput,
): SmartQueueLifecycleTransitionResult {
  return finishAgentPrompt(item, {
    agentPromptState: "failed",
    attemptId: input.attemptId,
    changedFilesSummary: input.changedFilesSummary,
    finishedAt: input.failedAt,
    finalAgentMessage: input.finalAgentMessage,
    reviewOutcome: "failed",
    transitionAction: "failAgentPrompt",
    validationSummary: input.validationSummary,
  });
}

export function canStartDependentAfterReviewGate(
  upstream: Pick<SmartQueueDogfoodLifecycleItem, "ticketState">,
) {
  return upstream.ticketState === "done";
}

function finishAgentPrompt(
  item: SmartQueueDogfoodLifecycleItem,
  input: FinishAgentPromptInput,
): SmartQueueLifecycleTransitionResult {
  const stateError = assertTicketState(item, input.transitionAction, [
    "running",
  ]);

  if (stateError) {
    return failure(item, stateError);
  }

  const finalAgentMessage = cleanText(input.finalAgentMessage);

  if (!finalAgentMessage) {
    return failure(
      item,
      transitionError({
        action: input.transitionAction,
        code: "missing_final_agent_message",
        item,
        message: "Agent prompt completion needs a final agent message.",
      }),
    );
  }

  return success({
    ...item,
    agentPromptState: input.agentPromptState,
    changedFilesSummary: cleanOptionalText(input.changedFilesSummary),
    currentAttemptId: input.attemptId ?? item.currentAttemptId,
    finalAgentMessage,
    reviewOutcome: input.reviewOutcome,
    ticketState: "awaiting_review",
    updatedAt: input.finishedAt,
    validationSummary: cleanOptionalText(input.validationSummary),
  });
}
