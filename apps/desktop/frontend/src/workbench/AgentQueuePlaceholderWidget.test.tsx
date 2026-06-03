import { act, useMemo } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import { AgentQueuePlaceholderWidget } from "./AgentQueuePlaceholderWidget";
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
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("AgentQueuePlaceholderWidget single-surface UX", () => {
  it("shows Flow Map as the only user-facing mode with selected-task run controls", async () => {
    const task = queueTask();
    const onStartAssignedAgentQueueTask = vi.fn();

    renderQueueWidget({
      onGetAgentQueueTask: async () => task,
      onListAgentQueueTasks: async () => [task],
      onStartAssignedAgentQueueTask,
    });
    await flushRender();

    expect(document.body.textContent).toContain("Flow map");
    expect(document.body.textContent).not.toContain("Table/list");
    expect(document.body.textContent).not.toContain("Agent Queue view mode");
    expect(document.body.textContent).toContain("Overview");
    expect(document.body.textContent).toContain("Prompt");
    expect(document.body.textContent).toContain("Actions and settings");
    expect(document.body.textContent).toContain("Run selected task");
    expect(detailsBySummary("Execution settings")?.open).toBe(true);
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
  });

  it("resizes the Queue rails around the Flow Map without starting a run", async () => {
    const onStartAssignedAgentQueueTask = vi.fn();

    renderQueueWidget({
      onStartAssignedAgentQueueTask,
    });
    await flushRender();

    const layout = document.querySelector<HTMLDivElement>(
      ".agent-queue-product-layout-flow",
    );
    const leftHandle = document.querySelector<HTMLButtonElement>(
      "[aria-label='Resize Queue controls rail']",
    );
    const rightHandle = document.querySelector<HTMLButtonElement>(
      "[aria-label='Resize selected item rail']",
    );

    expect(layout).not.toBeNull();
    expect(leftHandle).not.toBeNull();
    expect(rightHandle).not.toBeNull();
    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-left-rail-width: 220px",
    );
    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-right-rail-width: 320px",
    );

    vi.spyOn(layout!, "getBoundingClientRect").mockReturnValue(
      rect({ width: 1400 }),
    );

    await act(async () => {
      leftHandle?.dispatchEvent(pointerEvent("pointerdown", { clientX: 300 }));
    });
    await act(async () => {
      window.dispatchEvent(pointerEvent("pointermove", { clientX: 380 }));
    });
    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-left-rail-width: 300px",
    );

    await act(async () => {
      window.dispatchEvent(pointerEvent("pointerup", { clientX: 380 }));
    });
    await act(async () => {
      leftHandle?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-left-rail-width: 220px",
    );

    await act(async () => {
      rightHandle?.dispatchEvent(pointerEvent("pointerdown", { clientX: 600 }));
    });
    await act(async () => {
      window.dispatchEvent(pointerEvent("pointermove", { clientX: 520 }));
    });
    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-right-rail-width: 400px",
    );

    await act(async () => {
      window.dispatchEvent(pointerEvent("pointerup", { clientX: 500 }));
    });
    await act(async () => {
      rightHandle?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-left-rail-width: 220px",
    );
    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-right-rail-width: 320px",
    );
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
  });

  it("preserves resized Queue rails across Queue widget remounts", async () => {
    renderQueueWidget();
    await flushRender();

    let layout = document.querySelector<HTMLDivElement>(
      ".agent-queue-product-layout-flow",
    );
    const leftHandle = document.querySelector<HTMLButtonElement>(
      "[aria-label='Resize Queue controls rail']",
    );
    const rightHandle = document.querySelector<HTMLButtonElement>(
      "[aria-label='Resize selected item rail']",
    );

    expect(layout).not.toBeNull();
    vi.spyOn(layout!, "getBoundingClientRect").mockReturnValue(
      rect({ width: 1400 }),
    );

    await act(async () => {
      leftHandle?.dispatchEvent(pointerEvent("pointerdown", { clientX: 300 }));
    });
    await act(async () => {
      window.dispatchEvent(pointerEvent("pointermove", { clientX: 380 }));
    });
    await act(async () => {
      window.dispatchEvent(pointerEvent("pointerup", { clientX: 380 }));
    });
    await act(async () => {
      rightHandle?.dispatchEvent(pointerEvent("pointerdown", { clientX: 600 }));
    });
    await act(async () => {
      window.dispatchEvent(pointerEvent("pointermove", { clientX: 520 }));
    });
    await act(async () => {
      window.dispatchEvent(pointerEvent("pointerup", { clientX: 500 }));
    });

    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-left-rail-width: 300px",
    );
    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-right-rail-width: 400px",
    );

    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;

    renderQueueWidget();
    await flushRender();

    layout = document.querySelector<HTMLDivElement>(
      ".agent-queue-product-layout-flow",
    );
    const resetHandle = document.querySelector<HTMLButtonElement>(
      "[aria-label='Resize Queue controls rail']",
    );

    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-left-rail-width: 300px",
    );
    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-right-rail-width: 400px",
    );

    await act(async () => {
      resetHandle?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-left-rail-width: 220px",
    );
    expect(layout?.getAttribute("style")).toContain(
      "--agent-queue-right-rail-width: 320px",
    );
  });
});

