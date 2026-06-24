import { describe, expect, it, vi } from "vitest";

import {
  createActionRequest,
  createHobitAgentActionBroker,
} from "../broker";
import {
  createHobitAgentCapabilityRegistry,
  HOBIT_AGENT_INITIAL_CAPABILITIES,
} from "../capabilities";
import {
  QUEUE_CAPABILITY_CONTRACT_INVENTORY,
} from "../capabilities/queueCapabilityContracts";
import {
  HOBIT_TEST_AGENT_CAPABILITIES,
} from "../runtime";
import adapterSource from "./workspaceAgentQueueBridgeAdapter.ts?raw";
import capabilitySource from "./queueAgentCapabilities.ts?raw";
import { createQueueAgentActionHandlers } from "./queueAgentActionHandlers";
import { createWorkspaceAgentQueueBridgeAdapterApi } from "./workspaceAgentQueueBridgeAdapter";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import type {
  AgentQueueWorkflowAction,
  AgentQueueWorkflowReport,
  AgentQueueWorkflowResumePlan,
  AgentQueueWorkflowRun,
} from "../../../workspace/types";

describe("queue.workflow debug read capabilities", () => {
  it("registers every workflow debug read as Queue read risk without confirmation", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const capabilityIds = [
      "queue.workflow.get",
      "queue.workflow.list",
      "queue.workflow.getReport",
      "queue.workflow.planResume",
      "queue.workflow.readActionLog",
    ];

    for (const capabilityId of capabilityIds) {
      const capability = registry.capabilities.find(
        (candidate) => candidate.id === capabilityId,
      );
      const contract = QUEUE_CAPABILITY_CONTRACT_INVENTORY.find(
        (candidate) => candidate.capabilityId === capabilityId,
      );

      expect(capability).toMatchObject({
        confirmationRequirement: "none",
        ownerSurface: "Agent Queue",
        sideEffectLevel: "read",
      });
      expect(contract).toMatchObject({
        backing: "backend_backed",
        readOnly: true,
        riskClass: "read",
        sideEffectLevel: "read",
      });
    }
  });

  it("handles get, list, report, planResume, and readActionLog through the broker", async () => {
    const getWorkflow = vi.fn(async () => workflowRun());
    const listWorkflows = vi.fn(async () => [workflowRun()]);
    const getWorkflowReport = vi.fn(async () => workflowReport());
    const planWorkflowResume = vi.fn(async () => workflowResumePlan());
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            getQueueControlState: () => ({
              queueEnabled: false,
              workspaceId: "workspace-1",
            }),
            getWorkflow,
            getWorkflowReport,
            listWorkflows,
            planWorkflowResume,
          }),
        ),
      ),
      policy: { requireDryRunBeforeSideEffectingInvoke: false },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    });

    const getResult = await broker.invokeAsync(
      request("queue.workflow.get", { workflowRunId: "workflow-run-1" }),
    );
    const listResult = await broker.invokeAsync(
      request("queue.workflow.list", { limit: 10 }),
    );
    const reportResult = await broker.invokeAsync(
      request("queue.workflow.getReport", {
        workflowRunId: "workflow-run-1",
      }),
    );
    const planResult = await broker.invokeAsync(
      request("queue.workflow.planResume", {
        expectedVersion: 4,
        workflowRunId: "workflow-run-1",
      }),
    );
    const actionLogResult = await broker.invokeAsync(
      request("queue.workflow.readActionLog", {
        limit: 10,
        workflowRunId: "workflow-run-1",
      }),
    );

    expect(getResult.status).toBe("succeeded");
    expect(listResult.status).toBe("succeeded");
    expect(reportResult.status).toBe("succeeded");
    expect(planResult.status).toBe("succeeded");
    expect(actionLogResult.status).toBe("succeeded");
    expect(reportResult.result.output).toMatchObject({
      evidenceBundleIdsBySlot: { upstream: "evidence-bundle-1" },
      messageIdsBySlot: { upstream: "review-message-1" },
      runIdsBySlot: { upstream: "run-upstream-1" },
      taskIdsBySlot: { upstream: "task-upstream" },
    });
    expect(planResult.result.output).toMatchObject({
      nextPhase: "review",
      nextStep: "ack_review_message",
      requiredConfirmation: false,
      requiredFreshGrant: true,
    });
    expect(actionLogResult.result.output).toMatchObject({
      actions: [{ actionType: "record_worker_evidence" }],
      truncated: false,
    });
    expect(JSON.stringify(reportResult.result.output)).not.toContain(
      "operator-confirmed",
    );
    expect(JSON.stringify(actionLogResult.result.output)).not.toContain(
      "raw provider transcript",
    );
  });

  it("surfaces live failure smoke workflow report, action log, and resume plan refs", async () => {
    const createItem = vi.fn();
    const updateItem = vi.fn();
    const startWorkflowAssignedTask = vi.fn();
    const getWorkflowReport = vi.fn(async () => liveFailureWorkflowReport());
    const planWorkflowResume = vi.fn(async () => liveFailureResumePlan());
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            createItem,
            getQueueControlState: () => ({
              queueEnabled: false,
              workspaceId: "workspace-1",
            }),
            getWorkflowReport,
            planWorkflowResume,
            startWorkflowAssignedTask,
            updateItem,
          } as Partial<WorkspaceAgentQueueBridge>),
        ),
      ),
      policy: { requireDryRunBeforeSideEffectingInvoke: false },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    });

    const reportResult = await broker.invokeAsync<Record<string, unknown>>(
      request("queue.workflow.getReport", {
        workflowRunId: "queue-workflow-run-1782257290023621100_163",
      }),
    );
    const actionLogResult = await broker.invokeAsync<Record<string, unknown>>(
      request("queue.workflow.readActionLog", {
        limit: 10,
        workflowRunId: "queue-workflow-run-1782257290023621100_163",
      }),
    );
    const planResult = await broker.invokeAsync<Record<string, unknown>>(
      request("queue.workflow.planResume", {
        workflowRunId: "queue-workflow-run-1782257290023621100_163",
      }),
    );

    expect(reportResult.status).toBe("succeeded");
    expect(reportResult.result.output).toMatchObject({
      actionSummaryCount: 5,
      currentStep: "record_worker_evidence",
      persistentStatus: "paused",
      phase: "worker_evidence",
      requestId: "queue-workflow-request-live-failure",
      runIdsBySlot: { upstream: "queue-run_1782257290066506600_169" },
      slotBindings: {
        downstream: {
          taskId: "queue_task_wf_50bf4534e054bec3",
          taskSpecHash: "task-spec-hash-downstream",
        },
        upstream: {
          executionTarget: {
            kind: "queue_local",
            providerId: "codex",
          },
          executionTargetHash: "execution-target-hash-queue_local",
          runId: "queue-run_1782257290066506600_169",
          settingsHash: "settings-hash-upstream",
          taskId: "queue_task_wf_44a095e817b585b5",
          taskSpecHash: "task-spec-hash-upstream",
        },
      },
      taskIdsBySlot: {
        downstream: "queue_task_wf_50bf4534e054bec3",
        upstream: "queue_task_wf_44a095e817b585b5",
      },
      workflowRunId: "queue-workflow-run-1782257290023621100_163",
    });

    const actionLogOutput = actionLogResult.result.output as {
      actions: Array<{ actionType: string; resultRefs: Record<string, unknown> }>;
      total: number;
      truncated: boolean;
    };
    expect(actionLogOutput.total).toBe(5);
    expect(actionLogOutput.truncated).toBe(false);
    expect(actionLogOutput.actions).not.toEqual([]);
    expect(actionLogOutput.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "start_worker",
          resultRefs: expect.objectContaining({
            runId: "queue-run_1782257290066506600_169",
            slot: "upstream",
            taskId: "queue_task_wf_44a095e817b585b5",
          }),
        }),
      ]),
    );

    expect(planResult.result.output).toMatchObject({
      blockers: [
        expect.objectContaining({
          blockerCode: "incomplete_workflow_action_refs",
          missingRequiredField: "resultRefs.evidenceBundleId",
          runId: "queue-run_1782257290066506600_169",
          slot: "upstream",
          taskId: "queue_task_wf_44a095e817b585b5",
        }),
      ],
      missingRefs: [
        expect.objectContaining({
          missingRequiredField: "resultRefs.evidenceBundleId",
        }),
      ],
      nextPhase: "worker_evidence",
      nextStep: "record_worker_evidence",
      resumeStatus: "blocked_incomplete_workflow_action_refs",
      runIdsBySlot: { upstream: "queue-run_1782257290066506600_169" },
      taskIdsBySlot: { upstream: "queue_task_wf_44a095e817b585b5" },
    });

    const serialized = JSON.stringify({
      actionLog: actionLogResult.result.output,
      plan: planResult.result.output,
      report: reportResult.result.output,
    });
    expect(serialized).not.toContain("operator-confirmed");
    expect(serialized).not.toContain("confirmationToken");
    expect(serialized).not.toContain("rawProviderTranscript");
    expect(serialized).not.toContain("raw provider transcript");
    expect(createItem).not.toHaveBeenCalled();
    expect(updateItem).not.toHaveBeenCalled();
    expect(startWorkflowAssignedTask).not.toHaveBeenCalled();
  });

  it("returns a clear empty action log only when no workflow actions exist", async () => {
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            getQueueControlState: () => ({
              queueEnabled: false,
              workspaceId: "workspace-1",
            }),
            getWorkflowReport: vi.fn(async () =>
              workflowReport({ actions: [] }),
            ),
          }),
        ),
      ),
      policy: { requireDryRunBeforeSideEffectingInvoke: false },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    });

    const result = await broker.invokeAsync<Record<string, unknown>>(
      request("queue.workflow.readActionLog", {
        limit: 10,
        workflowRunId: "workflow-run-1",
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      actions: [],
      total: 0,
      truncated: false,
    });
  });

  it("keeps workflow debug reads free of Queue UI and visual shell imports", () => {
    for (const source of [adapterSource, capabilitySource]) {
      expect(source).not.toContain("AgentQueueV2Board");
      expect(source).not.toContain("AgentQueuePlaceholderWidget");
      expect(source).not.toContain("ModuleShell");
      expect(source).not.toContain("tokens.css");
      expect(source).not.toContain("widget.css");
    }
  });
});

