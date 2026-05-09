import {
  addWidgetInstanceToWorkbench,
  updateWidgetInstanceLayout,
  updateWidgetInstanceState,
} from "../workspace/workspaceApi";
import type { WorkspaceWorkbenchState } from "../workspace/types";
import type { WidgetCatalogTemplate } from "./catalogTemplates";
import type {
  WidgetInstanceId,
  WidgetLayout,
  WidgetState,
  WorkbenchViewState,
} from "./types";
import { createWorkbenchViewStateFromWorkspaceState } from "./viewState";

type UseWorkbenchWidgetActionsOptions = {
  onViewStateChange: (viewState: WorkbenchViewState) => void;
  viewState: WorkbenchViewState;
};

export type WorkbenchWidgetActions = {
  addWidgetTemplate: (template: WidgetCatalogTemplate) => Promise<boolean>;
  updateWidgetLayout: (
    widgetInstanceId: WidgetInstanceId,
    layout: WidgetLayout,
  ) => Promise<void>;
  updateWidgetState: (
    widgetInstanceId: WidgetInstanceId,
    state: WidgetState,
  ) => Promise<void>;
};

export type WorkbenchWidgetInstanceActions = Pick<
  WorkbenchWidgetActions,
  "updateWidgetLayout" | "updateWidgetState"
>;

export function useWorkbenchWidgetActions({
  onViewStateChange,
  viewState,
}: UseWorkbenchWidgetActionsOptions): WorkbenchWidgetActions {
  function applyWorkbenchState(workbenchState: WorkspaceWorkbenchState) {
    onViewStateChange(
      createWorkbenchViewStateFromWorkspaceState(workbenchState),
    );
  }

  async function addWidgetTemplate(template: WidgetCatalogTemplate) {
    if (template.status !== "available" || !viewState.workbench.id) {
      return false;
    }

    try {
      const workbenchState = await addWidgetInstanceToWorkbench({
        workspaceId: viewState.workspace.id,
        workbenchId: viewState.workbench.id,
        definitionId: template.futureWidgetDefinitionId ?? template.id,
        title: template.title,
        category: template.category,
      });

      if (!workbenchState) {
        return false;
      }

      applyWorkbenchState(workbenchState);
      return true;
    } catch (error) {
      console.error("Failed to add widget instance.", error);
      return false;
    }
  }

  async function updateWidgetState(
    widgetInstanceId: WidgetInstanceId,
    state: WidgetState,
  ) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to update widget state.");
    }

    const workbenchState = await updateWidgetInstanceState({
      workspaceId: viewState.workspace.id,
      workbenchId: viewState.workbench.id,
      widgetInstanceId,
      state: JSON.stringify(state),
    });

    if (!workbenchState) {
      throw new Error("Widget state could not be updated.");
    }

    applyWorkbenchState(workbenchState);
  }

  async function updateWidgetLayout(
    widgetInstanceId: WidgetInstanceId,
    layout: WidgetLayout,
  ) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to update widget layout.");
    }

    const widget = viewState.widgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!widget) {
      throw new Error("Widget layout could not be updated.");
    }

    const workbenchState = await updateWidgetInstanceLayout({
      workspaceId: viewState.workspace.id,
      workbenchId: viewState.workbench.id,
      widgetInstanceId,
      layout: {
        layoutMode: persistedLayoutMode(layout.mode),
        dockX: layout.x,
        dockY: layout.y,
        dockWidth: layout.width,
        dockHeight: layout.height,
        popoutX: layout.popout?.x ?? null,
        popoutY: layout.popout?.y ?? null,
        popoutWidth: layout.popout?.width ?? null,
        popoutHeight: layout.popout?.height ?? null,
        alwaysOnTop:
          layout.mode === "popped-out"
            ? (layout.popout?.alwaysOnTop ?? false)
            : false,
        isVisible: widget.visible,
      },
    });

    if (!workbenchState) {
      throw new Error("Widget layout could not be updated.");
    }

    applyWorkbenchState(workbenchState);
  }

  return {
    addWidgetTemplate,
    updateWidgetLayout,
    updateWidgetState,
  };
}

function persistedLayoutMode(mode: WidgetLayout["mode"]) {
  return mode === "popped-out" ? "popped_out" : mode;
}
