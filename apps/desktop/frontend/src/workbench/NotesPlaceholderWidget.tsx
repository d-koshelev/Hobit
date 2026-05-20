import { useId } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WorkspaceNote } from "../workspace/types";
import {
  DEFAULT_NOTE_TITLE,
  useWorkspaceNotesController,
} from "./notes/useWorkspaceNotesController";
import type { WidgetRenderProps } from "./types";

export function NotesPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onCreateWorkspaceNote,
  onGetWorkspaceNote,
  onListWorkspaceNotes,
  onLoadLogs,
  onStartFrameMove,
  onUpdateWorkspaceNote,
  title,
}: WidgetRenderProps) {
  const searchInputId = useId();
  const titleInputId = useId();
  const bodyInputId = useId();
  const {
    apiAvailable,
    createNote,
    draftBody,
    draftPinned,
    draftTitle,
    editorError,
    filteredNotes,
    isCreating,
    isDirty,
    isLoading,
    isSaving,
    isSelecting,
    loadError,
    notes,
    refreshNotes,
    saveNote,
    searchText,
    selectNote,
    selectedNote,
    setSearchText,
    updateDraftBody,
    updateDraftPinned,
    updateDraftTitle,
    validationMessage,
  } = useWorkspaceNotesController({
    onCreateWorkspaceNote,
    onGetWorkspaceNote,
    onListWorkspaceNotes,
    onUpdateWorkspaceNote,
  });

  const notesFrameActions = (
    <>
      <Button
        aria-label="Refresh notes"
        className="widget-icon-button"
        disabled={isLoading || isSaving || !apiAvailable}
        onClick={refreshNotes}
        title="Refresh notes"
        variant="ghost"
      >
        <span aria-hidden="true" className="button-icon-refresh" />
      </Button>
      <Button
        disabled={isCreating || isLoading || !apiAvailable}
        onClick={createNote}
        variant="primary"
      >
        {isCreating ? "Creating" : "New note"}
      </Button>
      {frameActions}
    </>
  );
  const frameStatus = statusBadge({
    apiAvailable,
    isDirty,
    isLoading,
    isSaving,
    loadError,
    selectedNote,
  });
  const singleState = notesSingleState({
    isLoading,
    loadError,
    noteCount: notes.length,
  });

  return (
    <WidgetFrame
      actions={notesFrameActions}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={frameStatus}
      title={title}
    >
      {singleState ? (
        <div className="notes-product-shell notes-product-shell-empty">
          <div
            className="notes-empty-state notes-empty-state-compact"
            role={loadError ? "alert" : undefined}
          >
            <p className="empty-state-title">{singleState.title}</p>
            <p className="empty-state-text">{singleState.text}</p>
          </div>
        </div>
      ) : (
        <div className="notes-product-shell">
          <aside className="notes-list-pane" aria-label="Workspace notes">
            <input
              aria-label="Filter notes"
              className="input notes-search-input"
              disabled={isLoading || notes.length === 0}
              id={searchInputId}
              onChange={(event) => setSearchText(event.currentTarget.value)}
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
                        onClick={() => void selectNote(note.noteId)}
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
                              draftPinned
                                ? "Unpin selected note"
                                : "Pin selected note"
                            }
                            checked={draftPinned}
                            className="notes-list-pin-checkbox"
                            disabled={isSelecting || isSaving}
                            onChange={(event) =>
                              updateDraftPinned(event.currentTarget.checked)
                            }
                            title={
                              draftPinned
                                ? "Unpin selected note"
                                : "Pin selected note"
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

          <section className="notes-editor-pane" aria-label="Selected note">
            {isLoading ? (
              <div className="notes-empty-state">
                <p className="empty-state-title">Loading notes.</p>
                <p className="empty-state-text">
                  Workspace-local notes are loading from desktop storage.
                </p>
              </div>
            ) : loadError ? (
              <div className="notes-empty-state" role="alert">
                <p className="empty-state-title">Notes unavailable.</p>
                <p className="empty-state-text">{loadError}</p>
              </div>
            ) : selectedNote ? (
              <div className="notes-editor">
                <input
                  aria-label="Note title"
                  className="input notes-title-input"
                  id={titleInputId}
                  onChange={(event) =>
                    updateDraftTitle(event.currentTarget.value)
                  }
                  placeholder={DEFAULT_NOTE_TITLE}
                  value={draftTitle}
                />
                <textarea
                  aria-label="Note body"
                  className="input notes-body-input"
                  id={bodyInputId}
                  onChange={(event) =>
                    updateDraftBody(event.currentTarget.value)
                  }
                  placeholder="Write note…"
                  value={draftBody}
                />
                <div className="notes-editor-controls">
                  <Button
                    disabled={!selectedNote || !isDirty || isSaving}
                    onClick={saveNote}
                    variant="primary"
                  >
                    {isSaving ? "Saving" : "Save"}
                  </Button>
                </div>
                {validationMessage ? (
                  <p
                    className="notes-message notes-message-warning"
                    role="alert"
                  >
                    {validationMessage}
                  </p>
                ) : null}
                {editorError ? (
                  <p className="notes-message notes-message-error" role="alert">
                    {editorError}
                  </p>
                ) : null}
                <p className="notes-privacy-note">
                  Workspace-local notes. Not sent to agents or Git
                  automatically.
                </p>
              </div>
            ) : (
              <div className="notes-empty-state">
                <p className="empty-state-title">No note selected.</p>
                <p className="empty-state-text">Select a note from the list.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </WidgetFrame>
  );
}

function statusBadge({
  apiAvailable,
  isDirty,
  isLoading,
  isSaving,
  loadError,
  selectedNote,
}: {
  apiAvailable: boolean;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  selectedNote: WorkspaceNote | null;
}) {
  if (!apiAvailable) {
    return <Badge variant="warning">Unsupported</Badge>;
  }

  if (isLoading) {
    return <Badge variant="info">Loading</Badge>;
  }

  if (loadError) {
    return <Badge variant="warning">Unavailable</Badge>;
  }

  if (isSaving) {
    return <Badge variant="info">Saving</Badge>;
  }

  if (isDirty) {
    return <Badge variant="warning">Unsaved</Badge>;
  }

  return <Badge variant={selectedNote ? "success" : "neutral"}>
    {selectedNote ? "Saved" : "Ready"}
  </Badge>;
}

function displayNoteTitle(note: WorkspaceNote) {
  return note.title.trim() || DEFAULT_NOTE_TITLE;
}

function notePreview(note: WorkspaceNote) {
  const preview = note.body.replace(/\s+/g, " ").trim();

  return preview || "No body yet.";
}

function notesSingleState({
  isLoading,
  loadError,
  noteCount,
}: {
  isLoading: boolean;
  loadError: string | null;
  noteCount: number;
}) {
  if (isLoading) {
    return {
      text: "Loading workspace-local notes from desktop storage.",
      title: "Loading notes.",
    };
  }

  if (loadError) {
    return {
      text: loadError,
      title: "Notes unavailable.",
    };
  }

  if (noteCount === 0) {
    return {
      text: "Create one from the header to capture workspace notes.",
      title: "No notes yet.",
    };
  }

  return null;
}
