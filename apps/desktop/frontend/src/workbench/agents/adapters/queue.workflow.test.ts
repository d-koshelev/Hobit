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
import workflowDebugSource from "./queueBridge/queueBridgeWorkflowDebugCapabilities.ts?raw";
import workflowDiagnosticsSource from "./queueBridge/queueBridgeWorkflowDiagnostics.ts?raw";
import workflowProjectionSource from "./queueBridge/queueBridgeWorkflowProjection.ts?raw";
import workflowRedactionSource from "./queueBridge/queueBridgeWorkflowRedaction.ts?raw";
import workflowRefsSource from "./queueBridge/queueBridgeWorkflowRefs.ts?raw";
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
    const planWorkflowResume = vi.fn(async () => safeWorkerEvidenceResumePlan());
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
    const focusedActionLogResult = await broker.invokeAsync<Record<string, unknown>>(
      request("queue.workflow.readActionLog", {
        actionType: "start_worker",
        includeRefs: true,
        limit: 10,
        slot: "upstream",
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
      actionSummaryCount: 7,
      currentStep: "worker_evidence_failed_unexpected",
      persistentStatus: "failed",
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
    expect(reportResult.result.output).toMatchObject({
      diagnostics: {
        refMaps: {
          runIdsBySlot: {
            upstream: "queue-run_1782257290066506600_169",
          },
          taskIdsBySlot: {
            downstream: "queue_task_wf_50bf4534e054bec3",
            upstream: "queue_task_wf_44a095e817b585b5",
          },
        },
        startWorker: {
          actionId: "workflow-action-start-worker",
          actionPresent: true,
          derivedSlot: "upstream",
          executionTargetHash: "execution-target-hash-queue_local",
          hasExecutionTargetHash: true,
          hasRunId: true,
          hasSettingsHash: true,
          hasSlot: true,
          hasTaskId: true,
          recoveredFromTaskId: true,
          resultRefs: {
            runId: "queue-run_1782257290066506600_169",
          },
          runId: "queue-run_1782257290066506600_169",
          settingsHash: "settings-hash-upstream",
          slot: "upstream",
          targetRefs: {
            executionTargetHash: "execution-target-hash-queue_local",
            settingsHash: "settings-hash-upstream",
            taskId: "queue_task_wf_44a095e817b585b5",
          },
          taskId: "queue_task_wf_44a095e817b585b5",
        },
      },
    });

    const actionLogOutput = actionLogResult.result.output as {
      actions: Array<{ actionType: string; resultRefs: Record<string, unknown> }>;
      total: number;
      truncated: boolean;
    };
    expect(actionLogOutput.total).toBe(7);
    expect(actionLogOutput.truncated).toBe(false);
    expect(actionLogOutput.actions).not.toEqual([]);
    expect(actionLogOutput.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "start_worker",
          resultRefs: expect.objectContaining({
            runId: "queue-run_1782257290066506600_169",
          }),
        }),
        expect.objectContaining({
          actionType: "queue.workflow.runner",
          blockerCode: "failed_unexpected",
          status: "failed",
        }),
        expect.objectContaining({
          actionType: "record_worker_evidence",
          blockerCode: "incomplete_workflow_action_refs",
          status: "blocked",
        }),
      ]),
    );
    expect(focusedActionLogResult.status).toBe("succeeded");
    expect(focusedActionLogResult.result.output).toMatchObject({
      actionTypeFilter: "start_worker",
      ambiguous: false,
      derivedSlot: "upstream",
      focusedAction: {
        actionType: "start_worker",
        derivedSlot: "upstream",
        idempotencyKey:
          "queue-workflow-run-1782257290023621100_163:start_worker:upstream:queue_task_wf_44a095e817b585b5:settings-hash-upstream",
        recoveredFromTaskId: true,
        resultRefs: {
          runId: "queue-run_1782257290066506600_169",
        },
        status: "completed",
        targetRefs: {
          executionTargetHash: "execution-target-hash-queue_local",
          settingsHash: "settings-hash-upstream",
          taskId: "queue_task_wf_44a095e817b585b5",
        },
      },
      includeRefs: true,
      recoveredFromTaskId: true,
      slotFilter: "upstream",
    });

    expect(planResult.result.output).toMatchObject({
      blockers: [
        expect.objectContaining({
          blockerCode: "retryable_worker_evidence_action_repair",
          missingRequiredField: "workerEvidence",
        }),
      ],
      missingRefs: [],
      nextPhase: "worker_evidence",
      nextStep: "waiting_for_worker_evidence",
      resumeStatus: "retryable_worker_evidence_action_repair",
      runIdsBySlot: { upstream: "queue-run_1782257290066506600_169" },
      taskIdsBySlot: { upstream: "queue_task_wf_44a095e817b585b5" },
    });
    expect(planResult.result.output).toMatchObject({
      diagnostics: {
        missingRefs: [],
        reasonIfNotSafe: null,
        safeToRecordWorkerEvidence: true,
        startWorkerRefCheck: {
          actionPresent: true,
          actionStatus: "completed",
          executionTargetHashPresent: true,
          runIdPresent: true,
          settingsHashPresent: true,
          slotPresent: true,
          taskIdPresent: true,
        },
        status: "retryable_worker_evidence_action_repair",
        staleHistory: expect.arrayContaining([
          expect.objectContaining({
            actionType: "queue.workflow.runner",
            blockerCode: "failed_unexpected",
            status: "failed",
          }),
        ]),
        workerState: {
          latestRunId: "queue-run_1782257290066506600_169",
          latestRunStatus: "completed",
          runExists: true,
          runId: "queue-run_1782257290066506600_169",
          taskExists: true,
          taskId: "queue_task_wf_44a095e817b585b5",
          workerRunState: "completed",
        },
      },
    });

    const serialized = JSON.stringify({
      actionLog: actionLogResult.result.output,
      focusedActionLog: focusedActionLogResult.result.output,
      plan: planResult.result.output,
      report: reportResult.result.output,
    });
    expect(serialized).not.toContain("operator-confirmed");
    expect(serialized).not.toContain("confirmationToken");
    expect(serialized).not.toContain("rawProviderTranscript");
    expect(serialized).not.toContain("raw provider transcript");
    expect(
      JSON.stringify(
        (reportResult.result.output as { diagnostics: unknown }).diagnostics,
      ),
    ).not.toContain("...");
    expect(
      JSON.stringify(
        (planResult.result.output as { diagnostics: unknown }).diagnostics,
      ),
    ).not.toContain("...");
    expect(createItem).not.toHaveBeenCalled();
    expect(updateItem).not.toHaveBeenCalled();
    expect(startWorkflowAssignedTask).not.toHaveBeenCalled();
  });

  it("surfaces repaired worker evidence debug reads without active stale blockers", async () => {
    const getWorkflowReport = vi.fn(async () => repairedLiveFailureWorkflowReport());
    const planWorkflowResume = vi.fn(async () => repairedWorkerEvidenceResumePlan());
    const startWorkflowAssignedTask = vi.fn();
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            getQueueControlState: () => ({
              queueEnabled: false,
              workspaceId: "workspace-1",
            }),
            getWorkflowReport,
            planWorkflowResume,
            startWorkflowAssignedTask,
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
    const focusedActionLogResult = await broker.invokeAsync<Record<string, unknown>>(
      request("queue.workflow.readActionLog", {
        actionType: "record_worker_evidence",
        includeRefs: true,
        slot: "upstream",
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
      currentStep: "awaiting_review",
      evidenceBundleIdsBySlot: {
        upstream: "evidence-bundle-live-repaired",
      },
      persistentStatus: "paused",
      diagnostics: {
        refMaps: {
          evidenceBundleIdsBySlot: {
            upstream: "evidence-bundle-live-repaired",
          },
          runIdsBySlot: {
            upstream: "queue-run_1782257290066506600_169",
          },
          taskIdsBySlot: {
            upstream: "queue_task_wf_44a095e817b585b5",
          },
        },
      },
    });
    expect(focusedActionLogResult.status).toBe("succeeded");
    expect(focusedActionLogResult.result.output).toMatchObject({
      actionTypeFilter: "record_worker_evidence",
      ambiguous: false,
      focusedAction: {
        actionType: "record_worker_evidence",
        resultRefs: {
          evidenceBundleId: "evidence-bundle-live-repaired",
          runId: "queue-run_1782257290066506600_169",
          taskId: "queue_task_wf_44a095e817b585b5",
        },
        status: "completed",
        targetRefs: {
          executionTargetHash: "execution-target-hash-queue_local",
          runId: "queue-run_1782257290066506600_169",
          settingsHash: "settings-hash-upstream",
          slot: "upstream",
          taskId: "queue_task_wf_44a095e817b585b5",
          workflowRunId: "queue-workflow-run-1782257290023621100_163",
        },
      },
      includeRefs: true,
      slotFilter: "upstream",
    });
    expect(planResult.result.output).toMatchObject({
      blockers: [],
      nextPhase: "review",
      nextStep: "review_create_ready",
      resumeStatus: "resume_ready",
      diagnostics: {
        reasonIfNotSafe: "planner_not_at_worker_evidence",
        safeToRecordWorkerEvidence: false,
        status: "resume_ready",
        staleHistory: expect.arrayContaining([
          expect.objectContaining({
            actionType: "queue.workflow.runner",
            blockerCode: "failed_unexpected",
            status: "failed",
          }),
        ]),
      },
    });
    const staleHistory = (
      planResult.result.output as {
        diagnostics: { staleHistory: Array<{ actionType: string }> };
      }
    ).diagnostics.staleHistory;
    expect(staleHistory).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionType: "record_worker_evidence" }),
      ]),
    );

    const serialized = JSON.stringify({
      focusedActionLog: focusedActionLogResult.result.output,
      plan: planResult.result.output,
      report: reportResult.result.output,
    });
    expect(serialized).not.toContain("operator-confirmed");
    expect(serialized).not.toContain("confirmationToken");
    expect(serialized).not.toContain("rawProviderTranscript");
    expect(startWorkflowAssignedTask).not.toHaveBeenCalled();
  });

  it("returns structured action-log no-match and ambiguity diagnostics", async () => {
    const getWorkflowReport = vi.fn(async () =>
      workflowReport({
        actions: [
          liveFailureAction({
            actionId: "workflow-action-start-worker-a",
            actionType: "start_worker",
            idempotencyKey: "workflow-run-1:start_worker:upstream:a",
            resultRefsJson: JSON.stringify({
              runId: "run-a",
              slot: "upstream",
              taskId: "task-upstream",
            }),
            stepId: "start_worker_upstream",
            targetRefsJson: JSON.stringify({
              executionTargetHash: "execution-target-hash-a",
              settingsHash: "settings-hash-a",
              slot: "upstream",
              taskId: "task-upstream",
            }),
          }),
          liveFailureAction({
            actionId: "workflow-action-start-worker-b",
            actionType: "start_worker",
            idempotencyKey: "workflow-run-1:start_worker:upstream:b",
            resultRefsJson: JSON.stringify({
              runId: "run-b",
              slot: "upstream",
              taskId: "task-upstream",
            }),
            stepId: "start_worker_upstream_retry",
            targetRefsJson: JSON.stringify({
              executionTargetHash: "execution-target-hash-b",
              settingsHash: "settings-hash-b",
              slot: "upstream",
              taskId: "task-upstream",
            }),
          }),
        ],
      }),
    );
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            getQueueControlState: () => ({
              queueEnabled: false,
              workspaceId: "workspace-1",
            }),
            getWorkflowReport,
          }),
        ),
      ),
      policy: { requireDryRunBeforeSideEffectingInvoke: false },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    });

    const ambiguous = await broker.invokeAsync<Record<string, unknown>>(
      request("queue.workflow.readActionLog", {
        actionType: "start_worker",
        includeRefs: true,
        slot: "upstream",
        workflowRunId: "workflow-run-1",
      }),
    );
    const noMatch = await broker.invokeAsync<Record<string, unknown>>(
      request("queue.workflow.readActionLog", {
        actionType: "record_worker_evidence",
        includeRefs: true,
        slot: "downstream",
        workflowRunId: "workflow-run-1",
      }),
    );

    expect(ambiguous.result.output).toMatchObject({
      ambiguous: true,
      blocker: {
        blockerCode: "ambiguous_matching_action",
      },
      focusedAction: null,
      matchingActions: [
        expect.objectContaining({
          actionId: "workflow-action-start-worker-a",
          resultRefs: expect.objectContaining({
            runId: "run-a",
            slot: "upstream",
          }),
        }),
        expect.objectContaining({
          actionId: "workflow-action-start-worker-b",
          resultRefs: expect.objectContaining({
            runId: "run-b",
            slot: "upstream",
          }),
        }),
      ],
    });
    expect(noMatch.result.output).toMatchObject({
      ambiguous: false,
      blocker: {
        blockerCode: "no_matching_action",
        missingRequiredField: "actionType",
        slot: "downstream",
      },
      focusedAction: null,
      matchingActions: [],
    });
    expect(JSON.stringify(ambiguous.result.output)).not.toContain(
      "confirmationToken",
    );
    expect(JSON.stringify(ambiguous.result.output)).not.toContain("raw log");
  });

  it("marks worker evidence retry safe only after completed worker refs are complete", async () => {
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            getQueueControlState: () => ({
              queueEnabled: false,
              workspaceId: "workspace-1",
            }),
            planWorkflowResume: vi.fn(async () =>
              safeWorkerEvidenceResumePlan(),
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
      request("queue.workflow.planResume", {
        workflowRunId: "queue-workflow-run-1782257290023621100_163",
      }),
    );

    expect(result.result.output).toMatchObject({
      diagnostics: {
        reasonIfNotSafe: null,
        safeToRecordWorkerEvidence: true,
        startWorkerRefCheck: {
          missingRefs: [],
          runIdPresent: true,
          settingsHashPresent: true,
          taskIdPresent: true,
        },
        status: "retryable_worker_evidence_action_repair",
        workerState: {
          latestRunStatus: "completed",
          workerRunState: "completed",
        },
      },
    });
    expect(
      JSON.stringify(
        (result.result.output as { diagnostics: unknown }).diagnostics,
      ),
    ).not.toContain("...");
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
    for (const source of [
      adapterSource,
      capabilitySource,
      workflowDebugSource,
      workflowDiagnosticsSource,
      workflowProjectionSource,
      workflowRedactionSource,
      workflowRefsSource,
    ]) {
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
      actionSummaryCount: 7,
      nextPhase: "worker_evidence",
      nextStep: "waiting_for_worker_evidence",
    }),
    currentStep: "worker_evidence_failed_unexpected",
    completedAt: "2026-06-23T12:06:00.000Z",
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
    status: "failed",
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
          runId: "queue-run_1782257290066506600_169",
        }),
        stepId: "start_worker_upstream",
        targetRefsJson: JSON.stringify({
          executionTargetHash: "execution-target-hash-queue_local",
          settingsHash: "settings-hash-upstream",
          taskId: "queue_task_wf_44a095e817b585b5",
          workflowRunId: "queue-workflow-run-1782257290023621100_163",
        }),
      }),
      liveFailureAction({
        actionId: "workflow-action-runner-worker-evidence",
        actionType: "queue.workflow.runner",
        blockerCode: "failed_unexpected",
        blockerMessage:
          "Queue workflow worker evidence recording failed unexpectedly",
        idempotencyKey:
          "queue-workflow-run-1782257290023621100_163:queue.workflow.runner:worker_evidence:live-failure-smoke-001",
        resultRefsJson: JSON.stringify({
          phase: "worker_evidence",
          runnerStatus: "failed_unexpected",
          summary:
            "Queue workflow worker evidence recording failed unexpectedly",
        }),
        status: "failed",
        stepId: "runner.worker_evidence",
        targetRefsJson: JSON.stringify({
          phase: "worker_evidence",
          requestId: "live-failure-smoke-001",
          workflowId: "dependency_failure_smoke",
        }),
      }),
      liveFailureAction({
        actionId: "workflow-action-record-worker-evidence-stale",
        actionType: "record_worker_evidence",
        blockerCode: "incomplete_workflow_action_refs",
        blockerMessage:
          "Workflow action refs are incomplete; worker evidence cannot be recorded yet.",
        completedAt: null,
        idempotencyKey:
          "queue-workflow-run-1782257290023621100_163:record_worker_evidence:upstream:queue_task_wf_44a095e817b585b5:queue-run_1782257290066506600_169",
        resultRefsJson: JSON.stringify({
          commandStatus: "blocked",
        }),
        status: "blocked",
        stepId: "record_worker_evidence",
        targetRefsJson: JSON.stringify({
          workflowRunId: "queue-workflow-run-1782257290023621100_163",
        }),
      }),
    ],
    reportSummary:
      "Queue workflow run failed during worker_evidence before durable evidence mutation.",
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

