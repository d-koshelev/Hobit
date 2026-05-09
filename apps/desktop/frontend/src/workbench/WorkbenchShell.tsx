import { useState } from "react";
import {
  addWidgetInstanceToWorkbench,
  updateWidgetInstanceLayout,
  updateWidgetInstanceState,
} from "../workspace/workspaceApi";
import type { WidgetCatalogTemplate } from "./catalogTemplates";
import type { WidgetInstanceId, WidgetLayout, WidgetState } from "./types";
import { WorkbenchCanvas } from "./WorkbenchCanvas";
import { WidgetCatalogShell } from "./WidgetCatalogShell";
import { WorkbenchTopBar } from "./WorkbenchTopBar";
import {
  createWorkbenchViewStateFromWorkspaceState,
  type WorkbenchViewState,
} from "./viewState";

type WorkbenchShellProps = {
  onViewStateChange: (viewState: WorkbenchViewState) => void;
  viewState: WorkbenchViewState;
};

export function WorkbenchShell({
  onViewStateChange,
  viewState,
}: WorkbenchShellProps) {
  const [isWidgetCatalogOpen, setIsWidgetCatalogOpen] = useState(false);
  const openWidgetCatalog = () => setIsWidgetCatalogOpen(true);
  const closeWidgetCatalog = () => setIsWidgetCatalogOpen(false);

  async function addTemplateToWorkbench(template: WidgetCatalogTemplate) {
    if (template.status !== "available" || !viewState.workbench.id) {
      return;
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
        return;
      }

      onViewStateChange(
        createWorkbenchViewStateFromWorkspaceState(workbenchState),
      );
      closeWidgetCatalog();
    } catch (error) {
      console.error("Failed to add widget instance.", error);
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

    onViewStateChange(
      createWorkbenchViewStateFromWorkspaceState(workbenchState),
    );
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

    onViewStateChange(
      createWorkbenchViewStateFromWorkspaceState(workbenchState),
    );
  }

  return (
    <main className="app-shell">
      <div className="workbench">
        <WorkbenchTopBar
          onOpenWidgetCatalog={openWidgetCatalog}
          viewState={viewState}
        />
        <div
          className={`workbench-content${
            isWidgetCatalogOpen ? " workbench-content-catalog-open" : ""
          }`}
        >
          <WorkbenchCanvas
            onOpenWidgetCatalog={openWidgetCatalog}
            onUpdateWidgetLayout={updateWidgetLayout}
            onUpdateWidgetState={updateWidgetState}
            viewState={viewState}
          />
          <WidgetCatalogShell
            isOpen={isWidgetCatalogOpen}
            onAddTemplate={addTemplateToWorkbench}
            onClose={closeWidgetCatalog}
          />
        </div>
      </div>
    </main>
  );
}

function persistedLayoutMode(mode: WidgetLayout["mode"]) {
  return mode === "popped-out" ? "popped_out" : mode;
}
