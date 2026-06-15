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
  parseSmartQueueAssistanceRequestPayload,
} from "./smartQueueAssistanceRequest";
import {
  buildSmartQueueWorkerFailureIntegration,
} from "./smartQueueWorkerReportIntegration";

describe("useAgentQueueController Smart Queue assistance", () => {
  it("records an assistance request without starting Workspace Agent or worker work", async () => {
    const failedTask = smartFailureTask();
    const harness = createQueueHarness([failedTask]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    let request = null as Awaited<
      ReturnType<typeof hook.result.current.smartQueueAssistance.onAskWorkspaceAgent>
    >;

    await act(async () => {
      request =
        await hook.result.current.smartQueueAssistance.onAskWorkspaceAgent();
      await flushHookEffects();
    });

    expect(request?.taskId).toBe("queue-1");
    expect(request?.attemptId).toBe("smart-attempt:queue-1:run-1");
    expect(request?.coordinatorDecisionId).toBe(
      "smart-queue-decision:queue-1:smart-attempt:queue-1:run-1:missing_context",
    );
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.handoffs).toHaveLength(0);
    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.updateRequests[0]?.queueItemId).toBe("queue-1");
    expect(harness.updateRequests[0]?.status).toBe("review_needed");
    expect(harness.updateRequests[0]?.validationStatus).toBe("needs_review");
    expect(harness.updateRequests[0]?.workerExecutionReports).toHaveLength(2);
    expect(hook.result.current.smartQueueAssistance.message).toBe(
      "Assistance request prepared",
    );
    expect(hook.result.current.smartQueueAssistance.error).toBeNull();
    expect(hook.result.current.selectedTask?.status).toBe("review_needed");
    expect(hook.result.current.selectedTask?.coordinatorStatus).toBe("blocked");

    const assistanceReport =
      hook.result.current.selectedTask?.workerExecutionReports?.[1] ?? null;
    const payload = parseSmartQueueAssistanceRequestPayload(
      assistanceReport?.rawReportPreview,
    );

    expect(payload?.request.taskId).toBe("queue-1");
    expect(payload?.request.attemptId).toBe("smart-attempt:queue-1:run-1");
    expect(payload?.sideEffects.wouldCallWorkspaceAgent).toBe(false);
    expect(payload?.sideEffects.wouldExecuteRetry).toBe(false);
    expect(payload?.sideEffects.wouldExecuteRollback).toBe(false);
    expect(payload?.sideEffects.wouldLaunchTerminal).toBe(false);
    expect(payload?.sideEffects.wouldMutateGit).toBe(false);
    expect(payload?.sideEffects.wouldStartWorker).toBe(false);

    hook.unmount();
  });

  it("leaves legacy tasks unchanged when no Smart Queue decision payload exists", async () => {
    const legacyTask = queueTask({
      prompt: "Run this",
      queueItemId: "queue-1",
      status: "review_needed",
      workerExecutionReports: [],
    });
    const harness = createQueueHarness([legacyTask]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    await act(async () => {
      await hook.result.current.smartQueueAssistance.onAskWorkspaceAgent();
      await flushHookEffects();
    });

    expect(harness.updateRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.handoffs).toHaveLength(0);
    expect(hook.result.current.smartQueueAssistance.error).toBe(
      "Smart Queue decision payload is unavailable.",
    );
    expect(hook.result.current.selectedTask?.status).toBe("review_needed");

    hook.unmount();
  });
});

function smartFailureTask(overrides: Partial<AgentQueueTask> = {}) {
  const baseTask = queueTask({
    assignedExecutorWidgetId: "executor-1",
    executionPolicy: "auto",
    prompt: "Run this",
    queueItemId: "queue-1",
    status: "review_needed",
    validationStatus: "needs_review",
    ...overrides,
  });
  const integration = buildSmartQueueWorkerFailureIntegration({
    createdAt: "2026-06-15T10:00:00.000Z",
    evidenceSummary: "The worker needs visible task context.",
    failureKind: "missing_context",
    maxRetries: 1,
    reason: "Context needed.",
    retryCount: 0,
    runId: "run-1",
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
