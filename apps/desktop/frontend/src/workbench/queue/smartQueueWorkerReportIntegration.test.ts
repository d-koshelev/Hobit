import { describe, expect, it } from "vitest";

import type { AgentQueueTask } from "../../workspace/types";
import {
  buildSmartQueueWorkerFailureIntegration,
  classifySmartQueueFailure,
  latestSmartQueueFailurePayloadForTask,
} from "./smartQueueWorkerReportIntegration";

describe("smartQueueWorkerReportIntegration", () => {
  it("creates failed attempt evidence and Needs decision for validation failure", () => {
    const result = integration({
      failureKind: "validation_failure",
      reason: "Validation command failed.",
      runId: "run-validation",
    });

    expect(result.attempt).toMatchObject({
      attemptId: "smart-attempt:queue-1:run-validation",
      coordinatorDecisionId: result.coordinatorDecision.decisionId,
      failureKind: "validation_failure",
      status: "failed",
      taskId: "queue-1",
      validationResult: { status: "failed" },
    });
    expect(result.workerReport).toMatchObject({
      attemptId: result.attempt.attemptId,
      failureKind: "validation_failure",
      stage: "validation",
      taskId: "queue-1",
    });
    expect(result.coordinatorDecision).toMatchObject({
      action: "request_human_input",
      productLabel: "Needs decision: validation failed",
    });
    expect(result.taskPatch).toMatchObject({
      coordinatorStatus: "awaiting_coordinator_review",
      validationStatus: "failed",
    });
  });

  it("creates an exec failure blocker/status without choosing retry or rollback", () => {
    const result = integration({
      failureKind: "execution_failure",
      reason: "Direct Work run failed.",
    });

    expect(result.coordinatorDecision).toMatchObject({
      action: "move_blocked",
      productLabel: "Blocked: exec failure",
      severity: "blocked",
    });
    expect(result.taskPatch).toMatchObject({
      coordinatorStatus: "blocked",
      validationStatus: "needs_review",
    });
    expect(result.sideEffects).toEqual({
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldMutateQueue: false,
      wouldStartWorker: false,
    });
    expect(result.coordinatorDecision.sideEffects).toMatchObject({
      wouldExecuteRetry: false,
      wouldRollback: false,
      wouldStartWorker: false,
    });
  });

  it("maps missing config and dirty workspace to blocked product statuses", () => {
    expect(
      integration({
        failureKind: "missing_config",
        reason: "Task is missing execution workspace.",
      }).coordinatorDecision.productLabel,
    ).toBe("Blocked: missing config");
    expect(
      integration({
        failureKind: "dirty_worktree",
        reason: "Working tree is dirty.",
      }).coordinatorDecision.productLabel,
    ).toBe("Blocked: dirty workspace");
  });

  it("respects retry budget for timeout and tool failures", () => {
    const retryAvailable = integration({
      failureKind: "timeout",
      maxRetries: 2,
      reason: "Timed out.",
      retryCount: 1,
    });
    const retryLimitReached = integration({
      failureKind: "tool_failure",
      maxRetries: 1,
      reason: "Tool failed.",
      retryCount: 1,
    });

    expect(retryAvailable.coordinatorDecision).toMatchObject({
      action: "retry_same",
      productLabel: "Retry available",
      retryPolicy: { canRetry: true },
    });
    expect(retryLimitReached.coordinatorDecision).toMatchObject({
      action: "move_blocked",
      productLabel: "Retry limit reached",
      retryPolicy: { canRetry: false },
    });
    expect(retryAvailable.sideEffects.wouldExecuteRetry).toBe(false);
    expect(retryLimitReached.sideEffects.wouldExecuteRollback).toBe(false);
  });

  it("requests human input for unknown failures", () => {
    const result = integration({
      failureKind: "unknown",
      reason: "Unexpected result shape.",
    });

    expect(result.coordinatorDecision).toMatchObject({
      action: "request_human_input",
      productLabel: "Needs decision",
      requiresOperatorApproval: true,
    });
    expect(result.taskPatch.coordinatorStatus).toBe("awaiting_coordinator_review");
  });

  it("embeds parseable structured report evidence on the Queue worker report", () => {
    const result = integration({
      failureKind: "execution_failure",
      reason: "Direct Work run failed.",
      runId: "run-parse",
    });
    const payload = latestSmartQueueFailurePayloadForTask({
      workerExecutionReports: [result.taskPatch.workerExecutionReport],
    });

    expect(payload?.workerReport).toMatchObject({
      attemptId: result.attempt.attemptId,
      taskId: "queue-1",
    });
    expect(payload?.coordinatorDecision.decisionId).toBe(
      result.coordinatorDecision.decisionId,
    );
    expect(result.taskPatch.workerExecutionReport.summary).toBe(
      "Blocked: exec failure",
    );
    expect(result.taskPatch.workerExecutionReport.summary).not.toContain(
      "execution_failure",
    );
  });

  it("classifies active Queue failure messages for controller integration", () => {
    expect(classifySmartQueueFailure("Validation failed.")).toBe(
      "validation_failure",
    );
    expect(classifySmartQueueFailure("Task is missing execution workspace.")).toBe(
      "missing_config",
    );
    expect(classifySmartQueueFailure("Working tree is dirty.")).toBe(
      "dirty_worktree",
    );
    expect(classifySmartQueueFailure("Run timed out.", "timed_out")).toBe(
      "timeout",
    );
    expect(classifySmartQueueFailure("Codex executable not found.")).toBe(
      "tool_failure",
    );
    expect(classifySmartQueueFailure("Unexpected result shape.")).toBe("unknown");
  });
});

function integration(
  overrides: Partial<Parameters<typeof buildSmartQueueWorkerFailureIntegration>[0]>,
) {
  return buildSmartQueueWorkerFailureIntegration({
    createdAt: "2026-06-15T10:00:00.000Z",
    reason: "Failed.",
    task: queueTask(),
    ...overrides,
  });
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: "executor-1",
    approvalPolicy: "never",
    codexExecutable: "codex",
    createdAt: "2026-06-15T09:00:00.000Z",
    description: "",
    executionPolicy: "auto",
    executionWorkspace: "C:/repo",
    priority: 0,
    prompt: "Run task",
    queueItemId: "queue-1",
    sandbox: "read_only",
    status: "ready",
    title: "Queue task",
    updatedAt: "2026-06-15T09:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
