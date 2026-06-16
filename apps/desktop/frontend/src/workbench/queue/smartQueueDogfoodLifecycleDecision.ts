import type {
  SmartQueueCommitRequest,
  SmartQueueCommitResult,
  SmartQueueCommitResultStatus,
  SmartQueueDogfoodLifecycleItem,
  SmartQueueFollowUpPrompt,
  SmartQueueLifecycleTransitionResult,
  SmartQueueValidationApproval,
} from "./smartQueueDogfoodLifecycleTypes";
import {
  assertTicketState,
  cleanOptionalText,
  cleanText,
  coordinatorDecision,
  failure,
  success,
  transitionError,
} from "./smartQueueDogfoodLifecycleInternal";

export type ApproveValidationInput = {
  readonly validationApprovalId: string;
  readonly approvedByCoordinatorAgentId: string;
  readonly summary: string;
  readonly approvedAt: string;
  readonly decisionId?: string;
};

export type RequestCommitInput = {
  readonly commitRequestId: string;
  readonly requestedByCoordinatorAgentId: string;
  readonly reason: string;
  readonly createdAt: string;
  readonly decisionId?: string;
};

export type AttachCommitResultInput = {
  readonly commitResultId: string;
  readonly commitRequestId?: string;
  readonly status: SmartQueueCommitResultStatus;
  readonly commitHash?: string;
  readonly summary: string;
  readonly attachedAt: string;
  readonly coordinatorAgentId?: string;
  readonly decisionId?: string;
};

export type MarkDoneInput = {
  readonly decisionId: string;
  readonly coordinatorAgentId: string;
  readonly reason: string;
  readonly completedAt: string;
};

export type AddFollowUpPromptInput = {
  readonly followUpPromptId: string;
  readonly prompt: string;
  readonly createdByCoordinatorAgentId: string;
  readonly createdAt: string;
  readonly parentAttemptId?: string;
  readonly threadId?: string;
  readonly decisionId?: string;
};

export type BlockQueueItemInput = {
  readonly decisionId: string;
  readonly coordinatorAgentId: string;
  readonly reason: string;
  readonly blockedAt: string;
};

export type FailQueueItemInput = {
  readonly decisionId: string;
  readonly coordinatorAgentId: string;
  readonly reason: string;
  readonly failedAt: string;
};

export function approveValidation(
  item: SmartQueueDogfoodLifecycleItem,
  input: ApproveValidationInput,
): SmartQueueLifecycleTransitionResult<SmartQueueValidationApproval> {
  const stateError = assertTicketState(item, "approveValidation", [
    "in_review",
  ]);

  if (stateError) {
    return failure(item, stateError);
  }

  const validationApproval: SmartQueueValidationApproval = {
    approvedAt: input.approvedAt,
    approvedByCoordinatorAgentId: input.approvedByCoordinatorAgentId,
    modelOnly: true,
    summary: cleanText(input.summary) || "Validation approved.",
    taskId: item.taskId,
    validationApprovalId: input.validationApprovalId,
  };
  const decision = coordinatorDecision({
    coordinatorAgentId: input.approvedByCoordinatorAgentId,
    createdAt: input.approvedAt,
    decisionId: input.decisionId ?? `decision:${input.validationApprovalId}`,
    kind: "approve_validation",
    reason: validationApproval.summary,
    taskId: item.taskId,
    validationApprovalId: validationApproval.validationApprovalId,
  });

  return success(
    {
      ...item,
      coordinatorDecisions: [...item.coordinatorDecisions, decision],
      updatedAt: input.approvedAt,
      validationApprovals: [...item.validationApprovals, validationApproval],
    },
    validationApproval,
  );
}

export function requestCommit(
  item: SmartQueueDogfoodLifecycleItem,
  input: RequestCommitInput,
): SmartQueueLifecycleTransitionResult<SmartQueueCommitRequest> {
  const stateError = assertTicketState(item, "requestCommit", ["in_review"]);

  if (stateError) {
    return failure(item, stateError);
  }

  if (item.validationApprovals.length === 0) {
    return failure(
      item,
      transitionError({
        action: "requestCommit",
        code: "missing_validation_approval",
        item,
        message: "Commit request requires an explicit validation approval record.",
      }),
    );
  }

  const commitRequest: SmartQueueCommitRequest = {
    commitRequestId: input.commitRequestId,
    createdAt: input.createdAt,
    modelOnly: true,
    reason: cleanText(input.reason) || "Commit requested.",
    requestedByCoordinatorAgentId: input.requestedByCoordinatorAgentId,
    taskId: item.taskId,
  };
  const decision = coordinatorDecision({
    commitRequestId: commitRequest.commitRequestId,
    coordinatorAgentId: input.requestedByCoordinatorAgentId,
    createdAt: input.createdAt,
    decisionId: input.decisionId ?? `decision:${input.commitRequestId}`,
    kind: "request_commit",
    reason: commitRequest.reason,
    taskId: item.taskId,
  });

  return success(
    {
      ...item,
      commitRequests: [...item.commitRequests, commitRequest],
      coordinatorDecisions: [...item.coordinatorDecisions, decision],
      updatedAt: input.createdAt,
    },
    commitRequest,
  );
}

