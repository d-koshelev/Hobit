import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_NAME } from "../workspace/useWorkspaceFlow";
import {
  COORDINATOR_NOTES_LAYOUT_GAP,
  COORDINATOR_NOTES_SIDE_BY_SIDE_MIN_WIDTH,
  DEFAULT_COORDINATOR_CHAT_HEIGHT,
  DEFAULT_COORDINATOR_CHAT_WIDTH,
  DEFAULT_NOTES_HEIGHT,
  DEFAULT_NOTES_WIDTH,
  coordinatorNotesWidgetsForCanvasWidth,
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

  it("uses Workspace Agent and Notes as the default workspace preset", () => {
    expect(defaultWorkbenchPreset).toBe(coordinatorWorkspacePreset);
    expect(
      coordinatorWorkspacePreset.widgets.map((widget) => widget.definitionId),
    ).toEqual([
      INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
      NOTES_WIDGET_DEFINITION_ID,
    ]);
  });

  it("places Workspace Agent as the larger primary default widget", () => {
    const coordinator = coordinatorWorkspacePreset.widgets[0];
    const notes = coordinatorWorkspacePreset.widgets[1];

    expect(coordinator.definitionId).toBe(INTERACTIVE_AGENT_WIDGET_DEFINITION_ID);
    expect(notes.definitionId).toBe(NOTES_WIDGET_DEFINITION_ID);
    expect(coordinatorWorkspacePreset.widgets).toHaveLength(2);
    expect(coordinator.layout.width).toBe(DEFAULT_COORDINATOR_CHAT_WIDTH);
    expect(coordinator.layout.height).toBeGreaterThanOrEqual(640);
    expect(coordinator.layout.height).toBeLessThanOrEqual(700);
    expect(coordinator.layout.height).toBe(DEFAULT_COORDINATOR_CHAT_HEIGHT);
    expect(notes.layout.width).toBe(DEFAULT_NOTES_WIDTH);
    expect(notes.layout.height).toBe(DEFAULT_NOTES_HEIGHT);
    expect(coordinator.layout.width).toBeGreaterThan(notes.layout.width);
    expect(coordinator.layout.width * coordinator.layout.height).toBeGreaterThan(
      notes.layout.width * notes.layout.height,
    );
  });

  it("places Notes beside Workspace Agent on a normal desktop layout", () => {
    const coordinator = coordinatorWorkspacePreset.widgets[0];
    const notes = coordinatorWorkspacePreset.widgets[1];

    expect(coordinator.layout.x).toBe(0);
    expect(coordinator.layout.y).toBe(0);
    expect(notes.layout.y).toBe(0);
    expect(notes.layout.x).toBe(
      coordinator.layout.width + COORDINATOR_NOTES_LAYOUT_GAP,
    );
    expect(coordinator.layout.height).toBe(notes.layout.height);
  });

  it("keeps locked default Coordinator and Notes geometry the same as edit geometry at normal desktop width", () => {
    const widgets = coordinatorNotesWidgetsForCanvasWidth({
      canvasWidth: 1440,
      presetId: coordinatorWorkspacePreset.id,
      widgets: coordinatorWorkspacePreset.widgets,
    });

    expect(widgets.map((widget) => widget.layout)).toEqual(
      coordinatorWorkspacePreset.widgets.map((widget) => widget.layout),
    );
  });

  it("does not stretch Workspace Agent to fill locked mode at normal desktop width", () => {
    const widgets = coordinatorNotesWidgetsForCanvasWidth({
      canvasWidth: 1440,
      presetId: coordinatorWorkspacePreset.id,
      widgets: coordinatorWorkspacePreset.widgets,
    });
    const coordinator = widgets[0];
    const notes = widgets[1];

    expect(coordinator.layout.width).toBe(DEFAULT_COORDINATOR_CHAT_WIDTH);
    expect(notes.layout.width).toBe(DEFAULT_NOTES_WIDTH);
    expect(notes.layout.x).toBe(
      DEFAULT_COORDINATOR_CHAT_WIDTH + COORDINATOR_NOTES_LAYOUT_GAP,
    );
    expect(coordinator.layout.y).toBe(notes.layout.y);
  });

  it("stacks Workspace Agent before Notes only for narrow canvas widths", () => {
    const widgets = coordinatorNotesWidgetsForCanvasWidth({
      canvasWidth: COORDINATOR_NOTES_SIDE_BY_SIDE_MIN_WIDTH - 1,
      presetId: coordinatorWorkspacePreset.id,
      widgets: coordinatorWorkspacePreset.widgets,
    });
    const coordinator = widgets[0];
    const notes = widgets[1];

    expect(coordinator.layout.x).toBe(0);
    expect(coordinator.layout.y).toBe(0);
    expect(notes.layout.x).toBe(0);
    expect(notes.layout.y).toBe(
      DEFAULT_COORDINATOR_CHAT_HEIGHT + COORDINATOR_NOTES_LAYOUT_GAP,
    );
  });

  it("respects persisted widget geometry in locked mode when the layout is not the default preset geometry", () => {
    const persistedWidgets = coordinatorWorkspacePreset.widgets.map(
      (widget, index) => ({
        ...widget,
        layout: {
          ...widget.layout,
          height: index === 0 ? 600 : 540,
          width: index === 0 ? 720 : 300,
          x: index === 0 ? 48 : 792,
          y: index === 0 ? 24 : 48,
        },
      }),
    );

    const widgets = coordinatorNotesWidgetsForCanvasWidth({
      canvasWidth: 1440,
      presetId: coordinatorWorkspacePreset.id,
      widgets: persistedWidgets,
    });

    expect(widgets.map((widget) => widget.layout)).toEqual(
      persistedWidgets.map((widget) => widget.layout),
    );
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
    ).toBe("Agent + Notes Workbench");

    expect(
      workbenchPresetForOriginOrWidgets({
        presetOriginId: null,
        widgetDefinitionIds: [],
      }).title,
    ).toBe("Empty Workbench");
  });
});
