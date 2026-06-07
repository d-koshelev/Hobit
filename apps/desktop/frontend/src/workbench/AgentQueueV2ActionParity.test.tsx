import { act, useMemo } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import { AgentQueuePlaceholderWidget } from "./AgentQueuePlaceholderWidget";
import { workerReport } from "./AgentQueueTaskRunPanel.test-fixtures";
import { useAgentQueueController } from "./queue/useAgentQueueController";
import type { WidgetRenderProps } from "./types";
import {
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Agent QueueV2 action parity", () => {
  it("runs a selected task only from the QueueV2 details action", async () => {
    const onStartAssignedAgentQueueTask = vi.fn(async (request) => ({
      executorWidgetInstanceId: request.executorWidgetInstanceId ?? "executor-1",
      queueItemId: request.queueItemId,
      runId: "run-from-v2",
      status: "running" as const,
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    }));
    const task = queueTask({
      approvalPolicy: "never",
      assignedExecutorWidgetId: "executor-1",
      codexExecutable: "codex.cmd",
      executionWorkspace: "C:\\repo",
      prompt: "Run through QueueV2 details only.",
      sandbox: "workspace_write",
      status: "ready",
    });

    renderQueueWidget({
      onGetAgentQueueTask: async () => task,
      onListAgentQueueTasks: async () => [task],
      onStartAssignedAgentQueueTask,
    });
    await flushRender();

    await clickCardAsync("queue-1");
    await flushRender();

    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();

    clickButton("Details");
    await flushRender();
    await clickQueueV2ActionAsync("Run task");

    expect(onStartAssignedAgentQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        queueItemId: "queue-1",
        repoRoot: "C:\\repo",
        sandbox: "workspace_write",
      }),
    );
  });

  it("exposes review and closure actions through existing callbacks", async () => {
    const updateRequests: unknown[] = [];
    const selectedTask = queueTask({
      coordinatorStatus: "awaiting_coordinator_review",
      status: "completed",
      validationStatus: "needs_review",
      workerExecutionReports: [
        workerReport({
          changedFiles: [],
          summary: "No-change report ready for review.",
          validationResult: "passed",
        }),
      ],
    });

    renderQueueWidget({
      onGetAgentQueueTask: async () => selectedTask,
      onListAgentQueueTasks: async () => [selectedTask],
      onUpdateAgentQueueTask: async (request) => {
        updateRequests.push(request);
        return queueTask({
          ...selectedTask,
          queueItemId: request.queueItemId,
          status: request.status,
          validationStatus: request.validationStatus,
        });
      },
    });
    await flushRender();

    clickButton("Details");
    await flushRender();

    expect(queueV2ActionButton("View report")).not.toBeNull();
    expect(queueV2ActionButton("Accept without commit")).not.toBeNull();
    expect(queueV2ActionButton("Finalize / Accept")).not.toBeNull();
    expect(queueV2ActionButton("Request changes")).not.toBeNull();

    clickQueueV2Action("View report");
    expect(document.querySelector("[role='tabpanel']")?.textContent).toContain(
      "Output summary",
    );

    await clickQueueV2ActionAsync("Accept without commit");

    expect(updateRequests).toHaveLength(1);
    expect(updateRequests[0]).toMatchObject({
      queueItemId: "queue-1",
      status: "completed",
      validationStatus: "passed",
    });
  });

  it("creates follow-up and attaches reports without starting work", async () => {
    const onCreateAgentQueueTask = vi.fn(async (request) =>
      queueTask({
        description: request.description,
        itemType: request.itemType,
        prompt: request.prompt,
        queueItemId: "follow-up-created",
        status: request.status,
        title: request.title,
      }),
    );
    const onStartAssignedAgentQueueTask = vi.fn();
    const updateRequests: unknown[] = [];
    const selectedTask = queueTask({
      coordinatorStatus: "awaiting_coordinator_review",
      status: "completed",
      validationStatus: "needs_review",
      workerExecutionReports: [
        workerReport({
          followUpRecommendation: "Split a smaller fix.",
          summary: "Follow-up is required.",
        }),
      ],
    });

    renderQueueWidget({
      onCreateAgentQueueTask,
      onGetAgentQueueTask: async () => selectedTask,
      onListAgentQueueTasks: async () => [selectedTask],
      onStartAssignedAgentQueueTask,
      onUpdateAgentQueueTask: async (request) => {
        updateRequests.push(request);
        return queueTask({
          ...selectedTask,
          queueItemId: request.queueItemId,
          status: request.status,
          validationStatus: request.validationStatus,
        });
      },
    });
    await flushRender();

    clickButton("Details");
    await flushRender();
    await clickQueueV2ActionAsync("Attach report");

    expect(document.body.textContent).toContain("Worker report received");
    expect(updateRequests).toHaveLength(0);
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();

    await clickQueueV2ActionAsync("Create follow-up");

    expect(onCreateAgentQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        itemType: "follow_up",
        status: "queued",
        title: "Follow-up: Selected runnable task",
      }),
    );
    expect(updateRequests[0]).toMatchObject({
      queueItemId: "queue-1",
      status: "review_needed",
      validationStatus: "needs_review",
    });
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
  });

  it("shows disabled action reasons and opens the existing New task dialog", async () => {
    renderQueueWidget({
      onGetAgentQueueTask: async () =>
        queueTask({
          prompt: "",
          status: "ready",
        }),
      onListAgentQueueTasks: async () => [
        queueTask({
          prompt: "",
          status: "ready",
        }),
      ],
    });
    await flushRender();

    clickButton("Details");
    await flushRender();

    const runButton = queueV2ActionButton("Run task");

    expect(runButton?.disabled).toBe(true);
    expect(runButton?.parentElement?.textContent).toContain(
      "Add a task prompt before configuring execution.",
    );

    await clickQueueV2ActionAsync("New task");

    expect(document.body.textContent).toContain("Run setup");
    expect(document.body.textContent).toContain("Create draft");
  });
});

