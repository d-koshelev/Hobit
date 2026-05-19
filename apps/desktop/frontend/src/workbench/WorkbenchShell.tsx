import { useState } from "react";
import type { WidgetCatalogTemplate } from "./catalogTemplates";
import { useCurrentSessionActivity } from "./useCurrentSessionActivity";
import { useWorkbenchWidgetActions } from "./useWorkbenchWidgetActions";
import { WorkbenchCanvas } from "./WorkbenchCanvas";
import { WidgetCatalogShell } from "./WidgetCatalogShell";
import { WorkbenchTopBar } from "./WorkbenchTopBar";
import type { WorkbenchLayoutMode, WorkbenchViewState } from "./types";
import { DEFAULT_WORKBENCH_GRID_SIZE } from "./workbenchLayoutGeometry";
import { AGENT_QUEUE_WIDGET_DEFINITION_ID } from "./widgetRegistry";

type WorkbenchShellProps = {
  onViewStateChange: (viewState: WorkbenchViewState) => void;
  viewState: WorkbenchViewState;
};

export function WorkbenchShell({
  onViewStateChange,
  viewState,
}: WorkbenchShellProps) {
  const [isWidgetCatalogOpen, setIsWidgetCatalogOpen] = useState(false);
  const [layoutMode, setLayoutMode] =
    useState<WorkbenchLayoutMode>("locked");
  const [gridSize, setGridSize] = useState(DEFAULT_WORKBENCH_GRID_SIZE);
  const currentSessionActivity = useCurrentSessionActivity();
  const openWidgetCatalog = () => setIsWidgetCatalogOpen(true);
  const closeWidgetCatalog = () => setIsWidgetCatalogOpen(false);
  const widgetActions = useWorkbenchWidgetActions({
    currentSessionActivity: currentSessionActivity.events,
    onViewStateChange,
    viewState,
  });
  const hasAgentQueueWidget = viewState.widgets.some(
    (widget) => widget.definitionId === AGENT_QUEUE_WIDGET_DEFINITION_ID,
  );

  async function addTemplateToWorkbench(template: WidgetCatalogTemplate) {
    const didAddWidget = await widgetActions.addWidgetTemplate(template);

    if (didAddWidget) {
      closeWidgetCatalog();
    }
  }

  return (
    <main className="app-shell">
      <div className="workbench">
        <WorkbenchTopBar
          activityStatus={currentSessionActivity.status}
          gridSize={gridSize}
          layoutMode={layoutMode}
          onGridSizeChange={setGridSize}
          onLayoutModeChange={setLayoutMode}
          onOpenWidgetCatalog={openWidgetCatalog}
          viewState={viewState}
        />
        <div
          className={`workbench-content${
            isWidgetCatalogOpen ? " workbench-content-catalog-open" : ""
          }`}
        >
          <WorkbenchCanvas
            gridSize={gridSize}
            layoutMode={layoutMode}
            onOpenWidgetCatalog={openWidgetCatalog}
            viewState={viewState}
            widgetActions={widgetActions}
          />
          <WidgetCatalogShell
            unavailableTemplateMessages={
              hasAgentQueueWidget
                ? {
                    [AGENT_QUEUE_WIDGET_DEFINITION_ID]: {
                      actionLabel: "Already added",
                      reason: "One Agent Queue per workspace",
                    },
                  }
                : undefined
            }
            isOpen={isWidgetCatalogOpen}
            onAddTemplate={addTemplateToWorkbench}
            onClose={closeWidgetCatalog}
          />
        </div>
      </div>
    </main>
  );
}
