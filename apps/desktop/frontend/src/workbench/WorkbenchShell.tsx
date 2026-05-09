import { useState } from "react";
import { addWidgetInstanceToWorkbench } from "../workspace/workspaceApi";
import type { WidgetCatalogTemplate } from "./catalogTemplates";
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
