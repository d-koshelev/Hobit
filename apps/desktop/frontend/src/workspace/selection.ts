import type { WorkbenchPreset, WorkbenchViewState } from "../workbench/types";
import type { WorkspaceSessionSummary, WorkspaceSummary } from "./types";

export type WorkspaceStartSelection = {
  preset: WorkbenchPreset;
  session: WorkspaceSessionSummary | null;
  viewState: WorkbenchViewState;
  workspace: WorkspaceSummary;
};
