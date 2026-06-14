import { describe, expect, it } from "vitest";

import type {
  QueueAssistanceRequest,
  QueueAssistanceResponse,
  QueueCoordinatorDecisionKind,
  SmartQueueBlockerKind,
  SmartQueueDependencyGate,
  SmartQueueRole,
  SmartQueueState,
  SmartQueueTaskHumanStatus,
} from "../../workspace/types";

describe("Smart Queue workflow exported types", () => {
  it("accepts the planned Smart Queue literal vocabulary", () => {
    const states = [
      "paused",
      "active",
      "draining",
      "stopped",
    ] satisfies SmartQueueState[];
    const statuses = [
      "ready",
      "waiting_dependency",
      "running",
      "review",
      "needs_decision",
      "blocked",
      "failed",
      "closed",
      "cancelled",
    ] satisfies SmartQueueTaskHumanStatus[];
    const gates = [
      "none",
      "waiting",
      "satisfied",
      "failed",
      "blocked",
    ] satisfies SmartQueueDependencyGate[];
    const blockers = [
      "dependency_failed",
      "dependency_blocked",
      "missing_config",
      "validation_requires_decision",
      "worker_unavailable",
      "dirty_worktree",
      "missing_prompt",
      "requires_human_input",
    ] satisfies SmartQueueBlockerKind[];
    const roles = [
      "queue_importer",
      "queue_coordinator",
      "queue_scheduler",
      "worker_agent",
      "workspace_agent_assistance",
      "human_operator",
    ] satisfies SmartQueueRole[];
    const decisions = [
      "start_task",
      "retry_task",
      "request_review",
      "request_validation",
      "request_assistance",
      "block_task",
      "fail_task",
      "close_task",
      "cancel_task",
      "pause_queue",
      "drain_queue",
      "stop_queue",
    ] satisfies QueueCoordinatorDecisionKind[];

    expect({ blockers, decisions, gates, roles, states, statuses }).toMatchObject({
      blockers: expect.arrayContaining(["dependency_failed", "missing_prompt"]),
      decisions: expect.arrayContaining(["retry_task", "drain_queue"]),
      gates: expect.arrayContaining(["waiting", "satisfied"]),
      roles: expect.arrayContaining([
        "queue_coordinator",
        "workspace_agent_assistance",
      ]),
      states: expect.arrayContaining(["active", "draining"]),
      statuses: expect.arrayContaining(["waiting_dependency", "blocked"]),
    });
  });

  it("models assistance as request/response requiring coordinator decision", () => {
    const request = {
      allowedResponseKinds: ["options", "decision_recommendation"],
      availableActions: ["move_blocked", "request_human_input"],
      createdAt: "2026-06-14T00:00:00.000Z",
      question: "Should this task retry or block?",
      queueId: "workspace-queue",
      reason: "dependency_failed",
      requestId: "assist-001",
      requestedBy: "queue_coordinator",
      target: "workspace_agent",
      taskId: "queue-002",
      visibleContext: {
        blockerSummary: "Upstream task failed.",
        dependencyTaskIds: ["queue-001"],
        taskTitle: "002 Dependent task",
      },
      workspaceId: "workspace-001",
    } satisfies QueueAssistanceRequest;
    const response = {
      createdAt: "2026-06-14T00:01:00.000Z",
      recommendedDecision: "block_task",
      requiresCoordinatorDecision: true,
      responder: "workspace_agent",
      responseId: "assist-response-001",
      responseKind: "decision_recommendation",
      requestId: request.requestId,
      summary: "Block the dependent task until the upstream failure is resolved.",
      warnings: [],
    } satisfies QueueAssistanceResponse;

    expect(response).toMatchObject({
      recommendedDecision: "block_task",
      requiresCoordinatorDecision: true,
      requestId: "assist-001",
    });
  });
});
