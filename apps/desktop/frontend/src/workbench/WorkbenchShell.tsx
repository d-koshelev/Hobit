import { useState } from "react";
import { WorkbenchCanvas } from "./WorkbenchCanvas";
import { WidgetCatalogShell } from "./WidgetCatalogShell";
import { WorkbenchTopBar } from "./WorkbenchTopBar";
import type { WorkbenchViewState } from "./viewState";

type WorkbenchShellProps = {
  viewState: WorkbenchViewState;
};

export function WorkbenchShell({ viewState }: WorkbenchShellProps) {
  const [isWidgetCatalogOpen, setIsWidgetCatalogOpen] = useState(false);
  const openWidgetCatalog = () => setIsWidgetCatalogOpen(true);
  const closeWidgetCatalog = () => setIsWidgetCatalogOpen(false);

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
            onClose={closeWidgetCatalog}
          />
        </div>
      </div>
    </main>
  );
}