describe("AgentQueuePlaceholderWidget new task dialog", () => {
  it("shows task run setup fields with safe defaults", async () => {
    renderQueueWidget({
      agentExecutorSlots: [],
      onListAgentQueueTasks: async () => [],
    });
    await flushRender();

    clickButton("New task");

    expect(document.body.textContent).toContain("Run setup");
    expect(document.body.textContent).toContain("Task settings");
    expect(document.body.textContent).toContain("Task workspace");
    expect(document.body.textContent).toContain("Codex executable");
    expect(document.body.textContent).toContain("Sandbox");
    expect(document.body.textContent).toContain("Approval policy");
    expect(document.body.textContent).toContain("Initial state");
    expect(document.body.textContent).toContain("Execution policy");
    expect(inputByLabel("Codex executable").value).toBe("codex.cmd");
    expect(selectByLabel("Sandbox").value).toBe("read_only");
    expect(selectByLabel("Approval policy").value).toBe("never");
    expect(buttonByText("Create queued task")?.disabled).toBe(true);
  });

  it("creates a draft task without starting execution", async () => {
    const onCreateAgentQueueTask = vi.fn(async (request) =>
      queueTask({
        description: request.description,
        executionPolicy: request.executionPolicy,
        priority: request.priority,
        prompt: request.prompt,
        queueItemId: "created-draft",
        status: request.status,
        title: request.title,
      }),
    );
    const onStartAssignedAgentQueueTask = vi.fn();

    renderQueueWidget({
      agentExecutorSlots: [],
      onCreateAgentQueueTask,
      onListAgentQueueTasks: async () => [],
      onStartAssignedAgentQueueTask,
    });
    await flushRender();

    clickButton("New task");
    await changeValue(inputByLabel("Title"), "Draft from dialog");
    clickButton("Create draft");
    await flushRender();

    expect(onCreateAgentQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        executionPolicy: "manual",
        prompt: "",
        status: "draft",
        title: "Draft from dialog",
      }),
    );
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
  });

  it("creates a queued runnable task with task run settings and waits for explicit Run task", async () => {
    const createRequests: unknown[] = [];
    const startRequests: unknown[] = [];
    const onCreateAgentQueueTask = vi.fn(async (request) => {
      createRequests.push(request);
      return queueTask({
        approvalPolicy: request.approvalPolicy,
        codexExecutable: request.codexExecutable,
        description: request.description,
        executionPolicy: request.executionPolicy,
        executionWorkspace: request.executionWorkspace,
        priority: request.priority,
        prompt: request.prompt,
        queueItemId: "created-queued",
        queueTagName: request.queueTagName,
        sandbox: request.sandbox,
        status: request.status,
        title: request.title,
      });
    });
    const onStartAssignedAgentQueueTask = vi.fn(async (request) => {
      startRequests.push(request);
      return {
        executorWidgetInstanceId:
          request.queueOwnerWidgetInstanceId ?? "queue-widget-1",
        queueItemId: request.queueItemId,
        runId: "run-created",
        status: "running",
        workbenchId: "workbench-1",
        workspaceId: "workspace-1",
      };
    });

    renderQueueWidget({
      agentExecutorSlots: [],
      onCreateAgentQueueTask,
      onListAgentQueueTasks: async () => [],
      onStartAssignedAgentQueueTask,
    });
    await flushRender();

    clickButton("New task");
    await changeValue(inputByLabel("Title"), "Queued from dialog");
    await changeValue(textareaByLabel("Prompt"), "Implement the queued task.");
    await changeValue(inputByLabel("Task workspace"), "C:\\repo");
    await changeValue(inputByLabel("Codex executable"), "codex.cmd");
    await changeSelect("Sandbox", "workspace_write");
    await changeSelect("Approval policy", "never");

    const createQueued = buttonByText("Create queued task");
    expect(createQueued?.disabled).toBe(false);
    clickButton("Create queued task");
    await flushRender();

    expect(onCreateAgentQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        executionPolicy: "manual",
        executionWorkspace: "C:\\repo",
        codexExecutable: "codex.cmd",
        sandbox: "workspace_write",
        approvalPolicy: "never",
        priority: 0,
        prompt: "Implement the queued task.",
        queueTagName: "Default",
        status: "queued",
        title: "Queued from dialog",
      }),
    );
    expect(onStartAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(sectionText("Next action")).toContain("Run task");
    expect(sectionText("Next action")).not.toContain("Set run settings");
    expect(sectionText("Queue task execution")).not.toContain("Set task workspace");
    expect(document.body.textContent).toContain("Run task");
    expect(document.body.textContent).not.toContain("Promote to queued");
    expect(inputByLabel("Task workspace").value).toBe("C:\\repo");
    expect(inputByLabel("Codex executable").value).toBe("codex.cmd");
    expect(selectByLabel("Sandbox").value).toBe("workspace_write");
    expect(selectByLabel("Approval policy").value).toBe("never");
    expect(detailsBySummary("Execution settings")?.open).toBe(false);

    clickButton("Run task");
    await flushRender();

    expect(onStartAssignedAgentQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        queueItemId: "created-queued",
        queueOwnerWidgetInstanceId: "queue-widget-1",
        repoRoot: "C:\\repo",
        sandbox: "workspace_write",
      }),
    );
    expect(createRequests).toHaveLength(1);
    expect(startRequests).toHaveLength(1);
  });

  it("shows a compact danger_full_access warning in the create dialog", async () => {
    renderQueueWidget({
      agentExecutorSlots: [],
      onListAgentQueueTasks: async () => [],
    });
    await flushRender();

    clickButton("New task");
    await changeSelect("Sandbox", "danger_full_access");

    expect(document.body.textContent).toContain(
      "danger_full_access is unsafe local-dev mode",
    );
    expect(document.body.textContent).toContain("will not auto-run");
  });
});

