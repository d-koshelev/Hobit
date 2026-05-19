import type { WidgetInstanceId, WorkbenchViewState } from "./types";

export type WidgetLogRefreshTokenBumper = (
  widgetInstanceId: WidgetInstanceId,
) => void;

export function requireOpenWorkbench(
  viewState: WorkbenchViewState,
  action: string,
) {
  if (!viewState.workbench.id) {
    throw new Error(`A workbench must be open to ${action}.`);
  }

  return viewState.workbench.id;
}

export function requireWidget(
  viewState: WorkbenchViewState,
  widgetInstanceId: WidgetInstanceId,
  message: string,
) {
  const widget = viewState.widgets.find(
    (candidate) => candidate.id === widgetInstanceId,
  );

  if (!widget) {
    throw new Error(message);
  }

  return widget;
}
