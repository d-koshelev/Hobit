import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkbenchShell } from "./WorkbenchShell";
import type { WorkbenchViewState } from "./types";
import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
} from "../workspace/types";

const workspaceApiMocks = vi.hoisted(() => ({
  addWidgetInstanceToWorkbench: vi.fn(),
  getAgentQueueRunnerSnapshot: vi.fn(),
  getAgentQueueTask: vi.fn(),
  listAgentQueueTaskRunLinks: vi.fn(),
  listAgentQueueTasks: vi.fn(),
  updateWidgetInstanceLayout: vi.fn(),
}));

vi.mock("../workspace/workspaceApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../workspace/workspaceApi")>();

  return {
    ...actual,
    addWidgetInstanceToWorkbench: workspaceApiMocks.addWidgetInstanceToWorkbench,
    getAgentQueueRunnerSnapshot: workspaceApiMocks.getAgentQueueRunnerSnapshot,
    getAgentQueueTask: workspaceApiMocks.getAgentQueueTask,
    listAgentQueueTaskRunLinks: workspaceApiMocks.listAgentQueueTaskRunLinks,
    listAgentQueueTasks: workspaceApiMocks.listAgentQueueTasks,
    updateWidgetInstanceLayout: workspaceApiMocks.updateWidgetInstanceLayout,
  };
});

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
  vi.clearAllMocks();
});

