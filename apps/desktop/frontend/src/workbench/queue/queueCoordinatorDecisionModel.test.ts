import { describe, expect, it } from "vitest";

import type { WorkerStuckReport } from "../../workspace/types";
import {
  decideQueueCoordinatorAction,
  describeQueueCoordinatorDecision,
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
