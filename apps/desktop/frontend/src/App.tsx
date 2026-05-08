import { useState } from "react";
import { WorkbenchShell } from "./workbench/WorkbenchShell";
import type { WorkbenchViewState } from "./workbench/viewState";
import { WorkspaceStartScreen } from "./workspace/WorkspaceStartScreen";
import type { WorkspaceStartSelection } from "./workspace/selection";

export default function App() {
  const [workbenchViewState, setWorkbenchViewState] =
    useState<WorkbenchViewState | null>(null);

  function openWorkspace(selection: WorkspaceStartSelection) {
    setWorkbenchViewState(selection.viewState);
  }

  if (!workbenchViewState) {
    return <WorkspaceStartScreen onOpenWorkspace={openWorkspace} />;
  }

  return <WorkbenchShell viewState={workbenchViewState} />;
}
