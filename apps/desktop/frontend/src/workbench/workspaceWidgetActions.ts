import {
  addWidgetInstanceToWorkbench,
  listWidgetLogs,
  updateWidgetInstanceLayout,
  updateWidgetInstanceState,
} from "../workspace/workspaceApi";
import type { WorkspaceWorkbenchState } from "../workspace/types";
import type { WidgetCatalogTemplate } from "./catalogTemplates";
import type {
  WidgetInstanceId,
  WidgetLayout,
  WidgetLogEntry,
  WidgetState,
  WorkbenchViewState,
} from "./types";
import {
  requireOpenWorkbench,
  requireWidget,
  type WidgetLogRefreshTokenBumper,
} from "./workbenchWidgetActionContext";
import { removeWidgetInstanceFromWorkbenchView } from "./widgetDeletionAction";
import { widgetLogEntryFromApi } from "./widgetLogEntryMapping";

export type WorkspaceWidgetActions = {
  addWidgetTemplate: (template: WidgetCatalogTemplate) => Promise<boolean>;
  listWidgetLogs: (
    widgetInstanceId: WidgetInstanceId,
  ) => Promise<WidgetLogEntry[]>;
  logRefreshTokens: Partial<Record<WidgetInstanceId, number>>;
  removeWidgetInstance: (widgetInstanceId: WidgetInstanceId) => Promise<void>;
  updateWidgetLayout: (
    widgetInstanceId: WidgetInstanceId,
    layout: WidgetLayout,
  ) => Promise<void>;
  updateWidgetState: (
    widgetInstanceId: WidgetInstanceId,
    state: WidgetState,
  ) => Promise<void>;
};

type WorkspaceWidgetActionOptions = {
  applyWorkbenchState: (workbenchState: WorkspaceWorkbenchState) => void;
  bumpWidgetLogRefreshToken: WidgetLogRefreshTokenBumper;
  logRefreshTokens: Partial<Record<WidgetInstanceId, number>>;
  viewState: WorkbenchViewState;
};

export function createWorkspaceWidgetActions({
  applyWorkbenchState,
  bumpWidgetLogRefreshToken,
  logRefreshTokens,
  viewState,
}: WorkspaceWidgetActionOptions): WorkspaceWidgetActions {
  async function addWidgetTemplate(template: WidgetCatalogTemplate) {
    if (template.availability !== "available" || !viewState.workbench.id) {
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
    const workbenchId = requireOpenWorkbench(
      viewState,
      "update widget state",
    );

    const workbenchState = await updateWidgetInstanceState({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      state: JSON.stringify(state),
    });

    if (!workbenchState) {
      throw new Error("Widget state could not be updated.");
    }

    applyWorkbenchState(workbenchState);
    bumpWidgetLogRefreshToken(widgetInstanceId);
  }

  async function updateWidgetLayout(
    widgetInstanceId: WidgetInstanceId,
    layout: WidgetLayout,
  ) {
    const workbenchId = requireOpenWorkbench(
      viewState,
      "update widget layout",
    );
    const widget = requireWidget(
      viewState,
      widgetInstanceId,
      "Widget layout could not be updated.",
    );

    const workbenchState = await updateWidgetInstanceLayout({
      workspaceId: viewState.workspace.id,
      workbenchId,
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
    bumpWidgetLogRefreshToken(widgetInstanceId);
  }

  async function removeWidgetInstance(widgetInstanceId: WidgetInstanceId) {
    const workbenchState = await removeWidgetInstanceFromWorkbenchView(
      viewState,
      widgetInstanceId,
    );
    applyWorkbenchState(workbenchState);
  }

  async function loadWidgetLogs(widgetInstanceId: WidgetInstanceId) {
    const workbenchId = requireOpenWorkbench(viewState, "load widget logs");
    requireWidget(
      viewState,
      widgetInstanceId,
      "Widget logs could not be loaded.",
    );

    const logs = await listWidgetLogs({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      limit: 100,
    });

    return logs.map(widgetLogEntryFromApi);
  }

  return {
    addWidgetTemplate,
    listWidgetLogs: loadWidgetLogs,
    logRefreshTokens,
    removeWidgetInstance,
    updateWidgetLayout,
    updateWidgetState,
  };
}

function persistedLayoutMode(mode: WidgetLayout["mode"]) {
  return mode === "popped-out" ? "popped_out" : mode;
}
