import adapterSource from "./queueWorkflowRunnerRuntimeAdapter.ts?raw";
import dispatcherSource from "./queueWorkflowBackendStepDispatcher.ts?raw";
import reviewPhaseSource from "./queueWorkflowRunnerBackendReviewPhase.ts?raw";

import { describe, expect, it, vi } from "vitest";

import {
  HOBIT_AGENT_WORKFLOW_REQUEST_ENVELOPE_TYPE,
  readHobitAgentWorkflowRequestEnvelope,
  type HobitAgentWorkflowRequestEnvelopeReadResult,
} from "../broker";
import type {
  AgentQueueItemAggregate,
  AgentQueueWorkflowRun,
  AgentQueueWorkflowWorkerEvidenceStepResult,
} from "../../../workspace/types";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import {
  backendOwnedQueueWorkflowPhases,
  legacyFrontendQueueWorkflowPhases,
} from "./queueWorkflowBackendStepDispatcher";
import {
  runQueueWorkflowRunnerRuntimeAdapter,
  type QueueWorkflowPersistencePort,
} from "./queueWorkflowRunnerRuntimeAdapter";
import { reviewStepResult } from "./queueWorkflowRunnerReviewStepTestHelpers";

describe("QueueWorkflowRunner backend step dispatcher", () => {
  it("declares backend-owned and legacy frontend phase boundaries", () => {
    expect(backendOwnedQueueWorkflowPhases).toEqual([
      "worker_evidence",
      "review",
    ]);
    expect(legacyFrontendQueueWorkflowPhases).toEqual([
      "create_setup_start",
      "read",
      "finalization",
    ]);
  });

  it("delegates worker_evidence to the backend step without raw evidence mutation or report synthesis", async () => {
    const rawEvidencePort = vi.fn();
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        workerEvidenceResumePlan({
          workflowRun: workflowRun({
            inputsSnapshotJson: JSON.stringify(validInputs()),
            phase: "worker_evidence",
            slotBindingsJson: JSON.stringify({
              upstream: { taskId: "task-upstream" },
            }),
            status: "paused",
          }),
        }),
      ),
    });

    const result = await runAdapter({
      queueBridge: queueBridge({ recordWorkflowWorkerEvidence: rawEvidencePort }),
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: workerEvidenceInputs(),
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "worker_evidence",
      status: "paused",
      workflowRunId: "queue-workflow-run-1",
    });
    expect(persistence.executeAgentQueueWorkflowWorkerEvidenceStep).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "completed",
        runId: "run-upstream",
        slot: "upstream",
        taskId: "task-upstream",
      }),
    );
    expect(rawEvidencePort).not.toHaveBeenCalled();
    expect(persistence.recordAgentQueueWorkflowRunnerReport).not.toHaveBeenCalled();
    expect(result.evidenceStepResult?.action).toMatchObject({
      actionType: "record_worker_evidence",
      status: "completed",
    });
    expect(result.runnerResult?.report.workerEvidence).toMatchObject({
      commandStatus: "recorded",
      evidenceBundleId: "bundle-upstream",
      status: "evidence_recorded",
    });
    expect(result.runnerResult?.report.nextMutatingPhase).toBe("review");
  });

  it("surfaces typed worker_evidence backend blockers without generic runner failure rows", async () => {
    const persistence = workflowPersistence({
      executeAgentQueueWorkflowWorkerEvidenceStep: vi.fn(async (request) =>
        workerEvidenceStepResult({
          blocker: {
            blockerCode: "worker_outcome_mismatch",
            blockerMessage:
              "Queue workflow worker evidence outcome does not match the durable worker run status.",
            missingRequiredField: "workerEvidence.outcome",
          },
          request,
          status: "blocked_precondition",
        }),
      ),
      planAgentQueueWorkflowResume: vi.fn(async () => workerEvidenceResumePlan()),
    });

    const result = await runAdapter({
      queueBridge: queueBridge({ recordWorkflowWorkerEvidence: vi.fn() }),
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: workerEvidenceInputs({
            outcome: "failed",
            summary: "Typed mismatched evidence.",
          }),
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      blockers: [
        "Queue workflow worker evidence outcome does not match the durable worker run status.",
      ],
      invoked: true,
      phase: "worker_evidence",
      status: "blocked",
    });
    expect(result.runnerResult?.status).toBe("blocked_worker_outcome_mismatch");
    expect(result.evidenceStepResult?.action).toMatchObject({
      actionType: "record_worker_evidence",
      blockerCode: "worker_outcome_mismatch",
      status: "blocked",
    });
    expect(persistence.recordAgentQueueWorkflowRunnerReport).not.toHaveBeenCalled();
  });

  it("lets retryable_review_failure_before_mutation reach the backend review step without local evidence refs", async () => {
    const rawCreate = vi.fn();
    const rawAck = vi.fn();
    const persistence = workflowPersistence({
      planAgentQueueWorkflowResume: vi.fn(async () =>
        reviewResumePlan({
          blockers: [
            {
              blockerCode: "retryable_review_failure_before_mutation",
              blockerMessage:
                "Backend proved review failed before durable review mutation.",
              completionDecisionId: null,
              evidenceBundleId: null,
              failureDecisionId: null,
              messageId: null,
              missingRequiredField: null,
              runId: "run-upstream",
              slot: "upstream",
              taskId: "task-upstream",
            },
          ],
          reportSummary:
            "Queue workflow review retry is allowed before durable mutation.",
          slotReconciliations: [
            slotReconciliation({
              evidenceBundleId: null,
              evidenceExists: false,
              runId: "run-upstream",
              taskId: "task-upstream",
            }),
          ],
          status: "retryable_review_failure_before_mutation",
          workflowRun: workflowRun({
            inputsSnapshotJson: JSON.stringify(validInputs()),
            phase: "review",
            slotBindingsJson: JSON.stringify({
              upstream: { runId: "run-upstream", taskId: "task-upstream" },
            }),
            status: "failed",
          }),
        }),
      ),
    });

    const result = await runAdapter({
      queueBridge: queueBridge({
        ackReviewMessage: rawAck,
        createReviewMessage: rawCreate,
      }),
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: { phase: "review" },
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: true,
      phase: "review",
      status: "paused",
    });
    expect(persistence.executeAgentQueueWorkflowReviewStep).toHaveBeenCalledWith(
      expect.objectContaining({
        slot: "upstream",
        workflowRunId: "queue-workflow-run-1",
        workspaceId: "workspace-1",
      }),
    );
    expect(rawCreate).not.toHaveBeenCalled();
    expect(rawAck).not.toHaveBeenCalled();
    expect(result.runnerResult?.report.review).toMatchObject({
      ackStatus: "succeeded",
      messageId: "message-upstream",
      status: "review_acknowledged",
    });
    expect(result.runnerResult?.report.nextMutatingPhase).toBe("finalization");
  });

  it("blocks non-retryable failed review plans from invoking the backend step", async () => {
    const executeReviewStep = vi.fn(async (request) =>
      reviewStepResult({ request }),
    );
    const persistence = workflowPersistence({
      executeAgentQueueWorkflowReviewStep: executeReviewStep,
      planAgentQueueWorkflowResume: vi.fn(async () =>
        reviewResumePlan({
          blockers: [
            {
              blockerCode: "failed_unexpected",
              blockerMessage: "Backend plan does not allow review retry.",
              completionDecisionId: null,
              evidenceBundleId: null,
              failureDecisionId: null,
              messageId: null,
              missingRequiredField: null,
              runId: "run-upstream",
              slot: "upstream",
              taskId: "task-upstream",
            },
          ],
          reportSummary: "Backend plan does not allow review retry.",
          status: "failed_unexpected",
          workflowRun: workflowRun({
            phase: "review",
            status: "failed",
          }),
        }),
      ),
    });

    const result = await runAdapter({
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: { phase: "review" },
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      invoked: false,
      phase: "review",
      status: "failed_unexpected",
      summary: "Backend plan does not allow review retry.",
    });
    expect(executeReviewStep).not.toHaveBeenCalled();
  });

  it("surfaces typed missing-evidence review blockers from the backend step unchanged", async () => {
    const persistence = workflowPersistence({
      executeAgentQueueWorkflowReviewStep: vi.fn(async (request) =>
        reviewStepResult({ request, status: "blocked_precondition" }),
      ),
      planAgentQueueWorkflowResume: vi.fn(async () => reviewResumePlan()),
    });

    const result = await runAdapter({
      queueBridge: queueBridge({
        ackReviewMessage: vi.fn(),
        createReviewMessage: vi.fn(),
      }),
      workflowPersistence: persistence,
      workflowRequestRead: validRead(
        workflowRequest({
          inputs: { phase: "review" },
          metadata: { workflowRunId: "queue-workflow-run-1" },
        }),
      ),
    });

    expect(result).toMatchObject({
      blockers: ["Queue workflow review requires durable worker evidence."],
      invoked: true,
      phase: "review",
      status: "blocked",
    });
    expect(result.runnerResult?.status).toBe("review_blocked_missing_evidence");
    expect(result.reviewStepResult?.blockers[0]).toMatchObject({
      blockerCode: "evidence_missing",
      missingRequiredField: "evidenceBundleId",
    });
    expect(persistence.recordAgentQueueWorkflowRunnerReport).not.toHaveBeenCalled();
  });

  it("keeps backend-owned dispatcher paths free of raw Queue mutations, UI, shell, and local persistence", () => {
    expect(adapterSource).not.toContain("createReviewMessage");
    expect(adapterSource).not.toContain("ackReviewMessage");
    expect(adapterSource).not.toContain("recordWorkflowWorkerEvidence");
    expect(adapterSource).not.toContain("queue.review.createMessage");
    expect(adapterSource).not.toContain("queue.review.ack");
    expect(adapterSource).not.toContain("queue.lifecycle.agentFinished");

    const backendOwnedSources = `${dispatcherSource}\n${reviewPhaseSource}`;
    const forbiddenFragments = [
      "AgentQueueV2Board",
      "AgentQueuePlaceholderWidget",
      "widgetV2/queueV2",
      "queue/details",
      "ModuleShell",
      "tokens.css",
      "widget.css",
      "recordAgentQueueWorkflowRunnerReport",
      "slotBindings:",
      "currentStep:",
      "queue.workflow.runner",
      "queue.lifecycle.agentFinished",
      "record_worker_evidence",
      "startWorkflowAssignedTask",
      "markDone",
      "failItem",
      "runValidation",
      "mutateGit",
    ];
    for (const fragment of forbiddenFragments) {
      expect(backendOwnedSources).not.toContain(fragment);
    }
    expect(reviewPhaseSource).not.toContain("createReviewMessage");
    expect(reviewPhaseSource).not.toContain("ackReviewMessage");
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
  if (read.status !== "valid") {
    throw new Error("Expected valid workflow request.");
  }
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

function workflowPersistence(
  overrides: Partial<QueueWorkflowPersistencePort> = {},
): QueueWorkflowPersistencePort {
  return {
    executeAgentQueueWorkflowReviewStep: vi.fn(async (request) =>
      reviewStepResult({ request }),
    ),
    executeAgentQueueWorkflowWorkerEvidenceStep: vi.fn(async (request) =>
      workerEvidenceStepResult({ request }),
    ),
    planAgentQueueWorkflowResume: vi.fn(async () => null),
    recordAgentQueueWorkflowRunnerReport: vi.fn(async (request) => ({
      actions: [],
      blocker: null,
      conflict: null,
      status: "recorded",
      workflowRun: workflowRun({
        currentStep: request.currentStep ?? null,
        phase: request.phase ?? "worker_evidence",
        status: request.status,
        workflowRunId: request.workflowRunId,
        workspaceId: request.workspaceId,
      }),
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

function validGrant(mode: string) {
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
      },
      sandbox: "read_only",
      workspaceRoot: "C:/work/hobit",
    },
    tasks: [
      {
        prompt: "Upstream smoke task.",
        slot: "upstream",
        title: "Upstream task",
      },
      {
        dependsOnSlots: ["upstream"],
        prompt: "Downstream smoke task.",
        slot: "downstream",
        title: "Downstream task",
      },
    ],
  };
}

function workerEvidenceInputs(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    phase: "worker_evidence",
    workerEvidence: {
      changedFiles: [],
      outcome: "completed",
      runId: "run-upstream",
      slot: "upstream",
      summary: "Worker completed.",
      taskId: "task-upstream",
      workflowRunId: "queue-workflow-run-1",
      ...overrides,
    },
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

function resumePlan(
  overrides: Partial<
    NonNullable<
      Awaited<
        ReturnType<QueueWorkflowPersistencePort["planAgentQueueWorkflowResume"]>
      >
    >
  > = {},
): NonNullable<
  Awaited<ReturnType<QueueWorkflowPersistencePort["planAgentQueueWorkflowResume"]>>
> {
  return {
    actions: [],
    blockers: [],
    nextPhase: "worker_evidence",
    nextStep: "waiting_for_worker_evidence",
    reconciledVariablesJson: null,
    reportSummary: "Queue workflow resume is ready.",
    requiredConfirmation: false,
    requiredFreshGrant: false,
    resumeAvailable: true,
    slotReconciliations: [slotReconciliation()],
    status: "waiting_for_worker_evidence",
    taskSnapshots: [],
    terminalStatus: null,
    workflowRun: workflowRun({
      inputsSnapshotJson: JSON.stringify(validInputs()),
      phase: "worker_evidence",
      slotBindingsJson: JSON.stringify({
        upstream: { runId: "run-upstream", taskId: "task-upstream" },
      }),
      status: "paused",
    }),
    ...overrides,
  };
}

function workerEvidenceResumePlan(overrides: Parameters<typeof resumePlan>[0] = {}) {
  return resumePlan({
    nextPhase: "worker_evidence",
    nextStep: "waiting_for_worker_evidence",
    status: "waiting_for_worker_evidence",
    ...overrides,
  });
}

function reviewResumePlan(overrides: Parameters<typeof resumePlan>[0] = {}) {
  return resumePlan({
    nextPhase: "review",
    nextStep: "review_create_ready",
    requiredFreshGrant: true,
    slotReconciliations: [
      slotReconciliation({
        aggregateEvidenceState: "available",
        aggregateReviewState: "awaiting_review",
        aggregateTicketState: "awaiting_review",
        evidenceBundleId: "bundle-upstream",
        evidenceExists: true,
        runExists: true,
        runId: "run-upstream",
        taskId: "task-upstream",
      }),
    ],
    status: "resume_ready",
    workflowRun: workflowRun({
      inputsSnapshotJson: JSON.stringify(validInputs()),
      phase: "review",
      slotBindingsJson: JSON.stringify({
        upstream: {
          evidenceBundleId: "bundle-upstream",
          runId: "run-upstream",
          taskId: "task-upstream",
        },
      }),
      status: "paused",
    }),
    ...overrides,
  });
}

function slotReconciliation(overrides: Record<string, unknown> = {}) {
  return {
    aggregateDependencyState: "none",
    aggregateEvidenceState: "none",
    aggregateReviewState: "none",
    aggregateTicketState: "review_needed",
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
    runExists: true,
    runId: "run-upstream",
    slot: "upstream",
    taskExists: true,
    taskId: "task-upstream",
    ...overrides,
  };
}

function workerEvidenceStepResult({
  request,
  status = "executed",
  blocker = null,
}: {
  request: Parameters<
    NonNullable<
      QueueWorkflowPersistencePort["executeAgentQueueWorkflowWorkerEvidenceStep"]
    >
  >[0];
  status?: "executed" | "already_applied" | "blocked_precondition";
  blocker?: {
    blockerCode: string;
    blockerMessage: string;
    missingRequiredField: string | null;
  } | null;
}): AgentQueueWorkflowWorkerEvidenceStepResult {
  const success = status === "executed" || status === "already_applied";
  const evidenceBundleId = success ? "bundle-upstream" : null;
  return {
    action: {
      actionId: "workflow-action-evidence",
      actionType: "record_worker_evidence",
      attemptCount: status === "already_applied" ? 1 : 2,
      blockerCode: blocker?.blockerCode ?? null,
      blockerMessage: blocker?.blockerMessage ?? null,
      completedAt: "2026-06-22T00:00:00.000Z",
      createdAt: "2026-06-22T00:00:00.000Z",
      idempotencyKey:
        request.actionIdempotencyKey ??
        `${request.workflowRunId}:record_worker_evidence:${request.slot}:${request.taskId}:${request.runId}`,
      resultRefsJson: "{}",
      startedAt: "2026-06-22T00:00:00.000Z",
      status: success ? "completed" : "blocked",
      stepId: "record_worker_evidence",
      targetRefsJson: "{}",
      updatedAt: "2026-06-22T00:00:00.000Z",
      workflowRunId: request.workflowRunId,
      workspaceId: request.workspaceId,
    },
    aggregate: aggregate({ taskId: request.taskId }),
    binding: evidenceBundleId
      ? {
          evidenceActionId: "workflow-action-evidence",
          evidenceActionIdempotencyKey:
            request.actionIdempotencyKey ??
            `${request.workflowRunId}:record_worker_evidence:${request.slot}:${request.taskId}:${request.runId}`,
          evidenceBundleId,
          evidenceRecordedAt: "2026-06-22T00:00:00.000Z",
          runId: request.runId,
          slot: request.slot,
          taskId: request.taskId,
          workerFinalStatus: "completed",
          workerOutcome: request.outcome,
        }
      : null,
    blockers: blocker ? [blocker] : [],
    conflict: null,
    evidenceBundle: evidenceBundleId
      ? {
          bundleId: evidenceBundleId,
          changedFiles: [],
          changedFilesCount: 0,
          changedFilesSummary: null,
          createdAt: "2026-06-22T00:00:00.000Z",
          errorSummary: null,
          executorWidgetId: null,
          metadataJson: null,
          outcome: request.outcome,
          runLinkId: "run-link-upstream",
          runId: request.runId,
          source: "test",
          summary: "Worker completed.",
          taskId: request.taskId,
          updatedAt: "2026-06-22T00:00:00.000Z",
          validationSummary: null,
          workerId: null,
          workspaceId: request.workspaceId,
        }
      : null,
    nextPhase: success ? "review" : "worker_evidence",
    nextStep: success ? "awaiting_review" : "worker_evidence_blocked",
    status,
    transition: "record_worker_evidence",
    workflowRun: workflowRun({
      currentStep: success ? "awaiting_review" : "worker_evidence_blocked",
      phase: "worker_evidence",
      status: success ? "paused" : "blocked",
      workflowRunId: request.workflowRunId,
      workspaceId: request.workspaceId,
    }),
    workflowRunId: request.workflowRunId,
  };
}

function aggregate({
  taskId = "task-upstream",
}: {
  taskId?: string;
} = {}): AgentQueueItemAggregate {
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
      latestRunLink: true,
      reviewState: true,
      taskRow: true,
      validationState: true,
    },
    evidenceState: "available",
    evidenceSummary: {
      available: true,
      notDurableReason: null,
      source: "test",
      summary: "Worker completed.",
    },
    latestRun: null,
    nextActions: [],
    reviewState: "awaiting_review",
    runSettings: {
      approvalPolicy: "never",
      assignedExecutorWidgetId: null,
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executionWorkspace: "C:/work/hobit",
      sandbox: "read_only",
    },
    taskId,
    ticketState: "awaiting_review",
    title: "Upstream task",
    updatedAt: "2026-06-22T00:00:00.000Z",
    validationState: "not_requested",
    workerRunState: "completed",
    workspaceId: "workspace-1",
  };
}
