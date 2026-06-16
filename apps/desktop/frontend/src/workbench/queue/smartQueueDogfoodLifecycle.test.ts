import { describe, expect, it } from "vitest";

import lifecycleFacadeSource from "./smartQueueDogfoodLifecycle.ts?raw";
import lifecycleDecisionSource from "./smartQueueDogfoodLifecycleDecision.ts?raw";
import lifecycleInternalSource from "./smartQueueDogfoodLifecycleInternal.ts?raw";
import lifecycleItemSource from "./smartQueueDogfoodLifecycleItem.ts?raw";
import lifecycleLabelsSource from "./smartQueueDogfoodLifecycleLabels.ts?raw";
import lifecycleReviewSource from "./smartQueueDogfoodLifecycleReview.ts?raw";
import lifecycleSelfTestSource from "./smartQueueDogfoodLifecycleSelfTest.ts?raw";
import lifecycleTypesSource from "./smartQueueDogfoodLifecycleTypes.ts?raw";
import {
  acknowledgeReviewMessage,
  addFollowUpPrompt,
  approveValidation,
  attachCommitResult,
  blockQueueItem,
  canStartDependentAfterReviewGate,
  completeAgentPrompt,
  createDogfoodLifecycleItem,
  createReviewMessage,
  failAgentPrompt,
  failQueueItem,
  getLifecycleHumanStatus,
  getSmartQueueDogfoodLifecycleSideEffects,
  markAgentPromptNotCompleted,
  markQueueItemDone,
  queueDogfoodLifecycleItem,
  requestCommit,
  returnToRunningWithAddedPrompt,
  runSmartQueueDogfoodLifecycleSelfTest,
  startQueueItemRun,
  type SmartQueueDogfoodLifecycleItem,
} from "./smartQueueDogfoodLifecycle";