function renderQueueWidget(
  overrides: Partial<WidgetRenderProps> = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <AgentQueueWidgetHarness
        agentExecutorSlots={[
          {
            label: "Local executor",
            widgetInstanceId: "executor-1",
          },
        ]}
        config={{}}
        definition={{
          category: "workflow",
          componentKey: AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
          defaultConfig: {},
          defaultTitle: "Agent Queue",
          description: "Queue",
          id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
          title: "Agent Queue",
        }}
        frameActions={null}
        frameMoveEnabled={false}
        instance={{
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
        }}
        logRefreshToken={0}
        onAssignAgentQueueTaskToExecutor={async () => queueTask()}
        onClearAgentQueueTaskAssignment={async () =>
          queueTask({ assignedExecutorWidgetId: null })
        }
        onCreateAgentQueueTask={async () => queueTask({ queueItemId: "created" })}
        onDeleteAgentQueueTask={async () => true}
        onGetAgentQueueTask={async () => queueTask()}
        onGetAgentQueueTaskLatestRunLink={async () => null}
        onListAgentQueueTaskRunLinks={async () => []}
        onListAgentQueueTasks={async () => [queueTask()]}
        onStartAssignedAgentQueueTask={async () => ({
          executorWidgetInstanceId: "executor-1",
          queueItemId: "queue-1",
          runId: "run-1",
          status: "running",
          workbenchId: "workbench-1",
          workspaceId: "workspace-1",
        })}
        onUpdateAgentQueueTask={async () => queueTask()}
        title="Agent Queue"
        {...overrides}
      />,
    );
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
    onCreateAgentQueueWorker: props.onCreateAgentQueueWorker,
    onDeleteAgentQueueTask: props.onDeleteAgentQueueTask,
    onDeleteAgentQueueWorker: props.onDeleteAgentQueueWorker,
    onDirectWorkRunHandoffStarted: props.onDirectWorkRunHandoffStarted,
    onGetAgentExecutorRunDetail: props.onGetAgentExecutorRunDetail,
    onGetAgentQueueRunnerSnapshot: props.onGetAgentQueueRunnerSnapshot,
    onGetAgentQueueTask: props.onGetAgentQueueTask,
    onGetAgentQueueTaskLatestRunLink: props.onGetAgentQueueTaskLatestRunLink,
    onListenToDirectWorkStreamEvents: props.onListenToDirectWorkStreamEvents,
    onListAgentQueueTaskRunLinks: props.onListAgentQueueTaskRunLinks,
    onListAgentQueueTasks: props.onListAgentQueueTasks,
    onListAgentQueueWorkers: props.onListAgentQueueWorkers,
    onStartAgentQueueRunnerSession: props.onStartAgentQueueRunnerSession,
    onStartAssignedAgentQueueTask: props.onStartAssignedAgentQueueTask,
    onStopAgentQueueRunnerSession: props.onStopAgentQueueRunnerSession,
    onUpdateAgentQueueTask: props.onUpdateAgentQueueTask,
    onUpdateAgentQueueWorker: props.onUpdateAgentQueueWorker,
    queueTaskAutoRefreshRequest: props.queueTaskAutoRefreshRequest,
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

