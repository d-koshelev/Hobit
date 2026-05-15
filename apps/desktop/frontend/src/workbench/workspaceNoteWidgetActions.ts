import {
  createWorkspaceNote,
  getWorkspaceNote,
  listWorkspaceNotes,
  updateWorkspaceNote,
} from "../workspace/workspaceApi";
import type {
  CreateWorkspaceNoteRequest,
  UpdateWorkspaceNoteRequest,
  WorkspaceNote,
} from "../workspace/types";
import type { WorkbenchViewState } from "./types";

export type WorkspaceNoteCreateRequest = Omit<
  CreateWorkspaceNoteRequest,
  "workspaceId"
>;

export type WorkspaceNoteUpdateRequest = Omit<
  UpdateWorkspaceNoteRequest,
  "workspaceId"
>;

export type WorkspaceNoteWidgetActions = {
  createWorkspaceNote: (
    request: WorkspaceNoteCreateRequest,
  ) => Promise<WorkspaceNote>;
  listWorkspaceNotes: () => Promise<WorkspaceNote[]>;
  getWorkspaceNote: (noteId: string) => Promise<WorkspaceNote | null>;
  updateWorkspaceNote: (
    request: WorkspaceNoteUpdateRequest,
  ) => Promise<WorkspaceNote | null>;
};

export function createWorkspaceNoteActions(
  viewState: WorkbenchViewState,
): WorkspaceNoteWidgetActions {
  return {
    createWorkspaceNote: (request) => {
      requireOpenWorkbench(viewState, "create workspace notes");
      return createWorkspaceNote({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    getWorkspaceNote: (noteId) => {
      requireOpenWorkbench(viewState, "read workspace notes");
      return getWorkspaceNote({
        workspaceId: viewState.workspace.id,
        noteId,
      });
    },
    listWorkspaceNotes: () => {
      requireOpenWorkbench(viewState, "read workspace notes");
      return listWorkspaceNotes({
        workspaceId: viewState.workspace.id,
      });
    },
    updateWorkspaceNote: (request) => {
      requireOpenWorkbench(viewState, "update workspace notes");
      return updateWorkspaceNote({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
  };
}

function requireOpenWorkbench(viewState: WorkbenchViewState, action: string) {
  if (!viewState.workbench.id) {
    throw new Error(`A workbench must be open to ${action}.`);
  }
}