export function attachCommitResult(
  item: SmartQueueDogfoodLifecycleItem,
  input: AttachCommitResultInput,
): SmartQueueLifecycleTransitionResult<SmartQueueCommitResult> {
  const stateError = assertTicketState(item, "attachCommitResult", [
    "in_review",
  ]);

  if (stateError) {
    return failure(item, stateError);
  }

  if (item.commitRequests.length === 0) {
    return failure(
      item,
      transitionError({
        action: "attachCommitResult",
        code: "missing_commit_request",
        item,
        message: "A fake commit result can be attached only after a commit request record exists.",
      }),
    );
  }

  const commitRequestId =
    input.commitRequestId ??
    item.commitRequests[item.commitRequests.length - 1]?.commitRequestId;

  if (
    commitRequestId &&
    !item.commitRequests.some((request) => request.commitRequestId === commitRequestId)
  ) {
    return failure(
      item,
      transitionError({
        action: "attachCommitResult",
        code: "invalid_commit_result",
        item,
        message: "Commit result references an unknown commit request.",
      }),
    );
  }

  const commitResult: SmartQueueCommitResult = {
    attachedAt: input.attachedAt,
    commitHash: cleanOptionalText(input.commitHash),
    commitRequestId,
    commitResultId: input.commitResultId,
    modelOnly: true,
    noGitMutationPerformed: true,
    status: input.status,
    summary: cleanText(input.summary) || defaultCommitResultSummary(input.status),
    taskId: item.taskId,
  };
  const decision = coordinatorDecision({
    commitRequestId,
    commitResultId: commitResult.commitResultId,
    coordinatorAgentId: input.coordinatorAgentId,
    createdAt: input.attachedAt,
    decisionId: input.decisionId ?? `decision:${input.commitResultId}`,
    kind: "attach_commit_result",
    reason: commitResult.summary,
    taskId: item.taskId,
  });

  return success(
    {
      ...item,
      commitResults: [...item.commitResults, commitResult],
      coordinatorDecisions: [...item.coordinatorDecisions, decision],
      updatedAt: input.attachedAt,
    },
    commitResult,
  );
}

export function markQueueItemDone(
  item: SmartQueueDogfoodLifecycleItem,
  input: MarkDoneInput,
): SmartQueueLifecycleTransitionResult {
  const stateError = assertTicketState(item, "markQueueItemDone", [
    "in_review",
  ]);

  if (stateError) {
    return failure(item, stateError);
  }

  if (item.reviewOutcome !== "completed") {
    return failure(
      item,
      transitionError({
        action: "markQueueItemDone",
        code: "missing_review_outcome",
        item,
        message: "Done requires a completed agent review outcome.",
      }),
    );
  }

  if (item.validationApprovals.length === 0) {
    return failure(
      item,
      transitionError({
        action: "markQueueItemDone",
        code: "missing_validation_approval",
        item,
        message: "Done requires an explicit validation approval record.",
      }),
    );
  }

  if (!item.commitResults.some((result) => result.status === "success")) {
    return failure(
      item,
      transitionError({
        action: "markQueueItemDone",
        code: "missing_commit_result",
        item,
        message: "Done requires a successful commit result placeholder in this MVP model.",
      }),
    );
  }

  const decision = coordinatorDecision({
    coordinatorAgentId: input.coordinatorAgentId,
    createdAt: input.completedAt,
    decisionId: input.decisionId,
    kind: "mark_done",
    reason: cleanText(input.reason) || "Queue item done.",
    taskId: item.taskId,
  });

  return success({
    ...item,
    coordinatorDecisions: [...item.coordinatorDecisions, decision],
    ticketState: "done",
    updatedAt: input.completedAt,
  });
}

export function addFollowUpPrompt(
  item: SmartQueueDogfoodLifecycleItem,
  input: AddFollowUpPromptInput,
): SmartQueueLifecycleTransitionResult<SmartQueueFollowUpPrompt> {
  const followUpPrompt: SmartQueueFollowUpPrompt = {
    createdAt: input.createdAt,
    createdByCoordinatorAgentId: input.createdByCoordinatorAgentId,
    followUpPromptId: input.followUpPromptId,
    parentAttemptId: input.parentAttemptId ?? item.currentAttemptId,
    prompt: cleanText(input.prompt),
    taskId: item.taskId,
    threadId: input.threadId ?? item.currentThreadId,
  };

  return returnToRunningWithAddedPrompt(item, followUpPrompt, {
    coordinatorAgentId: input.createdByCoordinatorAgentId,
    decisionId: input.decisionId ?? `decision:${input.followUpPromptId}`,
  });
}

