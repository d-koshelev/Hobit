import { describe, expect, it } from "vitest";

import type { AgentQueueTask } from "../../workspace/types";
import {
  selectNextAutonomousTask,
} from "./agentQueueAutonomousRunnerModel";
import {
  buildSmartQueueWorkerFailureIntegration,
  latestSmartQueueFailurePayloadForTask,
} from "./smartQueueWorkerReportIntegration";
import {
  applySmartQueueAssistanceRequestToTask,
  canApplySmartQueueWorkspaceAgentAssistance,
  parseSmartQueueAssistanceRequestPayload,
} from "./smartQueueAssistanceRequest";

describe("smartQueueAssistanceRequest", () => {
  it("allows Workspace Agent assistance only when the coordinator decision includes that action", () => {
    const failurePayload = latestSmartQueueFailurePayloadForTask(
      smartFailureTask("missing_context"),
    );

    expect(failurePayload).not.toBeNull();
    expect(
      canApplySmartQueueWorkspaceAgentAssistance(
        failurePayload?.coordinatorDecision,
      ),
    ).toBe(true);
    expect(
      canApplySmartQueueWorkspaceAgentAssistance({
        ...failurePayload!.coordinatorDecision,
        availableActions: ["rollback_attempt_proposal"],
        destructive: true,
      }),
    ).toBe(false);
    expect(
      canApplySmartQueueWorkspaceAgentAssistance({
        ...failurePayload!.coordinatorDecision,
        availableActions: [
          "rollback_attempt_proposal",
          "request_workspace_agent_assistance",
        ],
        destructive: true,
      }),
    ).toBe(true);
    expect(canApplySmartQueueWorkspaceAgentAssistance(null)).toBe(false);
  });

  it("creates a structured assistance request with task, attempt, and decision ids", () => {
    const failedTask = smartFailureTask("missing_context", {
      dependsOn: ["upstream-task"],
      prompt: "Current runnable prompt",
      title: "Repair Queue import",
    });
    const result = applySmartQueueAssistanceRequestToTask({
      createdAt: "2026-06-15T12:00:00.000Z",
      requestId: "assistance-1",
      task: failedTask,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const payload = parseSmartQueueAssistanceRequestPayload(
      result.report.rawReportPreview,
    );

    expect(result.request).toMatchObject({
      requestId: "assistance-1",
      taskId: "queue-1",
      taskTitle: "Repair Queue import",
      currentRunnablePrompt: "Current runnable prompt",
      failureSummary: "Visible context is missing.",
      dependencyContext: "Depends on upstream-task",
    });
    expect(result.request.attemptId).toBe("smart-attempt:queue-1:run-1");
    expect(result.request.coordinatorDecisionId).toBe(
      "smart-queue-decision:queue-1:smart-attempt:queue-1:run-1:missing_context",
    );
    expect(payload?.request.taskId).toBe("queue-1");
    expect(payload?.request.attemptId).toBe("smart-attempt:queue-1:run-1");
    expect(payload?.request.coordinatorDecisionId).toBe(
      "smart-queue-decision:queue-1:smart-attempt:queue-1:run-1:missing_context",
    );
  });

  it("builds a product-facing handoff prompt without raw JSON or enum names", () => {
    const failedTask = smartFailureTask("missing_context", {
      evidenceSummary: "Validation command failed.",
      prompt: "Run typecheck and fix the failure.",
      title: "Fix typecheck",
    });
    const result = applySmartQueueAssistanceRequestToTask({
      requestId: "assistance-1",
      task: failedTask,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.request.recommendedPrompt).toContain("Fix typecheck");
    expect(result.request.recommendedPrompt).toContain(
      "Validation command failed.",
    );
    expect(result.request.recommendedPrompt).toContain(
      "Inspect the likely cause",
    );
    expect(result.request.recommendedPrompt).toContain("modified prompt");
    expect(result.request.recommendedPrompt).not.toContain("validation_failure");
    expect(result.request.recommendedPrompt).not.toContain(
      "smart_queue_worker_failure_report",
    );
    expect(result.request.recommendedPrompt).not.toContain('{"');
  });

  it("keeps the task blocked for coordinator review and out of autonomous pickup", () => {
    const failedTask = smartFailureTask("missing_context", {
      assignedExecutorWidgetId: "executor-1",
      coordinatorStatus: "blocked",
      status: "review_needed",
    });
    const result = applySmartQueueAssistanceRequestToTask({
      requestId: "assistance-1",
      task: failedTask,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.task.status).toBe("review_needed");
    expect(result.task.coordinatorStatus).toBe("blocked");
    expect(result.task.workerExecutionReports).toHaveLength(2);
    expect(selectNextAutonomousTask([result.task], new Set()).task).toBeNull();

    const payload = parseSmartQueueAssistanceRequestPayload(
      result.report.rawReportPreview,
    );

    expect(payload?.sideEffects).toEqual({
      wouldCallWorkspaceAgent: false,
      wouldExecuteRetry: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldMutateGit: false,
      wouldMutateQueue: true,
      wouldStartWorker: false,
    });
  });

  it("does not create assistance requests for legacy tasks", () => {
    expect(
      applySmartQueueAssistanceRequestToTask({ task: queueTask() }),
    ).toMatchObject({
      message: "Cannot prepare assistance request",
      ok: false,
    });
  });
});

function smartFailureTask(
  failureKind: Parameters<typeof buildSmartQueueWorkerFailureIntegration>[0]["failureKind"],
  overrides: Partial<AgentQueueTask> & { evidenceSummary?: string } = {},
) {
  const { evidenceSummary, ...taskOverrides } = overrides;
  const baseTask = queueTask({
    coordinatorStatus: "awaiting_coordinator_review",
    status: "review_needed",
    validationStatus: "needs_review",
    ...taskOverrides,
  });
  const integration = buildSmartQueueWorkerFailureIntegration({
    changedFiles: ["src/workbench/queue.ts"],
    createdAt: "2026-06-15T10:00:00.000Z",
    evidenceSummary:
      evidenceSummary ??
      (failureKind === "validation_failure"
        ? "Validation command failed."
        : "Visible context is missing."),
    failureKind,
    maxRetries: 1,
    reason:
      failureKind === "validation_failure"
        ? "Validation failed."
        : "Context needed.",
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
