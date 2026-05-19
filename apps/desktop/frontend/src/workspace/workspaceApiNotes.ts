import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  CreateWorkspaceNoteRequest,
  GetWorkspaceNoteRequest,
  ListWorkspaceNotesRequest,
  UpdateWorkspaceNoteRequest,
  WorkspaceNote,
} from "./types";

export function createWorkspaceNote(
  request: CreateWorkspaceNoteRequest,
): Promise<WorkspaceNote> {
  return getWorkspaceApi().createWorkspaceNote(request);
}

export function listWorkspaceNotes(
  request: ListWorkspaceNotesRequest,
): Promise<WorkspaceNote[]> {
  return getWorkspaceApi().listWorkspaceNotes(request);
}

export function getWorkspaceNote(
  request: GetWorkspaceNoteRequest,
): Promise<WorkspaceNote | null> {
  return getWorkspaceApi().getWorkspaceNote(request);
}

export function updateWorkspaceNote(
  request: UpdateWorkspaceNoteRequest,
): Promise<WorkspaceNote | null> {
  return getWorkspaceApi().updateWorkspaceNote(request);
}
