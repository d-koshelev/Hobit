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
  onCreateKnowledgeDocument,
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
    cancelKnowledgePromotion,
    createNote,
    draftBody,
    draftPinned,
    draftTitle,
    editorError,
    filteredNotes,
    isCreating,
    isDirty,
    isLoading,
    isPromotingToKnowledge,
    isPromotionOpen,
    isSaving,
    isSelecting,
    knowledgePromotionAvailable,
    loadError,
    notes,
    openKnowledgePromotion,
    promoteSelectedNoteToKnowledge,
    promotionCatalogItemType,
    promotionError,
    promotionLifecycleStatus,
    promotionMessage,
    promotionScope,
    promotionTags,
    refreshNotes,
    saveNote,
    searchText,
    selectNote,
    selectedNote,
    setPromotionCatalogItemType,
    setPromotionLifecycleStatus,
    setPromotionScope,
    setPromotionTags,
    setSearchText,
    updateDraftBody,
    updateDraftPinned,
    updateDraftTitle,
    validationMessage,
  } = useWorkspaceNotesController({
    onCreateKnowledgeDocument,
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
            isPromotingToKnowledge={isPromotingToKnowledge}
            isPromotionOpen={isPromotionOpen}
            isSaving={isSaving}
            knowledgePromotionAvailable={knowledgePromotionAvailable}
            loadError={loadError}
            onCancelKnowledgePromotion={cancelKnowledgePromotion}
            onOpenKnowledgePromotion={openKnowledgePromotion}
            onPromoteSelectedNoteToKnowledge={promoteSelectedNoteToKnowledge}
            onSaveNote={saveNote}
            onSetPromotionCatalogItemType={setPromotionCatalogItemType}
            onSetPromotionLifecycleStatus={setPromotionLifecycleStatus}
            onSetPromotionScope={setPromotionScope}
            onSetPromotionTags={setPromotionTags}
            onUpdateDraftBody={updateDraftBody}
            onUpdateDraftTitle={updateDraftTitle}
            promotionCatalogItemType={promotionCatalogItemType}
            promotionError={promotionError}
            promotionLifecycleStatus={promotionLifecycleStatus}
            promotionMessage={promotionMessage}
            promotionScope={promotionScope}
            promotionTags={promotionTags}
            selectedNote={selectedNote}
            titleInputId={titleInputId}
            validationMessage={validationMessage}
          />
        </div>
      )}
    </WidgetFrame>
  );
}
