import { WorkbenchCanvas } from "./WorkbenchCanvas";
import { WorkbenchTopBar } from "./WorkbenchTopBar";

export function WorkbenchShell() {
  return (
    <main className="app-shell">
      <div className="workbench">
        <WorkbenchTopBar />
        <WorkbenchCanvas />
      </div>
    </main>
  );
}
