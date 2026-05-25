import type { WidgetDefinitionId, WorkbenchPreset } from "./types";
import {
  INTERACTIVE_AGENT_WIDGET_DEFINITION_ID,
  NOTES_WIDGET_DEFINITION_ID,
} from "./widgetRegistry";

export const COORDINATOR_WORKSPACE_PRESET_ID = "coordinator-notes";
export const EMPTY_WORKBENCH_PRESET_ID = "empty";

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
        width: 720,
        height: 520,
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
        x: 736,
        y: 0,
        width: 420,
        height: 520,
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