async function changeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  await act(async () => {
    setNativeValue(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function changeSelect(label: string, value: string) {
  const select = selectByLabel(label);

  await act(async () => {
    setNativeValue(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setNativeValue(
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  const prototype = Object.getPrototypeOf(field);
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  const ownValueSetter = Object.getOwnPropertyDescriptor(field, "value")?.set;

  if (valueSetter && ownValueSetter !== valueSetter) {
    valueSetter.call(field, value);
    return;
  }

  field.value = value;
}

function inputByLabel(labelText: string) {
  return fieldByLabel<HTMLInputElement>(labelText, "input");
}

function textareaByLabel(labelText: string) {
  return fieldByLabel<HTMLTextAreaElement>(labelText, "textarea");
}

function selectByLabel(labelText: string) {
  return fieldByLabel<HTMLSelectElement>(labelText, "select");
}

function fieldByLabel<T extends HTMLElement>(
  labelText: string,
  selector: string,
) {
  const label = Array.from(document.querySelectorAll("label")).find(
    (candidate) => candidate.textContent === labelText,
  );
  const fieldId = label?.getAttribute("for");

  if (!fieldId) {
    throw new Error(`Label not found: ${labelText}`);
  }

  const field = document.getElementById(fieldId);

  if (!field || !field.matches(selector)) {
    throw new Error(`Field not found for label: ${labelText}`);
  }

  return field as T;
}

function detailsBySummary(text: string) {
  return Array.from(document.querySelectorAll<HTMLDetailsElement>("details")).find(
    (details) => details.querySelector("summary")?.textContent === text,
  );
}

function sectionText(label: string) {
  const section = document.querySelector(`[aria-label="${label}"]`);

  if (!section) {
    throw new Error(`Section not found: ${label}`);
  }

  return section.textContent ?? "";
}

function pointerEvent(type: string, options: { clientX: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "button", { value: 0 });
  Object.defineProperty(event, "clientX", { value: options.clientX });
  Object.defineProperty(event, "isPrimary", { value: true });
  return event;
}

function rect({ width }: { width: number }) {
  return {
    bottom: 0,
    height: 0,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
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
