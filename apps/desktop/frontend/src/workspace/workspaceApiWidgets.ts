import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  AddWidgetInstanceToWorkbenchRequest,
  DeleteWidgetInstanceFromWorkbenchRequest,
  ListWidgetLogsRequest,
  UpdateWidgetInstanceLayoutRequest,
  UpdateWidgetInstanceStateRequest,
  WidgetLogEntry,
  WorkspaceWorkbenchState,
} from "./types";

export function addWidgetInstanceToWorkbench(
  request: AddWidgetInstanceToWorkbenchRequest,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().addWidgetInstanceToWorkbench(request);
}

export function updateWidgetInstanceState(
  request: UpdateWidgetInstanceStateRequest,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().updateWidgetInstanceState(request);
}

export function updateWidgetInstanceLayout(
  request: UpdateWidgetInstanceLayoutRequest,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().updateWidgetInstanceLayout(request);
}

export function deleteWidgetInstanceFromWorkbench(
  request: DeleteWidgetInstanceFromWorkbenchRequest,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().deleteWidgetInstanceFromWorkbench(request);
}

export function listWidgetLogs(
  request: ListWidgetLogsRequest,
): Promise<WidgetLogEntry[]> {
  return getWorkspaceApi().listWidgetLogs(request);
}