describe("smartQueueDogfoodLifecycle", () => {
  it("keeps ticket state and agent prompt state separate", () => {
    const running = must(startQueueItemRun(queuedItem(), startInput()));
    const awaitingReview = must(
      completeAgentPrompt(running, {
        changedFilesSummary: "Changed files: 2",
        completedAt: "2026-06-16T00:10:00.000Z",
        finalAgentMessage: "Implementation completed.",
        validationSummary: "Validation suggested.",
      }),
    );

    expect(awaitingReview).toMatchObject({
      agentPromptState: "completed",
      changedFilesSummary: "Changed files: 2",
      reviewOutcome: "completed",
      ticketState: "awaiting_review",
      validationSummary: "Validation suggested.",
    });
    expect(awaitingReview.ticketState).not.toBe("done");
    expect(canStartDependentAfterReviewGate(awaitingReview)).toBe(false);
  });

  it("supports draft to queued to running", () => {
    const draft = baseItem();
    const queued = queueDogfoodLifecycleItem(draft, "2026-06-16T00:01:00.000Z");

    expect(queued).toMatchObject({
      ok: true,
      item: {
        agentPromptState: "idle",
        ticketState: "queued",
      },
    });

    const running = startQueueItemRun(queued.item, startInput());

    expect(running).toMatchObject({
      ok: true,
      item: {
        agentPromptState: "running",
        currentAttemptId: "attempt-1",
        currentThreadId: "thread-1",
        ticketState: "running",
      },
    });
  });

  it("creates awaiting review for not completed and failed agent outcomes", () => {
    const notCompleted = must(
      markAgentPromptNotCompleted(must(startQueueItemRun(queuedItem(), startInput())), {
        completedAt: "2026-06-16T00:10:00.000Z",
        finalAgentMessage: "The worker needs more input.",
      }),
    );
    const failed = must(
      failAgentPrompt(must(startQueueItemRun(queuedItem("task-failed"), startInput())), {
        failedAt: "2026-06-16T00:10:00.000Z",
        finalAgentMessage: "The worker failed before validation.",
      }),
    );

    expect(notCompleted).toMatchObject({
      agentPromptState: "not_completed",
      reviewOutcome: "not_completed",
      ticketState: "awaiting_review",
    });
    expect(failed).toMatchObject({
      agentPromptState: "failed",
      reviewOutcome: "failed",
      ticketState: "awaiting_review",
    });
    expect(canStartDependentAfterReviewGate(failed)).toBe(false);
  });

  it("keeps awaiting review distinct from in review through ACK", () => {
    const awaitingReview = completedAwaitingReviewItem();
    const withMessage = must(
      createReviewMessage(awaitingReview, {
        createdAt: "2026-06-16T00:11:00.000Z",
        messageId: "review-message-1",
        toCoordinatorAgentId: "coordinator-1",
      }),
    );

    expect(withMessage.ticketState).toBe("awaiting_review");
    expect(getLifecycleHumanStatus(withMessage)).toMatchObject({
      reviewLabel: "Waiting for coordinator review",
      ticketLabel: "Awaiting review",
    });

    const acknowledged = must(
      acknowledgeReviewMessage(withMessage, {
        ackId: "ack-1",
        coordinatorAgentId: "coordinator-1",
        messageId: "review-message-1",
        receivedAt: "2026-06-16T00:12:00.000Z",
      }),
    );

    expect(acknowledged).toMatchObject({
      reviewAcks: [
        {
          ackId: "ack-1",
          coordinatorAgentId: "coordinator-1",
          messageId: "review-message-1",
        },
      ],
      ticketState: "in_review",
    });
    expect(getLifecycleHumanStatus(acknowledged)).toMatchObject({
      reviewLabel: "Review acknowledged",
      ticketLabel: "In review",
    });
  });

  it("rejects review ACK outside awaiting review", () => {
    const result = acknowledgeReviewMessage(queuedItem(), {
      ackId: "ack-1",
      coordinatorAgentId: "coordinator-1",
      messageId: "review-message-1",
      receivedAt: "2026-06-16T00:12:00.000Z",
    });

    expect(result).toMatchObject({
      error: {
        code: "invalid_state",
        expectedTicketStates: ["awaiting_review"],
      },
      ok: false,
    });
  });

  it("rejects review ACK with the wrong message or coordinator target", () => {
    const withMessage = reviewMessagedItem();

    expect(
      acknowledgeReviewMessage(withMessage, {
        ackId: "ack-1",
        coordinatorAgentId: "coordinator-1",
        messageId: "missing-message",
        receivedAt: "2026-06-16T00:12:00.000Z",
      }),
    ).toMatchObject({
      error: { code: "missing_review_message" },
      ok: false,
    });
    expect(
      acknowledgeReviewMessage(withMessage, {
        ackId: "ack-1",
        coordinatorAgentId: "coordinator-2",
        messageId: "review-message-1",
        receivedAt: "2026-06-16T00:12:00.000Z",
      }),
    ).toMatchObject({
      error: { code: "wrong_review_ack_target" },
      ok: false,
    });
  });

  it("creates review messages with required evidence fields and product summary", () => {
    const result = createReviewMessage(completedAwaitingReviewItem(), {
      attemptId: "attempt-explicit",
      changedFilesSummary: "Changed files: src/a.ts",
      createdAt: "2026-06-16T00:11:00.000Z",
      messageId: "review-message-1",
      toCoordinatorAgentId: "coordinator-1",
      validationSummary: "npm.cmd run test passed.",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        attemptId: "attempt-explicit",
        changedFilesSummary: "Changed files: src/a.ts",
        finalAgentMessage: "Implementation completed.",
        productSummary: "Agent completed: Implementation completed.",
        reviewOutcome: "completed",
        validationSummary: "npm.cmd run test passed.",
      },
    });
  });

  it("requires validation approval and fake commit result before done", () => {
    const inReview = acknowledgedItem();

    expect(
      markQueueItemDone(inReview, {
        completedAt: "2026-06-16T00:16:00.000Z",
        coordinatorAgentId: "coordinator-1",
        decisionId: "decision-done",
        reason: "Accept.",
      }),
    ).toMatchObject({
      error: { code: "missing_validation_approval" },
      ok: false,
    });

    const approved = must(
      approveValidation(inReview, {
        approvedAt: "2026-06-16T00:13:00.000Z",
        approvedByCoordinatorAgentId: "coordinator-1",
        summary: "Validation approved.",
        validationApprovalId: "validation-1",
      }),
    );

    expect(
      markQueueItemDone(approved, {
        completedAt: "2026-06-16T00:16:00.000Z",
        coordinatorAgentId: "coordinator-1",
        decisionId: "decision-done",
        reason: "Accept.",
      }),
    ).toMatchObject({
      error: { code: "missing_commit_result" },
      ok: false,
    });

    const commitRequested = must(
      requestCommit(approved, {
        commitRequestId: "commit-request-1",
        createdAt: "2026-06-16T00:14:00.000Z",
        reason: "Create reviewed local commit.",
        requestedByCoordinatorAgentId: "coordinator-1",
      }),
    );
    const commitAttached = must(
      attachCommitResult(commitRequested, {
        attachedAt: "2026-06-16T00:15:00.000Z",
        commitHash: "abc1234",
        commitRequestId: "commit-request-1",
        commitResultId: "commit-result-1",
        status: "success",
        summary: "Fake commit result attached.",
      }),
    );
    const done = markQueueItemDone(commitAttached, {
      completedAt: "2026-06-16T00:16:00.000Z",
      coordinatorAgentId: "coordinator-1",
      decisionId: "decision-done",
      reason: "Accepted and committed.",
    });

    expect(done).toMatchObject({
      ok: true,
      item: {
        ticketState: "done",
      },
    });
    expect(canStartDependentAfterReviewGate(done.item)).toBe(true);
  });

  it("attaches fake commit result without executing Git", () => {
    const withCommitRequest = must(
      requestCommit(
        must(
          approveValidation(acknowledgedItem(), {
            approvedAt: "2026-06-16T00:13:00.000Z",
            approvedByCoordinatorAgentId: "coordinator-1",
            summary: "Validation approved.",
            validationApprovalId: "validation-1",
          }),
        ),
        {
          commitRequestId: "commit-request-1",
          createdAt: "2026-06-16T00:14:00.000Z",
          reason: "Create reviewed local commit.",
          requestedByCoordinatorAgentId: "coordinator-1",
        },
      ),
    );
    const result = attachCommitResult(withCommitRequest, {
      attachedAt: "2026-06-16T00:15:00.000Z",
      commitHash: "abc1234",
      commitResultId: "commit-result-1",
      status: "success",
      summary: "Fake commit succeeded.",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        modelOnly: true,
        noGitMutationPerformed: true,
        status: "success",
      },
    });
    expect(result.item.sideEffects).toMatchObject({
      wouldExecuteCommit: false,
      wouldMutateGit: false,
    });
  });

  it("returns follow-up prompt to running without marking done or starting a worker", () => {
    const inReview = acknowledgedItem();
    const result = addFollowUpPrompt(inReview, {
      createdAt: "2026-06-16T00:13:00.000Z",
      createdByCoordinatorAgentId: "coordinator-1",
      followUpPromptId: "follow-up-1",
      prompt: "Continue in the same thread with narrower scope.",
    });

    expect(result).toMatchObject({
      ok: true,
      item: {
        additionalPromptCount: 1,
        agentPromptState: "additional_prompt_running",
        currentRunnablePrompt: "Continue in the same thread with narrower scope.",
        ticketState: "running",
      },
      value: {
        parentAttemptId: "attempt-1",
        threadId: "thread-1",
      },
    });
    expect(result.item.originalPrompt).toBe("Implement the lifecycle task.");
    expect(result.item.sideEffects.wouldStartWorker).toBe(false);
    expect(canStartDependentAfterReviewGate(result.item)).toBe(false);
  });

  it("rejects follow-up prompt with wrong task id", () => {
    const result = returnToRunningWithAddedPrompt(acknowledgedItem(), {
      createdAt: "2026-06-16T00:13:00.000Z",
      createdByCoordinatorAgentId: "coordinator-1",
      followUpPromptId: "follow-up-1",
      prompt: "Continue.",
      taskId: "other-task",
    });

    expect(result).toMatchObject({
      error: { code: "invalid_follow_up_prompt" },
      ok: false,
    });
  });

  it("moves in-review items to blocked or terminal failure by explicit decision", () => {
    const blocked = blockQueueItem(acknowledgedItem(), {
      blockedAt: "2026-06-16T00:13:00.000Z",
      coordinatorAgentId: "coordinator-1",
      decisionId: "decision-block",
      reason: "Missing product decision.",
    });
    const failed = failQueueItem(acknowledgedItem("task-fail-final"), {
      coordinatorAgentId: "coordinator-1",
      decisionId: "decision-fail",
      failedAt: "2026-06-16T00:13:00.000Z",
      reason: "Rejected by coordinator.",
    });

    expect(blocked).toMatchObject({
      ok: true,
      item: {
        blockedReason: "Missing product decision.",
        ticketState: "blocked",
      },
    });
    expect(failed).toMatchObject({
      ok: true,
      item: {
        failureReason: "Rejected by coordinator.",
        ticketState: "failure",
      },
    });
  });

  it("keeps done and failure terminal unless a future reset helper exists", () => {
    const done = doneItem();
    const failed = must(
      failQueueItem(acknowledgedItem("task-terminal-failure"), {
        coordinatorAgentId: "coordinator-1",
        decisionId: "decision-fail",
        failedAt: "2026-06-16T00:13:00.000Z",
        reason: "Rejected.",
      }),
    );

    expect(startQueueItemRun(done, startInput())).toMatchObject({
      error: { code: "terminal_state" },
      ok: false,
    });
    expect(addFollowUpPrompt(done, followUpInput())).toMatchObject({
      error: { code: "terminal_state" },
      ok: false,
    });
    expect(startQueueItemRun(failed, startInput())).toMatchObject({
      error: { code: "terminal_state" },
      ok: false,
    });
  });

  it("uses product-facing labels instead of raw enum names", () => {
    const followUp = must(addFollowUpPrompt(acknowledgedItem(), followUpInput()));
    const status = getLifecycleHumanStatus(followUp);

    expect(status).toMatchObject({
      agentPromptLabel: "Follow-up prompt running",
      ticketLabel: "Running",
    });
    expect(status.text).toContain("Follow-up prompt running");
    expect(status.text).not.toMatch(/_/);
  });

  it("runs a fake full lifecycle self-test without runtime side effects", () => {
    const report = runSmartQueueDogfoodLifecycleSelfTest();

    expect(report).toMatchObject({
      followUpAdditionalPromptCount: 1,
      status: "passed",
      upstreamAfterDoneStartable: true,
      upstreamBeforeDoneStartable: false,
    });
    expect(report.sideEffects).toEqual(getSmartQueueDogfoodLifecycleSideEffects());
  });

  it("asserts no Codex, shell, Terminal, Git, rollback, worker, or regex routing side effects", () => {
    const sideEffects = getSmartQueueDogfoodLifecycleSideEffects();
    const sourceKeys = Object.keys(sideEffects);

    expect(sideEffects).toEqual({
      wouldCallCodex: false,
      wouldCallShell: false,
      wouldCallWorkspaceApi: false,
      wouldExecuteCommit: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldMutateGit: false,
      wouldPersist: false,
      wouldStartWorker: false,
    });
    expect(sourceKeys).not.toContain("wouldParseNaturalLanguage");
    expect(sourceKeys).not.toContain("wouldRouteByRegex");
  });

  it("does not add natural-language regex routing to lifecycle modules", () => {
    const source = dogfoodLifecycleSources();

    expect(source).not.toContain("RegExp");
    expect(source).not.toContain(".match(");
    expect(source).not.toContain("classifyUserIntent");
    expect(source).not.toContain("wouldRouteByRegex");
    expect(source).not.toContain(["user text", " -> regex"].join(""));
  });

  it("keeps dependents gated until upstream is done", () => {
    expect(canStartDependentAfterReviewGate(completedAwaitingReviewItem())).toBe(false);
    expect(canStartDependentAfterReviewGate(acknowledgedItem())).toBe(false);
    expect(canStartDependentAfterReviewGate(doneItem())).toBe(true);
  });
});

