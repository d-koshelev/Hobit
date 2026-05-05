import { minimalWorkbenchPreset } from "./presets";
import { WorkbenchCanvas } from "./WorkbenchCanvas";
import { WorkbenchTopBar } from "./WorkbenchTopBar";

export function WorkbenchShell() {
  const preset = minimalWorkbenchPreset;

  return (
    <main className="app-shell">
      <div className="workbench">
        <WorkbenchTopBar preset={preset} />
        <WorkbenchCanvas preset={preset} />
      </div>
    </main>
  );
}
