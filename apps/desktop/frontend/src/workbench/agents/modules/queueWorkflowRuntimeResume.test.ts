import { describe, expect, it, vi } from "vitest";

import {
  HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
  readHobitAgentWorkflowRequestEnvelope,
  type HobitAgentWorkflowRequestEnvelopeReadResult,
} from "../broker";
import type {
  AgentQueueItemAggregate,
  AgentQueueWorkflowFinalizationStepResult,
  AgentQueueWorkflowResumePlan,
  AgentQueueWorkflowRun,
  ExecuteAgentQueueWorkflowFinalizationStepRequest,
} from "../../../workspace/types";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import {
  runQueueWorkflowRunnerRuntimeAdapter,
  type QueueWorkflowPersistencePort,
} from "./queueWorkflowRunnerRuntimeAdapter";

describe("QueueWorkflowRuntime resume adapter", () => {
  it("uses resume planning for explicit workflowRunId before read-only execution", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () => resumePlan()),
    });
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
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(persistence.planAgentQueueWorkflowResume).toHaveBeenCalledWith({
      workflowRunId: "queue-workflow-run-1",
      workspaceId: "workspace-1",
    });
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      invoked: true,
      phase: "read",
      resumePlan: expect.objectContaining({
        status: "resume_read_only_ready",
      }),
      workflowRunId: "queue-workflow-run-1",
    });
  });

  it("returns terminal and blocked resume plans without invoking runner paths", async () => {
    const terminalPersistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        resumePlan({
          reportSummary: "Workflow is already completed.",
          resumeAvailable: false,
          status: "terminal_completed",
          terminalStatus: "completed",
          workflowRun: workflowRun({
            completedAt: "2026-06-22T00:00:00.000Z",
            status: "completed",
          }),
        }),
      ),
    });
    const terminalBridge = queueBridge({ getItemAggregate: vi.fn() });

    const terminal = await runAdapter({
      queueBridge: terminalBridge,
      workflowPersistence: terminalPersistence,
      workflowRequestRead: validRead(resumeWorkflowRequest()),
    });

    expect(terminal).toMatchObject({
      invoked: false,
      persistentStatus: "completed",
      resumePlan: expect.objectContaining({ status: "terminal_completed" }),
      status: "completed",
    });
    expect(terminalBridge.getItemAggregate).not.toHaveBeenCalled();

    const blockedPersistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        resumePlan({
          blockers: [
            {
              blockerCode: "task_missing",
              blockerMessage: "Persisted task is missing.",
              completionDecisionId: null,
              evidenceBundleId: null,
              failureDecisionId: null,
              messageId: null,
              missingRequiredField: "taskId",
              runId: null,
              slot: "upstream",
              taskId: "task-upstream",
            },
          ],
          reportSummary: "Persisted task is missing.",
          status: "blocked_missing_task",
        }),
      ),
    });
    const blockedBridge = queueBridge({ getItemAggregate: vi.fn() });

    const blocked = await runAdapter({
      queueBridge: blockedBridge,
      workflowPersistence: blockedPersistence,
      workflowRequestRead: validRead(resumeWorkflowRequest()),
    });

    expect(blocked).toMatchObject({
      invoked: false,
      status: "blocked",
    });
    expect(blocked.blockers).toEqual(
      expect.arrayContaining(["Persisted task is missing."]),
    );
    expect(blockedBridge.getItemAggregate).not.toHaveBeenCalled();
  });

  it("does not start a second worker when resume planner reports worker running", async () => {
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        resumePlan({
          nextPhase: "worker_evidence",
          nextStep: "worker_running_waiting_for_evidence",
          status: "resume_read_only_ready",
        }),
      ),
    });

    const result = await runAdapter({
      queueBridge: queueBridge({ startWorkflowAssignedTask: vi.fn() }),
      workflowPersistence: persistence,
      workflowRequestRead: validRead(resumeWorkflowRequest()),
    });

    expect(result).toMatchObject({
      invoked: false,
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(persistence.startAgentQueueWorkflow).not.toHaveBeenCalled();
    expect(persistence.recordAgentQueueWorkflowRunnerReport).not.toHaveBeenCalled();
  });

  it("keeps worker evidence resume paused without typed completion input", async () => {
    const executeEvidence = vi.fn();
    const persistence = workflowPersistence({
      executeAgentQueueWorkflowWorkerEvidenceStep: executeEvidence,
      planAgentQueueWorkflowResume: vi.fn(async () =>
        resumePlan({
          nextPhase: "worker_evidence",
          nextStep: "waiting_for_worker_evidence",
          reportSummary:
            "Queue workflow run queue-workflow-run-1 resume plan status is waiting_for_worker_evidence.",
          status: "waiting_for_worker_evidence",
        }),
      ),
    });

    const result = await runAdapter({
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: { phase: "worker_evidence" },
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      phase: "worker_evidence",
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(executeEvidence).not.toHaveBeenCalled();
    expect(persistence.recordAgentQueueWorkflowRunnerReport).not.toHaveBeenCalled();
  });

  it("resumes finalization through the backend step and redacts confirmation", async () => {
    const executeFinalization = vi.fn(
      async (request: ExecuteAgentQueueWorkflowFinalizationStepRequest) =>
        finalizationStepResult({ request }),
    );
    const persistence = workflowPersistence({
      executeAgentQueueWorkflowFinalizationStep: executeFinalization,
      planAgentQueueWorkflowResume: vi.fn(async () => finalizationResumePlan()),
    });
    const bridge = queueBridge({ failItem: vi.fn(), markItemDone: vi.fn() });

    const result = await runAdapter({
      actorId: "workspace-agent:test",
      queueBridge: bridge,
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          grant: validGrant("queue_acceptance_smoke", {
            confirmationToken: "operator-confirmed",
          }),
          inputs: {
            ...validInputs(),
            phase: "finalization",
          },
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "finalization",
      status: "completed",
    });
    expect(executeFinalization).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "workspace-agent:test",
        confirmationToken: "operator-confirmed",
        failureReason: undefined,
        workflowRunId: "queue-workflow-run-1",
      }),
    );
    expect(bridge.markItemDone).not.toHaveBeenCalled();
    expect(bridge.failItem).not.toHaveBeenCalled();
    expect(persistence.recordAgentQueueWorkflowRunnerReport).not.toHaveBeenCalled();
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

function resumeWorkflowRequest() {
  return workflowRequest({
    metadata: { workflowRunId: "queue-workflow-run-1" },
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
      { prompt: "Upstream smoke task.", slot: "upstream", title: "Upstream" },
      {
        dependsOnSlots: ["upstream"],
        prompt: "Downstream smoke task.",
        slot: "downstream",
        title: "Downstream",
      },
    ],
  };
}

function workflowPersistence(
  overrides: Partial<QueueWorkflowPersistencePort> = {},
): QueueWorkflowPersistencePort {
  return {
    planAgentQueueWorkflowResume: vi.fn(async () => null),
    recordAgentQueueWorkflowRunnerReport: vi.fn(async () => ({
      actions: [],
      blocker: null,
      conflict: null,
      status: "recorded",
      workflowRun: null,
    })),
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

function resumePlan(
  overrides: Partial<AgentQueueWorkflowResumePlan> = {},
): AgentQueueWorkflowResumePlan {
  return {
    actions: [],
    blockers: [],
    nextPhase: "worker_evidence",
    nextStep: "read_ready",
    reconciledVariablesJson: null,
    reportSummary:
      "Queue workflow run queue-workflow-run-1 resume plan status is resume_read_only_ready. No workflow steps were executed.",
    requiredConfirmation: false,
    requiredFreshGrant: false,
    resumeAvailable: true,
    slotReconciliations: [
      slotReconciliation({ slot: "upstream", taskId: "task-upstream" }),
      slotReconciliation({ slot: "downstream", taskId: "task-downstream" }),
    ],
    status: "resume_read_only_ready",
    taskSnapshots: [],
    terminalStatus: null,
    workflowRun: workflowRun({
      phase: "worker_evidence",
      slotBindingsJson: JSON.stringify({
        downstream: { taskId: "task-downstream" },
        upstream: { taskId: "task-upstream" },
      }),
      status: "paused",
    }),
    ...overrides,
  };
}

function finalizationResumePlan() {
  return resumePlan({
    nextPhase: "decision",
    nextStep: "mark_done_ready",
    requiredConfirmation: true,
    requiredFreshGrant: true,
    slotReconciliations: [
      slotReconciliation({
        aggregateReviewState: "acked",
        evidenceBundleId: "bundle-upstream",
        evidenceExists: true,
        messageId: "message-upstream",
        reviewMessageExists: true,
        reviewMessageStatus: "acked",
        runExists: true,
        runId: "run-upstream",
        slot: "upstream",
        taskId: "task-upstream",
      }),
      slotReconciliation({
        aggregateDependencyState: "done",
        slot: "downstream",
        taskId: "task-downstream",
      }),
    ],
    status: "blocked_missing_confirmation",
    workflowRun: workflowRun({
      phase: "decision",
      slotBindingsJson: JSON.stringify({
        downstream: { taskId: "task-downstream" },
        upstream: {
          evidenceBundleId: "bundle-upstream",
          messageId: "message-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        },
      }),
      status: "paused",
    }),
  });
}

function slotReconciliation(
  overrides: Partial<AgentQueueWorkflowResumePlan["slotReconciliations"][number]> = {},
): AgentQueueWorkflowResumePlan["slotReconciliations"][number] {
  return {
    aggregateDependencyState: "none",
    aggregateEvidenceState: "available",
    aggregateReviewState: "none",
    aggregateTicketState: "queued",
    blockerCode: null,
    completionDecisionExists: false,
    completionDecisionId: null,
    evidenceBundleId: null,
    evidenceExists: false,
    executorWidgetId: null,
    failureDecisionExists: false,
    failureDecisionId: null,
    messageId: null,
    reviewMessageExists: false,
    reviewMessageStatus: null,
    runExists: false,
    runId: null,
    slot: "upstream",
    taskExists: true,
    taskId: "task-upstream",
    ...overrides,
  };
}

function finalizationStepResult({
  request,
}: {
  request: ExecuteAgentQueueWorkflowFinalizationStepRequest;
}): AgentQueueWorkflowFinalizationStepResult {
  return {
    action: {
      actionId: "workflow-action-finalization",
      actionType: "queue.item.markDone",
      attemptCount: 1,
      blockerCode: null,
      blockerMessage: null,
      completedAt: "2026-06-22T00:00:00.000Z",
      createdAt: "2026-06-22T00:00:00.000Z",
      idempotencyKey: `${request.workflowRunId}:mark_done:upstream:task-upstream`,
      resultRefsJson: '{"confirmationAccepted":true}',
      startedAt: "2026-06-22T00:00:00.000Z",
      status: "completed",
      stepId: "finalization.mark_done",
      targetRefsJson: '{"taskId":"task-upstream"}',
      updatedAt: "2026-06-22T00:00:00.000Z",
      workflowRunId: request.workflowRunId,
      workspaceId: request.workspaceId,
    },
    binding: {
      actionIdempotencyKey: `${request.workflowRunId}:mark_done:upstream:task-upstream`,
      completionDecisionId: "completion-decision-1",
      evidenceBundleId: "bundle-upstream",
      failureDecisionId: null,
      finalizationActionId: "workflow-action-finalization",
      finalizedAt: "2026-06-22T00:00:00.000Z",
      messageId: "message-upstream",
      runId: "run-upstream",
      slot: "upstream",
      taskId: "task-upstream",
      terminalStatus: "completed",
    },
    blockers: [],
    completionDecisionId: "completion-decision-1",
    conflict: null,
    downstreamVerification: {
      dependencyState: "ready",
      dependencyVerified: true,
      downstreamTaskId: "task-downstream",
      expectedDependencyState: "ready",
      latestRunId: null,
      notAutoStartedVerified: true,
      ticketState: "queued",
      verificationMissing: false,
      workerRunState: "not_started",
    },
    failureDecisionId: null,
    nextPhase: "closed",
    nextStep: "finalization_complete",
    status: "executed",
    terminalStatus: "completed",
    transition: "finalize_done",
    workflowId: "dependency_acceptance_smoke",
    workflowRun: workflowRun({
      currentStep: "finalization_complete",
      phase: "closed",
      status: "completed",
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

function aggregate({ taskId }: { taskId: string }): AgentQueueItemAggregate {
  return {
    blockers: [],
    commitState: "none",
    dependencyState: "none",
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
    reviewState: "none",
    runSettings: {
      approvalPolicy: "never",
      assignedExecutorWidgetId: null,
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executionWorkspace: "C:/work/hobit",
      sandbox: "read_only",
    },
    taskId,
    ticketState: "queued",
    title: "Queue task",
    updatedAt: "2026-06-22T00:00:00.000Z",
    validationState: "not_requested",
    workerRunState: "not_started",
    workspaceId: "workspace-1",
  };
}