function safeWorkerEvidenceResumePlan(): AgentQueueWorkflowResumePlan {
  return {
    ...liveFailureResumePlan(),
    blockers: [
      {
        blockerCode: "retryable_worker_evidence_action_repair",
        blockerMessage:
          "Queue workflow has stale non-mutating record_worker_evidence history with incomplete refs; retry with corrected typed workerEvidence is allowed.",
        completionDecisionId: null,
        evidenceBundleId: null,
        failureDecisionId: null,
        messageId: null,
        missingRequiredField: "workerEvidence",
        runId: "queue-run_1782257290066506600_169",
        slot: "upstream",
        taskId: "queue_task_wf_44a095e817b585b5",
      },
    ],
    nextPhase: "worker_evidence",
    nextStep: "waiting_for_worker_evidence",
    reportSummary:
      "Resume planning found a retryable worker evidence failure before durable evidence mutation.",
    resumeAvailable: true,
    slotReconciliations: [
      {
        ...liveFailureResumePlan().slotReconciliations[0],
        aggregateEvidenceState: "missing",
        aggregateTicketState: "running",
        blockerCode: null,
        runExists: true,
        taskExists: true,
      },
    ],
    status: "retryable_worker_evidence_action_repair",
    taskSnapshots: [
      {
        ...liveFailureResumePlan().taskSnapshots[0],
        latestRunStatus: "completed",
        workerRunState: "completed",
      },
    ],
  };
}

