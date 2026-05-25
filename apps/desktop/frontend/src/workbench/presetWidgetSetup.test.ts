import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceWorkbenchState } from "../workspace/types";
import { coordinatorWorkspacePreset } from "./presets";
import { applyPresetWidgetsToWorkspaceState } from "./presetWidgetSetup";
import {
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  AGENT_RUN_WIDGET_DEFINITION_ID,
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  NOTES_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

const workspaceApiMocks = vi.hoisted(() => ({
  addWidgetInstanceToWorkbench: vi.fn(),
  updateWidgetInstanceLayout: vi.fn(),
}));

vi.mock("../workspace/workspaceApi", () => ({
  addWidgetInstanceToWorkbench: workspaceApiMocks.addWidgetInstanceToWorkbench,
  updateWidgetInstanceLayout: workspaceApiMocks.updateWidgetInstanceLayout,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("preset widget setup", () => {
  it("creates Coordinator Chat and Notes for the default workspace preset", async () => {
    workspaceApiMocks.addWidgetInstanceToWorkbench
      .mockResolvedValueOnce(
        workspaceState({
          widgetDefinitionIds: [INTERACTIVE_AGENT_WIDGET_DEFINITION_ID],
        }),
      )
      .mockResolvedValueOnce(
        workspaceState({
          widgetDefinitionIds: [
            INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
            NOTES_WIDGET_DEFINITION_ID,
          ],
        }),
      );
    workspaceApiMocks.updateWidgetInstanceLayout
      .mockResolvedValueOnce(
        workspaceState({
          widgetDefinitionIds: [INTERACTIVE_AGENT_WIDGET_DEFINITION_ID],
          usePresetLayout: true,
        }),
      )
      .mockResolvedValueOnce(
        workspaceState({
          widgetDefinitionIds: [
            INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
            NOTES_WIDGET_DEFINITION_ID,
          ],
          usePresetLayout: true,
        }),
      );

    const result = await applyPresetWidgetsToWorkspaceState(
      workspaceState(),
      coordinatorWorkspacePreset,
    );

    expect(workspaceApiMocks.addWidgetInstanceToWorkbench).toHaveBeenCalledTimes(
      2,
    );
    expect(
      workspaceApiMocks.addWidgetInstanceToWorkbench.mock.calls.map(
        ([request]) => request.definitionId,
      ),
    ).toEqual([
      INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
      NOTES_WIDGET_DEFINITION_ID,
    ]);
    expect(result.widgetInstances.map((widget) => widget.definitionId)).toEqual(
      [INTERACTIVE_AGENT_WIDGET_DEFINITION_ID, NOTES_WIDGET_DEFINITION_ID],
    );
    expect(result.widgetInstances).toHaveLength(2);
    expect(
      workspaceApiMocks.updateWidgetInstanceLayout.mock.calls.map(
        ([request]) => request.layout,
      ),
    ).toEqual([
      {
        alwaysOnTop: false,
        dockHeight: 560,
        dockWidth: 840,
        dockX: 0,
        dockY: 0,
        isVisible: true,
        layoutMode: "docked",
        popoutHeight: null,
        popoutWidth: null,
        popoutX: null,
        popoutY: null,
      },
      {
        alwaysOnTop: false,
        dockHeight: 560,
        dockWidth: 360,
        dockX: 864,
        dockY: 0,
        isVisible: true,
        layoutMode: "docked",
        popoutHeight: null,
        popoutWidth: null,
        popoutX: null,
        popoutY: null,
      },
    ]);
  });

  it("does not create Queue or Executor widgets for the default preset", async () => {
    workspaceApiMocks.addWidgetInstanceToWorkbench
      .mockResolvedValueOnce(
        workspaceState({
          widgetDefinitionIds: [INTERACTIVE_AGENT_WIDGET_DEFINITION_ID],
        }),
      )
      .mockResolvedValueOnce(
        workspaceState({
          widgetDefinitionIds: [
            INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
            NOTES_WIDGET_DEFINITION_ID,
          ],
        }),
      );
    workspaceApiMocks.updateWidgetInstanceLayout
      .mockResolvedValueOnce(
        workspaceState({
          widgetDefinitionIds: [INTERACTIVE_AGENT_WIDGET_DEFINITION_ID],
          usePresetLayout: true,
        }),
      )
      .mockResolvedValueOnce(
        workspaceState({
          widgetDefinitionIds: [
            INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
            NOTES_WIDGET_DEFINITION_ID,
          ],
          usePresetLayout: true,
        }),
      );

    await applyPresetWidgetsToWorkspaceState(
      workspaceState(),
      coordinatorWorkspacePreset,
    );

    const createdDefinitionIds =
      workspaceApiMocks.addWidgetInstanceToWorkbench.mock.calls.map(
        ([request]) => request.definitionId,
      );

    expect(createdDefinitionIds).not.toContain(AGENT_QUEUE_WIDGET_DEFINITION_ID);
    expect(createdDefinitionIds).not.toContain(AGENT_RUN_WIDGET_DEFINITION_ID);
  });
});

function workspaceState({
  widgetDefinitionIds = [],
  usePresetLayout = false,
}: {
  widgetDefinitionIds?: string[];
  usePresetLayout?: boolean;
} = {}): WorkspaceWorkbenchState {
  return {
    workspace: {
      description: null,
      id: "workspace_1",
      status: "active",
      title: "Untitled",
      workbenchId: "workbench_1",
    },
    workbench: {
      id: "workbench_1",
      presetOriginId: null,
      workspaceId: "workspace_1",
    },
    widgetInstances: widgetDefinitionIds.map((definitionId, index) => {
      const presetWidget = coordinatorWorkspacePreset.widgets.find(
        (widget) => widget.definitionId === definitionId,
      );
      const dockWidth = usePresetLayout
        ? (presetWidget?.layout.width ?? 360)
        : 360;
      const dockHeight = usePresetLayout
        ? (presetWidget?.layout.height ?? 240)
        : 240;
      const dockX = usePresetLayout ? (presetWidget?.layout.x ?? 0) : 0;
      const dockY = usePresetLayout
        ? (presetWidget?.layout.y ?? index * 256)
        : index * 256;

      return {
        alwaysOnTop: false,
        category: "core",
        config: "{}",
        definitionId,
        dockHeight,
        dockWidth,
        dockX,
        dockY,
        id: `widget_${index + 1}`,
        isVisible: true,
        layoutMode: "docked",
        popoutHeight: null,
        popoutWidth: null,
        popoutX: null,
        popoutY: null,
        state: "{}",
        title:
          definitionId === INTERACTIVE_AGENT_WIDGET_DEFINITION_ID
            ? "Coordinator Chat"
            : "Notes",
      };
    }),
    sharedStateObjects: [],
    recentEvents: [],
  };
}
