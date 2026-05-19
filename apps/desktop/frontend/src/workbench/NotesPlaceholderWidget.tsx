import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WorkspaceNote } from "../workspace/types";
import type { WidgetRenderProps } from "./types";

const DEFAULT_NOTE_TITLE = "Untitled note";

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
  const apiAvailable = Boolean(
    onCreateWorkspaceNote &&
      onGetWorkspaceNote &&
      onListWorkspaceNotes &&
      onUpdateWorkspaceNote,
  );
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<WorkspaceNote | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftPinned, setDraftPinned] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [saveStateText, setSaveStateText] = useState("Saved");

  const isDirty = Boolean(
    selectedNote &&
      (draftTitle !== selectedNote.title ||
        draftBody !== selectedNote.body ||
        draftPinned !== selectedNote.pinned),
  );

  const filteredNotes = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return notes;
    }

    return notes.filter((note) =>
      `${note.title} ${note.body}`.toLowerCase().includes(query),
    );
  }, [notes, searchText]);

  const loadNotes = useCallback(
    async (preferredNoteId?: string | null) => {
      if (
        !onListWorkspaceNotes ||
        !onGetWorkspaceNote ||
        !onCreateWorkspaceNote ||
        !onUpdateWorkspaceNote
      ) {
        setNotes([]);
        clearSelectedNote();
        setLoadError("Workspace Notes API is not available in this runtime.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      setEditorError(null);
      setValidationMessage(null);

      try {
        const loadedNotes = await onListWorkspaceNotes();
        setNotes(loadedNotes);

        const preferredExists = loadedNotes.some(
          (note) => note.noteId === preferredNoteId,
        );
        const noteIdToSelect = preferredExists
          ? preferredNoteId
          : loadedNotes[0]?.noteId;

        if (!noteIdToSelect) {
          clearSelectedNote();
          return;
        }

        const detail = await onGetWorkspaceNote(noteIdToSelect);

        if (!detail) {
          clearSelectedNote();
          setEditorError("The selected workspace note could not be found.");
          return;
        }

        setSelectedDraft(detail);
        setSaveStateText("Saved");
      } catch (error) {
        setNotes([]);
        clearSelectedNote();
        setLoadError(errorToMessage(error, "Unable to load workspace notes."));
      } finally {
        setIsLoading(false);
      }
    },
    [
      onCreateWorkspaceNote,
      onGetWorkspaceNote,
      onListWorkspaceNotes,
      onUpdateWorkspaceNote,
    ],
  );

  useEffect(() => {
    void loadNotes(null);
  }, [loadNotes]);

  async function createNote() {
    if (!onCreateWorkspaceNote || isCreating || isLoading) {
      return;
    }

    if (isDirty) {
      setValidationMessage("Save current note before creating another note.");
      return;
    }

    setIsCreating(true);
    setLoadError(null);
    setEditorError(null);
    setValidationMessage(null);

    try {
      const createdNote = await onCreateWorkspaceNote({
        title: DEFAULT_NOTE_TITLE,
        body: "",
        pinned: false,
      });
      await loadNotes(createdNote.noteId);
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to create workspace note."));
    } finally {
      setIsCreating(false);
    }
  }

  async function selectNote(noteId: string) {
    if (!onGetWorkspaceNote || isSelecting || selectedNote?.noteId === noteId) {
      return;
    }

    if (isDirty) {
      setValidationMessage("Save current note before selecting another note.");
      return;
    }

    setIsSelecting(true);
    setEditorError(null);
    setValidationMessage(null);

    try {
      const detail = await onGetWorkspaceNote(noteId);

      if (!detail) {
        setEditorError("The selected workspace note could not be found.");
        return;
      }

      setSelectedDraft(detail);
      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.noteId === detail.noteId ? detail : note,
        ),
      );
      setSaveStateText("Saved");
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to open workspace note."));
    } finally {
      setIsSelecting(false);
    }
  }

  async function refreshNotes() {
    if (isDirty) {
      setValidationMessage("Save current note before refreshing notes.");
      return;
    }

    await loadNotes(selectedNote?.noteId ?? null);
  }

  async function saveNote() {
    if (!selectedNote || !onUpdateWorkspaceNote || !isDirty || isSaving) {
      return;
    }

    const nextTitle = draftTitle.trim();

    if (!nextTitle) {
      setValidationMessage("Title is required before saving.");
      return;
    }

    setIsSaving(true);
    setEditorError(null);
    setValidationMessage(null);
    setSaveStateText("Saving");

    try {
      const updatedNote = await onUpdateWorkspaceNote({
        noteId: selectedNote.noteId,
        title: nextTitle,
        body: draftBody,
        pinned: draftPinned,
      });

      if (!updatedNote) {
        setEditorError("The selected workspace note could not be found.");
        setSaveStateText("Unsaved changes");
        return;
      }

      setSelectedDraft(updatedNote);
      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.noteId === updatedNote.noteId ? updatedNote : note,
        ),
      );
      setSaveStateText("Saved");
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to save workspace note."));
      setSaveStateText("Unsaved changes");
    } finally {
      setIsSaving(false);
    }
  }

  function updateDraftTitle(value: string) {
    setDraftTitle(value);
    setValidationMessage(null);
  }

  function updateDraftBody(value: string) {
    setDraftBody(value);
    setValidationMessage(null);
  }

  function updateDraftPinned(value: boolean) {
    setDraftPinned(value);
    setValidationMessage(null);
  }

  function setSelectedDraft(note: WorkspaceNote) {
    setSelectedNote(note);
    setDraftTitle(note.title);
    setDraftBody(note.body);
    setDraftPinned(note.pinned);
  }

  function clearSelectedNote() {
    setSelectedNote(null);
    setDraftTitle("");
    setDraftBody("");
    setDraftPinned(false);
    setSaveStateText("Saved");
  }

  const notesFrameActions = (
    <>
      <Button
        disabled={isLoading || isSaving || !apiAvailable}
        onClick={refreshNotes}
        variant="ghost"
      >
        Refresh
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
  const selectedUpdatedText = selectedNote
    ? formatUpdatedTimestamp(selectedNote.updatedAt)
    : null;
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
            <div className="notes-pane-header">
              <div>
                <p className="notes-pane-label">Workspace notes</p>
                <p className="notes-pane-count">
                  {notes.length === 1
                    ? "1 note"
                    : `${notes.length.toString()} notes`}
                </p>
              </div>
            </div>
            <label className="field-label" htmlFor={searchInputId}>
              Filter
            </label>
            <input
              className="input notes-search-input"
              disabled={isLoading || notes.length === 0}
              id={searchInputId}
              onChange={(event) => setSearchText(event.currentTarget.value)}
              placeholder="Title or body"
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
                  const updatedText = formatUpdatedTimestamp(note.updatedAt);

                  return (
                    <button
                      aria-current={
                        selectedNote?.noteId === note.noteId
                          ? "true"
                          : undefined
                      }
                      className={
                        selectedNote?.noteId === note.noteId
                          ? "notes-list-item notes-list-item-selected"
                          : "notes-list-item"
                      }
                      disabled={isSelecting}
                      key={note.noteId}
                      onClick={() => void selectNote(note.noteId)}
                      type="button"
                    >
                      <span className="notes-list-item-title-row">
                        <span className="notes-list-item-title">
                          {displayNoteTitle(note)}
                        </span>
                        {note.pinned ? (
                          <span className="notes-pin-marker">Pinned</span>
                        ) : null}
                      </span>
                      <span className="notes-list-item-preview">
                        {notePreview(note)}
                      </span>
                      {updatedText ? (
                        <time
                          className="notes-list-item-time"
                          dateTime={note.updatedAt}
                        >
                          {updatedText}
                        </time>
                      ) : null}
                    </button>
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
                <div className="notes-editor-meta">
                  {selectedUpdatedText ? (
                    <span>{selectedUpdatedText}</span>
                  ) : null}
                  <span>{isDirty ? "Unsaved changes" : saveStateText}</span>
                </div>
                <label className="field-label" htmlFor={titleInputId}>
                  Title
                </label>
                <input
                  className="input notes-title-input"
                  id={titleInputId}
                  onChange={(event) =>
                    updateDraftTitle(event.currentTarget.value)
                  }
                  value={draftTitle}
                />
                <label className="field-label" htmlFor={bodyInputId}>
                  Body
                </label>
                <textarea
                  className="input notes-body-input"
                  id={bodyInputId}
                  onChange={(event) =>
                    updateDraftBody(event.currentTarget.value)
                  }
                  value={draftBody}
                />
                <div className="notes-editor-controls">
                  <label className="notes-pin-control">
                    <input
                      checked={draftPinned}
                      onChange={(event) =>
                        updateDraftPinned(event.currentTarget.checked)
                      }
                      type="checkbox"
                    />
                    Pinned
                  </label>
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

  return <Badge variant={selectedNote ? "success" : "neutral"}>Notes</Badge>;
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

function formatUpdatedTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
