import { useState } from "react";
import { WorkbenchShell } from "./workbench/WorkbenchShell";
import type { WorkbenchViewState } from "./workbench/types";
import { WorkspaceStartScreen } from "./workspace/WorkspaceStartScreen";
import type { WorkspaceStartSelection } from "./workspace/selection";

export default function App() {
  const [workbenchViewState, setWorkbenchViewState] =
    useState<WorkbenchViewState | null>(null);

  function openWorkspace(selection: WorkspaceStartSelection) {
    setWorkbenchViewState(selection.viewState);
  }

  function closeWorkspace() {
    setWorkbenchViewState(null);
  }

  if (!workbenchViewState) {
    return <WorkspaceStartScreen onOpenWorkspace={openWorkspace} />;
  }

  return (
    <WorkbenchShell
      onCloseWorkspace={closeWorkspace}
      onViewStateChange={setWorkbenchViewState}
      viewState={workbenchViewState}
    />
  );
}
