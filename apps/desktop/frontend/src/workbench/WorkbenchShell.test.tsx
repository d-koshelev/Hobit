import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppThemeController } from "../theme/useAppTheme";
import { WorkbenchShell } from "./WorkbenchShell";
import type { WorkbenchViewState } from "./types";
import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
} from "../workspace/types";
import {
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  NOTES_WIDGET_DEFINITION_ID,
  SKILL_LIBRARY_WIDGET_DEFINITION_ID,
  TERMINAL_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

const workspaceApiMocks = vi.hoisted(() => ({
  addWidgetInstanceToWorkbench: vi.fn(),
  deleteWidgetInstanceFromWorkbench: vi.fn(),
  getAgentQueueRunnerSnapshot: vi.fn(),
  getAgentQueueTask: vi.fn(),
  listTerminalPtySessions: vi.fn(),
  listAgentQueueTaskRunLinks: vi.fn(),
  listAgentQueueTasks: vi.fn(),
  updateWorkspace: vi.fn(),
  updateWidgetInstanceLayout: vi.fn(),
}));

vi.mock("../workspace/workspaceApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../workspace/workspaceApi")>();

  return {
    ...actual,
    addWidgetInstanceToWorkbench: workspaceApiMocks.addWidgetInstanceToWorkbench,
    deleteWidgetInstanceFromWorkbench:
      workspaceApiMocks.deleteWidgetInstanceFromWorkbench,
    getAgentQueueRunnerSnapshot: workspaceApiMocks.getAgentQueueRunnerSnapshot,
    getAgentQueueTask: workspaceApiMocks.getAgentQueueTask,
    listAgentQueueTaskRunLinks: workspaceApiMocks.listAgentQueueTaskRunLinks,
    listAgentQueueTasks: workspaceApiMocks.listAgentQueueTasks,
    listTerminalPtySessions: workspaceApiMocks.listTerminalPtySessions,
    updateWorkspace: workspaceApiMocks.updateWorkspace,
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
      "Agent + Notes Workbench",
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

describe("WorkbenchShell widget layout controls", () => {
  it.each([
    [
      "Agent Queue",
      AGENT_QUEUE_WIDGET_DEFINITION_ID,
      { width: 1160, height: 680 },
    ],
    [
      "Workspace Agent",
      INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
      { width: 840, height: 672 },
    ],
    ["Terminal", TERMINAL_WIDGET_DEFINITION_ID, { width: 816, height: 600 }],
    [
      "Notes",
      NOTES_WIDGET_DEFINITION_ID,
      { width: 480, height: 552 },
    ],
      [
        "Knowledge / Skills",
        SKILL_LIBRARY_WIDGET_DEFINITION_ID,
        { width: 744, height: 600 },
      ],
    ])(
    "adds %s from the catalog with its usable default size",
    async (_title, definitionId, expectedSize) => {
      workspaceApiMocks.addWidgetInstanceToWorkbench.mockResolvedValue(
        workspaceWorkbenchState({
          widgetDefinitionIds: [definitionId],
        }),
      );
      workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
        workspaceWorkbenchState({
          widgetDefinitionIds: [definitionId],
        }),
      );

      renderShell();

      await awaitAct(() => {
        buttonWithText("+ Add Widget").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });
      await awaitAct(() => {
        buttonInCatalogCard(definitionId).dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });
      await flushShellEffects();

      expect(workspaceApiMocks.addWidgetInstanceToWorkbench).toHaveBeenCalledWith(
        expect.objectContaining({
          definitionId,
        }),
      );
      expect(workspaceApiMocks.updateWidgetInstanceLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          layout: expect.objectContaining({
            dockHeight: expectedSize.height,
            dockWidth: expectedSize.width,
            dockX: 0,
            dockY: 0,
          }),
          widgetInstanceId: "widget_1",
        }),
      );
    },
  );

  it("places a newly added catalog widget below existing docked widgets", async () => {
    workspaceApiMocks.addWidgetInstanceToWorkbench.mockResolvedValue(
      workspaceWorkbenchState({
        widgetDefinitionIds: [TERMINAL_WIDGET_DEFINITION_ID],
      }),
    );
    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState({
        widgetDefinitionIds: [TERMINAL_WIDGET_DEFINITION_ID],
      }),
    );

    renderShell(
      workbenchViewState({
        widgets: [notesWidget()],
      }),
    );

    await awaitAct(() => {
      buttonWithText("+ Add Widget").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await awaitAct(() => {
      buttonInCatalogCard(TERMINAL_WIDGET_DEFINITION_ID).dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await flushShellEffects();

    expect(workspaceApiMocks.updateWidgetInstanceLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({
          dockHeight: 600,
          dockWidth: 816,
          dockX: 0,
          dockY: 264,
        }),
      }),
    );
  });

  it("does not rewrite existing saved widget geometry on render", async () => {
    renderShell(
      workbenchViewState({
        widgets: [
          {
            ...notesWidget(),
            layout: {
              ...notesWidget().layout,
              height: 200,
              width: 320,
              x: 48,
              y: 72,
            },
          },
        ],
      }),
    );
    await flushShellEffects();

    expect(workspaceApiMocks.updateWidgetInstanceLayout).not.toHaveBeenCalled();
  });

  it("keeps catalog default layout units independent from UI scale", async () => {
    workspaceApiMocks.addWidgetInstanceToWorkbench.mockResolvedValue(
      workspaceWorkbenchState({
        widgetDefinitionIds: [NOTES_WIDGET_DEFINITION_ID],
      }),
    );
    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState({
        widgetDefinitionIds: [NOTES_WIDGET_DEFINITION_ID],
      }),
    );

    renderShell(undefined, () => undefined, undefined, themeController({ uiScale: 1.5 }));

    await awaitAct(() => {
      buttonWithText("+ Add Widget").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await awaitAct(() => {
      buttonInCatalogCard(NOTES_WIDGET_DEFINITION_ID).dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await flushShellEffects();

    expect(workspaceApiMocks.updateWidgetInstanceLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({
          dockHeight: 552,
          dockWidth: 480,
        }),
      }),
    );
  });

  it("clamps resize to widget-specific minimum size when metadata is present", async () => {
    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState({
        widgetDefinitionIds: [INTERACTIVE_AGENT_WIDGET_DEFINITION_ID],
      }),
    );
    renderShell(
      workbenchViewState({
        widgets: [workspaceAgentWidget()],
      }),
    );
    setLayoutSurfaceRect();

    await awaitAct(() => {
      buttonWithLabel("Resize widget").dispatchEvent(
        pointerEvent("pointerdown", { clientX: 840, clientY: 672 }),
      );
    });
    await flushShellEffects();
    await awaitAct(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", { clientX: 120, clientY: 160 }),
      );
      window.dispatchEvent(
        pointerEvent("pointerup", { clientX: 120, clientY: 160 }),
      );
    });
    await flushShellEffects();

    expect(workspaceApiMocks.updateWidgetInstanceLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({
          dockHeight: 480,
          dockWidth: 672,
        }),
      }),
    );
  });

  it("starts unlocked with widgets movable and resizable by default", async () => {
    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState({
        widgetDefinitionIds: ["notes"],
      }),
    );
    renderShell(
      workbenchViewState({
        widgets: [notesWidget()],
      }),
    );
    setLayoutSurfaceRect();

    expect(document.body.textContent).toContain("View");
    expect(document.body.textContent).not.toContain("Layout unlocked");
    expect(document.body.textContent).not.toContain("Edit layout");
    expect(document.querySelector(".widget-header-movable")).not.toBeNull();
    expect(buttonWithLabel("Resize widget")).not.toBeNull();

    await awaitAct(() => {
      document
        .querySelector(".widget-header")
        ?.dispatchEvent(pointerEvent("pointerdown", { clientX: 10, clientY: 10 }));
    });
    await flushShellEffects();
    await awaitAct(() => {
      window.dispatchEvent(pointerEvent("pointermove", { clientX: 130, clientY: 82 }));
      window.dispatchEvent(pointerEvent("pointerup", { clientX: 130, clientY: 82 }));
    });
    await flushShellEffects();

    expect(workspaceApiMocks.updateWidgetInstanceLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({
          dockX: 120,
          dockY: 72,
          dockHeight: 240,
          dockWidth: 360,
        }),
        widgetInstanceId: "widget_notes_1",
      }),
    );
  });

  it("persists widget size after resize", async () => {
    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState({
        widgetDefinitionIds: ["notes"],
      }),
    );
    renderShell(
      workbenchViewState({
        widgets: [notesWidget()],
      }),
    );
    setLayoutSurfaceRect();

    await awaitAct(() => {
      buttonWithLabel("Resize widget").dispatchEvent(
        pointerEvent("pointerdown", { clientX: 360, clientY: 240 }),
      );
    });
    await flushShellEffects();
    await awaitAct(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", { clientX: 480, clientY: 360 }),
      );
      window.dispatchEvent(
        pointerEvent("pointerup", { clientX: 480, clientY: 360 }),
      );
    });
    await flushShellEffects();

    expect(workspaceApiMocks.updateWidgetInstanceLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({
          dockHeight: 360,
          dockWidth: 480,
          dockX: 0,
          dockY: 0,
        }),
        widgetInstanceId: "widget_notes_1",
      }),
    );
  });

  it("brings focused, dragged, and resized widgets to the front", async () => {
    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState({ widgetDefinitionIds: ["notes", "notes"] }),
    );
    const firstWidget = notesWidget();
    const baseSecondWidget = notesWidget();
    const secondWidget = {
      ...baseSecondWidget,
      id: "widget_notes_2",
      layout: { ...baseSecondWidget.layout, order: 1, x: 24, y: 24 },
      title: "Second Notes",
    };

    renderShell(workbenchViewState({ widgets: [firstWidget, secondWidget] }));
    setLayoutSurfaceRect();

    const firstElement = widgetElement("widget_notes_1");
    const secondElement = widgetElement("widget_notes_2");

    expect(firstElement.style.zIndex).toBe("");
    expect(secondElement.style.zIndex).toBe("");

    await awaitAct(() => {
      secondElement.dispatchEvent(pointerEvent("pointerdown", { clientX: 34, clientY: 34 }));
    });

    expect(secondElement.style.zIndex).toBe("18");

    await awaitAct(() => {
      firstElement
        .querySelector(".widget-header")
        ?.dispatchEvent(pointerEvent("pointerdown", { clientX: 10, clientY: 10 }));
    });
    await flushShellEffects();

    expect(firstElement.style.zIndex).toBe("20");

    await awaitAct(() => {
      window.dispatchEvent(pointerEvent("pointerup", { clientX: 10, clientY: 10 }));
    });
    await flushShellEffects();

    expect(firstElement.style.zIndex).toBe("18");

    await awaitAct(() => {
      resizeButtonInWidget("widget_notes_2", "Resize widget").dispatchEvent(
        pointerEvent("pointerdown", { clientX: 384, clientY: 264 }),
      );
    });
    await flushShellEffects();

    expect(secondElement.style.zIndex).toBe("20");
  });

  it("resizes from the left edge and highlights only the active edge", async () => {
    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState({
        widgetDefinitionIds: ["notes"],
      }),
    );
    renderShell(
      workbenchViewState({
        widgets: [
          {
            ...notesWidget(),
            layout: {
              ...notesWidget().layout,
              width: 360,
              x: 96,
            },
          },
        ],
      }),
    );
    setLayoutSurfaceRect();

    await awaitAct(() => {
      buttonWithLabel("Resize widget left edge").dispatchEvent(
        pointerEvent("pointerdown", { clientX: 96, clientY: 120 }),
      );
    });
    await flushShellEffects();

    expect(
      document
        .querySelector(".widget-resize-handle-left")
        ?.classList.contains("widget-resize-handle-active"),
    ).toBe(true);
    expect(
      document
        .querySelector(".widget-resize-handle-right")
        ?.classList.contains("widget-resize-handle-active"),
    ).toBe(false);
    expect(
      document
        .querySelector(".widget-resize-handle-bottom")
        ?.classList.contains("widget-resize-handle-active"),
    ).toBe(false);

    await awaitAct(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", { clientX: 48, clientY: 120 }),
      );
      window.dispatchEvent(
        pointerEvent("pointerup", { clientX: 48, clientY: 120 }),
      );
    });
    await flushShellEffects();

    expect(workspaceApiMocks.updateWidgetInstanceLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({
          dockHeight: 240,
          dockWidth: 408,
          dockX: 48,
          dockY: 0,
        }),
        widgetInstanceId: "widget_notes_1",
      }),
    );
  });

  it("resizes from the top edge and preserves the bottom edge", async () => {
    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState({
        widgetDefinitionIds: ["notes"],
      }),
    );
    renderShell(
      workbenchViewState({
        widgets: [
          {
            ...notesWidget(),
            layout: {
              ...notesWidget().layout,
              height: 240,
              y: 96,
            },
          },
        ],
      }),
    );
    setLayoutSurfaceRect();

    await awaitAct(() => {
      buttonWithLabel("Resize widget top edge").dispatchEvent(
        pointerEvent("pointerdown", { clientX: 180, clientY: 96 }),
      );
    });
    await flushShellEffects();

    expect(
      document
        .querySelector(".widget-resize-handle-top")
        ?.classList.contains("widget-resize-handle-active"),
    ).toBe(true);

    await awaitAct(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", { clientX: 180, clientY: 48 }),
      );
      window.dispatchEvent(
        pointerEvent("pointerup", { clientX: 180, clientY: 48 }),
      );
    });
    await flushShellEffects();

    expect(workspaceApiMocks.updateWidgetInstanceLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({
          dockHeight: 288,
          dockWidth: 360,
          dockX: 0,
          dockY: 48,
        }),
        widgetInstanceId: "widget_notes_1",
      }),
    );
  });

  it("locks layout from the optional top bar toggle", async () => {
    renderShell(
      workbenchViewState({
        widgets: [notesWidget()],
      }),
    );
    setLayoutSurfaceRect();

    await awaitAct(() => {
      buttonWithText("View").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    await awaitAct(() => {
      buttonWithText("Layout unlocked").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(document.body.textContent).toContain("Layout locked");
    expect(document.querySelector(".widget-header-movable")).toBeNull();
    expect(buttonWithLabel("Resize widget", false)).toBeNull();
    expect(document.querySelector(".widget-resize-handle")).toBeNull();

    await awaitAct(() => {
      document
        .querySelector(".widget-header")
        ?.dispatchEvent(pointerEvent("pointerdown", { clientX: 10, clientY: 10 }));
      window.dispatchEvent(pointerEvent("pointermove", { clientX: 130, clientY: 82 }));
      window.dispatchEvent(pointerEvent("pointerup", { clientX: 130, clientY: 82 }));
    });
    await flushShellEffects();

    expect(workspaceApiMocks.updateWidgetInstanceLayout).not.toHaveBeenCalled();
  });

  it("keeps widget removal behind confirmation", async () => {
    workspaceApiMocks.deleteWidgetInstanceFromWorkbench.mockResolvedValue(
      workspaceWorkbenchState({
        widgetDefinitionIds: [],
      }),
    );
    renderShell(
      workbenchViewState({
        widgets: [notesWidget()],
      }),
    );

    await awaitAct(() => {
      buttonWithText("Remove").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(
      document.querySelector("[aria-label='Remove widget confirmation']"),
    ).not.toBeNull();
    expect(workspaceApiMocks.deleteWidgetInstanceFromWorkbench).not.toHaveBeenCalled();

    await awaitAct(() => {
      buttonWithText("Remove widget").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await flushShellEffects();

    expect(workspaceApiMocks.deleteWidgetInstanceFromWorkbench).toHaveBeenCalledWith(
      expect.objectContaining({
        widgetInstanceId: "widget_notes_1",
      }),
    );
  });
});

describe("WorkbenchShell close workspace", () => {
  it("shows a close workspace action and calls the close handler", async () => {
    const onCloseWorkspace = vi.fn();
    workspaceApiMocks.listTerminalPtySessions.mockResolvedValue([]);

    renderShell(workbenchViewState(), () => undefined, onCloseWorkspace);

    await awaitAct(() => {
      buttonWithText("Close workspace").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onCloseWorkspace).toHaveBeenCalledTimes(1);
  });

  it("does not require Workspace Agent direct mode state for start screen navigation", async () => {
    const onCloseWorkspace = vi.fn();
    workspaceApiMocks.listTerminalPtySessions.mockResolvedValue([]);

    renderShell(
      workbenchViewState({
        widgets: [
          {
            config: {},
            definitionId: "interactive-agent",
            id: "widget_agent_1",
            layout: {
              area: "main",
              height: 560,
              mode: "docked",
              order: 0,
              width: 840,
              x: 0,
              y: 0,
            },
            state: {
              codexDirectModeEnabled: true,
              codexThreadId: "thread_1",
            },
            title: "Workspace Agent",
            visible: true,
          },
        ],
      }),
      () => undefined,
      onCloseWorkspace,
    );

    await awaitAct(() => {
      buttonWithText("Close workspace").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onCloseWorkspace).toHaveBeenCalledTimes(1);
  });
});

function renderShell(
  viewState = workbenchViewState(),
  onViewStateChange: (viewState: WorkbenchViewState) => void = () => undefined,
  onCloseWorkspace?: () => void,
  theme: AppThemeController = themeController(),
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <WorkbenchShell
        onCloseWorkspace={onCloseWorkspace}
        onViewStateChange={onViewStateChange}
        theme={theme}
        viewState={viewState}
      />,
    );
  });
}

function themeController(
  overrides: Partial<AppThemeController> = {},
): AppThemeController {
  return {
    customTheme: {
      basedOn: "dark-default",
      values: {
        accent: "#4a84ff",
        background: "#0b1320",
        border: "#2d3b52",
        mutedText: "#8d97aa",
        surface: "#141d2c",
        surfaceElevated: "#182234",
        text: "#f3f6fb",
      },
    },
    resetCustomTheme: vi.fn(),
    resolvedTheme: {
      id: "dark-default",
      mode: "dark",
      name: "Dark / Default",
      variables: {} as AppThemeController["resolvedTheme"]["variables"],
    },
    selectedThemeId: "dark-default",
    selectCustomTheme: vi.fn(),
    selectPresetTheme: vi.fn(),
    selectUiScale: vi.fn(),
    uiScale: 1,
    updateCustomThemeValue: vi.fn(),
    ...overrides,
  };
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

function buttonWithLabel(label: string): HTMLButtonElement;
function buttonWithLabel(label: string, required: false): HTMLButtonElement | null;
function buttonWithLabel(label: string, required = true) {
  const button = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );

  if (!button && required) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

function buttonInCatalogCard(widgetDefinitionId: string) {
  const button = document.querySelector<HTMLButtonElement>(
    `[data-catalog-template-id="${widgetDefinitionId}"] button`,
  );

  if (!button) {
    throw new Error(`Catalog card button not found: ${widgetDefinitionId}`);
  }

  return button;
}

function widgetElement(widgetInstanceId: string) {
  const element = document.querySelector<HTMLElement>(
    `[data-widget-instance-id="${widgetInstanceId}"]`,
  );
  if (!element) {
    throw new Error(`Widget layout item not found: ${widgetInstanceId}`);
  }
  return element;
}

function resizeButtonInWidget(widgetInstanceId: string, label: string) {
  const button = widgetElement(widgetInstanceId)
    .querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) {
    throw new Error(`Resize button not found: ${widgetInstanceId} ${label}`);
  }
  return button;
}

function pointerEvent(
  type: string,
  {
    button = 0,
    clientX,
    clientY,
    isPrimary = true,
  }: {
    button?: number;
    clientX: number;
    clientY: number;
    isPrimary?: boolean;
  },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button,
    cancelable: true,
    clientX,
    clientY,
  });

  Object.defineProperty(event, "isPrimary", { value: isPrimary });
  Object.defineProperty(event, "pointerId", { value: 1 });

  return event;
}

function setLayoutSurfaceRect() {
  const surface = document.querySelector<HTMLElement>(".widget-layout-surface");

  if (!surface) {
    throw new Error("Widget layout surface not found.");
  }

  surface.getBoundingClientRect = () =>
    ({
      bottom: 900,
      height: 900,
      left: 0,
      right: 1200,
      toJSON: () => ({}),
      top: 0,
      width: 1200,
      x: 0,
      y: 0,
    }) as DOMRect;
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

function notesWidget(): WorkbenchViewState["widgets"][number] {
  return {
    config: {},
    definitionId: "notes",
    id: "widget_notes_1",
    layout: {
      area: "main",
      height: 240,
      mode: "docked",
      order: 0,
      width: 360,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Notes",
    visible: true,
  };
}

function workspaceAgentWidget(): WorkbenchViewState["widgets"][number] {
  return {
    config: {},
    definitionId: INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
    id: "widget_agent_1",
    layout: {
      area: "main",
      height: 672,
      minHeight: 480,
      minWidth: 672,
      mode: "docked",
      order: 0,
      width: 840,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Workspace Agent",
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

function awaitAct(action: () => void) {
  return act(async () => {
    action();
    await Promise.resolve();
  });
}
