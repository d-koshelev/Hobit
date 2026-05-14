import { invoke } from "@tauri-apps/api/core";
import type {
  CreateWorkspaceNoteRequest,
  GetWorkspaceNoteRequest,
  ListWorkspaceNotesRequest,
  UpdateWorkspaceNoteRequest,
  WorkspaceNote,
} from "./types";

type TauriWorkspaceNote = {
  note_id: string;
  workspace_id: string;
  title: string;
  body: string;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export async function createWorkspaceNote(
  request: CreateWorkspaceNoteRequest,
): Promise<WorkspaceNote> {
  const note = await invoke<TauriWorkspaceNote>("create_workspace_note", {
    request: {
      workspace_id: request.workspaceId,
      title: request.title,
      body: request.body,
      pinned: request.pinned,
    },
  });

  return normalizeWorkspaceNote(note);
}

export async function listWorkspaceNotes(
  request: ListWorkspaceNotesRequest,
): Promise<WorkspaceNote[]> {
  const notes = await invoke<TauriWorkspaceNote[]>("list_workspace_notes", {
    request: {
      workspace_id: request.workspaceId,
    },
  });

  return notes.map(normalizeWorkspaceNote);
}

export async function getWorkspaceNote(
  request: GetWorkspaceNoteRequest,
): Promise<WorkspaceNote | null> {
  const note = await invoke<TauriWorkspaceNote | null>("get_workspace_note", {
    request: {
      workspace_id: request.workspaceId,
      note_id: request.noteId,
    },
  });

  return note ? normalizeWorkspaceNote(note) : null;
}

export async function updateWorkspaceNote(
  request: UpdateWorkspaceNoteRequest,
): Promise<WorkspaceNote | null> {
  const note = await invoke<TauriWorkspaceNote | null>("update_workspace_note", {
    request: {
      workspace_id: request.workspaceId,
      note_id: request.noteId,
      title: request.title,
      body: request.body,
      pinned: request.pinned,
    },
  });

  return note ? normalizeWorkspaceNote(note) : null;
}

function normalizeWorkspaceNote(note: TauriWorkspaceNote): WorkspaceNote {
  return {
    noteId: note.note_id,
    workspaceId: note.workspace_id,
    title: note.title,
    body: note.body,
    pinned: note.pinned,
    archived: note.archived,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  };
}
