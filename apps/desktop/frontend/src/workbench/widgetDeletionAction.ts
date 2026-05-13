import { deleteWidgetInstanceFromWorkbench } from "../workspace/workspaceApi";
import type { WorkspaceWorkbenchState } from "../workspace/types";
import type { WidgetInstanceId, WorkbenchViewState } from "./types";

export async function removeWidgetInstanceFromWorkbenchView(
  viewState: WorkbenchViewState,
  widgetInstanceId: WidgetInstanceId,
): Promise<WorkspaceWorkbenchState> {
  if (!viewState.workbench.id) {
    throw new Error("A workbench must be open to remove a widget.");
  }

  const widget = viewState.widgets.find(
    (candidate) => candidate.id === widgetInstanceId,
  );

  if (!widget) {
    throw new Error("Widget could not be removed from this workbench.");
  }

  const workbenchState = await deleteWidgetInstanceFromWorkbench({
    workspaceId: viewState.workspace.id,
    workbenchId: viewState.workbench.id,
    widgetInstanceId,
  });

  if (!workbenchState) {
    throw new Error("Widget was not found in this workbench.");
  }

  return workbenchState;
}
