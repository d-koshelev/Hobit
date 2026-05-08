import { useState } from "react";
import { WorkbenchShell } from "./workbench/WorkbenchShell";
import {
  createWorkbenchViewStateFromSelection,
  type WorkbenchViewState,
} from "./workbench/viewState";
import { WorkspaceStartScreen } from "./workspace/WorkspaceStartScreen";
import type { WorkspaceStartSelection } from "./workspace/selection";

export default function App() {
  const [workbenchViewState, setWorkbenchViewState] =
    useState<WorkbenchViewState | null>(null);

  function openWorkspace(selection: WorkspaceStartSelection) {
    setWorkbenchViewState(createWorkbenchViewStateFromSelection(selection));
  }

  if (!workbenchViewState) {
    return <WorkspaceStartScreen onOpenWorkspace={openWorkspace} />;
  }

  return <WorkbenchShell viewState={workbenchViewState} />;
}