describe("WorkbenchShell global activity", () => {
  it("renders the compact shell summary and opens Recent Activity in a bottom drawer", () => {
    renderShell();

    expect(document.body.textContent).toContain("Idle");
    expect(document.body.textContent).toContain("No active local runs");
    expect(document.querySelector("#workbench-activity-panel")).toBeNull();
    expect(
      document.querySelector(".canvas-shell")?.textContent,
    ).not.toContain("Recent Activity");

    const activityButton = buttonWithText("Activity");

    act(() => {
      activityButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(activityButton.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("#workbench-activity-panel")).not.toBeNull();
    expect(document.body.textContent).toContain("Recent Activity");
    expect(document.body.textContent).toContain("Widget added");
    expect(document.body.textContent).toContain("Workspace opened");
    expect(
      document.querySelector(".canvas-shell")?.textContent,
    ).not.toContain("Recent Activity");

    act(() => {
      buttonWithText("Close").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(document.querySelector("#workbench-activity-panel")).toBeNull();
    expect(activityButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("does not reload Agent Queue tasks when Activity drawer state changes", async () => {
    const task = queueTask();
    workspaceApiMocks.listAgentQueueTasks.mockResolvedValue([task]);
    workspaceApiMocks.getAgentQueueTask.mockResolvedValue(task);
    workspaceApiMocks.listAgentQueueTaskRunLinks.mockResolvedValue([]);
    workspaceApiMocks.getAgentQueueRunnerSnapshot.mockResolvedValue(
      queueRunnerSnapshot(),
    );

    renderShell(
      workbenchViewState({
        widgets: [agentQueueWidget()],
      }),
    );
    await flushShellEffects();

    expect(workspaceApiMocks.listAgentQueueTasks).toHaveBeenCalledTimes(1);
    expect(workspaceApiMocks.getAgentQueueTask).toHaveBeenCalledTimes(1);

    const activityButton = buttonWithText("Activity");

    act(() => {
      activityButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushShellEffects();

    expect(document.querySelector("#workbench-activity-panel")).not.toBeNull();
    expect(workspaceApiMocks.listAgentQueueTasks).toHaveBeenCalledTimes(1);
    expect(workspaceApiMocks.getAgentQueueTask).toHaveBeenCalledTimes(1);

    act(() => {
      buttonWithText("Close").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await flushShellEffects();

    expect(document.querySelector("#workbench-activity-panel")).toBeNull();
    expect(workspaceApiMocks.listAgentQueueTasks).toHaveBeenCalledTimes(1);
    expect(workspaceApiMocks.getAgentQueueTask).toHaveBeenCalledTimes(1);
  });
});

describe("WorkbenchShell empty canvas recovery", () => {
  it("adds Workspace Agent and Notes from the empty workbench CTA", async () => {
    const onViewStateChange = vi.fn();

    workspaceApiMocks.addWidgetInstanceToWorkbench
      .mockResolvedValueOnce(
        workspaceWorkbenchState({
          widgetDefinitionIds: ["interactive-agent"],
        }),
      )
      .mockResolvedValueOnce(
        workspaceWorkbenchState({
          widgetDefinitionIds: ["interactive-agent", "notes"],
        }),
      );
    workspaceApiMocks.updateWidgetInstanceLayout
      .mockResolvedValueOnce(
        workspaceWorkbenchState({
          widgetDefinitionIds: ["interactive-agent"],
          usePresetLayout: true,
        }),
      )
      .mockResolvedValueOnce(
        workspaceWorkbenchState({
          widgetDefinitionIds: ["interactive-agent", "notes"],
          usePresetLayout: true,
        }),
      );

    renderShell(workbenchViewState(), onViewStateChange);

    await act(async () => {
      buttonWithText("Add Workspace Agent + Notes").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
    });

    expect(workspaceApiMocks.addWidgetInstanceToWorkbench).toHaveBeenCalledTimes(
      2,
    );
    expect(workspaceApiMocks.updateWidgetInstanceLayout).toHaveBeenCalledTimes(
      2,
    );
    expect(
      workspaceApiMocks.addWidgetInstanceToWorkbench.mock.calls.map(
        ([request]) => request.definitionId,
      ),
    ).toEqual(["interactive-agent", "notes"]);
    expect(onViewStateChange).toHaveBeenCalledTimes(1);
    expect(
      onViewStateChange.mock.calls[0][0].widgets.map(
        (widget: WorkbenchViewState["widgets"][number]) => widget.definitionId,
      ),
    ).toEqual(["interactive-agent", "notes"]);
    expect(onViewStateChange.mock.calls[0][0].workbench.preset.title).toBe(
      "Workspace Agent Workspace",
    );
  });
});

describe("WorkbenchShell workspace title", () => {
  it("shows the workspace title without a visible Workspace prefix", () => {
    renderShell(
      workbenchViewState({
        workspace: {
          description: null,
          id: "workspace_1",
          status: "open",
          title: "Untitled",
        },
      }),
    );

    expect(
      document.querySelector(".workspace-context-title")?.textContent,
    ).toBe("Untitled");
    expect(document.querySelector(".workspace-pill")?.textContent).toBe(
      "Untitled",
    );
  });
});

function renderShell(
  viewState = workbenchViewState(),
  onViewStateChange: (viewState: WorkbenchViewState) => void = () => undefined,
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <WorkbenchShell
        onViewStateChange={onViewStateChange}
        viewState={viewState}
      />,
    );
  });
}

function workspaceWorkbenchState({
  widgetDefinitionIds,
  usePresetLayout = false,
}: {
  widgetDefinitionIds: string[];
  usePresetLayout?: boolean;
}) {
  const baseViewState = workbenchViewState();

  return {
    workspace: {
      ...baseViewState.workspace,
      workbenchId: baseViewState.workbench.id,
    },
    workbench: {
      id: baseViewState.workbench.id ?? "workbench_1",
      presetOriginId: null,
      workspaceId: baseViewState.workspace.id,
    },
    widgetInstances: widgetDefinitionIds.map((definitionId, index) => {
      const isCoordinator = definitionId === "interactive-agent";

      return {
        alwaysOnTop: false,
        category: "core",
        config: "{}",
        definitionId,
        dockHeight: usePresetLayout ? 560 : 240,
        dockWidth: usePresetLayout ? (isCoordinator ? 840 : 360) : 360,
        dockX: usePresetLayout ? (isCoordinator ? 0 : 864) : 0,
        dockY: usePresetLayout ? 0 : index * 256,
        id: `widget_${index + 1}`,
        isVisible: true,
        layoutMode: "docked",
        popoutHeight: null,
        popoutWidth: null,
        popoutX: null,
        popoutY: null,
        state: "{}",
        title: isCoordinator ? "Workspace Agent" : "Notes",
      };
    }),
    sharedStateObjects: [],
    recentEvents: baseViewState.recentEvents,
  };
}

function buttonWithText(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
}

function workbenchViewState(
  overrides: Partial<WorkbenchViewState> = {},
): WorkbenchViewState {
  return {
    recentEvents: [
      {
        createdAt: "2026-05-22T10:00:00.000Z",
        id: "event_workspace_opened",
        kind: "workspace_opened",
        summary: "Workspace opened",
      },
      {
        createdAt: "2026-05-22T10:01:00.000Z",
        id: "event_widget_added",
        kind: "widget_instance_added",
        summary: "Widget added",
      },
    ],
    sharedStateObjects: [],
    widgets: [],
    workbench: {
      id: "workbench_1",
      preset: {
        description: null,
        id: "preset_empty",
        title: "Empty Workbench",
      },
    },
    workspace: {
      description: null,
      id: "workspace_1",
      status: "open",
      title: "Shell Activity Test",
    },
    ...overrides,
  };
}

function agentQueueWidget(): WorkbenchViewState["widgets"][number] {
  return {
    config: {},
    definitionId: "agent-queue",
    id: "widget_queue_1",
    layout: {
      area: "main",
      height: 560,
      mode: "docked",
      order: 0,
      width: 760,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Agent Queue",
    visible: true,
  };
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-20T10:00:00.000Z",
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: "",
    queueItemId: "queue-1",
    status: "draft",
    title: "Queue task",
    updatedAt: "2026-05-20T10:00:00.000Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function queueRunnerSnapshot(): AgentQueueRunnerSnapshot {
  return {
    activeQueueItemId: null,
    finalRunStatus: null,
    isActive: false,
    isSessionOnly: true,
    lastReconciledAt: null,
    policy: {
      allowHiddenExecution: false,
      durableResume: false,
      oneTaskAtATime: true,
      requireOperatorStart: true,
      stopOnCancel: true,
      stopOnFailure: true,
      stopOnReviewNeeded: true,
    },
    sessionId: null,
    status: "idle",
    stopReason: null,
    waitingRunId: null,
  };
}

async function flushShellEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}
