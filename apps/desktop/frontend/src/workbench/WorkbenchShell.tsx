import { useState } from "react";
import type { WidgetCatalogTemplate } from "./catalogTemplates";
import { useCurrentSessionActivity } from "./useCurrentSessionActivity";
import { useWorkbenchWidgetActions } from "./useWorkbenchWidgetActions";
import { WorkbenchCanvas } from "./WorkbenchCanvas";
import { WidgetCatalogShell } from "./WidgetCatalogShell";
import { WorkbenchTopBar } from "./WorkbenchTopBar";
import type { WorkbenchLayoutMode, WorkbenchViewState } from "./types";

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
  const currentSessionActivity = useCurrentSessionActivity();
  const openWidgetCatalog = () => setIsWidgetCatalogOpen(true);
  const closeWidgetCatalog = () => setIsWidgetCatalogOpen(false);
  const widgetActions = useWorkbenchWidgetActions({
    currentSessionActivity: currentSessionActivity.events,
    onViewStateChange,
    viewState,
  });

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
          layoutMode={layoutMode}
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
            layoutMode={layoutMode}
            onOpenWidgetCatalog={openWidgetCatalog}
            viewState={viewState}
            widgetActions={widgetActions}
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
