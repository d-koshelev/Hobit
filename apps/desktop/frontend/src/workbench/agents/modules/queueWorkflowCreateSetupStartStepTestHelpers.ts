import type {
  AgentQueueWorkflowAction,
  AgentQueueWorkflowCreateSetupStartStepResult,
  AgentQueueWorkflowRun,
  ExecuteAgentQueueWorkflowCreateSetupStartStepRequest,
} from "../../../workspace/types";

export function createSetupStartStepResult({
  request,
  status = "executed",
  blocker = null,
  workflowRunId = request.workflowRunId ?? "queue-workflow-run-1",
}: {
  request: ExecuteAgentQueueWorkflowCreateSetupStartStepRequest;
  status?: "executed" | "already_applied" | "blocked_precondition";
  blocker?: {
    blockerCode: string;
    blockerMessage: string;
    missingRequiredField: string | null;
  } | null;
  workflowRunId?: string;
}): AgentQueueWorkflowCreateSetupStartStepResult {
  const executed = status === "executed" || status === "already_applied";
  const runIdsBySlot: Record<string, string> = executed
    ? { upstream: "run-upstream" }
    : {};
  return {
    actions: {
      createTaskDownstream: workflowAction({
        actionId: "workflow-action-create-downstream",
        actionType: "create_task",
        idempotencyKey: `${workflowRunId}:create_task:downstream:task-spec-hash-downstream`,
        status: executed ? "completed" : "blocked",
        stepId: "downstream",
        workflowRunId,
        workspaceId: request.workspaceId,
      }),
      createTaskUpstream: workflowAction({
        actionId: "workflow-action-create-upstream",
        actionType: "create_task",
        idempotencyKey: `${workflowRunId}:create_task:upstream:task-spec-hash-upstream`,
        status: "completed",
        stepId: "upstream",
        workflowRunId,
        workspaceId: request.workspaceId,
      }),
      promoteTask: workflowAction({
        actionId: "workflow-action-promote-upstream",
        actionType: "promote_task",
        idempotencyKey: `${workflowRunId}:promote_task:upstream:task-spec-hash-upstream:settings-hash-upstream`,
        status: executed ? "completed" : "blocked",
        stepId: "upstream",
        workflowRunId,
        workspaceId: request.workspaceId,
      }),
      startWorker: workflowAction({
        actionId: "workflow-action-start-upstream",
        actionType: "start_worker",
        blockerCode: blocker?.blockerCode ?? null,
        blockerMessage: blocker?.blockerMessage ?? null,
        idempotencyKey: `${workflowRunId}:start_worker:task-upstream:execution-target-hash-queue_local:settings-hash-upstream`,
        resultRefsJson: executed ? JSON.stringify({ runId: "run-upstream" }) : null,
        status: executed ? "completed" : "blocked",
        stepId: "upstream",
        targetRefsJson: JSON.stringify({
          executionTargetHash: "execution-target-hash-queue_local",
          executionTargetKind: "queue_local",
          providerId: "codex",
          settingsHash: "settings-hash-upstream",
          slot: "upstream",
          taskId: "task-upstream",
          workflowRunId,
        }),
        workflowRunId,
        workspaceId: request.workspaceId,
      }),
      updateRunSettings: workflowAction({
        actionId: "workflow-action-settings-upstream",
        actionType: "update_run_settings",
        idempotencyKey: `${workflowRunId}:update_run_settings:upstream:settings-hash-upstream`,
        status: executed ? "completed" : "blocked",
        stepId: "upstream",
        workflowRunId,
        workspaceId: request.workspaceId,
      }),
    },
    blockers: blocker ? [blocker] : [],
    conflict: null,
    downstreamVerification: {
      dependencyEdgeExists: true,
      downstreamNotStarted: true,
      downstreamRunIdAbsent: true,
      downstreamTaskExists: true,
      downstreamTaskId: "task-downstream",
    },
    executionTargetHash: "execution-target-hash-queue_local",
    executionTargetKind: "queue_local",
    nextPhase: "run_start",
    nextStep:
      status === "blocked_precondition"
        ? "create_setup_start_blocked"
        : "awaiting_worker_completion",
    providerId: "codex",
    queueControl: { status: "manual_enabled", version: 7 },
    requestId: request.requestId,
    runIdsBySlot,
    settingsHash: "settings-hash-upstream",
    slotBindingSnapshot: {
      downstream: {
        dependencyTaskIds: ["task-upstream"],
        dependsOnSlots: ["upstream"],
        taskId: "task-downstream",
        taskSpecHash: "task-spec-hash-downstream",
      },
      upstream: {
        executionTargetHash: "execution-target-hash-queue_local",
        executionTargetKind: "queue_local",
        providerId: "codex",
        runId: executed ? "run-upstream" : null,
        settingsHash: "settings-hash-upstream",
        taskId: "task-upstream",
        taskSpecHash: "task-spec-hash-upstream",
      },
    },
    status,
    taskIdsBySlot: {
      downstream: "task-downstream",
      upstream: "task-upstream",
    },
    transition: "create_setup_start",
    workflowId: request.workflowId,
    workflowRun: workflowRun({
      currentStep:
        status === "blocked_precondition"
          ? "create_setup_start_blocked"
          : "awaiting_worker_completion",
      phase: "run_start",
      status: status === "blocked_precondition" ? "blocked" : "paused",
      workflowId: request.workflowId,
      workflowRunId,
      workspaceId: request.workspaceId,
    }),
    workflowRunId,
  };
}

function workflowAction(
  overrides: Partial<AgentQueueWorkflowAction> &
    Pick<
      AgentQueueWorkflowAction,
      | "actionId"
      | "actionType"
      | "idempotencyKey"
      | "status"
      | "stepId"
      | "workflowRunId"
      | "workspaceId"
    >,
): AgentQueueWorkflowAction {
  return {
    attemptCount: 1,
    blockerCode: null,
    blockerMessage: null,
    completedAt:
      overrides.status === "completed" ? "2026-06-22T00:00:00.000Z" : null,
    createdAt: "2026-06-22T00:00:00.000Z",
    resultRefsJson: null,
    startedAt: "2026-06-22T00:00:00.000Z",
    targetRefsJson: "{}",
    updatedAt: "2026-06-22T00:00:00.000Z",
    ...overrides,
  };
}

function workflowRun(overrides: Partial<AgentQueueWorkflowRun>): AgentQueueWorkflowRun {
  return {
    actionLogSummaryJson: null,
    actorId: "workspace-agent:test",
    blockerReason: null,
    completedAt: null,
    createdAt: "2026-06-22T00:00:00.000Z",
    currentStep: "created",
    grantSummaryJson: null,
    idempotencyKeysJson: null,
    inputsSnapshotJson: null,
    mutationRefsJson: null,
    pauseReason: null,
    phase: "intake",
    requestHash: "fnv1a64:test",
    requestId: "workflow-request-1",
    schemaVersion: 1,
    slotBindingsJson: null,
    status: "created",
    updatedAt: "2026-06-22T00:00:00.000Z",
    variablesJson: null,
    version: 1,
    workflowId: "dependency_acceptance_smoke",
    workflowRunId: "queue-workflow-run-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
