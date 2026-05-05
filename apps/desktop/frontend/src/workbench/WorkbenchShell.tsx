import { useState } from "react";
import { minimalWorkbenchPreset } from "./presets";
import { WorkbenchCanvas } from "./WorkbenchCanvas";
import { WidgetCatalogShell } from "./WidgetCatalogShell";
import { WorkbenchTopBar } from "./WorkbenchTopBar";

export function WorkbenchShell() {
  const [isWidgetCatalogOpen, setIsWidgetCatalogOpen] = useState(false);
  const preset = minimalWorkbenchPreset;
  const openWidgetCatalog = () => setIsWidgetCatalogOpen(true);
  const closeWidgetCatalog = () => setIsWidgetCatalogOpen(false);

  return (
    <main className="app-shell">
      <div className="workbench">
        <WorkbenchTopBar
          onOpenWidgetCatalog={openWidgetCatalog}
          preset={preset}
        />
        <WorkbenchCanvas
          onOpenWidgetCatalog={openWidgetCatalog}
          preset={preset}
        />
      </div>
      <WidgetCatalogShell
        isOpen={isWidgetCatalogOpen}
        onClose={closeWidgetCatalog}
      />
    </main>
  );
}
