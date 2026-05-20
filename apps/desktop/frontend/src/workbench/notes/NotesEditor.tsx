import { Button } from "../../design-system/Button";
import type { WorkspaceNote } from "../../workspace/types";
import { NotesEmptyState } from "./NotesEmptyState";
import { NotesStatusMessage } from "./NotesStatusMessage";
import { DEFAULT_NOTE_TITLE } from "./useWorkspaceNotesController";

export function NotesEditor({
  bodyInputId,
  draftBody,
  draftTitle,
  editorError,
  isDirty,
  isLoading,
  isSaving,
  loadError,
  onSaveNote,
  onUpdateDraftBody,
  onUpdateDraftTitle,
  selectedNote,
  titleInputId,
  validationMessage,
}: {
  bodyInputId: string;
  draftBody: string;
  draftTitle: string;
  editorError: string | null;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  onSaveNote: () => void | Promise<void>;
  onUpdateDraftBody: (value: string) => void;
  onUpdateDraftTitle: (value: string) => void;
  selectedNote: WorkspaceNote | null;
  titleInputId: string;
  validationMessage: string | null;
}) {
  return (
    <section className="notes-editor-pane" aria-label="Selected note">
      {isLoading ? (
        <NotesEmptyState
          text="Workspace-local notes are loading from desktop storage."
          title="Loading notes."
        />
      ) : loadError ? (
        <NotesEmptyState role="alert" text={loadError} title="Notes unavailable." />
      ) : selectedNote ? (
        <div className="notes-editor">
          <input
            aria-label="Note title"
            className="input notes-title-input"
            id={titleInputId}
            onChange={(event) => onUpdateDraftTitle(event.currentTarget.value)}
            placeholder={DEFAULT_NOTE_TITLE}
            value={draftTitle}
          />
          <textarea
            aria-label="Note body"
            className="input notes-body-input"
            id={bodyInputId}
            onChange={(event) => onUpdateDraftBody(event.currentTarget.value)}
            placeholder="Write note…"
            value={draftBody}
          />
          <div className="notes-editor-controls">
            <Button
              disabled={!selectedNote || !isDirty || isSaving}
              onClick={onSaveNote}
              variant="primary"
            >
              {isSaving ? "Saving" : "Save"}
            </Button>
          </div>
          {validationMessage ? (
            <NotesStatusMessage variant="warning">
              {validationMessage}
            </NotesStatusMessage>
          ) : null}
          {editorError ? (
            <NotesStatusMessage variant="error">{editorError}</NotesStatusMessage>
          ) : null}
          <p className="notes-privacy-note">
            Workspace-local notes. Not sent to agents or Git automatically.
          </p>
        </div>
      ) : (
        <NotesEmptyState text="Select a note from the list." title="No note selected." />
      )}
    </section>
  );
}
