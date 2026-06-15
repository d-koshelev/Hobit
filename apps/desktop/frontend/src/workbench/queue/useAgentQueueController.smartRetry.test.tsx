import { act } from "react";

import type { AgentQueueTask } from "../../workspace/types";
import {
  createQueueHarness,
  flushControllerLoad,
  flushHookEffects,
  queueTask,
  renderQueueController,
} from "./useAgentQueueControllerTestHelpers";
import {
  buildSmartQueueWorkerFailureIntegration,
  parseSmartQueueRetrySamePayload,
} from "./smartQueueWorkerReportIntegration";

describe("useAgentQueueController Smart Queue Retry same", () => {
  it("records a new attempt and returns the task to Ready without starting work", async () => {
    const failedTask = smartFailureTaskForRetry();
    const harness = createQueueHarness([failedTask]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    await act(async () => {
      hook.result.current.smartQueueRetry.onRetrySame();
      await flushHookEffects();
    });

    expect(harness.startRequests).toHaveLength(0);
    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.updateRequests[0]?.queueItemId).toBe("queue-1");
    expect(harness.updateRequests[0]?.status).toBe("ready");
    expect(harness.updateRequests[0]?.validationStatus).toBe("not_started");
    expect(harness.updateRequests[0]?.workerExecutionReports).toHaveLength(2);
    expect(hook.result.current.smartQueueRetry.message).toBe("Retry queued");
    expect(hook.result.current.smartQueueRetry.error).toBeNull();
    expect(hook.result.current.selectedTask?.coordinatorStatus).toBe(
      "not_reported",
    );
    expect(hook.result.current.selectedTask?.status).toBe("ready");
    expect(hook.result.current.selectedTask?.validationStatus).toBe(
      "not_started",
    );
    expect(hook.result.current.selectedTask?.workerExecutionReports).toHaveLength(2);

    const retryReport =
      hook.result.current.selectedTask?.workerExecutionReports?.[1] ?? null;
    const retryPayload = parseSmartQueueRetrySamePayload(
      retryReport?.rawReportPreview,
    );

    expect(retryPayload?.retryAttempt.attemptNumber).toBe(2);
    expect(retryPayload?.retryAttempt.status).toBe("pending");
    expect(retryPayload?.sideEffects.wouldCallWorkspaceAgent).toBe(false);
    expect(retryPayload?.sideEffects.wouldExecuteRetry).toBe(false);
    expect(retryPayload?.sideEffects.wouldExecuteRollback).toBe(false);
    expect(retryPayload?.sideEffects.wouldLaunchTerminal).toBe(false);
    expect(retryPayload?.sideEffects.wouldMutateGit).toBe(false);
    expect(retryPayload?.sideEffects.wouldStartWorker).toBe(false);

    hook.unmount();
  });

  it("leaves legacy tasks unchanged when no Smart Queue decision payload exists", async () => {
    const legacyTask = queueTask({
      prompt: "Run this",
      queueItemId: "queue-1",
      status: "review_needed",
      workerExecutionReports: [legacyReport()],
    });
    const harness = createQueueHarness([legacyTask]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    await act(async () => {
      hook.result.current.smartQueueRetry.onRetrySame();
      await flushHookEffects();
    });

    expect(harness.updateRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(0);
    expect(hook.result.current.smartQueueRetry.error).toBe("Cannot retry task");
    expect(hook.result.current.selectedTask?.status).toBe("review_needed");
    expect(hook.result.current.selectedTask?.workerExecutionReports).toEqual(
      legacyTask.workerExecutionReports,
    );

    hook.unmount();
  });
});

function smartFailureTaskForRetry() {
  const baseTask = queueTask({
    assignedExecutorWidgetId: "executor-1",
    executionPolicy: "auto",
    prompt: "Run this",
    queueItemId: "queue-1",
    status: "review_needed",
    validationStatus: "needs_review",
  });
  const integration = buildSmartQueueWorkerFailureIntegration({
    createdAt: "2026-06-15T10:00:00.000Z",
    evidenceSummary: "The worker timed out.",
    failureKind: "timeout",
    maxRetries: 2,
    reason: "Run timed out.",
    retryCount: 0,
    runId: "run-timeout",
    task: baseTask,
  });

  return {
    ...baseTask,
    coordinatorStatus: integration.taskPatch.coordinatorStatus,
    status: integration.taskPatch.status,
    validationStatus: integration.taskPatch.validationStatus,
    workerExecutionReports: [integration.taskPatch.workerExecutionReport],
  };
}

function legacyReport(): NonNullable<AgentQueueTask["workerExecutionReports"]>[number] {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: "2026-06-15T10:00:00.000Z",
    errors: [],
    itemId: "queue-1",
    rawReportPreview: "Legacy report.",
    reportId: "legacy-report",
    reportStatus: "failed",
    summary: "Legacy failure",
    validationCommandsSuggested: [],
    warnings: [],
    workerId: "agent-queue",
  };
}