function repairedLiveFailureWorkflowRun(): AgentQueueWorkflowRun {
  return workflowRun({
    ...liveFailureWorkflowRun(),
    actionLogSummaryJson: JSON.stringify({
      actionSummaryCount: 7,
      nextPhase: "review",
      nextStep: "review_create_ready",
    }),
    completedAt: null,
    currentStep: "awaiting_review",
    slotBindingsJson: JSON.stringify({
      downstream: {
        taskId: "queue_task_wf_50bf4534e054bec3",
        taskSpecHash: "task-spec-hash-downstream",
      },
      upstream: {
        evidenceActionId: "workflow-action-record-worker-evidence-stale",
        evidenceActionIdempotencyKey:
          "queue-workflow-run-1782257290023621100_163:record_worker_evidence:upstream:queue_task_wf_44a095e817b585b5:queue-run_1782257290066506600_169",
        evidenceBundleId: "evidence-bundle-live-repaired",
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
    status: "paused",
    variablesJson: JSON.stringify({
      evidenceBundleIdsBySlot: {
        upstream: "evidence-bundle-live-repaired",
      },
      runIdsBySlot: {
        upstream: "queue-run_1782257290066506600_169",
      },
      taskIdsBySlot: {
        downstream: "queue_task_wf_50bf4534e054bec3",
        upstream: "queue_task_wf_44a095e817b585b5",
      },
    }),
  });
}

function repairedLiveFailureWorkflowReport(): AgentQueueWorkflowReport {
  return workflowReport({
    actions: [
      ...liveFailureWorkflowReport().actions.filter(
        (action) =>
          action.actionId !== "workflow-action-record-worker-evidence-stale",
      ),
      repairedRecordWorkerEvidenceAction(),
    ],
    reportSummary:
      "Queue workflow worker evidence was repaired and recorded; review is ready.",
    resumeAvailable: true,
    resumeStatus: "resume_ready",
    workflowRun: repairedLiveFailureWorkflowRun(),
  });
}

function repairedRecordWorkerEvidenceAction(): AgentQueueWorkflowAction {
  return liveFailureAction({
    actionId: "workflow-action-record-worker-evidence-stale",
    actionType: "record_worker_evidence",
    blockerCode: null,
    blockerMessage: null,
    completedAt: "2026-06-23T12:07:00.000Z",
    idempotencyKey:
      "queue-workflow-run-1782257290023621100_163:record_worker_evidence:upstream:queue_task_wf_44a095e817b585b5:queue-run_1782257290066506600_169",
    resultRefsJson: JSON.stringify({
      evidenceBundleId: "evidence-bundle-live-repaired",
      evidenceStatus: "available",
      outcome: "completed",
      runId: "queue-run_1782257290066506600_169",
      taskId: "queue_task_wf_44a095e817b585b5",
      workerFinalStatus: "completed",
    }),
    status: "completed",
    stepId: "record_worker_evidence",
    targetRefsJson: JSON.stringify({
      executionTargetHash: "execution-target-hash-queue_local",
      runId: "queue-run_1782257290066506600_169",
      settingsHash: "settings-hash-upstream",
      slot: "upstream",
      taskId: "queue_task_wf_44a095e817b585b5",
      workflowRunId: "queue-workflow-run-1782257290023621100_163",
    }),
    updatedAt: "2026-06-23T12:07:00.000Z",
  });
}

function repairedWorkerEvidenceResumePlan(): AgentQueueWorkflowResumePlan {
  return {
    ...safeWorkerEvidenceResumePlan(),
    actions: repairedLiveFailureWorkflowReport().actions,
    blockers: [],
    nextPhase: "review",
    nextStep: "review_create_ready",
    reportSummary:
      "Queue workflow worker evidence is recorded; review creation is ready.",
    resumeAvailable: true,
    slotReconciliations: [
      {
        ...safeWorkerEvidenceResumePlan().slotReconciliations[0],
        aggregateEvidenceState: "available",
        evidenceBundleId: "evidence-bundle-live-repaired",
        evidenceExists: true,
      },
    ],
    status: "resume_ready",
    taskSnapshots: [
      {
        ...safeWorkerEvidenceResumePlan().taskSnapshots[0],
        evidenceState: "available",
        latestEvidenceBundleId: "evidence-bundle-live-repaired",
        latestRunStatus: "completed",
        workerRunState: "completed",
      },
    ],
    workflowRun: repairedLiveFailureWorkflowRun(),
  };
}
