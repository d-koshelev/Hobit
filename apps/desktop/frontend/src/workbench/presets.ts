import type { WidgetDefinitionId, WidgetInstance, WorkbenchPreset } from "./types";
import {
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  NOTES_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

export const COORDINATOR_WORKSPACE_PRESET_ID = "coordinator-notes";
export const EMPTY_WORKBENCH_PRESET_ID = "empty";
export const COORDINATOR_NOTES_SIDE_BY_SIDE_MIN_WIDTH = 984;
export const COORDINATOR_NOTES_LAYOUT_GAP = 24;
export const DEFAULT_COORDINATOR_CHAT_WIDTH = 840;
export const DEFAULT_COORDINATOR_CHAT_HEIGHT = 672;
export const DEFAULT_NOTES_WIDTH = 360;
export const DEFAULT_NOTES_HEIGHT = 672;

export const coordinatorWorkspacePreset: WorkbenchPreset = {
  id: COORDINATOR_WORKSPACE_PRESET_ID,
  title: "Coordinator Workspace",
  description: "Coordinator Chat with Notes as the lightweight companion.",
  widgets: [
    {
      id: "preset_coordinator_chat",
      definitionId: INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
      title: "Coordinator Chat",
      config: {},
      state: {},
      layout: {
        area: "main",
        mode: "docked",
        order: 0,
        x: 0,
        y: 0,
        width: DEFAULT_COORDINATOR_CHAT_WIDTH,
        height: DEFAULT_COORDINATOR_CHAT_HEIGHT,
      },
      visible: true,
    },
    {
      id: "preset_notes",
      definitionId: NOTES_WIDGET_DEFINITION_ID,
      title: "Notes",
      config: {},
      state: {},
      layout: {
        area: "main",
        mode: "docked",
        order: 1,
        x: DEFAULT_COORDINATOR_CHAT_WIDTH + COORDINATOR_NOTES_LAYOUT_GAP,
        y: 0,
        width: DEFAULT_NOTES_WIDTH,
        height: DEFAULT_NOTES_HEIGHT,
      },
      visible: true,
    },
  ],
};

export const emptyWorkbenchPreset: WorkbenchPreset = {
  id: EMPTY_WORKBENCH_PRESET_ID,
  title: "Empty Workbench",
  description: "Advanced manual workbench surface for composing widgets.",
  widgets: [],
};

export const defaultWorkbenchPreset = coordinatorWorkspacePreset;

export const workbenchPresets = [
  coordinatorWorkspacePreset,
  emptyWorkbenchPreset,
];

export function workbenchPresetForOriginOrWidgets({
  presetOriginId,
  widgetDefinitionIds,
}: {
  presetOriginId: string | null | undefined;
  widgetDefinitionIds: WidgetDefinitionId[];
}) {
  const originPreset = workbenchPresets.find(
    (preset) => preset.id === presetOriginId,
  );

  if (originPreset) {
    return originPreset;
  }

  if (isCoordinatorNotesWidgetSet(widgetDefinitionIds)) {
    return coordinatorWorkspacePreset;
  }

  if (widgetDefinitionIds.length === 0) {
    return emptyWorkbenchPreset;
  }

  return {
    id: null,
    title: "Custom Workbench",
    description: "Operator-composed workbench surface.",
  };
}

export function isCoordinatorNotesWidgetSet(
  widgetDefinitionIds: WidgetDefinitionId[],
) {
  const definitionIdSet = new Set(widgetDefinitionIds);

  return (
    definitionIdSet.has(INTERACTIVE_AGENT_WIDGET_DEFINITION_ID) &&
    definitionIdSet.has(NOTES_WIDGET_DEFINITION_ID)
  );
}

export function coordinatorNotesWidgetsForCanvasWidth({
  canvasWidth,
  presetId,
  widgets,
}: {
  canvasWidth: number | null;
  presetId: WorkbenchPreset["id"] | null;
  widgets: WidgetInstance[];
}): WidgetInstance[] {
  if (
    presetId !== COORDINATOR_WORKSPACE_PRESET_ID ||
    canvasWidth === null ||
    widgets.length !== 2 ||
    !hasDefaultCoordinatorNotesGeometry(widgets)
  ) {
    return widgets;
  }

  const coordinator = widgets.find(
    (widget) => widget.definitionId === INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  );
  const notes = widgets.find(
    (widget) => widget.definitionId === NOTES_WIDGET_DEFINITION_ID,
  );

  if (!coordinator || !notes) {
    return widgets;
  }

  if (canvasWidth < COORDINATOR_NOTES_SIDE_BY_SIDE_MIN_WIDTH) {
    return widgets.map((widget) => {
      if (widget.id === coordinator.id) {
        return {
          ...widget,
          layout: {
            ...widget.layout,
            height: DEFAULT_COORDINATOR_CHAT_HEIGHT,
            width: canvasWidth,
            x: 0,
            y: 0,
          },
        };
      }

      return {
        ...widget,
        layout: {
          ...widget.layout,
          height: DEFAULT_NOTES_HEIGHT,
          width: canvasWidth,
          x: 0,
          y: DEFAULT_COORDINATOR_CHAT_HEIGHT + COORDINATOR_NOTES_LAYOUT_GAP,
        },
      };
    });
  }

  const notesWidth = clamp(Math.round(canvasWidth * 0.3), 320, 420);
  const coordinatorWidth =
    canvasWidth - notesWidth - COORDINATOR_NOTES_LAYOUT_GAP;

  return widgets.map((widget) => {
    if (widget.id === coordinator.id) {
      return {
        ...widget,
        layout: {
          ...widget.layout,
          height: DEFAULT_COORDINATOR_CHAT_HEIGHT,
          width: coordinatorWidth,
          x: 0,
          y: 0,
        },
      };
    }

    return {
      ...widget,
      layout: {
        ...widget.layout,
        height: DEFAULT_NOTES_HEIGHT,
        width: notesWidth,
        x: coordinatorWidth + COORDINATOR_NOTES_LAYOUT_GAP,
        y: 0,
      },
    };
  });
}

function hasDefaultCoordinatorNotesGeometry(widgets: WidgetInstance[]) {
  const coordinator = widgets.find(
    (widget) => widget.definitionId === INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  );
  const notes = widgets.find(
    (widget) => widget.definitionId === NOTES_WIDGET_DEFINITION_ID,
  );

  return (
    coordinator?.layout.mode === "docked" &&
    coordinator.layout.x === 0 &&
    coordinator.layout.y === 0 &&
    coordinator.layout.width === DEFAULT_COORDINATOR_CHAT_WIDTH &&
    coordinator.layout.height === DEFAULT_COORDINATOR_CHAT_HEIGHT &&
    notes?.layout.mode === "docked" &&
    notes.layout.x ===
      DEFAULT_COORDINATOR_CHAT_WIDTH + COORDINATOR_NOTES_LAYOUT_GAP &&
    notes.layout.y === 0 &&
    notes.layout.width === DEFAULT_NOTES_WIDTH &&
    notes.layout.height === DEFAULT_NOTES_HEIGHT
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
