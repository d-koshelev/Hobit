import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  clickButton,
  lastAssistantMessageText,
  renderWidget,
  setTextareaValue,
} from "./InteractiveAgentPlaceholderWidget.test-utils";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import {
  createFakeAgentProvider,
  fakeAgentProviderScriptForScenario,
  type FakeAgentProviderScenario,
  type FakeAgentProviderScriptStep,
} from "./agentRuntime";
import type { QueueWorkflowPersistencePort } from "./agents/modules";
import type {
  AgentQueueItemAggregate,
  AgentQueueWorkflowRun,
} from "../workspace/types";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";

describe("WorkspaceAgent AgentProvider", () => {
  it("uses FakeAgentProvider for final answer turns without Codex", async () => {
    renderWidget({
      workspaceAgentProvider: fakeProvider("final_answer"),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Answer through fake provider.");
    await flushAsync();

    expect(lastAssistantMessageText()).toBe("Fake provider final answer.");
  });

  it("uses FakeAgentProvider for valid action requests", async () => {
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProvider("valid_action_request"),
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("List Queue items through fake provider.");
    await flushAsync();

    expect(listItemAggregates).toHaveBeenCalledTimes(1);
    expect(allAssistantMessageText()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Action 1/16: queue.items.list"),
        expect.stringContaining("Queue items listed."),
      ]),
    );
  });

  it("stops invalid FakeAgentProvider action requests before broker execution", async () => {
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProvider("invalid_action_request"),
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Emit an invalid fake action.");
    await flushAsync();

    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Invalid Hobit action request.");
    expect(lastAssistantMessageText()).toContain(
      "Stopped: invalid or unsupported action envelope.",
    );
  });

  it("reports FakeAgentProvider workflow runner blockers without Queue reads", async () => {
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProvider("valid_workflow_request"),
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceAgentQueueWorkflowPersistence: workflowPersistence(),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Emit a fake workflow request.");
    await flushAsync();

    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Queue workflow runner report. Status: paused.",
    );
    expect(lastAssistantMessageText()).toContain("explicit existing task ids");
  });

  it("runs FakeAgentProvider workflow requests with explicit ids through typed Queue reads", async () => {
    const getItemAggregate = vi.fn(
      async ({ taskId }: { taskId: string }) => aggregate({ taskId }),
    );
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProviderFromScript([
        {
          text: JSON.stringify(explicitWorkflowRequest()),
          type: "workflow_request_detected",
        },
      ]),
      workspaceAgentQueueBridge: queueBridge({
        getItemAggregate,
        listItemAggregates,
      }),
      workspaceAgentQueueWorkflowPersistence: workflowPersistence(),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Emit a fake workflow request with explicit ids.");
    await flushAsync(20);

    expect(getItemAggregate).toHaveBeenCalledTimes(4);
    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Queue workflow runner report. Status: completed.",
    );
    expect(lastAssistantMessageText()).toContain("Task ids:");
  });

  it("rejects invalid FakeAgentProvider workflow requests before broker execution", async () => {
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProvider("invalid_workflow_request"),
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Emit an invalid fake workflow request.");
    await flushAsync();

    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Invalid Hobit workflow request.");
    expect(lastAssistantMessageText()).toContain("product_input_in_grant");
  });

  it("surfaces FakeAgentProvider error events without invoking Queue", async () => {
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProvider("error"),
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Fail through fake provider.");
    await flushAsync();

    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Fake provider failed.");
  });

  it("surfaces FakeAgentProvider cancellation without invoking Queue", async () => {
    const listItemAggregates = vi.fn(async () => []);

    renderWidget({
      workspaceAgentProvider: fakeProvider("cancelled"),
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Cancel through fake provider.");
    await flushAsync();

    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Fake provider cancelled.");
  });
});

function fakeProvider(scenario: FakeAgentProviderScenario) {
  return createFakeAgentProvider({
    providerId: `fake-${scenario}`,
    providerThreadId: "fake-thread-1",
    script: fakeAgentProviderScriptForScenario(scenario),
  });
}

function fakeProviderFromScript(script: readonly FakeAgentProviderScriptStep[]) {
  return createFakeAgentProvider({
    providerId: "fake-explicit-workflow",
    providerThreadId: "fake-thread-1",
    script,
  });
}

