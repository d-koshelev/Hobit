export type CreateWorkspaceNoteRequest = {
  workspaceId: string;
  title: string;
  body: string;
  pinned: boolean;
};

export type ListWorkspaceNotesRequest = {
  workspaceId: string;
};

export type GetWorkspaceNoteRequest = {
  workspaceId: string;
  noteId: string;
};

export type UpdateWorkspaceNoteRequest = {
  workspaceId: string;
  noteId: string;
  title: string;
  body: string;
  pinned: boolean;
};

export type WorkspaceNote = {
  noteId: string;
  workspaceId: string;
  title: string;
  body: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};
