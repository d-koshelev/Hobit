import { describe, expect, it } from "vitest";

import type { AgentQueueTask } from "../../workspace/types";
import {
  selectNextAutonomousTask,
} from "./agentQueueAutonomousRunnerModel";
import {
  proposeSmartQueueRollbackAttemptDecision,
} from "./smartQueueCoordinatorDecision";
import {
  applySmartQueueRollbackProposalToTask,
  canPrepareSmartQueueRollbackProposal,
  parseSmartQueueRollbackProposalPayload,
} from "./smartQueueRollbackProposal";
import {
  buildSmartQueueWorkerFailureIntegration,
  type SmartQueueWorkerFailurePayload,
} from "./smartQueueWorkerReportIntegration";

describe("smartQueueRollbackProposal", () => {
  it("allows rollback proposal preparation only when the coordinator decision includes rollback proposal action", () => {
    const rollbackTask = smartRollbackTask();
    const ordinaryTask = smartFailureTask();
    const rollbackPayload = failurePayloadFromTask(rollbackTask);
    const ordinaryPayload = failurePayloadFromTask(ordinaryTask);

    expect(
      canPrepareSmartQueueRollbackProposal(
        rollbackPayload?.coordinatorDecision,
      ),
    ).toBe(true);
    expect(
      canPrepareSmartQueueRollbackProposal(
        ordinaryPayload?.coordinatorDecision,
      ),
    ).toBe(false);
    expect(canPrepareSmartQueueRollbackProposal(null)).toBe(false);
  });

  it("creates a structured approval-required destructive proposal with task, attempt, decision, files, and base revision", () => {
    const result = applySmartQueueRollbackProposalToTask({
      createdAt: "2026-06-15T12:00:00.000Z",
      proposalId: "rollback-proposal-1",
      task: smartRollbackTask({
        changedFiles: ["src/workbench/queue.ts", "src/workbench/card.tsx"],
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.proposal).toMatchObject({
      approvalRequired: true,
      baseRevision: "base-rev-1",
      changedFiles: ["src/workbench/queue.ts", "src/workbench/card.tsx"],
      changedFilesCount: 2,
      coordinatorDecisionId:
        "smart-queue-decision:queue-1:smart-attempt:queue-1:run-1:validation_failure",
      destructive: true,
      executableNow: false,
      proposalId: "rollback-proposal-1",
      taskId: "queue-1",
    });
    expect(result.proposal.attemptId).toBe("smart-attempt:queue-1:run-1");
    expect(result.proposal.planText).toContain("No rollback executed");
    expect(result.proposal.planText).toContain("Affected files: 2");
    expect(result.proposal.planText).toContain("Base revision: base-rev-1");

    const payload = parseSmartQueueRollbackProposalPayload(
      result.report.rawReportPreview,
    );

    expect(payload?.proposal.taskId).toBe("queue-1");
    expect(payload?.proposal.attemptId).toBe("smart-attempt:queue-1:run-1");
    expect(payload?.proposal.coordinatorDecisionId).toBe(
      "smart-queue-decision:queue-1:smart-attempt:queue-1:run-1:validation_failure",
    );
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
  });

  it("keeps rollback-required task state blocked for review and out of autonomous pickup", () => {
    const failedTask = smartRollbackTask({
      coordinatorStatus: "rollback_required",
      status: "review_needed",
    });
    const result = applySmartQueueRollbackProposalToTask({
      proposalId: "rollback-proposal-1",
      task: failedTask,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.task.status).toBe("review_needed");
    expect(result.task.coordinatorStatus).toBe("rollback_required");
    expect(result.task.validationStatus).toBe("failed");
    expect(result.task.workerExecutionReports).toHaveLength(2);
    expect(selectNextAutonomousTask([result.task], new Set()).task).toBeNull();
  });

  it("does not prepare proposals for legacy tasks or non-rollback Smart Queue decisions", () => {
    expect(
      applySmartQueueRollbackProposalToTask({ task: queueTask() }),
    ).toMatchObject({
      message: "Cannot prepare rollback proposal",
      ok: false,
    });
    expect(
      applySmartQueueRollbackProposalToTask({ task: smartFailureTask() }),
    ).toMatchObject({
      message: "Cannot prepare rollback proposal",
      ok: false,
      reason:
        "Coordinator decision does not allow rollback proposal preparation.",
    });
  });

  it("keeps raw JSON and internal enum names out of product-facing proposal text", () => {
    const result = applySmartQueueRollbackProposalToTask({
      proposalId: "rollback-proposal-1",
      task: smartRollbackTask({
        evidenceSummary:
          '{"kind":"smart_queue_worker_failure_report","failureKind":"validation_failure"}',
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.proposal.failureSummary).toBeUndefined();
    expect(result.proposal.planText).not.toContain("validation_failure");
    expect(result.proposal.planText).not.toContain(
      "smart_queue_worker_failure_report",
    );
    expect(result.proposal.planText).not.toContain('{"');
  });
});

function smartRollbackTask(
  overrides: Partial<AgentQueueTask> & {
    changedFiles?: readonly string[];
    evidenceSummary?: string;
  } = {},
) {
  const { changedFiles, evidenceSummary, ...taskOverrides } = overrides;
  const baseTask = smartFailureTask({
    changedFiles,
    evidenceSummary,
    ...taskOverrides,
  });
  const payload = failurePayloadFromTask(baseTask);

  if (!payload) {
    throw new Error("Expected Smart Queue failure payload.");
  }

  const coordinatorDecision = proposeSmartQueueRollbackAttemptDecision({
    maxRetries: 1,
    report: payload.workerReport,
    retryCount: 1,
  });
  const nextPayload = {
    ...payload,
    attempt: {
      ...payload.attempt,
      baseRevision: "base-rev-1",
      changedFiles: changedFiles ?? ["src/workbench/queue.ts"],
    },
    coordinatorDecision,
    queueStatus: coordinatorDecision.productLabel,
  };

  return {
    ...baseTask,
    coordinatorStatus:
      taskOverrides.coordinatorStatus ?? baseTask.coordinatorStatus,
    workerExecutionReports: [
      {
        ...baseTask.workerExecutionReports?.[0],
        changedFiles: [...(changedFiles ?? ["src/workbench/queue.ts"])],
        rawReportPreview: JSON.stringify(nextPayload),
        summary: coordinatorDecision.productLabel,
      },
    ],
  } as AgentQueueTask;
}

function smartFailureTask(
  overrides: Partial<AgentQueueTask> & {
    changedFiles?: readonly string[];
    evidenceSummary?: string;
  } = {},
) {
  const { changedFiles, evidenceSummary, ...taskOverrides } = overrides;
  const baseTask = queueTask({
    assignedExecutorWidgetId: "executor-1",
    coordinatorStatus: "awaiting_coordinator_review",
    executionPolicy: "auto",
    prompt: "Run this",
    queueItemId: "queue-1",
    status: "review_needed",
    validationStatus: "needs_review",
    ...taskOverrides,
  });
  const integration = buildSmartQueueWorkerFailureIntegration({
    changedFiles: changedFiles ?? ["src/workbench/queue.ts"],
    createdAt: "2026-06-15T10:00:00.000Z",
    evidenceSummary: evidenceSummary ?? "Validation command failed.",
    failureKind: "validation_failure",
    maxRetries: 1,
    reason: "Validation failed.",
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

function failurePayloadFromTask(task: AgentQueueTask) {
  const report = task.workerExecutionReports?.[0];

  if (!report?.rawReportPreview) {
    return null;
  }

  return JSON.parse(report.rawReportPreview) as SmartQueueWorkerFailurePayload;
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