function explicitWorkflowRequest() {
  return {
    grant: {
      constraints: {
        noDelete: true,
        noDownstreamAutoStart: true,
        noGit: true,
        noRollback: true,
        noTerminal: true,
        noValidationExecution: true,
      },
      mode: "queue_acceptance_smoke",
    },
    inputs: {
      phase: "read",
      runSettings: {
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionPolicy: "manual",
        executorWidgetId: "executor-widget-1",
        sandbox: "read_only",
        workspaceRoot: "C:/repo",
      },
      taskIdsBySlot: {
        downstream: "task-downstream",
        upstream: "task-upstream",
      },
      tasks: [
        {
          prompt: "Complete upstream dependency smoke work.",
          slot: "upstream",
          title: "Upstream dependency smoke",
        },
        {
          dependsOnSlots: ["upstream"],
          prompt: "Complete downstream dependency smoke work.",
          slot: "downstream",
          title: "Downstream dependency smoke",
        },
      ],
    },
    moduleId: "queue",
    requestId: "fake-explicit-workflow-request",
    type: "hobit.workflow.request",
    workflowId: "dependency_acceptance_smoke",
  };
}

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(async () => itemResult()),
    getSnapshot: vi.fn(async () => snapshotResult()),
    updateItem: vi.fn(async () => itemResult()),
    ...overrides,
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
        resultRefsJson: action.resultRefs ? JSON.stringify(action.resultRefs) : null,
        startedAt: "2026-06-22T00:00:00.000Z",
        status: action.status,
        stepId: action.stepId,
        targetRefsJson: action.targetRefs ? JSON.stringify(action.targetRefs) : null,
        updatedAt: "2026-06-22T00:00:00.000Z",
        workflowRunId: request.workflowRunId,
        workspaceId: request.workspaceId,
      })),
      blocker: null,
      conflict: null,
      status: "recorded",
      workflowRun: workflowRun({
        currentStep: request.currentStep ?? null,
        phase: request.phase ?? "read",
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
    requestId: overrides.requestId ?? "fake-workflow-request",
    schemaVersion: 1,
    slotBindingsJson: null,
    status: overrides.status ?? "created",
    updatedAt: "2026-06-22T00:00:00.000Z",
    variablesJson: null,
    version: 1,
    workflowId: overrides.workflowId ?? "dependency_acceptance_smoke",
    workflowRunId: overrides.workflowRunId ?? "queue-workflow-run-1",
    workspaceId: overrides.workspaceId ?? "workspace_1",
    ...overrides,
  };
}

function itemResult(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  const item = {
    dependencies: [],
    id: "queue-created",
    prompt: "Prompt",
    status: "queued",
    title: "Queue item",
    ...overrides,
  } as QueueWidgetItemSnapshot;

  return {
    action: "queue.createItem",
    events: [],
    item,
    message: "Queue item created. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function snapshotResult(
  overrides: Partial<QueueWidgetSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetSnapshot> {
  return {
    action: "queue.getSnapshot",
    events: [],
    message: "Queue snapshot returned.",
    ok: true,
    safetyClass: "safe_read",
    snapshot: {
      items: [],
      queueId: "workspace:workspace_1:agent-queue",
      selectedItem: null,
      selectedItemId: null,
      widgetType: "agent-queue",
      workspaceId: "workspace_1",
      ...overrides,
    } as QueueWidgetSnapshot,
  };
}

function aggregate({
  taskId,
}: {
  taskId: string;
}): AgentQueueItemAggregate {
  return {
    blockers: [],
    commitState: "none",
    dependencyState: "none",
    durableFlags: {
      commitState: false,
      completionState: false,
      dependencyState: true,
      evidenceState: false,
      failureState: false,
      frontendOverlayUsed: false,
      latestRunLink: false,
      reviewState: true,
      taskRow: true,
      validationState: true,
    },
    evidenceState: "none",
    evidenceSummary: null,
    latestRun: null,
    nextActions: [],
    reviewState: "not_requested",
    runSettings: {
      approvalPolicy: "never",
      assignedExecutorWidgetId: null,
      codexExecutable: "codex.cmd",
      executionPolicy: "manual",
      executionWorkspace: "C:/repo",
      sandbox: "read_only",
    },
    taskId,
    ticketState: "queued",
    title: "Queue item",
    updatedAt: "2026-06-22T00:00:00.000Z",
    validationState: "not_requested",
    workerRunState: "not_started",
    workspaceId: "workspace_1",
  };
}

async function runDirectWork(prompt: string) {
  await setTextareaValue(prompt);
  await clickButton("Run with Codex");
}

async function flushAsync(cycles = 12) {
  await act(async () => {
    for (let index = 0; index < cycles; index += 1) {
      await Promise.resolve();
    }
  });
}

function allAssistantMessageText() {
  return Array.from(
    document.querySelectorAll(
      '[data-testid="interactive-agent-message-assistant"]',
    ),
  ).map(
    (message) =>
      message.querySelector(".interactive-agent-message-body")?.textContent ??
      "",
  );
}
