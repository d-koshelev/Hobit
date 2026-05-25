import {
  addWidgetInstanceToWorkbench,
  updateWidgetInstanceLayout,
} from "../workspace/workspaceApi";
import type { WorkspaceWorkbenchState } from "../workspace/types";
import type { WidgetDefinitionId, WidgetLayout, WorkbenchPreset } from "./types";
import { getWidgetDefinition } from "./widgetRegistry";

type AddPresetWidgetsTarget = {
  existingWidgetDefinitionIds: WidgetDefinitionId[];
  workbenchId: string;
  workspaceId: string;
};

export async function applyPresetWidgetsToWorkspaceState(
  workbenchState: WorkspaceWorkbenchState,
  preset: WorkbenchPreset,
): Promise<WorkspaceWorkbenchState> {
  const workbenchId =
    workbenchState.workbench?.id ?? workbenchState.workspace.workbenchId;

  if (!workbenchId) {
    throw new Error("Workbench is not available for default widget setup.");
  }

  const nextState = await addPresetWidgetsToWorkbench(
    {
      existingWidgetDefinitionIds: workbenchState.widgetInstances.map(
        (widget) => widget.definitionId,
      ),
      workbenchId,
      workspaceId: workbenchState.workspace.id,
    },
    preset,
  );

  return nextState ?? workbenchState;
}

export async function addPresetWidgetsToWorkbench(
  target: AddPresetWidgetsTarget,
  preset: WorkbenchPreset,
): Promise<WorkspaceWorkbenchState | null> {
  let latestWorkbenchState: WorkspaceWorkbenchState | null = null;
  const existingWidgetDefinitionIds = new Set(
    target.existingWidgetDefinitionIds,
  );

  for (const widget of preset.widgets) {
    if (existingWidgetDefinitionIds.has(widget.definitionId)) {
      continue;
    }

    const definition = getWidgetDefinition(widget.definitionId);

    if (!definition) {
      throw new Error(`Unknown widget definition: ${widget.definitionId}`);
    }

    const nextWorkbenchState = await addWidgetInstanceToWorkbench({
      workspaceId: target.workspaceId,
      workbenchId: target.workbenchId,
      definitionId: definition.id,
      title: widget.title || definition.defaultTitle,
      category: definition.category,
    });

    if (!nextWorkbenchState) {
      throw new Error("Preset widget could not be added to the workbench.");
    }

    latestWorkbenchState = nextWorkbenchState;
    existingWidgetDefinitionIds.add(widget.definitionId);

    const createdWidget = nextWorkbenchState.widgetInstances.find(
      (candidate) => candidate.definitionId === widget.definitionId,
    );

    if (!createdWidget) {
      throw new Error("Preset widget could not be found after creation.");
    }

    const layoutWorkbenchState = await updateWidgetInstanceLayout({
      workspaceId: target.workspaceId,
      workbenchId: target.workbenchId,
      widgetInstanceId: createdWidget.id,
      layout: presetWidgetLayoutUpdate(widget.layout, createdWidget.isVisible),
    });

    if (!layoutWorkbenchState) {
      throw new Error("Preset widget layout could not be applied.");
    }

    latestWorkbenchState = layoutWorkbenchState;
  }

  return latestWorkbenchState;
}

function presetWidgetLayoutUpdate(
  layout: WidgetLayout,
  isVisible: boolean,
) {
  return {
    alwaysOnTop:
      layout.mode === "popped-out" ? (layout.popout?.alwaysOnTop ?? false) : false,
    dockHeight: layout.height,
    dockWidth: layout.width,
    dockX: layout.x,
    dockY: layout.y,
    isVisible,
    layoutMode: layout.mode === "popped-out" ? "popped_out" : layout.mode,
    popoutHeight: layout.popout?.height ?? null,
    popoutWidth: layout.popout?.width ?? null,
    popoutX: layout.popout?.x ?? null,
    popoutY: layout.popout?.y ?? null,
  };
}
