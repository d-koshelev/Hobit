import type { WorkbenchPreset } from "../workbench/types";
import type { WorkspaceSessionSummary, WorkspaceSummary } from "./types";

export type WorkspaceStartSelection = {
  preset: WorkbenchPreset;
  session: WorkspaceSessionSummary | null;
  workspace: WorkspaceSummary;
};