function request(capabilityId: string, input: unknown) {
  return createActionRequest({
    agentId: "test.agentA",
    agentRoleId: "test_harness",
    capabilityId,
    createdAt: "2026-06-23T12:00:00.000Z",
    dryRun: false,
    input,
    requestId: `request-${capabilityId}`,
  });
}

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge>,
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(),
    getSnapshot: vi.fn(),
    updateItem: vi.fn(),
    ...overrides,
  } as unknown as WorkspaceAgentQueueBridge;
}

function workflowRun(
  overrides: Partial<AgentQueueWorkflowRun> = {},
): AgentQueueWorkflowRun {
  return {
    actionLogSummaryJson: null,
    actorId: "workspace-agent:test",
    blockerReason: null,
    completedAt: null,
    createdAt: "2026-06-23T12:00:00.000Z",
    currentStep: "record_worker_evidence",
    grantSummaryJson: null,
    idempotencyKeysJson: null,
    inputsSnapshotJson: null,
    mutationRefsJson: null,
    pauseReason: null,
    phase: "worker_evidence",
    requestHash: "workflow-request-hash",
    requestId: "workflow-request-1",
    schemaVersion: 1,
    slotBindingsJson: JSON.stringify({
      upstream: {
        evidenceBundleId: "evidence-bundle-1",
        messageId: "review-message-1",
        runId: "run-upstream-1",
        taskId: "task-upstream",
      },
    }),
    status: "paused",
    updatedAt: "2026-06-23T12:05:00.000Z",
    variablesJson: null,
    version: 4,
    workflowId: "dependency_acceptance_smoke",
    workflowRunId: "workflow-run-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function workflowAction(
  overrides: Partial<AgentQueueWorkflowAction> = {},
): AgentQueueWorkflowAction {
  return {
    actionId: "workflow-action-1",
    actionType: "record_worker_evidence",
    attemptCount: 1,
    blockerCode: null,
    blockerMessage: null,
    completedAt: "2026-06-23T12:04:00.000Z",
    createdAt: "2026-06-23T12:03:00.000Z",
    idempotencyKey: "workflow-run-1:upstream:evidence",
    resultRefsJson: JSON.stringify({
      confirmationToken: "operator-confirmed",
      evidenceBundleId: "evidence-bundle-1",
      messageId: "review-message-1",
      rawProviderTranscript: "raw provider transcript",
      runId: "run-upstream-1",
      slot: "upstream",
      taskId: "task-upstream",
    }),
    startedAt: "2026-06-23T12:03:00.000Z",
    status: "completed",
    stepId: "record_worker_evidence",
    targetRefsJson: JSON.stringify({
      slot: "upstream",
      taskId: "task-upstream",
    }),
    updatedAt: "2026-06-23T12:04:00.000Z",
    workflowRunId: "workflow-run-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function workflowReport(
  overrides: Partial<AgentQueueWorkflowReport> = {},
): AgentQueueWorkflowReport {
  return {
    actions: [workflowAction()],
    reportSummary: "Queue workflow report.",
    resumeAvailable: true,
    resumeStatus: "plan_required",
    workflowRun: workflowRun(),
    ...overrides,
  };
}

function workflowResumePlan(): AgentQueueWorkflowResumePlan {
  return {
    actions: [workflowAction()],
    blockers: [],
    nextPhase: "review",
    nextStep: "ack_review_message",
    reconciledVariablesJson: null,
    reportSummary: "Queue workflow resume plan.",
    requiredConfirmation: false,
    requiredFreshGrant: true,
    resumeAvailable: true,
    slotReconciliations: [],
    status: "resume_read_only_ready",
    taskSnapshots: [],
    terminalStatus: null,
    workflowRun: workflowRun(),
  };
}

function liveFailureWorkflowRun(): AgentQueueWorkflowRun {
  return workflowRun({
    actionLogSummaryJson: JSON.stringify({
      actionSummaryCount: 5,
      nextPhase: "worker_evidence",
      nextStep: "record_worker_evidence",
    }),
    currentStep: "record_worker_evidence",
    phase: "worker_evidence",
    requestId: "queue-workflow-request-live-failure",
    slotBindingsJson: JSON.stringify({
      downstream: {
        taskId: "queue_task_wf_50bf4534e054bec3",
        taskSpecHash: "task-spec-hash-downstream",
      },
      upstream: {
        executionTarget: {
          kind: "queue_local",
          providerId: "codex",
        },
        executionTargetHash: "execution-target-hash-queue_local",
        runId: "queue-run_1782257290066506600_169",
        settingsHash: "settings-hash-upstream",
        taskId: "queue_task_wf_44a095e817b585b5",
        taskSpecHash: "task-spec-hash-upstream",
      },
    }),
    variablesJson: JSON.stringify({
      runIdsBySlot: {
        upstream: "queue-run_1782257290066506600_169",
      },
      taskIdsBySlot: {
        downstream: "queue_task_wf_50bf4534e054bec3",
        upstream: "queue_task_wf_44a095e817b585b5",
      },
    }),
    workflowRunId: "queue-workflow-run-1782257290023621100_163",
  });
}

function liveFailureWorkflowReport(): AgentQueueWorkflowReport {
  return workflowReport({
    actions: [
      liveFailureAction({
        actionId: "workflow-action-create-upstream",
        actionType: "create_task",
        idempotencyKey:
          "queue-workflow-run-1782257290023621100_163:create_task:upstream:task-spec-hash-upstream",
        resultRefsJson: JSON.stringify({
          slot: "upstream",
          taskId: "queue_task_wf_44a095e817b585b5",
        }),
        stepId: "create_upstream",
        targetRefsJson: JSON.stringify({ slot: "upstream" }),
      }),
      liveFailureAction({
        actionId: "workflow-action-create-downstream",
        actionType: "create_task",
        idempotencyKey:
          "queue-workflow-run-1782257290023621100_163:create_task:downstream:task-spec-hash-downstream",
        resultRefsJson: JSON.stringify({
          slot: "downstream",
          taskId: "queue_task_wf_50bf4534e054bec3",
        }),
        stepId: "create_downstream",
        targetRefsJson: JSON.stringify({ slot: "downstream" }),
      }),
      liveFailureAction({
        actionId: "workflow-action-setup-upstream",
        actionType: "update_run_settings",
        idempotencyKey:
          "queue-workflow-run-1782257290023621100_163:update_run_settings:upstream:settings-hash-upstream",
        resultRefsJson: JSON.stringify({
          executionTargetHash: "execution-target-hash-queue_local",
          settingsHash: "settings-hash-upstream",
          slot: "upstream",
          taskId: "queue_task_wf_44a095e817b585b5",
        }),
        stepId: "setup_upstream",
        targetRefsJson: JSON.stringify({
          slot: "upstream",
          taskId: "queue_task_wf_44a095e817b585b5",
        }),
      }),
      liveFailureAction({
        actionId: "workflow-action-promote-upstream",
        actionType: "promote_task",
        idempotencyKey:
          "queue-workflow-run-1782257290023621100_163:promote_task:upstream:task-spec-hash-upstream:settings-hash-upstream",
        resultRefsJson: JSON.stringify({
          slot: "upstream",
          taskId: "queue_task_wf_44a095e817b585b5",
        }),
        stepId: "promote_upstream",
        targetRefsJson: JSON.stringify({
          slot: "upstream",
          taskId: "queue_task_wf_44a095e817b585b5",
        }),
      }),
      liveFailureAction({
        actionId: "workflow-action-start-worker",
        actionType: "start_worker",
        idempotencyKey:
          "queue-workflow-run-1782257290023621100_163:start_worker:upstream:queue_task_wf_44a095e817b585b5:settings-hash-upstream",
        resultRefsJson: JSON.stringify({
          confirmationToken: "operator-confirmed",
          rawProviderTranscript: "raw provider transcript",
          runId: "queue-run_1782257290066506600_169",
          slot: "upstream",
          taskId: "queue_task_wf_44a095e817b585b5",
        }),
        stepId: "start_worker_upstream",
        targetRefsJson: JSON.stringify({
          executionTargetHash: "execution-target-hash-queue_local",
          settingsHash: "settings-hash-upstream",
          slot: "upstream",
          taskId: "queue_task_wf_44a095e817b585b5",
        }),
      }),
    ],
    reportSummary:
      "Queue workflow run paused at worker_evidence after create/setup/start.",
    workflowRun: liveFailureWorkflowRun(),
  });
}

function liveFailureAction(
  overrides: Partial<AgentQueueWorkflowAction>,
): AgentQueueWorkflowAction {
  return workflowAction({
    completedAt: "2026-06-23T12:05:00.000Z",
    createdAt: "2026-06-23T12:01:00.000Z",
    startedAt: "2026-06-23T12:01:00.000Z",
    status: "completed",
    updatedAt: "2026-06-23T12:05:00.000Z",
    workflowRunId: "queue-workflow-run-1782257290023621100_163",
    ...overrides,
  });
}

function liveFailureResumePlan(): AgentQueueWorkflowResumePlan {
  return {
    actions: liveFailureWorkflowReport().actions,
    blockers: [
      {
        blockerCode: "incomplete_workflow_action_refs",
        blockerMessage:
          "Workflow action refs are incomplete; worker evidence cannot be recorded yet.",
        completionDecisionId: null,
        evidenceBundleId: null,
        failureDecisionId: null,
        messageId: null,
        missingRequiredField: "resultRefs.evidenceBundleId",
        runId: "queue-run_1782257290066506600_169",
        slot: "upstream",
        taskId: "queue_task_wf_44a095e817b585b5",
      },
    ],
    nextPhase: "worker_evidence",
    nextStep: "record_worker_evidence",
    reconciledVariablesJson: JSON.stringify({
      runIdsBySlot: {
        upstream: "queue-run_1782257290066506600_169",
      },
      taskIdsBySlot: {
        upstream: "queue_task_wf_44a095e817b585b5",
      },
    }),
    reportSummary:
      "Resume planning blocked on incomplete workflow action refs.",
    requiredConfirmation: false,
    requiredFreshGrant: false,
    resumeAvailable: false,
    slotReconciliations: [
      {
        aggregateDependencyState: "waiting",
        aggregateEvidenceState: "missing",
        aggregateReviewState: "none",
        aggregateTicketState: "running",
        blockerCode: "incomplete_workflow_action_refs",
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
        runId: "queue-run_1782257290066506600_169",
        slot: "upstream",
        taskExists: true,
        taskId: "queue_task_wf_44a095e817b585b5",
      },
    ],
    status: "blocked_incomplete_workflow_action_refs",
    taskSnapshots: [
      {
        commitState: "unknown",
        dependencyState: "none",
        evidenceState: "missing",
        latestCompletionDecisionId: null,
        latestEvidenceBundleId: null,
        latestFailureDecisionId: null,
        latestReviewMessageId: null,
        latestReviewMessageStatus: null,
        latestRunId: "queue-run_1782257290066506600_169",
        latestRunStatus: "running",
        reviewState: "none",
        taskId: "queue_task_wf_44a095e817b585b5",
        ticketState: "running",
        validationState: "unknown",
        workerRunState: "running",
      },
    ],
    terminalStatus: null,
    workflowRun: liveFailureWorkflowRun(),
  };
}
