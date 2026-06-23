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

function workflowRun(): AgentQueueWorkflowRun {
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
  };
}

function workflowAction(): AgentQueueWorkflowAction {
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
  };
}

function workflowReport(): AgentQueueWorkflowReport {
  return {
    actions: [workflowAction()],
    reportSummary: "Queue workflow report.",
    resumeAvailable: true,
    resumeStatus: "plan_required",
    workflowRun: workflowRun(),
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
