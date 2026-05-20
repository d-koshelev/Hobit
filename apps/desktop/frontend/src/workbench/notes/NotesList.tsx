import type { WorkspaceNote } from "../../workspace/types";
import { DEFAULT_NOTE_TITLE } from "./useWorkspaceNotesController";

export function NotesList({
  draftPinned,
  filteredNotes,
  isLoading,
  isSaving,
  isSelecting,
  loadError,
  notes,
  onSearchTextChange,
  onSelectNote,
  onUpdateDraftPinned,
  searchInputId,
  searchText,
  selectedNote,
}: {
  draftPinned: boolean;
  filteredNotes: WorkspaceNote[];
  isLoading: boolean;
  isSaving: boolean;
  isSelecting: boolean;
  loadError: string | null;
  notes: WorkspaceNote[];
  onSearchTextChange: (value: string) => void;
  onSelectNote: (noteId: string) => void | Promise<void>;
  onUpdateDraftPinned: (value: boolean) => void;
  searchInputId: string;
  searchText: string;
  selectedNote: WorkspaceNote | null;
}) {
  return (
    <aside className="notes-list-pane" aria-label="Workspace notes">
      <input
        aria-label="Filter notes"
        className="input notes-search-input"
        disabled={isLoading || notes.length === 0}
        id={searchInputId}
        onChange={(event) => onSearchTextChange(event.currentTarget.value)}
        placeholder="Filter"
        type="search"
        value={searchText}
      />
      <div className="notes-list" role="list">
        {isLoading ? (
          <p className="empty-state-text">Loading workspace notes.</p>
        ) : loadError ? (
          <p className="empty-state-text" role="alert">
            {loadError}
          </p>
        ) : notes.length === 0 ? (
          <div className="notes-empty-state">
            <p className="empty-state-title">No notes yet.</p>
            <p className="empty-state-text">
              Create one from the header to capture workspace notes.
            </p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <p className="empty-state-text">No matching notes.</p>
        ) : (
          filteredNotes.map((note) => {
            const isSelected = selectedNote?.noteId === note.noteId;

            return (
              <div
                className={
                  isSelected
                    ? "notes-list-item notes-list-item-selected"
                    : "notes-list-item"
                }
                key={note.noteId}
                role="listitem"
              >
                <button
                  aria-current={isSelected ? "true" : undefined}
                  className="notes-list-item-select"
                  disabled={isSelecting}
                  onClick={() => void onSelectNote(note.noteId)}
                  type="button"
                >
                  <span className="notes-list-item-title">
                    {displayNoteTitle(note)}
                  </span>
                  <span className="notes-list-item-preview">
                    {notePreview(note)}
                  </span>
                </button>
                <span className="notes-list-pin-slot">
                  {isSelected ? (
                    <input
                      aria-label={
                        draftPinned ? "Unpin selected note" : "Pin selected note"
                      }
                      checked={draftPinned}
                      className="notes-list-pin-checkbox"
                      disabled={isSelecting || isSaving}
                      onChange={(event) =>
                        onUpdateDraftPinned(event.currentTarget.checked)
                      }
                      title={
                        draftPinned ? "Unpin selected note" : "Pin selected note"
                      }
                      type="checkbox"
                    />
                  ) : note.pinned ? (
                    <span className="notes-pin-marker">Pinned</span>
                  ) : null}
                </span>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function displayNoteTitle(note: WorkspaceNote) {
  return note.title.trim() || DEFAULT_NOTE_TITLE;
}

function notePreview(note: WorkspaceNote) {
  const preview = note.body.replace(/\s+/g, " ").trim();

  return preview || "No body yet.";
}
