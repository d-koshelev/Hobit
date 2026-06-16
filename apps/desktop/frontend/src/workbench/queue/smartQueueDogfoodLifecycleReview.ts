import type {
  SmartQueueDogfoodLifecycleItem,
  SmartQueueReviewAck,
  SmartQueueReviewMessage,
  SmartQueueLifecycleTransitionResult,
} from "./smartQueueDogfoodLifecycleTypes";
import { reviewOutcomeLabel } from "./smartQueueDogfoodLifecycleLabels";
import {
  assertTicketState,
  cleanOptionalText,
  cleanText,
  failure,
  success,
  transitionError,
} from "./smartQueueDogfoodLifecycleInternal";

export type CreateReviewMessageInput = {
  readonly messageId: string;
  readonly toCoordinatorAgentId: string;
  readonly createdAt: string;
  readonly attemptId?: string;
  readonly finalAgentMessage?: string;
  readonly validationSummary?: string;
  readonly changedFilesSummary?: string;
};

export type AcknowledgeReviewMessageInput = {
  readonly ackId: string;
  readonly messageId: string;
  readonly coordinatorAgentId: string;
  readonly receivedAt: string;
};

export function createReviewMessage(
  item: SmartQueueDogfoodLifecycleItem,
  input: CreateReviewMessageInput,
): SmartQueueLifecycleTransitionResult<SmartQueueReviewMessage> {
  const stateError = assertTicketState(item, "createReviewMessage", [
    "awaiting_review",
  ]);

  if (stateError) {
    return failure(item, stateError);
  }

  if (!item.reviewOutcome) {
    return failure(
      item,
      transitionError({
        action: "createReviewMessage",
        code: "missing_review_outcome",
        item,
        message: "A review message needs the agent review outcome.",
      }),
    );
  }

  const finalAgentMessage = cleanText(
    input.finalAgentMessage ?? item.finalAgentMessage,
  );

  if (!finalAgentMessage) {
    return failure(
      item,
      transitionError({
        action: "createReviewMessage",
        code: "missing_final_agent_message",
        item,
        message: "A review message needs the final agent message.",
      }),
    );
  }

  const message: SmartQueueReviewMessage = {
    attemptId: input.attemptId ?? item.currentAttemptId,
    changedFilesSummary: cleanOptionalText(
      input.changedFilesSummary ?? item.changedFilesSummary,
    ),
    createdAt: input.createdAt,
    finalAgentMessage,
    fromQueueItemId: item.taskId,
    messageId: input.messageId,
    productSummary: `${reviewOutcomeLabel(item.reviewOutcome)}: ${finalAgentMessage}`,
    reviewOutcome: item.reviewOutcome,
    taskId: item.taskId,
    toCoordinatorAgentId: input.toCoordinatorAgentId,
    validationSummary: cleanOptionalText(
      input.validationSummary ?? item.validationSummary,
    ),
  };

  return success(
    {
      ...item,
      reviewMessages: [...item.reviewMessages, message],
      updatedAt: input.createdAt,
    },
    message,
  );
}

export function acknowledgeReviewMessage(
  item: SmartQueueDogfoodLifecycleItem,
  input: AcknowledgeReviewMessageInput,
): SmartQueueLifecycleTransitionResult<SmartQueueReviewAck> {
  const stateError = assertTicketState(item, "acknowledgeReviewMessage", [
    "awaiting_review",
  ]);

  if (stateError) {
    return failure(item, stateError);
  }

  const message = item.reviewMessages.find(
    (candidate) => candidate.messageId === input.messageId,
  );

  if (!message) {
    return failure(
      item,
      transitionError({
        action: "acknowledgeReviewMessage",
        code: "missing_review_message",
        item,
        message: "Review ACK failed because the review message was not found.",
      }),
    );
  }

  if (
    message.taskId !== item.taskId ||
    message.fromQueueItemId !== item.taskId ||
    message.toCoordinatorAgentId !== input.coordinatorAgentId
  ) {
    return failure(
      item,
      transitionError({
        action: "acknowledgeReviewMessage",
        code: "wrong_review_ack_target",
        item,
        message: "Review ACK failed because the message target does not match this task and coordinator.",
      }),
    );
  }

  const ack: SmartQueueReviewAck = {
    ackId: input.ackId,
    coordinatorAgentId: input.coordinatorAgentId,
    messageId: input.messageId,
    receivedAt: input.receivedAt,
  };

  return success(
    {
      ...item,
      reviewAcks: [...item.reviewAcks, ack],
      ticketState: "in_review",
      updatedAt: input.receivedAt,
    },
    ack,
  );
}
