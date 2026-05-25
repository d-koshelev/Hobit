import { addWidgetInstanceToWorkbench } from "../workspace/workspaceApi";
import type { WorkspaceWorkbenchState } from "../workspace/types";
import type { WidgetDefinitionId, WorkbenchPreset } from "./types";
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
  }

  return latestWorkbenchState;
}
