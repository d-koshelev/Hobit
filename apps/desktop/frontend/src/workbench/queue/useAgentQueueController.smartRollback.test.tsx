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
  proposeSmartQueueRollbackAttemptDecision,
} from "./smartQueueCoordinatorDecision";
import {
  parseSmartQueueRollbackProposalPayload,
} from "./smartQueueRollbackProposal";
import {
  buildSmartQueueWorkerFailureIntegration,
} from "./smartQueueWorkerReportIntegration";

describe("useAgentQueueController Smart Queue rollback proposal", () => {
  it("records a rollback proposal without starting rollback, retry, worker, Workspace Agent, Git, file, or Terminal work", async () => {
    const failedTask = smartRollbackTask({
      assignedExecutorWidgetId: "executor-1",
      coordinatorStatus: "rollback_required",
      status: "review_needed",
    });
    const harness = createQueueHarness([failedTask]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    let proposal = null as Awaited<
      ReturnType<typeof hook.result.current.smartQueueRollback.onPrepareProposal>
    >;

    await act(async () => {
      proposal =
        await hook.result.current.smartQueueRollback.onPrepareProposal();
      await flushHookEffects();
    });

    expect(proposal?.taskId).toBe("queue-1");
    expect(proposal?.attemptId).toBe("smart-attempt:queue-1:run-1");
    expect(proposal?.coordinatorDecisionId).toBe(
      "smart-queue-decision:queue-1:smart-attempt:queue-1:run-1:validation_failure",
    );
    expect(proposal?.approvalRequired).toBe(true);
    expect(proposal?.destructive).toBe(true);
    expect(proposal?.executableNow).toBe(false);
    expect(proposal?.changedFilesCount).toBe(1);
    expect(proposal?.changedFiles).toEqual(["src/workbench/queue.ts"]);
    expect(proposal?.baseRevision).toBe("base-rev-1");
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.handoffs).toHaveLength(0);
    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.updateRequests[0]?.queueItemId).toBe("queue-1");
    expect(harness.updateRequests[0]?.status).toBe("review_needed");
    expect(harness.updateRequests[0]?.validationStatus).toBe("failed");
    expect(harness.updateRequests[0]?.workerExecutionReports).toHaveLength(2);
    expect(hook.result.current.smartQueueRollback.message).toBe(
      "Rollback proposal prepared",
    );
    expect(hook.result.current.smartQueueRollback.error).toBeNull();
    expect(hook.result.current.selectedTask?.status).toBe("review_needed");
    expect(hook.result.current.selectedTask?.coordinatorStatus).toBe(
      "rollback_required",
    );

    const rollbackReport =
      hook.result.current.selectedTask?.workerExecutionReports?.[1] ?? null;
    const payload = parseSmartQueueRollbackProposalPayload(
      rollbackReport?.rawReportPreview,
    );

    expect(payload?.proposal.taskId).toBe("queue-1");
    expect(payload?.sideEffects).toEqual({
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldMutateFiles: false,
      wouldMutateGit: false,
      wouldMutateQueue: true,
      wouldStartWorker: false,
    });

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
      await hook.result.current.smartQueueRollback.onPrepareProposal();
      await flushHookEffects();
    });

    expect(harness.updateRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.handoffs).toHaveLength(0);
    expect(hook.result.current.smartQueueRollback.error).toBe(
      "Smart Queue decision payload is unavailable.",
    );
    expect(hook.result.current.selectedTask?.status).toBe("review_needed");

    hook.unmount();
  });
});

function smartRollbackTask(overrides: Partial<AgentQueueTask> = {}) {
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
    changedFiles: ["src/workbench/queue.ts"],
    createdAt: "2026-06-15T10:00:00.000Z",
    evidenceSummary: "Validation command failed.",
    failureKind: "validation_failure",
    maxRetries: 1,
    reason: "Validation failed.",
    retryCount: 0,
    runId: "run-1",
    task: baseTask,
  });
  const coordinatorDecision = proposeSmartQueueRollbackAttemptDecision({
    maxRetries: 1,
    report: integration.workerReport,
    retryCount: 1,
  });
  const payload = {
    attempt: {
      ...integration.attempt,
      baseRevision: "base-rev-1",
      changedFiles: ["src/workbench/queue.ts"],
    },
    coordinatorDecision,
    kind: "smart_queue_worker_failure_report",
    queueDetail: integration.queueDetail,
    queueStatus: coordinatorDecision.productLabel,
    sideEffects: integration.sideEffects,
    version: 1,
    workerReport: integration.workerReport,
  };

  return {
    ...baseTask,
    coordinatorStatus: overrides.coordinatorStatus ?? "rollback_required",
    status: integration.taskPatch.status,
    validationStatus: integration.taskPatch.validationStatus,
    workerExecutionReports: [
      {
        ...integration.taskPatch.workerExecutionReport,
        changedFiles: ["src/workbench/queue.ts"],
        rawReportPreview: JSON.stringify(payload),
        summary: coordinatorDecision.productLabel,
      },
    ],
  };
}
