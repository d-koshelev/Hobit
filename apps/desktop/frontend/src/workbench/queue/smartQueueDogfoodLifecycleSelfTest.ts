import type { SmartQueueDogfoodLifecycleSelfTestReport } from "./smartQueueDogfoodLifecycleTypes";
import {
  attachCommitResult,
  approveValidation,
  requestCommit,
  addFollowUpPrompt,
  markQueueItemDone,
} from "./smartQueueDogfoodLifecycleDecision";
import {
  canStartDependentAfterReviewGate,
  completeAgentPrompt,
  createDogfoodLifecycleItem,
  queueDogfoodLifecycleItem,
  startQueueItemRun,
} from "./smartQueueDogfoodLifecycleItem";
import {
  acknowledgeReviewMessage,
  createReviewMessage,
} from "./smartQueueDogfoodLifecycleReview";
import {
  NO_DOGFOOD_LIFECYCLE_SIDE_EFFECTS,
  mustTransition,
} from "./smartQueueDogfoodLifecycleInternal";

export function runSmartQueueDogfoodLifecycleSelfTest(
  createdAt = "2026-06-16T00:00:00.000Z",
): SmartQueueDogfoodLifecycleSelfTestReport {
  const queuedRoot = mustTransition(
    queueDogfoodLifecycleItem(
      createDogfoodLifecycleItem({
        createdAt,
        originalPrompt: "Implement root task.",
        taskId: "task-root",
        title: "Root task",
      }),
      "2026-06-16T00:01:00.000Z",
    ),
  );
  const runningRoot = mustTransition(
    startQueueItemRun(queuedRoot, {
      attemptId: "attempt-root-1",
      startedAt: "2026-06-16T00:02:00.000Z",
      threadId: "thread-root",
    }),
  );
  const completedRoot = mustTransition(
    completeAgentPrompt(runningRoot, {
      changedFilesSummary: "Changed files: 1",
      completedAt: "2026-06-16T00:10:00.000Z",
      finalAgentMessage: "Root task completed.",
      validationSummary: "Validation suggested.",
    }),
  );
  const dependentBeforeDone = canStartDependentAfterReviewGate(completedRoot);
  const doneRoot = completeReviewAndCommit(completedRoot);
  const followUpRunning = runFollowUpBranch(createdAt);
  const passed =
    !dependentBeforeDone &&
    canStartDependentAfterReviewGate(doneRoot) &&
    followUpRunning.ticketState === "running" &&
    followUpRunning.agentPromptState === "additional_prompt_running" &&
    followUpRunning.additionalPromptCount === 1;

  return {
    createdAt,
    followUpAdditionalPromptCount: followUpRunning.additionalPromptCount,
    reportId: "smart-queue-dogfood-lifecycle:self-test",
    sideEffects: NO_DOGFOOD_LIFECYCLE_SIDE_EFFECTS,
    status: passed ? "passed" : "failed",
    summary: passed
      ? "Queue dogfood lifecycle model self-test passed."
      : "Queue dogfood lifecycle model self-test failed.",
    upstreamAfterDoneStartable: canStartDependentAfterReviewGate(doneRoot),
    upstreamBeforeDoneStartable: dependentBeforeDone,
  };
}

export function getSmartQueueDogfoodLifecycleSideEffects() {
  return NO_DOGFOOD_LIFECYCLE_SIDE_EFFECTS;
}

function completeReviewAndCommit(
  completedRoot: ReturnType<typeof createDogfoodLifecycleItem>,
) {
  const messagedRoot = mustTransition(
    createReviewMessage(completedRoot, {
      createdAt: "2026-06-16T00:11:00.000Z",
      messageId: "review-message-root",
      toCoordinatorAgentId: "coordinator-1",
    }),
  );
  const acknowledgedRoot = mustTransition(
    acknowledgeReviewMessage(messagedRoot, {
      ackId: "ack-root",
      coordinatorAgentId: "coordinator-1",
      messageId: "review-message-root",
      receivedAt: "2026-06-16T00:12:00.000Z",
    }),
  );
  const approvedRoot = mustTransition(
    approveValidation(acknowledgedRoot, {
      approvedAt: "2026-06-16T00:13:00.000Z",
      approvedByCoordinatorAgentId: "coordinator-1",
      summary: "Validation approved.",
      validationApprovalId: "validation-root",
    }),
  );
  const commitRequestedRoot = mustTransition(
    requestCommit(approvedRoot, {
      commitRequestId: "commit-request-root",
      createdAt: "2026-06-16T00:14:00.000Z",
      reason: "Commit approved result.",
      requestedByCoordinatorAgentId: "coordinator-1",
    }),
  );
  const commitAttachedRoot = mustTransition(
    attachCommitResult(commitRequestedRoot, {
      attachedAt: "2026-06-16T00:15:00.000Z",
      commitHash: "abc1234",
      commitRequestId: "commit-request-root",
      commitResultId: "commit-result-root",
      status: "success",
      summary: "Fake commit result attached.",
    }),
  );

  return mustTransition(
    markQueueItemDone(commitAttachedRoot, {
      completedAt: "2026-06-16T00:16:00.000Z",
      coordinatorAgentId: "coordinator-1",
      decisionId: "decision-root-done",
      reason: "Accepted and committed.",
    }),
  );
}

function runFollowUpBranch(createdAt: string) {
  const queuedFollowUp = mustTransition(
    queueDogfoodLifecycleItem(
      createDogfoodLifecycleItem({
        createdAt,
        originalPrompt: "Implement follow-up branch.",
        taskId: "task-follow-up",
      }),
      "2026-06-16T00:01:00.000Z",
    ),
  );
  const runningFollowUp = mustTransition(
    startQueueItemRun(queuedFollowUp, {
      attemptId: "attempt-follow-up-1",
      startedAt: "2026-06-16T00:02:00.000Z",
      threadId: "thread-follow-up",
    }),
  );
  const completedFollowUp = mustTransition(
    completeAgentPrompt(runningFollowUp, {
      completedAt: "2026-06-16T00:10:00.000Z",
      finalAgentMessage: "Needs follow-up.",
    }),
  );
  const messagedFollowUp = mustTransition(
    createReviewMessage(completedFollowUp, {
      createdAt: "2026-06-16T00:11:00.000Z",
      messageId: "review-message-follow-up",
      toCoordinatorAgentId: "coordinator-1",
    }),
  );
  const acknowledgedFollowUp = mustTransition(
    acknowledgeReviewMessage(messagedFollowUp, {
      ackId: "ack-follow-up",
      coordinatorAgentId: "coordinator-1",
      messageId: "review-message-follow-up",
      receivedAt: "2026-06-16T00:12:00.000Z",
    }),
  );

  return mustTransition(
    addFollowUpPrompt(acknowledgedFollowUp, {
      createdAt: "2026-06-16T00:13:00.000Z",
      createdByCoordinatorAgentId: "coordinator-1",
      followUpPromptId: "follow-up-1",
      prompt: "Continue in the same thread with narrower scope.",
    }),
  );
}
