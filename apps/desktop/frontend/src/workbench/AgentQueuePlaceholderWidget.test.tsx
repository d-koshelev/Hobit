import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import { AgentQueuePlaceholderWidget } from "./AgentQueuePlaceholderWidget";
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
    expect(document.body.textContent).toContain("Selected work item");
    expect(document.body.textContent).toContain("Prompt");
    expect(document.body.textContent).toContain("Run task");
    expect(detailsBySummary("Advanced execution settings")?.open).toBe(false);
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
      rect({ width: 1160 }),
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
      window.dispatchEvent(pointerEvent("pointermove", { clientX: 500 }));
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
});

function renderQueueWidget(
  overrides: Partial<WidgetRenderProps> = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <AgentQueuePlaceholderWidget
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

async function flushRender() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function detailsBySummary(text: string) {
  return Array.from(document.querySelectorAll<HTMLDetailsElement>("details")).find(
    (details) => details.querySelector("summary")?.textContent === text,
  );
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
