import { useState } from "react";
import { useAppTheme } from "./theme/useAppTheme";
import { WorkbenchShell } from "./workbench/WorkbenchShell";
import type { WorkbenchViewState } from "./workbench/types";
import { WorkspaceStartScreen } from "./workspace/WorkspaceStartScreen";
import type { WorkspaceStartSelection } from "./workspace/selection";

export default function App() {
  const theme = useAppTheme();
  const [workbenchViewState, setWorkbenchViewState] =
    useState<WorkbenchViewState | null>(null);

  function openWorkspace(selection: WorkspaceStartSelection) {
    setWorkbenchViewState(selection.viewState);
  }

  function closeWorkspace() {
    setWorkbenchViewState(null);
  }

  if (!workbenchViewState) {
    return (
      <WorkspaceStartScreen onOpenWorkspace={openWorkspace} theme={theme} />
    );
  }

  return (
    <WorkbenchShell
      onCloseWorkspace={closeWorkspace}
      onViewStateChange={setWorkbenchViewState}
      theme={theme}
      viewState={workbenchViewState}
    />
  );
}
