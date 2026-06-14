import { describe, expect, it, vi } from "vitest";

import type { WorkspaceWorkbenchState } from "../workspace/types";
import type { WidgetCatalogTemplate } from "./catalogTemplates";
import type { WidgetInstance, WorkbenchViewState } from "./types";
import { createWorkspaceWidgetActions } from "./workspaceWidgetActions";
import {
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  AGENT_RUN_WIDGET_DEFINITION_ID,
  NOTES_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

const workspaceApiMocks = vi.hoisted(() => ({
  addWidgetInstanceToWorkbench: vi.fn(),
  listWidgetLogs: vi.fn(),
  updateWidgetInstanceLayout: vi.fn(),
  updateWidgetInstanceState: vi.fn(),
}));

vi.mock("../workspace/workspaceApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../workspace/workspaceApi")>();

  return {
    ...actual,
    addWidgetInstanceToWorkbench: workspaceApiMocks.addWidgetInstanceToWorkbench,
    listWidgetLogs: workspaceApiMocks.listWidgetLogs,
    updateWidgetInstanceLayout: workspaceApiMocks.updateWidgetInstanceLayout,
    updateWidgetInstanceState: workspaceApiMocks.updateWidgetInstanceState,
  };
});

describe("createWorkspaceWidgetActions Queue singleton add flow", () => {
  it("creates one Agent Queue widget when no Queue view exists", async () => {
    const actions = widgetActions(workbenchViewState());

    workspaceApiMocks.addWidgetInstanceToWorkbench.mockResolvedValue(
      workspaceWorkbenchState([AGENT_QUEUE_WIDGET_DEFINITION_ID]),
    );
    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState([AGENT_QUEUE_WIDGET_DEFINITION_ID]),
    );

    await expect(actions.addWidgetTemplate(queueTemplate())).resolves.toBe(true);

    expect(workspaceApiMocks.addWidgetInstanceToWorkbench).toHaveBeenCalledWith(
      expect.objectContaining({
        definitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
      }),
    );
    expect(workspaceApiMocks.updateWidgetInstanceLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        widgetInstanceId: "widget_1",
      }),
    );
  });

  it("does not create a duplicate Agent Queue widget when the singleton view already exists", async () => {
    const actions = widgetActions(
      workbenchViewState({
        widgets: [queueWidget()],
      }),
    );

    await expect(actions.addWidgetTemplate(queueTemplate())).resolves.toBe(true);

    expect(workspaceApiMocks.addWidgetInstanceToWorkbench).not.toHaveBeenCalled();
    expect(workspaceApiMocks.updateWidgetInstanceLayout).not.toHaveBeenCalled();
  });

  it("restores the existing hidden Agent Queue view instead of creating a duplicate", async () => {
    const hiddenQueue = {
      ...queueWidget(),
      visible: false,
    };
    const applyWorkbenchState = vi.fn();
    const actions = widgetActions(
      workbenchViewState({
        widgets: [hiddenQueue],
      }),
      applyWorkbenchState,
    );

    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState([AGENT_QUEUE_WIDGET_DEFINITION_ID]),
    );

    await expect(actions.addWidgetTemplate(queueTemplate())).resolves.toBe(true);

    expect(workspaceApiMocks.addWidgetInstanceToWorkbench).not.toHaveBeenCalled();
    expect(workspaceApiMocks.updateWidgetInstanceLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({
          isVisible: true,
          layoutMode: "docked",
        }),
        widgetInstanceId: hiddenQueue.id,
      }),
    );
    expect(applyWorkbenchState).toHaveBeenCalledTimes(1);
  });

  it("targets the visible canonical Queue view when a hidden duplicate appears first", async () => {
    const hiddenDuplicate = queueWidget({
      id: "widget_queue_hidden_duplicate",
      order: 0,
      visible: false,
    });
    const visibleCanonical = queueWidget({
      id: "widget_queue_visible_canonical",
      order: 1,
      visible: true,
    });
    const actions = widgetActions(
      workbenchViewState({
        widgets: [hiddenDuplicate, visibleCanonical],
      }),
    );

    await expect(actions.addWidgetTemplate(queueTemplate())).resolves.toBe(true);

    expect(workspaceApiMocks.addWidgetInstanceToWorkbench).not.toHaveBeenCalled();
    expect(workspaceApiMocks.updateWidgetInstanceLayout).not.toHaveBeenCalled();
  });

  it("restores the deterministic canonical hidden Queue view when duplicates are hidden", async () => {
    const laterHiddenDuplicate = queueWidget({
      id: "widget_queue_later",
      order: 2,
      visible: false,
    });
    const earlierHiddenCanonical = queueWidget({
      id: "widget_queue_earlier",
      order: 1,
      visible: false,
    });
    const actions = widgetActions(
      workbenchViewState({
        widgets: [laterHiddenDuplicate, earlierHiddenCanonical],
      }),
    );

    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState([AGENT_QUEUE_WIDGET_DEFINITION_ID]),
    );

    await expect(actions.addWidgetTemplate(queueTemplate())).resolves.toBe(true);

    expect(workspaceApiMocks.addWidgetInstanceToWorkbench).not.toHaveBeenCalled();
    expect(workspaceApiMocks.updateWidgetInstanceLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({
          isVisible: true,
          layoutMode: "docked",
        }),
        widgetInstanceId: earlierHiddenCanonical.id,
      }),
    );
  });

  it("keeps non-singleton widget creation multi-instance", async () => {
    const actions = widgetActions(
      workbenchViewState({
        widgets: [notesWidget()],
      }),
    );

    workspaceApiMocks.addWidgetInstanceToWorkbench.mockResolvedValue(
      workspaceWorkbenchState([NOTES_WIDGET_DEFINITION_ID, NOTES_WIDGET_DEFINITION_ID]),
    );
    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState([NOTES_WIDGET_DEFINITION_ID, NOTES_WIDGET_DEFINITION_ID]),
    );

    await expect(actions.addWidgetTemplate(notesTemplate())).resolves.toBe(true);

    expect(workspaceApiMocks.addWidgetInstanceToWorkbench).toHaveBeenCalledWith(
      expect.objectContaining({
        definitionId: NOTES_WIDGET_DEFINITION_ID,
      }),
    );
  });

  it("does not let compatibility widgets satisfy or bypass the Queue singleton", async () => {
    const actions = widgetActions(
      workbenchViewState({
        widgets: [agentRunWidget()],
      }),
    );

    workspaceApiMocks.addWidgetInstanceToWorkbench.mockResolvedValue(
      workspaceWorkbenchState([
        AGENT_RUN_WIDGET_DEFINITION_ID,
        AGENT_QUEUE_WIDGET_DEFINITION_ID,
      ]),
    );
    workspaceApiMocks.updateWidgetInstanceLayout.mockResolvedValue(
      workspaceWorkbenchState([
        AGENT_RUN_WIDGET_DEFINITION_ID,
        AGENT_QUEUE_WIDGET_DEFINITION_ID,
      ]),
    );

    await expect(actions.addWidgetTemplate(queueTemplate())).resolves.toBe(true);

    expect(workspaceApiMocks.addWidgetInstanceToWorkbench).toHaveBeenCalledWith(
      expect.objectContaining({
        definitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
      }),
    );
  });
});

