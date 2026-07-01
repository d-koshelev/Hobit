import { describe, expect, it, vi } from "vitest";

import {
  HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
  readHobitAgentWorkflowRequestEnvelope,
  type HobitAgentWorkflowRequestEnvelopeReadResult,
} from "../broker";
import type {
  AgentQueueItemAggregate,
  AgentQueueWorkflowRun,
} from "../../../workspace/types";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import {
  runQueueWorkflowRunnerRuntimeAdapter,
  type QueueWorkflowPersistencePort,
} from "./queueWorkflowRunnerRuntimeAdapter";

describe("QueueWorkflowRuntime read-only adapter", () => {
  it("invokes read-only runner for valid dependency_acceptance_smoke with explicit ids", async () => {
    const persistence = workflowPersistence();
    const bridge = queueBridge({
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ taskId }),
      ),
      listItemAggregates: vi.fn(async () => []),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: {
            ...validInputs(),
            phase: "read",
            taskIdsBySlot: explicitDependencyTaskIds(),
          },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "read",
      status: "completed",
      workflowId: "dependency_acceptance_smoke",
      workflowRunId: "queue-workflow-run-1",
      workflowStartStatus: "succeeded",
    });
    expect(persistence.startAgentQueueWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "workflow-request-1",
        workflowId: "dependency_acceptance_smoke",
        workspaceId: "workspace-1",
      }),
    );
    expect(persistence.recordAgentQueueWorkflowRunnerReport).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paused",
        workflowRunId: "queue-workflow-run-1",
      }),
    );
    expect(result.runnerResult?.report.mutationSummary).toEqual(
      expect.objectContaining({
        didAckReview: false,
        didCreateReviewMessage: false,
        didFail: false,
        didMarkDone: false,
        didStartWorker: false,
      }),
    );
    expect(bridge.getItemAggregate).toHaveBeenCalledTimes(4);
  });

  it("preserves request reuse and conflict behavior before read-only invocation", async () => {
    const reusedPersistence = workflowPersistence({
      startAgentQueueWorkflow: vi.fn(async (request) => ({
        blocker: null,
        conflict: null,
        status: "already_exists",
        workflowRun: workflowRun({
          requestId: request.requestId,
          workflowId: request.workflowId,
          workflowRunId: "queue-workflow-run-existing",
          workspaceId: request.workspaceId,
        }),
      })),
    });

    const reused = await runAdapter({
      queueBridge: queueBridge({
        getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
          aggregate({ taskId }),
        ),
        listItemAggregates: vi.fn(async () => []),
      }),
      workflowPersistence: reusedPersistence,
      workflowRequestRead: validRead(readOnlyWorkflowRequest()),
    });

    expect(reused).toMatchObject({
      invoked: true,
      persistenceStatus: "reused",
      workflowRunId: "queue-workflow-run-existing",
      workflowStartStatus: "already_exists",
    });

    const conflictPersistence = workflowPersistence({
      startAgentQueueWorkflow: vi.fn(async () => ({
        blocker: null,
        conflict: {
          conflictCode: "request_id_hash_conflict",
          conflictMessage: "Different typed request content exists.",
          existingRequestHash: "fnv1a64:old",
          existingWorkflowRunId: "queue-workflow-run-existing",
          requestedRequestHash: "fnv1a64:new",
        },
        status: "conflict",
        workflowRun: workflowRun({
          requestHash: "fnv1a64:old",
          workflowRunId: "queue-workflow-run-existing",
        }),
      })),
    });
    const bridge = queueBridge({ getItemAggregate: vi.fn() });

    const conflict = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: conflictPersistence,
      workflowRequestRead: validRead(readOnlyWorkflowRequest()),
    });

    expect(conflict).toMatchObject({
      invoked: false,
      persistenceStatus: "conflict",
      status: "blocked",
      workflowRunId: "queue-workflow-run-existing",
    });
    expect(bridge.getItemAggregate).not.toHaveBeenCalled();
    expect(
      conflictPersistence.recordAgentQueueWorkflowRunnerReport,
    ).not.toHaveBeenCalled();
  });

  it("stops early for invalid envelopes and unsupported workflows", async () => {
    const invalidPersistence = workflowPersistence();
    const invalidBridge = queueBridge({ getItemAggregate: vi.fn() });

    const invalid = await runAdapter({
      queueBridge: invalidBridge,
      workflowPersistence: invalidPersistence,
      workflowRequestRead: readWorkflow({ ...workflowRequest(), requestId: "" }),
    });

    expect(invalid).toMatchObject({
      invoked: false,
      status: "invalid_request",
    });
    expect(invalidBridge.getItemAggregate).not.toHaveBeenCalled();
    expect(invalidPersistence.startAgentQueueWorkflow).not.toHaveBeenCalled();

    const unsupportedPersistence = workflowPersistence();
    const unsupportedBridge = queueBridge({ getItemAggregate: vi.fn() });
    const unsupported = await runAdapter({
      queueBridge: unsupportedBridge,
      workflowPersistence: unsupportedPersistence,
      workflowRequestRead: validRead(
        workflowRequest({ workflowId: "unknown_queue_workflow" }),
      ),
    });

    expect(unsupported).toMatchObject({
      invoked: false,
      status: "unsupported",
      unsupportedReason: "workflow_not_declared",
    });
    expect(unsupportedBridge.getItemAggregate).not.toHaveBeenCalled();
    expect(unsupportedPersistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
  });

  it("keeps validation-deferred terminal_failure stopped before Queue mutation", async () => {
    const persistence = workflowPersistence();
    const bridge = queueBridge({
      failItem: vi.fn(),
      getItemAggregate: vi.fn(),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_failure_smoke"),
          workflowId: "terminal_failure",
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      status: "deferred",
      unsupportedReason: "terminal_failure_deferred",
    });
    expect(bridge.getItemAggregate).not.toHaveBeenCalled();
    expect(bridge.failItem).not.toHaveBeenCalled();
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
  });

  it("read-only inspection calls only read bridge methods", async () => {
    const bridge = queueBridge({
      createReviewMessage: vi.fn(),
      failItem: vi.fn(),
      getItemAggregate: vi.fn(async ({ taskId }: { taskId: string }) =>
        aggregate({ taskId }),
      ),
      listItemAggregates: vi.fn(async () => []),
      markItemDone: vi.fn(),
    });

    const result = await runAdapter({
      queueBridge: bridge,
      workflowRequestRead: validRead(readOnlyWorkflowRequest()),
    });

    expect(result.status).toBe("completed");
    expect(bridge.getItemAggregate).toHaveBeenCalled();
    expect(bridge.createReviewMessage).not.toHaveBeenCalled();
    expect(bridge.markItemDone).not.toHaveBeenCalled();
    expect(bridge.failItem).not.toHaveBeenCalled();
  });

  it("maps unexpected adapter failures to a safe failed_unexpected result", async () => {
    const result = await runAdapter({
      workflowPersistence: workflowPersistence({
        startAgentQueueWorkflow: vi.fn(async () => {
          throw new Error("secret-token=operator-confirmed");
        }),
      }),
      workflowRequestRead: validRead(readOnlyWorkflowRequest()),
    });

    expect(result).toMatchObject({
      invoked: false,
      status: "failed_unexpected",
      blockers: ["Unexpected Queue workflow runtime adapter failure."],
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(JSON.stringify(result)).not.toContain("operator-confirmed");
  });
});

function readWorkflow(
  request: Record<string, unknown>,
): HobitAgentWorkflowRequestEnvelopeReadResult {
  return readHobitAgentWorkflowRequestEnvelope(JSON.stringify(request));
}

function validRead(
  request: Record<string, unknown>,
): Extract<HobitAgentWorkflowRequestEnvelopeReadResult, { status: "valid" }> {
  const read = readWorkflow(request);
  expect(read.status).toBe("valid");
  if (read.status !== "valid") throw new Error("Expected valid workflow request.");
  return read;
}

function runAdapter(
  input: Parameters<typeof runQueueWorkflowRunnerRuntimeAdapter>[0],
) {
  return runQueueWorkflowRunnerRuntimeAdapter({
    workflowPersistence: workflowPersistence(),
    workspaceId: "workspace-1",
    ...input,
  });
}

function readOnlyWorkflowRequest() {
  return workflowRequest({
    inputs: {
      ...validInputs(),
      phase: "read",
      taskIdsBySlot: explicitDependencyTaskIds(),
    },
  });
}

function workflowRequest(overrides: Record<string, unknown> = {}) {
  return {
    grant: validGrant("queue_acceptance_smoke"),
    inputs: validInputs(),
    moduleId: "queue",
    requestId: "workflow-request-1",
    type: HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
    workflowId: "dependency_acceptance_smoke",
    ...overrides,
  };
}

function validGrant(mode: string, overrides: Record<string, unknown> = {}) {
  return {
    constraints: {
      noDelete: true,
      noDownstreamAutoStart: true,
      noGit: true,
      noRollback: true,
      noTerminal: true,
      noValidationExecution: true,
    },
    maxActions: 16,
    mode,
    ...overrides,
  };
}

function validInputs() {
  return {
    runSettings: {
      approvalPolicy: "never",
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executionTarget: {
        kind: "queue_local",
        providerId: "codex",
        queueOwnerWidgetInstanceId: "agent-queue-widget-id",
      },
      sandbox: "read_only",
      workspaceRoot: "C:/work/hobit",
    },
    tasks: [
      {
        prompt: "Read-only upstream smoke task.",
        slot: "upstream",
        title: "Upstream task",
      },
      {
        dependsOnSlots: ["upstream"],
        prompt: "Read-only downstream smoke task.",
        slot: "downstream",
        title: "Downstream task",
      },
    ],
  };
}

function explicitDependencyTaskIds() {
  return {
    downstream: "task-downstream",
    upstream: "task-upstream",
  };
}

function workflowPersistence(
  overrides: Partial<QueueWorkflowPersistencePort> = {},
): QueueWorkflowPersistencePort {
  return {
    planAgentQueueWorkflowResume: vi.fn(async () => null),
    recordAgentQueueWorkflowRunnerReport: vi.fn(
      async (
        request: Parameters<
          QueueWorkflowPersistencePort["recordAgentQueueWorkflowRunnerReport"]
        >[0],
      ) => ({
        actions: request.actions.map((action, index) => ({
          actionId: `workflow-action-${index + 1}`,
          actionType: action.actionType,
          attemptCount: 1,
          blockerCode: action.blockerCode ?? null,
          blockerMessage: action.blockerMessage ?? null,
          completedAt: "2026-06-22T00:00:00.000Z",
          createdAt: "2026-06-22T00:00:00.000Z",
          idempotencyKey: action.idempotencyKey,
          resultRefsJson: action.resultRefs
            ? JSON.stringify(action.resultRefs)
            : null,
          startedAt: "2026-06-22T00:00:00.000Z",
          status: action.status,
          stepId: action.stepId,
          targetRefsJson: action.targetRefs
            ? JSON.stringify(action.targetRefs)
            : null,
          updatedAt: "2026-06-22T00:00:00.000Z",
          workflowRunId: request.workflowRunId,
          workspaceId: request.workspaceId,
        })),
        blocker: null,
        conflict: null,
        status: "recorded",
        workflowRun: workflowRun({
          currentStep: request.currentStep ?? null,
          phase: request.phase ?? "review",
          status: request.status,
          workflowRunId: request.workflowRunId,
          workspaceId: request.workspaceId,
        }),
      }),
    ),
    startAgentQueueWorkflow: vi.fn(async (request) => ({
      blocker: null,
      conflict: null,
      status: "succeeded",
      workflowRun: workflowRun({
        requestId: request.requestId,
        workflowId: request.workflowId,
        workspaceId: request.workspaceId,
      }),
    })),
    ...overrides,
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
    schemaVersion: 1,
    slotBindingsJson: null,
    status: overrides.status ?? "created",
    updatedAt: "2026-06-22T00:00:00.000Z",
    variablesJson: null,
    version: 1,
    workflowId: overrides.workflowId ?? "dependency_acceptance_smoke",
    workflowRunId: overrides.workflowRunId ?? "queue-workflow-run-1",
    workspaceId: overrides.workspaceId ?? "workspace-1",
    ...overrides,
  };
}

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(),
    getSnapshot: vi.fn(),
    updateItem: vi.fn(),
    ...overrides,
  } as WorkspaceAgentQueueBridge;
}

function aggregate({
  dependencyState = "none",
  reviewState = "none",
  taskId,
  ticketState = "queued",
  workerRunState = "not_started",
}: {
  dependencyState?: string;
  reviewState?: string;
  taskId: string;
  ticketState?: string;
  workerRunState?: string;
}): AgentQueueItemAggregate {
  return {
    blockers: [],
    commitState: "none",
    dependencyState,
    durableFlags: {
      commitState: false,
      completionState: false,
      dependencyState: true,
      evidenceState: true,
      failureState: false,
      frontendOverlayUsed: false,
      latestRunLink: false,
      reviewState: true,
      taskRow: true,
      validationState: true,
    },
    evidenceState: "available",
    evidenceSummary: null,
    latestRun: null,
    nextActions: [],
    reviewState,
    runSettings: {
      approvalPolicy: "never",
      assignedExecutorWidgetId: null,
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executionWorkspace: "C:/work/hobit",
      sandbox: "read_only",
    },
    taskId,
    ticketState,
    title: "Queue task",
    updatedAt: "2026-06-22T00:00:00.000Z",
    validationState: "not_requested",
    workerRunState,
    workspaceId: "workspace-1",
  };
}
