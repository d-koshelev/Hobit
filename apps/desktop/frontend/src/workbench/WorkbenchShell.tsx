import { useState } from "react";
import { emptyWorkbenchPreset } from "./presets";
import { WorkbenchCanvas } from "./WorkbenchCanvas";
import { WidgetCatalogShell } from "./WidgetCatalogShell";
import { WorkbenchTopBar } from "./WorkbenchTopBar";
import type { WorkbenchPreset } from "./types";

type WorkbenchShellProps = {
  preset?: WorkbenchPreset;
  workspaceTitle: string;
};

export function WorkbenchShell({
  preset = emptyWorkbenchPreset,
  workspaceTitle,
}: WorkbenchShellProps) {
  const [isWidgetCatalogOpen, setIsWidgetCatalogOpen] = useState(false);
  const openWidgetCatalog = () => setIsWidgetCatalogOpen(true);
  const closeWidgetCatalog = () => setIsWidgetCatalogOpen(false);

  return (
    <main className="app-shell">
      <div className="workbench">
        <WorkbenchTopBar
          onOpenWidgetCatalog={openWidgetCatalog}
          preset={preset}
          workspaceTitle={workspaceTitle}
        />
        <div
          className={`workbench-content${
            isWidgetCatalogOpen ? " workbench-content-catalog-open" : ""
          }`}
        >
          <WorkbenchCanvas
            onOpenWidgetCatalog={openWidgetCatalog}
            preset={preset}
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
