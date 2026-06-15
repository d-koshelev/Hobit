import { describe, expect, it } from "vitest";

import {
  appendAttempt,
  attachCoordinatorDecisionToAttempt,
  cancelAttempt,
  computeAttemptRollbackScope,
  computeAttemptSummary,
  createInitialAttempt,
  createWorkerReportFromAttemptFailure,
  finishAttemptFailure,
  finishAttemptSuccess,
  getSmartQueueAttemptModelSideEffects,
  isTerminalAttempt,
  markAttemptValidation,
  selectCurrentAttempt,
  startAttempt,
  type SmartQueueAttempt,
  type SmartQueueAttemptHistory,
} from "./smartQueueAttemptModel";
import { decideSmartQueueCoordinatorAction } from "./smartQueueCoordinatorDecision";

describe("smartQueueAttemptModel", () => {
  it("creates the initial pending attempt with attemptNumber 1", () => {
    expect(createInitialAttempt({ attemptId: "attempt-1", taskId: "task-1" }))
      .toEqual({
        attemptId: "attempt-1",
        attemptNumber: 1,
        coordinatorDecisionId: undefined,
        status: "pending",
        taskId: "task-1",
      });
  });

  it("starts an attempt by setting running state and worker metadata", () => {
    const attempt = startAttempt(initialAttempt(), {
      baseRevision: "rev-before",
      startedAt: "2026-06-15T08:00:00.000Z",
      workerId: "worker-1",
    });

    expect(attempt).toMatchObject({
      attemptId: "attempt-1",
      baseRevision: "rev-before",
      startedAt: "2026-06-15T08:00:00.000Z",
      status: "running",
      workerId: "worker-1",
    });
  });

  it("finishes success with completed state, result, validation, and summary", () => {
    const attempt = finishAttemptSuccess(
      startAttempt(initialAttempt(), {
        startedAt: "2026-06-15T08:00:00.000Z",
      }),
      {
        changedFiles: ["src/a.ts"],
        finishedAt: "2026-06-15T08:10:00.000Z",
        result: { summary: "Task completed." },
        validationResult: {
          status: "passed",
          summary: "npm test passed.",
        },
      },
    );
    const summary = computeAttemptSummary(history([attempt]));

    expect(attempt).toMatchObject({
      changedFiles: ["src/a.ts"],
      finishedAt: "2026-06-15T08:10:00.000Z",
      result: { summary: "Task completed." },
      status: "succeeded",
      validationResult: { status: "passed" },
    });
    expect(summary.rows).toEqual([
      {
        attemptId: "attempt-1",
        attemptNumber: 1,
        statusLabel: "Completed",
        text: "Attempt 1 Completed",
      },
    ]);
  });

  it("records failureKind and shortReason for failed attempts", () => {
    const attempt = finishAttemptFailure(initialAttempt(), {
      failureKind: "execution_failure",
      finishedAt: "2026-06-15T08:10:00.000Z",
      shortReason: "worker exited non-zero",
    });

    expect(attempt).toMatchObject({
      failureKind: "execution_failure",
      finishedAt: "2026-06-15T08:10:00.000Z",
      shortReason: "worker exited non-zero",
      status: "failed",
    });
  });

  it("represents validation failure distinctly", () => {
    const attempt = finishAttemptFailure(
      markAttemptValidation(initialAttempt(), {
        status: "running",
        summary: "Running validation.",
      }),
      {
        failureKind: "validation_failure",
        finishedAt: "2026-06-15T08:10:00.000Z",
        shortReason: "validation failed",
        validationResult: {
          evidence: ["npm.cmd run test failed."],
          status: "failed",
          summary: "Unit tests failed.",
        },
      },
    );

    expect(attempt).toMatchObject({
      failureKind: "validation_failure",
      status: "failed",
      validationResult: {
        status: "failed",
        summary: "Unit tests failed.",
      },
    });
    expect(computeAttemptSummary(history([attempt])).rows[0]).toMatchObject({
      statusLabel: "Failed validation",
      text: "Attempt 1 Failed validation",
    });
  });

  it("appends retry attempts with previous max attemptNumber plus one", () => {
    const previous = [
      createInitialAttempt({
        attemptId: "attempt-1",
        attemptNumber: 1,
        taskId: "task-1",
      }),
      createInitialAttempt({
        attemptId: "attempt-3",
        attemptNumber: 3,
        taskId: "task-1",
      }),
    ];
    const nextHistory = appendAttempt(history(previous), {
      attemptId: "attempt-4",
    });

    expect(nextHistory.attempts.map((attempt) => attempt.attemptNumber)).toEqual([
      1,
      3,
      4,
    ]);
    expect(nextHistory.attempts[2]).toMatchObject({
      attemptId: "attempt-4",
      attemptNumber: 4,
      status: "pending",
    });
  });

  it("preserves previous attempts when appending retries", () => {
    const first = finishAttemptFailure(initialAttempt(), {
      failureKind: "timeout",
      finishedAt: "2026-06-15T08:10:00.000Z",
      shortReason: "timeout",
    });
    const originalHistory = history([first]);
    const nextHistory = appendAttempt(originalHistory, {
      attemptId: "attempt-2",
    });

    expect(nextHistory.attempts[0]).toBe(first);
    expect(originalHistory.attempts).toHaveLength(1);
    expect(nextHistory.attempts).toHaveLength(2);
  });

  it("records modified prompt retry metadata on the new pending attempt", () => {
    const nextHistory = appendAttempt(history([initialAttempt()]), {
      attemptId: "attempt-2",
      promptOverride: {
        kind: "operator_modified_retry_prompt",
        modifiedPrompt: "Run task with narrower scope.",
        originalPrompt: "Run task",
        runnablePromptField: "task.prompt",
      },
      retrySource: "retry_with_modified_prompt",
    });

    expect(nextHistory.attempts[1]).toMatchObject({
      attemptId: "attempt-2",
      attemptNumber: 2,
      promptOverride: {
        kind: "operator_modified_retry_prompt",
        modifiedPrompt: "Run task with narrower scope.",
        originalPrompt: "Run task",
        runnablePromptField: "task.prompt",
      },
      retrySource: "retry_with_modified_prompt",
      status: "pending",
    });
  });

  it("keeps terminal attempts immutable from lifecycle helpers", () => {
    const completed = finishAttemptSuccess(initialAttempt(), {
      finishedAt: "2026-06-15T08:30:00.000Z",
      result: { summary: "Completed." },
    });

    expect(isTerminalAttempt(completed)).toBe(true);
    expect(
      startAttempt(completed, {
        startedAt: "2026-06-15T09:00:00.000Z",
        workerId: "worker-2",
      }),
    ).toBe(completed);
    expect(
      finishAttemptFailure(completed, {
        failureKind: "execution_failure",
        finishedAt: "2026-06-15T09:10:00.000Z",
        shortReason: "late failure",
      }),
    ).toBe(completed);
    expect(
      cancelAttempt(completed, {
        finishedAt: "2026-06-15T09:15:00.000Z",
      }),
    ).toBe(completed);
    expect(
      markAttemptValidation(completed, {
        status: "failed",
        summary: "late validation",
      }),
    ).toBe(completed);
  });

  it("selects the current attempt deterministically by highest attemptNumber then attemptId", () => {
    const selected = selectCurrentAttempt(
      history([
        createInitialAttempt({
          attemptId: "attempt-b",
          attemptNumber: 2,
          taskId: "task-1",
        }),
        createInitialAttempt({
          attemptId: "attempt-a",
          attemptNumber: 3,
          taskId: "task-1",
        }),
        createInitialAttempt({
          attemptId: "attempt-z",
          attemptNumber: 3,
          taskId: "task-1",
        }),
      ]),
    );

    expect(selected?.attemptId).toBe("attempt-z");
  });

  it("computes product-facing attempt summary text without internal enum names", () => {
    const first = startAttempt(initialAttempt(), {
      startedAt: "2026-06-15T08:00:00.000Z",
    });
    const second = finishAttemptFailure(
      createInitialAttempt({
        attemptId: "attempt-2",
        attemptNumber: 2,
        taskId: "task-1",
      }),
      {
        failureKind: "validation_failure",
        finishedAt: "2026-06-15T08:20:00.000Z",
        shortReason: "validation failed",
      },
    );
    const third = finishAttemptSuccess(
      createInitialAttempt({
        attemptId: "attempt-3",
        attemptNumber: 3,
        taskId: "task-1",
      }),
      {
        finishedAt: "2026-06-15T08:30:00.000Z",
      },
    );

    const summary = computeAttemptSummary(history([third, first, second]));

    expect(summary.rows.map((row) => row.text)).toEqual([
      "Attempt 1 Running",
      "Attempt 2 Failed validation",
      "Attempt 3 Completed",
    ]);
    expect(summary.lastFailureText).toBe("Last failure: validation failed");
    expect(summary.rows.map((row) => row.text).join(" ")).not.toMatch(/_/);
  });

  it("includes changed files count in the summary", () => {
    const first = finishAttemptFailure(initialAttempt(), {
      changedFiles: ["src/a.ts", "src/b.ts"],
      failureKind: "validation_failure",
      finishedAt: "2026-06-15T08:20:00.000Z",
      shortReason: "validation failed",
    });
    const second = finishAttemptSuccess(
      createInitialAttempt({
        attemptId: "attempt-2",
        attemptNumber: 2,
        taskId: "task-1",
      }),
      {
        changedFiles: ["src/a.ts", "src/c.ts"],
        finishedAt: "2026-06-15T08:30:00.000Z",
      },
    );

    expect(computeAttemptSummary(history([first, second]))).toMatchObject({
      changedFilesCount: 3,
      changedFilesText: "Changed files: 3",
    });
  });

  it("creates a pure coordinator worker report from a failed attempt", () => {
    const failed = finishAttemptFailure(initialAttempt(), {
      failureKind: "validation_failure",
      finishedAt: "2026-06-15T08:10:00.000Z",
      shortReason: "validation failed",
      validationResult: {
        status: "failed",
        summary: "Unit tests failed.",
      },
    });
    const report = createWorkerReportFromAttemptFailure({ attempt: failed });

    expect(report).toEqual({
      attemptId: "attempt-1",
      evidenceSummary: "Unit tests failed.",
      failureKind: "validation_failure",
      shortReason: "validation failed",
      stage: "validation",
      taskId: "task-1",
    });
    expect(
      createWorkerReportFromAttemptFailure({ attempt: initialAttempt() }),
    ).toBeUndefined();
  });

  it("lets coordinator decisions attach back to failed attempts by attemptId", () => {
    const failed = finishAttemptFailure(initialAttempt(), {
      failureKind: "validation_failure",
      finishedAt: "2026-06-15T08:10:00.000Z",
      shortReason: "validation failed",
      validationResult: {
        status: "failed",
        summary: "Unit tests failed.",
      },
    });
    const report = createWorkerReportFromAttemptFailure({ attempt: failed });

    expect(report).toBeDefined();

    const decision = decideSmartQueueCoordinatorAction({
      decisionId: "decision-1",
      maxRetries: 2,
      report: report!,
      retryCount: 1,
    });
    const decidedAttempt = attachCoordinatorDecisionToAttempt(
      failed,
      decision.decisionId,
    );

    expect(decision).toMatchObject({
      attemptId: "attempt-1",
      evidenceSummary: "Unit tests failed.",
      humanStatus: {
        label: "Needs decision: validation failed",
      },
      taskId: "task-1",
    });
    expect(decidedAttempt).toMatchObject({
      attemptId: "attempt-1",
      coordinatorDecisionId: "decision-1",
      status: "failed",
    });
  });

  it("attaches coordinator decision id to an attempt without changing its identity", () => {
    const attempt = attachCoordinatorDecisionToAttempt(
      initialAttempt(),
      "decision-1",
    );

    expect(attempt).toMatchObject({
      attemptId: "attempt-1",
      coordinatorDecisionId: "decision-1",
      taskId: "task-1",
    });
  });

  it("represents rollback scope metadata without executing rollback", () => {
    const attempt = startAttempt(initialAttempt(), {
      baseRevision: "rev-before",
      changedFiles: ["src/a.ts"],
      startedAt: "2026-06-15T08:00:00.000Z",
    });

    expect(computeAttemptRollbackScope(attempt)).toEqual({
      attemptId: "attempt-1",
      baseRevision: "rev-before",
      changedFiles: ["src/a.ts"],
      requiresApproval: true,
      wouldExecuteRollback: false,
    });
    expect(computeAttemptSummary(history([attempt])).rollbackScope).toMatchObject({
      attemptId: "attempt-1",
      wouldExecuteRollback: false,
    });
  });

  it("keeps cancellation as an attempt terminal state", () => {
    const cancelled = cancelAttempt(initialAttempt(), {
      finishedAt: "2026-06-15T08:01:00.000Z",
    });

    expect(cancelled).toMatchObject({
      finishedAt: "2026-06-15T08:01:00.000Z",
      status: "cancelled",
    });
    expect(computeAttemptSummary(history([cancelled])).rows[0]?.text).toBe(
      "Attempt 1 Cancelled",
    );
  });

  it("exposes pure model side-effect flags only", () => {
    const sideEffects = getSmartQueueAttemptModelSideEffects();

    expect(sideEffects).toEqual({
      wouldCallWorkspaceApi: false,
      wouldExecuteAttempt: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldMutateQueue: false,
      wouldPersist: false,
    });
    expect("execute" in sideEffects).toBe(false);
    expect("run" in sideEffects).toBe(false);
    expect("tauri" in sideEffects).toBe(false);
    expect("workspaceApi" in sideEffects).toBe(false);
    expect("localStorage" in sideEffects).toBe(false);
  });
});

function initialAttempt(): SmartQueueAttempt {
  return createInitialAttempt({
    attemptId: "attempt-1",
    taskId: "task-1",
  });
}

function history(
  attempts: readonly SmartQueueAttempt[],
): SmartQueueAttemptHistory {
  return {
    attempts,
    taskId: "task-1",
  };
}
