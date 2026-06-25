import type { AgentQueueWorkflowRun } from "../../../workspace/types";
import type { QueueWorkflowPersistencePort } from "./queueWorkflowRunnerRuntimeAdapter";

export function reviewStepResult({
  request,
  status = "executed",
}: {
  request: Parameters<
    NonNullable<QueueWorkflowPersistencePort["executeAgentQueueWorkflowReviewStep"]>
  >[0];
  status?: "executed" | "already_applied" | "blocked_precondition";
}) {
  const success = status === "executed" || status === "already_applied";
  const slot = request.slot ?? "upstream";
  const createKey = `${request.workflowRunId}:create_review_message:${slot}:task-upstream:run-upstream:bundle-upstream`;
  const ackKey = `${request.workflowRunId}:ack_review_message:${slot}:message-upstream`;
  const action = ({
    actionId,
    actionType,
    idempotencyKey,
    resultRefsJson,
    stepId,
    targetRefsJson,
  }: {
    actionId: string;
    actionType: string;
    idempotencyKey: string;
    resultRefsJson: string;
    stepId: string;
    targetRefsJson: string;
  }) => ({
    actionId,
    actionType,
    attemptCount: status === "already_applied" ? 1 : 2,
    blockerCode: null,
    blockerMessage: null,
    completedAt: "2026-06-22T00:00:00.000Z",
    createdAt: "2026-06-22T00:00:00.000Z",
    idempotencyKey,
    resultRefsJson,
    startedAt: "2026-06-22T00:00:00.000Z",
    status: "completed",
    stepId,
    targetRefsJson,
    updatedAt: "2026-06-22T00:00:00.000Z",
    workflowRunId: request.workflowRunId,
    workspaceId: request.workspaceId,
  });

  return {
    ackAction: success
      ? action({
          actionId: "workflow-action-review-ack",
          actionType: "queue.review.ack",
          idempotencyKey: ackKey,
          resultRefsJson: JSON.stringify({
            ackStatus: "acknowledged",
            messageId: "message-upstream",
            status: "acknowledged",
          }),
          stepId: "review.ack",
          targetRefsJson: JSON.stringify({
            messageId: "message-upstream",
            slot,
            taskId: "task-upstream",
            workflowRunId: request.workflowRunId,
          }),
        })
      : null,
    ackStatus: success ? "acknowledged" : null,
    binding: success
      ? {
          ackActionId: "workflow-action-review-ack",
          ackActionIdempotencyKey: ackKey,
          ackStatus: "acknowledged",
          createActionId: "workflow-action-review-create",
          createActionIdempotencyKey: createKey,
          evidenceBundleId: "bundle-upstream",
          messageId: "message-upstream",
          reviewAckedAt: "2026-06-22T00:00:00.000Z",
          reviewCreatedAt: "2026-06-22T00:00:00.000Z",
          runId: "run-upstream",
          slot,
          taskId: "task-upstream",
        }
      : null,
    blockers:
      status === "blocked_precondition"
        ? [
            {
              blockerCode: "evidence_missing",
              blockerMessage: "Queue workflow review requires durable worker evidence.",
              missingRequiredField: "evidenceBundleId",
            },
          ]
        : [],
    conflict: null,
    createAction: success
      ? action({
          actionId: "workflow-action-review-create",
          actionType: "queue.review.createMessage",
          idempotencyKey: createKey,
          resultRefsJson: JSON.stringify({
            evidenceBundleId: "bundle-upstream",
            messageId: "message-upstream",
            runId: "run-upstream",
            status: status === "already_applied" ? "reused" : "created",
          }),
          stepId: "review.create",
          targetRefsJson: JSON.stringify({
            evidenceBundleId: "bundle-upstream",
            runId: "run-upstream",
            slot,
            taskId: "task-upstream",
            workflowRunId: request.workflowRunId,
          }),
        })
      : null,
    messageId: success ? "message-upstream" : null,
    nextPhase: success ? "finalization" : "review",
    nextStep: success ? "awaiting_finalization" : "review_blocked",
    status,
    transition: "review",
    workflowRun: workflowRun({
      currentStep: success ? "awaiting_finalization" : "review_blocked",
      phase: "review",
      status: success ? "paused" : "blocked",
      workflowRunId: request.workflowRunId,
      workspaceId: request.workspaceId,
    }),
    workflowRunId: request.workflowRunId,
  };
}

function workflowRun(
  overrides: Partial<AgentQueueWorkflowRun> = {},
): AgentQueueWorkflowRun {
  return {
    actionLogSummaryJson: null,
    actorId: "workspace-agent:test",
    blockerReason: null,
    completedAt: null,
    createdAt: "2026-06-22T00:00:00.000Z",
    currentStep: overrides.currentStep ?? "created",
    grantSummaryJson: null,
    idempotencyKeysJson: null,
    inputsSnapshotJson: null,
    mutationRefsJson: null,
    pauseReason: null,
    phase: overrides.phase ?? "intake",
    requestHash: overrides.requestHash ?? "fnv1a64:test",
    requestId: overrides.requestId ?? "workflow-request-1",
    schemaVersion: overrides.schemaVersion ?? 1,
    slotBindingsJson: null,
    status: overrides.status ?? "created",
    updatedAt: "2026-06-22T00:00:00.000Z",
    variablesJson: null,
    version: overrides.version ?? 1,
    workflowId: overrides.workflowId ?? "dependency_acceptance_smoke",
    workflowRunId: overrides.workflowRunId ?? "queue-workflow-run-1",
    workspaceId: overrides.workspaceId ?? "workspace-1",
  };
}
