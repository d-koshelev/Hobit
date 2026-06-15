import { describe, expect, it } from "vitest";

import type { AgentQueueTask } from "../../workspace/types";
import {
  selectNextAutonomousTask,
} from "./agentQueueAutonomousRunnerModel";
import {
  applySmartQueueRetrySameActionToTask,
  canApplySmartQueueRetrySame,
  smartQueueAttemptHistoryForTask,
} from "./smartQueueRetrySameAction";
import {
  buildSmartQueueWorkerFailureIntegration,
  latestSmartQueueFailurePayloadForTask,
  parseSmartQueueRetrySamePayload,
} from "./smartQueueWorkerReportIntegration";

describe("smartQueueRetrySameAction", () => {
  it("creates a pending retry attempt and preserves the failed attempt report", () => {
    const failedTask = smartFailureTask({
      failureKind: "timeout",
      maxRetries: 2,
      retryCount: 0,
    });
    const result = applySmartQueueRetrySameActionToTask({
      acceptedAt: "2026-06-15T10:10:00.000Z",
      attemptId: "retry-attempt-2",
      task: failedTask,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.retryAttempt).toMatchObject({
      attemptId: "retry-attempt-2",
      attemptNumber: 2,
      status: "pending",
    });
    expect(result.task).toMatchObject({
      coordinatorStatus: "not_reported",
      status: "ready",
      validationStatus: "not_started",
    });
    expect(result.task.workerExecutionReports).toHaveLength(2);
    expect(result.task.workerExecutionReports?.[0]?.summary).toBe(
      "Retry available",
    );
    expect(result.report.summary).toBe("Retry queued");
    expect(smartQueueAttemptHistoryForTask(result.task).attempts).toHaveLength(2);
    expect(latestSmartQueueFailurePayloadForTask(result.task)).toBeNull();
  });

  it("records retry metadata without runtime, rollback, Git, Terminal, or Workspace Agent side effects", () => {
    const result = applySmartQueueRetrySameActionToTask({
      acceptedAt: "2026-06-15T10:10:00.000Z",
      attemptId: "retry-attempt-2",
      task: smartFailureTask({
        failureKind: "tool_failure",
        maxRetries: 2,
        retryCount: 0,
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const retryPayload = parseSmartQueueRetrySamePayload(
      result.report.rawReportPreview,
    );

    expect(retryPayload?.sideEffects).toEqual({
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldMutateGit: false,
      wouldMutateQueue: true,
      wouldStartWorker: false,
    });
  });

  it("does not retry exhausted, rollback-only, or legacy tasks", () => {
    const exhausted = smartFailureTask({
      failureKind: "timeout",
      maxRetries: 1,
      retryCount: 1,
    });
    const rollbackOnly = smartFailureTask({
      failureKind: "timeout",
      maxRetries: 2,
      retryCount: 0,
    });
    const rollbackPayload = latestSmartQueueFailurePayloadForTask(rollbackOnly);

    expect(
      applySmartQueueRetrySameActionToTask({ task: exhausted }),
    ).toMatchObject({
      message: "Cannot retry task",
      ok: false,
    });

    expect(rollbackPayload).not.toBeNull();
    expect(
      canApplySmartQueueRetrySame({
        ...rollbackPayload!.coordinatorDecision,
        availableActions: ["rollback_attempt_proposal"],
        destructive: true,
      }),
    ).toBe(false);

    expect(
      applySmartQueueRetrySameActionToTask({ task: queueTask() }),
    ).toMatchObject({
      message: "Cannot retry task",
      ok: false,
      task: queueTask(),
    });
  });

  it("keeps Queue Paused and dependency gates in control after retry", () => {
    const retried = applySmartQueueRetrySameActionToTask({
      attemptId: "retry-attempt-2",
      task: smartFailureTask({
        assignedExecutorWidgetId: "executor-1",
        failureKind: "timeout",
        maxRetries: 2,
        retryCount: 0,
      }),
    });

    expect(retried.ok).toBe(true);
    if (!retried.ok) {
      return;
    }

    expect(selectNextAutonomousTask([retried.task], new Set(), "stopped")).toEqual({
      skippedCount: 0,
      task: null,
    });
    expect(
      selectNextAutonomousTask([retried.task], new Set(), "started").task
        ?.queueItemId,
    ).toBe("queue-1");

    const failedDependency = queueTask({
      coordinatorStatus: "failed",
      queueItemId: "upstream",
      status: "failed",
    });
    const dependencyBlockedTask = {
      ...retried.task,
      dependsOn: ["upstream"],
      queueItemId: "queue-1",
    };

    expect(
      selectNextAutonomousTask(
        [failedDependency, dependencyBlockedTask],
        new Set(),
        "started",
      ),
    ).toEqual({
      skippedCount: 1,
      task: null,
    });
  });
});

function smartFailureTask({
  failureKind,
  maxRetries,
  retryCount,
  ...taskOverrides
}: Partial<AgentQueueTask> & {
  failureKind: Parameters<typeof buildSmartQueueWorkerFailureIntegration>[0]["failureKind"];
  maxRetries: number;
  retryCount: number;
}) {
  const baseTask = queueTask({
    coordinatorStatus: "awaiting_coordinator_review",
    status: "review_needed",
    validationStatus: "needs_review",
    ...taskOverrides,
  });
  const integration = buildSmartQueueWorkerFailureIntegration({
    createdAt: "2026-06-15T10:00:00.000Z",
    evidenceSummary: "Worker attempt failed.",
    failureKind,
    maxRetries,
    reason: "Worker attempt failed.",
    retryCount,
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

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    approvalPolicy: "never",
    assignedExecutorWidgetId: "executor-1",
    assignedWorkerId: null,
    codexExecutable: "codex",
    coordinatorStatus: "not_reported",
    createdAt: "2026-06-15T09:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "auto",
    executionWorkspace: "/repo",
    priority: 0,
    prompt: "Run task",
    queueItemId: "queue-1",
    sandbox: "read_only",
    status: "ready",
    title: "Queue task",
    updatedAt: "2026-06-15T09:00:00.000Z",
    validationStatus: "not_started",
    workerExecutionReports: [],
    workspaceId: "workspace-1",
    ...overrides,
  };
}
