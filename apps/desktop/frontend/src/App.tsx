import { useEffect, useRef, useState } from "react";
import { Badge } from "./design-system/Badge";
import { useAppTheme } from "./theme/useAppTheme";
import { WorkbenchShell } from "./workbench/WorkbenchShell";
import type { WorkbenchViewState } from "./workbench/types";
import { WorkspaceStartScreen } from "./workspace/WorkspaceStartScreen";
import type { WorkspaceStartSelection } from "./workspace/selection";
import {
  createWorkspaceRecoveryPassState,
  runWorkspaceRecoveryPass,
  type WorkspaceRecoveryNotice,
} from "./workspace/workspaceRecovery";
import {
  readLastOpenWorkspaceRecord,
  clearLastOpenWorkspaceRecord,
  saveLastOpenWorkspaceRecord,
} from "./workspace/workspaceRecoveryStorage";

export default function App() {
  const theme = useAppTheme();
  const [workbenchViewState, setWorkbenchViewState] =
    useState<WorkbenchViewState | null>(null);
  const [isRecoveringWorkspace, setIsRecoveringWorkspace] = useState(() =>
    readLastOpenWorkspaceRecord() !== null
  );
  const [recoveryNotice, setRecoveryNotice] =
    useState<WorkspaceRecoveryNotice | null>(null);
  const recoveryPassState = useRef(createWorkspaceRecoveryPassState());

  useEffect(() => {
    return runWorkspaceRecoveryPass(recoveryPassState.current, {
      setIsRecoveringWorkspace,
      setRecoveryNotice,
      setWorkbenchViewState,
    });
  }, []);

  function openWorkspace(selection: WorkspaceStartSelection) {
    saveLastOpenWorkspaceRecord(selection.workspace);
    setRecoveryNotice(null);
    setWorkbenchViewState(selection.viewState);
  }

  function closeWorkspace() {
    clearLastOpenWorkspaceRecord();
    setRecoveryNotice(null);
    setWorkbenchViewState(null);
  }

  if (isRecoveringWorkspace) {
    return (
      <main className="workspace-start-shell">
        <section
          aria-labelledby="workspace-recovery-title"
          className="workspace-start workspace-recovery-shell"
        >
          <header className="workspace-start-header">
            <div className="brand" aria-label="Hobit AI Workbench">
              <div className="brand-mark" aria-hidden="true">
                H
              </div>
              <div className="brand-copy">
                <div className="brand-name">Hobit</div>
                <div className="brand-subtitle">AI Workbench</div>
              </div>
            </div>
            <Badge variant="neutral">Recovering</Badge>
          </header>
          <div className="workspace-recovery-progress">
            <h1
              className="workspace-start-heading"
              id="workspace-recovery-title"
            >
              Restoring workspace
            </h1>
            <p className="workspace-start-text">
              Reopening the last active workspace after the renderer reloaded.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!workbenchViewState) {
    return (
      <WorkspaceStartScreen
        onOpenWorkspace={openWorkspace}
        recoveryNotice={recoveryNotice}
        theme={theme}
      />
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