function renderQueueWidget(overrides: Partial<WidgetRenderProps> = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<AgentQueueWidgetHarness {...widgetProps(overrides)} />);
  });
}

function AgentQueueWidgetHarness(props: WidgetRenderProps) {
  const queueOwnedExecutorSlots = useMemo(
    () => [
      {
        label: "Local executor ready",
        ownerKind: "agent_queue" as const,
        widgetInstanceId: props.instance.id,
      },
      ...(props.agentExecutorSlots ?? []).map((slot) => ({
        ...slot,
        ownerKind: slot.ownerKind ?? ("agent_executor" as const),
      })),
    ],
    [props.agentExecutorSlots, props.instance.id],
  );
  const controller = useAgentQueueController({
    agentExecutorSlots: queueOwnedExecutorSlots,
    onAssignAgentQueueTaskToExecutor: props.onAssignAgentQueueTaskToExecutor,
    onClearAgentQueueTaskAssignment: props.onClearAgentQueueTaskAssignment,
    onCreateAgentQueueTask: props.onCreateAgentQueueTask,
    onDeleteAgentQueueTask: props.onDeleteAgentQueueTask,
    onGetAgentQueueTask: props.onGetAgentQueueTask,
    onListAgentQueueTasks: props.onListAgentQueueTasks,
    onStartAssignedAgentQueueTask: props.onStartAssignedAgentQueueTask,
    onUpdateAgentQueueTask: props.onUpdateAgentQueueTask,
    queueWidgetInstanceId: props.instance.id,
  });

  return (
    <AgentQueuePlaceholderWidget
      {...props}
      agentExecutorSlots={queueOwnedExecutorSlots}
      agentQueueController={controller}
    />
  );
}

function widgetProps(overrides: Partial<WidgetRenderProps>): WidgetRenderProps {
  return {
    agentExecutorSlots: [
      {
        label: "Local executor",
        widgetInstanceId: "executor-1",
      },
    ],
    config: {},
    definition: {
      category: "workflow",
      componentKey: AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
      defaultConfig: {},
      defaultTitle: "Agent Queue",
      description: "Queue",
      id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
      title: "Agent Queue",
    },
    frameActions: null,
    frameMoveEnabled: false,
    instance: {
      config: {},
      definitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
      id: "queue-widget-1",
      layout: {
        area: "main",
        height: 680,
        mode: "docked",
        order: 0,
        width: 1160,
        x: 0,
        y: 0,
      },
      state: {},
      title: "Agent Queue",
      visible: true,
    },
    logRefreshToken: 0,
    onAssignAgentQueueTaskToExecutor: async () => queueTask(),
    onClearAgentQueueTaskAssignment: async () =>
      queueTask({ assignedExecutorWidgetId: null }),
    onCreateAgentQueueTask: async () => queueTask({ queueItemId: "created" }),
    onDeleteAgentQueueTask: async () => true,
    onGetAgentQueueTask: async () => queueTask(),
    onListAgentQueueTasks: async () => [queueTask()],
    onStartAssignedAgentQueueTask: async () => ({
      executorWidgetInstanceId: "executor-1",
      queueItemId: "queue-1",
      runId: "run-1",
      status: "running",
      workbenchId: "workbench-1",
      workspaceId: "workspace-1",
    }),
    onUpdateAgentQueueTask: async () => queueTask(),
    title: "Agent Queue",
    ...overrides,
  } as WidgetRenderProps;
}

async function flushRender() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function clickButton(text: string) {
  const button = buttonByText(text);

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function buttonByText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function queueV2ActionButton(text: string) {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".queue-v2-task-details-actions button",
    ),
  ).find((button) => button.textContent === text);
}

function clickQueueV2Action(text: string) {
  const button = queueV2ActionButton(text);

  if (!button) {
    throw new Error(`QueueV2 action not found: ${text}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function clickQueueV2ActionAsync(text: string) {
  const button = queueV2ActionButton(text);

  if (!button || button.disabled) {
    throw new Error(`Enabled QueueV2 action not found: ${text}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

async function clickCardAsync(queueItemId: string) {
  const card = document.querySelector<HTMLElement>(
    `[data-queue-item-id="${queueItemId}"]`,
  );

  if (!card) {
    throw new Error(`Card not found: ${queueItemId}`);
  }

  await act(async () => {
    card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: "executor-1",
    createdAt: "2026-05-22T10:00:00.000Z",
    description: "Selected runnable Queue task",
    executionPolicy: "manual",
    priority: 1,
    prompt: "Run the selected task from Queue.",
    queueItemId: "queue-1",
    status: "ready",
    title: "Selected runnable task",
    updatedAt: "2026-05-22T10:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