export function returnToRunningWithAddedPrompt(
  item: SmartQueueDogfoodLifecycleItem,
  followUpPrompt: SmartQueueFollowUpPrompt,
  options?: {
    readonly decisionId?: string;
    readonly coordinatorAgentId?: string;
  },
): SmartQueueLifecycleTransitionResult<SmartQueueFollowUpPrompt> {
  const stateError = assertTicketState(item, "returnToRunningWithAddedPrompt", [
    "in_review",
  ]);

  if (stateError) {
    return failure(item, stateError);
  }

  if (
    followUpPrompt.taskId !== item.taskId ||
    !cleanText(followUpPrompt.prompt)
  ) {
    return failure(
      item,
      transitionError({
        action: "returnToRunningWithAddedPrompt",
        code: "invalid_follow_up_prompt",
        item,
        message: "Follow-up prompt must target this Queue item and include runnable prompt text.",
      }),
    );
  }

  const decision = coordinatorDecision({
    coordinatorAgentId:
      options?.coordinatorAgentId ?? followUpPrompt.createdByCoordinatorAgentId,
    createdAt: followUpPrompt.createdAt,
    decisionId:
      options?.decisionId ?? `decision:${followUpPrompt.followUpPromptId}`,
    followUpPromptId: followUpPrompt.followUpPromptId,
    kind: "add_follow_up_prompt",
    reason: "Follow-up prompt added.",
    taskId: item.taskId,
  });
  const runningDecision = coordinatorDecision({
    coordinatorAgentId:
      options?.coordinatorAgentId ?? followUpPrompt.createdByCoordinatorAgentId,
    createdAt: followUpPrompt.createdAt,
    decisionId: `${decision.decisionId}:return-to-running`,
    followUpPromptId: followUpPrompt.followUpPromptId,
    kind: "return_to_running_added_prompt",
    reason: "Returned to running with added prompt.",
    taskId: item.taskId,
  });

  return success(
    {
      ...item,
      additionalPromptCount: item.additionalPromptCount + 1,
      agentPromptState: "additional_prompt_running",
      coordinatorDecisions: [
        ...item.coordinatorDecisions,
        decision,
        runningDecision,
      ],
      currentRunnablePrompt: followUpPrompt.prompt,
      currentThreadId: followUpPrompt.threadId ?? item.currentThreadId,
      followUpPrompts: [...item.followUpPrompts, followUpPrompt],
      ticketState: "running",
      updatedAt: followUpPrompt.createdAt,
    },
    followUpPrompt,
  );
}

export function blockQueueItem(
  item: SmartQueueDogfoodLifecycleItem,
  input: BlockQueueItemInput,
): SmartQueueLifecycleTransitionResult {
  const stateError = assertTicketState(item, "blockQueueItem", ["in_review"]);

  if (stateError) {
    return failure(item, stateError);
  }

  const reason = cleanText(input.reason) || "Blocked by coordinator decision.";
  const decision = coordinatorDecision({
    coordinatorAgentId: input.coordinatorAgentId,
    createdAt: input.blockedAt,
    decisionId: input.decisionId,
    kind: "block_task",
    reason,
    taskId: item.taskId,
  });

  return success({
    ...item,
    blockedReason: reason,
    coordinatorDecisions: [...item.coordinatorDecisions, decision],
    ticketState: "blocked",
    updatedAt: input.blockedAt,
  });
}

export function failQueueItem(
  item: SmartQueueDogfoodLifecycleItem,
  input: FailQueueItemInput,
): SmartQueueLifecycleTransitionResult {
  const stateError = assertTicketState(item, "failQueueItem", ["in_review"]);

  if (stateError) {
    return failure(item, stateError);
  }

  const reason = cleanText(input.reason) || "Failed by coordinator decision.";
  const decision = coordinatorDecision({
    coordinatorAgentId: input.coordinatorAgentId,
    createdAt: input.failedAt,
    decisionId: input.decisionId,
    kind: "fail_task",
    reason,
    taskId: item.taskId,
  });

  return success({
    ...item,
    coordinatorDecisions: [...item.coordinatorDecisions, decision],
    failureReason: reason,
    ticketState: "failure",
    updatedAt: input.failedAt,
  });
}

function defaultCommitResultSummary(status: SmartQueueCommitResultStatus) {
  return status === "success"
    ? "Fake commit result succeeded."
    : "Fake commit result failed.";
}