function baseItem(taskId = "task-1") {
  return createDogfoodLifecycleItem({
    createdAt: "2026-06-16T00:00:00.000Z",
    originalPrompt: "Implement the lifecycle task.",
    taskId,
    title: "Lifecycle task",
  });
}

function queuedItem(taskId = "task-1") {
  return must(
    queueDogfoodLifecycleItem(baseItem(taskId), "2026-06-16T00:01:00.000Z"),
  );
}

function completedAwaitingReviewItem(taskId = "task-1") {
  return must(
    completeAgentPrompt(must(startQueueItemRun(queuedItem(taskId), startInput())), {
      changedFilesSummary: "Changed files: 1",
      completedAt: "2026-06-16T00:10:00.000Z",
      finalAgentMessage: "Implementation completed.",
      validationSummary: "Validation passed.",
    }),
  );
}

function reviewMessagedItem(taskId = "task-1") {
  return must(
    createReviewMessage(completedAwaitingReviewItem(taskId), {
      createdAt: "2026-06-16T00:11:00.000Z",
      messageId: "review-message-1",
      toCoordinatorAgentId: "coordinator-1",
    }),
  );
}

function acknowledgedItem(taskId = "task-1") {
  return must(
    acknowledgeReviewMessage(reviewMessagedItem(taskId), {
      ackId: "ack-1",
      coordinatorAgentId: "coordinator-1",
      messageId: "review-message-1",
      receivedAt: "2026-06-16T00:12:00.000Z",
    }),
  );
}

