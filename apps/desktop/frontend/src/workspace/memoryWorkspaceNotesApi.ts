import type { WorkspaceNote } from "./types";
import type { WorkspaceApi } from "./workspaceApiTypes";

const notesByWorkspaceId = new Map<string, WorkspaceNote[]>();
let nextNoteId = 1;

export const createWorkspaceNote: WorkspaceApi["createWorkspaceNote"] = async (
  request,
) => {
  const now = new Date().toISOString();
  const note: WorkspaceNote = {
    noteId: `dev_memory_note_${nextNoteId++}`,
    workspaceId: request.workspaceId,
    title: request.title,
    body: request.body,
    pinned: request.pinned,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  const notes = getWorkspaceNotes(request.workspaceId);
  notesByWorkspaceId.set(request.workspaceId, [note, ...notes]);

  return cloneWorkspaceNote(note);
};

export const listWorkspaceNotes: WorkspaceApi["listWorkspaceNotes"] = async (
  request,
) => {
  return getSortedWorkspaceNotes(request.workspaceId).map(cloneWorkspaceNote);
};

export const getWorkspaceNote: WorkspaceApi["getWorkspaceNote"] = async (
  request,
) => {
  const note =
    getWorkspaceNotes(request.workspaceId).find(
      (candidate) => candidate.noteId === request.noteId,
    ) ?? null;

  return note ? cloneWorkspaceNote(note) : null;
};

export const updateWorkspaceNote: WorkspaceApi["updateWorkspaceNote"] = async (
  request,
) => {
  const notes = getWorkspaceNotes(request.workspaceId);
  const noteIndex = notes.findIndex((note) => note.noteId === request.noteId);

  if (noteIndex === -1) {
    return null;
  }

  const currentNote = notes[noteIndex];
  const updatedNote: WorkspaceNote = {
    ...currentNote,
    title: request.title,
    body: request.body,
    pinned: request.pinned,
    updatedAt: new Date().toISOString(),
  };
  notesByWorkspaceId.set(
    request.workspaceId,
    notes.map((note, index) => (index === noteIndex ? updatedNote : note)),
  );

  return cloneWorkspaceNote(updatedNote);
};

function getWorkspaceNotes(workspaceId: string) {
  return notesByWorkspaceId.get(workspaceId) ?? [];
}

function getSortedWorkspaceNotes(workspaceId: string) {
  return [...getWorkspaceNotes(workspaceId)].sort(compareWorkspaceNotes);
}

function compareWorkspaceNotes(left: WorkspaceNote, right: WorkspaceNote) {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function cloneWorkspaceNote(note: WorkspaceNote): WorkspaceNote {
  return { ...note };
}