function widgetActions(
  viewState: WorkbenchViewState,
  applyWorkbenchState: (state: WorkspaceWorkbenchState) => void = () =>
    undefined,
) {
  vi.clearAllMocks();

  return createWorkspaceWidgetActions({
    applyWorkbenchState,
    bumpWidgetLogRefreshToken: () => undefined,
    logRefreshTokens: {},
    viewState,
  });
}

function queueTemplate(): WidgetCatalogTemplate {
  return template({
    category: "workflow",
    futureWidgetDefinitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    title: "Agent Queue",
  });
}

function notesTemplate(): WidgetCatalogTemplate {
  return template({
    category: "notes",
    futureWidgetDefinitionId: NOTES_WIDGET_DEFINITION_ID,
    id: NOTES_WIDGET_DEFINITION_ID,
    title: "Notes",
  });
}

function template(
  overrides: Pick<
    WidgetCatalogTemplate,
    "category" | "futureWidgetDefinitionId" | "id" | "title"
  >,
): WidgetCatalogTemplate {
  return {
    availability: "available",
    capabilitySummary: [],
    catalogCategory: "agents",
    description: "",
    layoutDefaults: {
      defaultHeight: 240,
      defaultWidth: 360,
      minHeight: 240,
      minWidth: 320,
    },
    readiness: "ready",
    ...overrides,
  };
}

