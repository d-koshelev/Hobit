import { describe, expect, it } from "vitest";

import type { QueueAssistanceRequest, QueueAssistanceResponse, WorkerStuckReport } from "../../workspace/types";
import {
  decideQueueCoordinatorAction,
  describeQueueCoordinatorDecision,
  proposeCoordinatorDecisionFromAssistanceResponse,
  proposeQueueCoordinatorRetryDecision,
} from "./queueCoordinatorDecisionModel";

const baseReport: WorkerStuckReport = {
  createdAt: "2026-06-14T00:00:00.000Z",
  kind: "validation_failure",
  maxRetryCount: 3,
  queueId: "workspace:workspace-1:agent-queue",
  reportId: "report-1",
  retryCount: 0,
  summary: "Worker could not finish.",
  taskId: "task-1",
  workerId: "worker-1",
  workspaceId: "workspace-1",
};

describe("Queue Coordinator decision model", () => {
  it("creates Needs decision for validation failure", () => {
    const decision = decideQueueCoordinatorAction({
      createdAt: "2026-06-14T00:01:00.000Z",
      decisionId: "decision-1",
      report: {
        ...baseReport,
        kind: "validation_failure",
        validationSummary: "npm test failed.",
      },
    });

    expect(decision).toMatchObject({
      action: "request_human_input",
      blockerKind: "validation_requires_decision",
      reason: "Validation failed. Queue Coordinator needs an explicit decision before continuing.",
      requiresApproval: true,
      status: "needs_decision",
    });
  });

  it("creates Needs decision proposal for worker validation failure", () => {
    const decision = decideQueueCoordinatorAction({
      createdAt: "2026-06-14T00:01:00.000Z",
      decisionId: "decision-validation-proposal",
      report: {
        ...baseReport,
        attemptId: "attempt-validation-1",
        evidence: ["npm run test failed with exit code 1."],
        kind: "validation_failure",
        reportId: "report-validation-1",
        validationSummary: "Queue validation command failed.",
      },
    });

    expect(decision).toMatchObject({
      action: "request_human_input",
      blockerKind: "validation_requires_decision",
      sourceAttemptId: "attempt-validation-1",
      sourceReportId: "report-validation-1",
      status: "needs_decision",
    });
  });

  it("creates expected exec failure decision and environment blocker", () => {
    const needsDecision = decideQueueCoordinatorAction({
      createdAt: "2026-06-14T00:01:00.000Z",
      decisionId: "decision-exec-1",
      report: {
        ...baseReport,
        kind: "exec_failure",
        summary: "Worker process exited non-zero.",
      },
    });
    const blocked = decideQueueCoordinatorAction({
      createdAt: "2026-06-14T00:02:00.000Z",
      decisionId: "decision-exec-2",
      report: {
        ...baseReport,
        flags: { environmentOrToolIssue: true },
        kind: "exec_failure",
        summary: "Codex executable is unavailable.",
      },
    });

    expect(needsDecision).toMatchObject({
      action: "request_human_input",
      status: "needs_decision",
    });
    expect(blocked).toMatchObject({
      action: "move_blocked",
      blockerKind: "worker_unavailable",
      status: "blocked",
    });
  });

  it("creates downstream blocked decision for dependency failure", () => {
    const decision = decideQueueCoordinatorAction({
      createdAt: "2026-06-14T00:01:00.000Z",
      decisionId: "decision-2",
      report: {
        ...baseReport,
        dependencyTaskIds: ["task-upstream"],
        kind: "dependency_failed",
        summary: "Upstream task failed.",
        taskId: "task-downstream",
      },
    });

    expect(decision).toMatchObject({
      action: "move_blocked",
      blockerKind: "dependency_failed",
      reason: "Blocked: upstream dependency failed.",
      requiresApproval: false,
      status: "blocked",
      taskId: "task-downstream",
    });
  });

  it("creates downstream dependency_blocked blocker", () => {
    const decision = decideQueueCoordinatorAction({
      createdAt: "2026-06-14T00:01:00.000Z",
      decisionId: "decision-dependency-blocked",
      report: {
        ...baseReport,
        dependencyTaskIds: ["task-upstream"],
        kind: "dependency_blocked",
        summary: "Upstream task is blocked.",
        taskId: "task-downstream",
      },
    });

    expect(decision).toMatchObject({
      action: "move_blocked",
      blockerKind: "dependency_blocked",
      reason: "Blocked: upstream dependency is blocked.",
      status: "blocked",
      taskId: "task-downstream",
    });
  });

  it("blocks missing config and missing prompt with short reasons", () => {
    expect(
      decideQueueCoordinatorAction({
        createdAt: "2026-06-14T00:01:00.000Z",
        decisionId: "decision-missing-config",
        report: { ...baseReport, kind: "missing_config" },
      }),
    ).toMatchObject({
      blockerKind: "missing_config",
      reason: "Blocked: missing run configuration.",
      status: "blocked",
    });
    expect(
      decideQueueCoordinatorAction({
        createdAt: "2026-06-14T00:02:00.000Z",
        decisionId: "decision-missing-prompt",
        report: { ...baseReport, kind: "missing_prompt" },
      }),
    ).toMatchObject({
      blockerKind: "missing_prompt",
      reason: "Blocked: missing task prompt.",
      status: "blocked",
    });
  });

  it("requests Workspace Agent or human assistance for missing context", () => {
    const workspaceAgentDecision = decideQueueCoordinatorAction({
      assistanceRequestId: "assist-1",
      createdAt: "2026-06-14T00:01:00.000Z",
      decisionId: "decision-3",
      report: {
        ...baseReport,
        flags: { needsWorkspaceAgentAssistance: true },
        kind: "missing_context",
        summary: "Worker needs a bounded product decision.",
      },
    });
    const humanDecision = decideQueueCoordinatorAction({
      createdAt: "2026-06-14T00:02:00.000Z",
      decisionId: "decision-4",
      report: {
        ...baseReport,
        kind: "missing_context",
        summary: "Worker needs an operator-provided setting.",
      },
    });

    expect(workspaceAgentDecision).toMatchObject({
      action: "request_workspace_agent_assistance",
      assistanceRequest: {
        allowedResponseKinds: [
          "explanation",
          "options",
          "draft_prompt",
          "decision_recommendation",
        ],
        requestId: "assist-1",
        requestedBy: "queue_coordinator",
        target: "workspace_agent",
      },
      status: "assistance_requested",
    });
    expect(humanDecision).toMatchObject({
      action: "request_human_input",
      blockerKind: "requires_human_input",
      status: "needs_decision",
    });
  });

  it("creates assistance request with task, attempt, reason, evidence, and available actions", () => {
    const decision = decideQueueCoordinatorAction({
      assistanceRequestId: "assist-validation",
      createdAt: "2026-06-14T00:01:00.000Z",
      decisionId: "decision-assistance",
      report: {
        ...baseReport,
        attemptId: "attempt-1",
        evidence: ["stderr: test failed", "summary: validation failed"],
        flags: { needsWorkspaceAgentAssistance: true },
        kind: "validation_failure",
        validationSummary: "npm run test failed.",
      },
    });

    expect(decision.assistanceRequest).toMatchObject({
      attemptId: "attempt-1",
      availableActions: expect.arrayContaining([
        "retry_same",
        "retry_with_modified_prompt",
        "move_blocked",
        "mark_failed",
        "request_human_input",
        "rollback_attempt",
        "split_followup_task",
        "accept_dependency_anyway",
      ]),
      reason: "validation_requires_decision",
      taskId: "task-1",
      visibleContext: {
        evidence: ["stderr: test failed", "summary: validation failed"],
        validationSummary: "npm run test failed.",
      },
    });
  });

  it("represents retry decision without erasing previous attempt or report", () => {
    const decision = proposeQueueCoordinatorRetryDecision({
      createdAt: "2026-06-14T00:01:00.000Z",
      decisionId: "decision-retry",
      modifiedPrompt: "Retry with a narrower validation command.",
      report: {
        ...baseReport,
        attemptId: "attempt-original",
        kind: "exec_failure",
        reportId: "report-original",
      },
    });

    expect(decision).toMatchObject({
      action: "retry_with_modified_prompt",
      proposedPrompt: "Retry with a narrower validation command.",
      requiresApproval: true,
      sourceAttemptId: "attempt-original",
      sourceReportId: "report-original",
      status: "needs_decision",
    });
  });

  it("converts Workspace Agent response into coordinator decision proposal only", () => {
    const request: QueueAssistanceRequest = {
      allowedResponseKinds: ["decision_recommendation", "draft_prompt"],
      attemptId: "attempt-assisted",
      availableActions: ["retry_same", "retry_with_modified_prompt", "move_blocked"],
      createdAt: "2026-06-14T00:01:00.000Z",
      question: "Should the task retry?",
      queueId: baseReport.queueId,
      reason: "validation_requires_decision",
      requestId: "assist-response-test",
      requestedBy: "queue_coordinator",
      target: "workspace_agent",
      taskId: "task-1",
      visibleContext: {
        evidence: ["validation failed"],
        validationSummary: "npm run test failed.",
      },
      workspaceId: "workspace-1",
    };
    const response: QueueAssistanceResponse = {
      createdAt: "2026-06-14T00:02:00.000Z",
      proposedPrompt: "Retry after fixing the test command.",
      recommendedDecision: "retry_task",
      requiresCoordinatorDecision: true,
      responder: "workspace_agent",
      responseId: "response-1",
      responseKind: "decision_recommendation",
      requestId: request.requestId,
      summary: "Retry is reasonable after narrowing the validation evidence.",
      warnings: ["No Queue lifecycle mutation was applied."],
    };

    const proposal = proposeCoordinatorDecisionFromAssistanceResponse({
      createdAt: "2026-06-14T00:03:00.000Z",
      decisionId: "decision-from-assistance",
      request,
      response,
    });

    expect(proposal).toMatchObject({
      action: "retry_same",
      assistanceRequest: request,
      proposedPrompt: "Retry after fixing the test command.",
      requiresApproval: true,
      status: "needs_decision",
    });
    expect(proposal.reason).toContain("Queue Coordinator decision is still required");
  });

  it("blocks dirty worktree with product-facing reason", () => {
    const decision = decideQueueCoordinatorAction({
      createdAt: "2026-06-14T00:01:00.000Z",
      decisionId: "decision-5",
      report: {
        ...baseReport,
        kind: "dirty_worktree",
        summary: "Git status is not clean.",
      },
    });

    expect(decision).toMatchObject({
      action: "move_blocked",
      blockerKind: "dirty_worktree",
      reason: "Blocked: dirty workspace. Review or clean local changes before continuing.",
      status: "blocked",
    });
  });

  it("uses approval-only action names for destructive decision proposals", () => {
    const rollback = decideQueueCoordinatorAction({
      createdAt: "2026-06-14T00:01:00.000Z",
      decisionId: "decision-rollback",
      report: {
        ...baseReport,
        flags: { hasRollbackRecommendation: true },
        kind: "validation_failure",
      },
    });

    expect(rollback).toMatchObject({
      action: "rollback_attempt",
      requiresApproval: true,
      status: "needs_decision",
    });
  });

  it("respects retry count limits without infinite retry", () => {
    const humanDecision = decideQueueCoordinatorAction({
      createdAt: "2026-06-14T00:01:00.000Z",
      decisionId: "decision-6",
      report: {
        ...baseReport,
        flags: { needsHumanInput: true },
        kind: "exec_failure",
        retryCount: 3,
      },
    });
    const failedDecision = decideQueueCoordinatorAction({
      createdAt: "2026-06-14T00:02:00.000Z",
      decisionId: "decision-7",
      report: {
        ...baseReport,
        kind: "exec_failure",
        retryCount: 3,
      },
    });

    expect(humanDecision).toMatchObject({
      action: "request_human_input",
      status: "needs_decision",
    });
    expect(failedDecision).toMatchObject({
      action: "mark_failed",
      reason: "Retry limit reached. Marking failed prevents an infinite retry loop.",
      status: "failed",
    });
  });

  it("formats decisions as human-readable auditable records", () => {
    const decision = decideQueueCoordinatorAction({
      createdAt: "2026-06-14T00:01:00.000Z",
      decisionId: "decision-8",
      report: {
        ...baseReport,
        kind: "exec_failure",
        flags: { environmentOrToolIssue: true },
      },
    });

    expect(describeQueueCoordinatorDecision(decision)).toBe(
      "Task task-1: blocked via move_blocked. Blocked: exec failure from environment or tool issue. Blocker: worker_unavailable.",
    );
  });
});
