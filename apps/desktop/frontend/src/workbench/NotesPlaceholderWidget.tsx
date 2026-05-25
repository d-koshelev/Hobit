import { useId } from "react";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { NotesEditor } from "./notes/NotesEditor";
import { NotesEmptyState, notesSingleState } from "./notes/NotesEmptyState";
import { NotesList } from "./notes/NotesList";
import { NotesFrameStatusBadge } from "./notes/NotesStatusMessage";
import { NotesToolbar } from "./notes/NotesToolbar";
import { useWorkspaceNotesController } from "./notes/useWorkspaceNotesController";
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
    <NotesToolbar
      apiAvailable={apiAvailable}
      frameActions={frameActions}
      isCreating={isCreating}
      isLoading={isLoading}
      isSaving={isSaving}
      onCreateNote={createNote}
      onRefreshNotes={refreshNotes}
    />
  );
  const frameStatus = (
    <NotesFrameStatusBadge
      apiAvailable={apiAvailable}
      isDirty={isDirty}
      isLoading={isLoading}
      isSaving={isSaving}
      loadError={loadError}
      selectedNote={selectedNote}
    />
  );
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
          <NotesEmptyState
            compact
            role={loadError ? "alert" : undefined}
            text={singleState.text}
            title={singleState.title}
          />
        </div>
      ) : (
        <div className="notes-product-shell">
          <NotesList
            draftPinned={draftPinned}
            filteredNotes={filteredNotes}
            isLoading={isLoading}
            isSaving={isSaving}
            isSelecting={isSelecting}
            loadError={loadError}
            notes={notes}
            onSearchTextChange={setSearchText}
            onSelectNote={selectNote}
            onUpdateDraftPinned={updateDraftPinned}
            searchInputId={searchInputId}
            searchText={searchText}
            selectedNote={selectedNote}
          />

          <NotesEditor
            bodyInputId={bodyInputId}
            draftBody={draftBody}
            draftTitle={draftTitle}
            editorError={editorError}
            isDirty={isDirty}
            isLoading={isLoading}
            isSaving={isSaving}
            loadError={loadError}
            onSaveNote={saveNote}
            onUpdateDraftBody={updateDraftBody}
            onUpdateDraftTitle={updateDraftTitle}
            selectedNote={selectedNote}
            titleInputId={titleInputId}
            validationMessage={validationMessage}
          />
        </div>
      )}
    </WidgetFrame>
  );
}