function workbenchViewState(
  overrides: Partial<WorkbenchViewState> = {},
): WorkbenchViewState {
  return {
    recentEvents: [],
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
      title: "Workspace",
    },
    ...overrides,
  };
}

function queueWidget(
  overrides: Partial<WidgetInstance> & {
    order?: number;
    visible?: boolean;
    x?: number;
    y?: number;
  } = {},
): WidgetInstance {
  return widget({
    definitionId: AGENT_QUEUE_WIDGET_DEFINITION_ID,
    id: overrides.id ?? "widget_queue_1",
    order: overrides.order,
    title: "Agent Queue",
    visible: overrides.visible,
    x: overrides.x,
    y: overrides.y,
  });
}

function notesWidget(): WidgetInstance {
  return widget({
    definitionId: NOTES_WIDGET_DEFINITION_ID,
    id: "widget_notes_1",
    title: "Notes",
  });
}

function agentRunWidget(): WidgetInstance {
  return widget({
    definitionId: AGENT_RUN_WIDGET_DEFINITION_ID,
    id: "widget_run_1",
    title: "Agent Executor",
  });
}

function widget({
  definitionId,
  id,
  order = 0,
  title,
  visible = true,
  x = 0,
  y = 0,
}: Pick<WidgetInstance, "definitionId" | "id" | "title"> & {
  order?: number;
  visible?: boolean;
  x?: number;
  y?: number;
}): WidgetInstance {
  return {
    config: {},
    definitionId,
    id,
    layout: {
      area: "main",
      height: 240,
      mode: "docked",
      order,
      width: 360,
      x,
      y,
    },
    state: {},
    title,
    visible,
  };
}

function workspaceWorkbenchState(
  widgetDefinitionIds: string[],
): WorkspaceWorkbenchState {
  return {
    recentEvents: [],
    sharedStateObjects: [],
    widgetInstances: widgetDefinitionIds.map((definitionId, index) => ({
      alwaysOnTop: false,
      category: "core",
      config: "{}",
      definitionId,
      dockHeight: 240,
      dockWidth: 360,
      dockX: 0,
      dockY: index * 264,
      id: `widget_${index + 1}`,
      isVisible: true,
      layoutMode: "docked",
      popoutHeight: null,
      popoutWidth: null,
      popoutX: null,
      popoutY: null,
      state: "{}",
      title: definitionId === AGENT_QUEUE_WIDGET_DEFINITION_ID ? "Agent Queue" : "Notes",
    })),
    workbench: {
      id: "workbench_1",
      presetOriginId: null,
      workspaceId: "workspace_1",
    },
    workspace: {
      createdAt: "2026-06-14T00:00:00.000Z",
      description: null,
      id: "workspace_1",
      knowledgeDocumentCount: 0,
      lastOpenedAt: null,
      noteCount: 0,
      queueTaskCount: 0,
      skillCount: 0,
      status: "open",
      title: "Workspace",
      updatedAt: "2026-06-14T00:00:00.000Z",
      widgetCount: widgetDefinitionIds.length,
      workbenchId: "workbench_1",
      workspaceAgentCount: 0,
    },
  };
}