function doneItem() {
  const approved = must(
    approveValidation(acknowledgedItem("task-done"), {
      approvedAt: "2026-06-16T00:13:00.000Z",
      approvedByCoordinatorAgentId: "coordinator-1",
      summary: "Validation approved.",
      validationApprovalId: "validation-1",
    }),
  );
  const commitRequested = must(
    requestCommit(approved, {
      commitRequestId: "commit-request-1",
      createdAt: "2026-06-16T00:14:00.000Z",
      reason: "Create reviewed local commit.",
      requestedByCoordinatorAgentId: "coordinator-1",
    }),
  );
  const commitAttached = must(
    attachCommitResult(commitRequested, {
      attachedAt: "2026-06-16T00:15:00.000Z",
      commitHash: "abc1234",
      commitRequestId: "commit-request-1",
      commitResultId: "commit-result-1",
      status: "success",
      summary: "Fake commit result attached.",
    }),
  );

  return must(
    markQueueItemDone(commitAttached, {
      completedAt: "2026-06-16T00:16:00.000Z",
      coordinatorAgentId: "coordinator-1",
      decisionId: "decision-done",
      reason: "Accepted and committed.",
    }),
  );
}

function startInput() {
  return {
    attemptId: "attempt-1",
    startedAt: "2026-06-16T00:02:00.000Z",
    threadId: "thread-1",
  };
}

function followUpInput() {
  return {
    createdAt: "2026-06-16T00:13:00.000Z",
    createdByCoordinatorAgentId: "coordinator-1",
    followUpPromptId: "follow-up-1",
    prompt: "Continue in the same thread with narrower scope.",
  };
}

function must(result: {
  readonly ok: boolean;
  readonly item: SmartQueueDogfoodLifecycleItem;
  readonly error?: { readonly message: string };
}) {
  if (!result.ok) {
    throw new Error(result.error?.message ?? "Expected lifecycle transition success.");
  }

  return result.item;
}

function dogfoodLifecycleSources() {
  return [
    lifecycleDecisionSource,
    lifecycleFacadeSource,
    lifecycleInternalSource,
    lifecycleItemSource,
    lifecycleLabelsSource,
    lifecycleReviewSource,
    lifecycleSelfTestSource,
    lifecycleTypesSource,
  ].join("\n");
}
