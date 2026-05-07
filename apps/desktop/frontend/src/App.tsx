import { useState } from "react";
import { WorkbenchShell } from "./workbench/WorkbenchShell";
import { WorkspaceStartScreen } from "./workspace/WorkspaceStartScreen";
import type { WorkspaceStartSelection } from "./workspace/selection";

export default function App() {
  const [activeWorkspace, setActiveWorkspace] =
    useState<WorkspaceStartSelection | null>(null);

  if (!activeWorkspace) {
    return <WorkspaceStartScreen onOpenWorkspace={setActiveWorkspace} />;
  }

  return (
    <WorkbenchShell
      preset={activeWorkspace.preset}
      workspaceTitle={activeWorkspace.workspace.title}
    />
  );
}
