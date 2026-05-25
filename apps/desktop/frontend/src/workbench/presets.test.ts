import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_NAME } from "../workspace/useWorkspaceFlow";
import {
  coordinatorWorkspacePreset,
  defaultWorkbenchPreset,
  emptyWorkbenchPreset,
  workbenchPresetForOriginOrWidgets,
  workbenchPresets,
} from "./presets";
import {
  AGENT_QUEUE_WIDGET_DEFINITION_ID,
  AGENT_RUN_WIDGET_DEFINITION_ID,
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  NOTES_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

describe("workbench presets", () => {
  it("uses Untitled as the default new workspace name", () => {
    expect(DEFAULT_WORKSPACE_NAME).toBe("Untitled");
  });

  it("uses Coordinator Chat and Notes as the default workspace preset", () => {
    expect(defaultWorkbenchPreset).toBe(coordinatorWorkspacePreset);
    expect(
      coordinatorWorkspacePreset.widgets.map((widget) => widget.definitionId),
    ).toEqual([
      INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
      NOTES_WIDGET_DEFINITION_ID,
    ]);
  });

  it("does not add Queue or Executor by default", () => {
    const defaultWidgetDefinitionIds = new Set(
      coordinatorWorkspacePreset.widgets.map((widget) => widget.definitionId),
    );

    expect(defaultWidgetDefinitionIds.has(AGENT_QUEUE_WIDGET_DEFINITION_ID)).toBe(
      false,
    );
    expect(defaultWidgetDefinitionIds.has(AGENT_RUN_WIDGET_DEFINITION_ID)).toBe(
      false,
    );
  });

  it("keeps Empty Workbench available as a manual preset", () => {
    expect(workbenchPresets).toContain(emptyWorkbenchPreset);
    expect(emptyWorkbenchPreset.widgets).toEqual([]);
  });

  it("labels coordinator and notes workbenches without calling them empty", () => {
    expect(
      workbenchPresetForOriginOrWidgets({
        presetOriginId: null,
        widgetDefinitionIds: [
          INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
          NOTES_WIDGET_DEFINITION_ID,
        ],
      }).title,
    ).toBe("Coordinator Workspace");

    expect(
      workbenchPresetForOriginOrWidgets({
        presetOriginId: null,
        widgetDefinitionIds: [],
      }).title,
    ).toBe("Empty Workbench");
  });
});
