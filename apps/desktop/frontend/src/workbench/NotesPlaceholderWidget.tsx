import {
  useCallback,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { NotesEditor } from "./notes/NotesEditor";
import { NotesEmptyState, notesSingleState } from "./notes/NotesEmptyState";
import { NotesList } from "./notes/NotesList";
import { NotesFrameStatusBadge } from "./notes/NotesStatusMessage";
import { NotesToolbar } from "./notes/NotesToolbar";
import { useWorkspaceNotesController } from "./notes/useWorkspaceNotesController";
import type { WidgetRenderProps } from "./types";

const DEFAULT_NOTES_LIST_WIDTH = 196;
const MIN_NOTES_LIST_WIDTH = 132;
const MAX_NOTES_LIST_WIDTH = 320;
const MIN_NOTES_EDITOR_WIDTH = 220;

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
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [listWidth, setListWidth] = useState(DEFAULT_NOTES_LIST_WIDTH);
  const [restoreListWidth, setRestoreListWidth] = useState(
    DEFAULT_NOTES_LIST_WIDTH,
  );
  const [isResizingList, setIsResizingList] = useState(false);
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
  const clampListWidth = useCallback((nextWidth: number) => {
    const shellWidth = shellRef.current?.clientWidth ?? 0;
    const maxWidthFromShell =
      shellWidth > 0
        ? Math.max(
            MIN_NOTES_LIST_WIDTH,
            Math.min(MAX_NOTES_LIST_WIDTH, shellWidth - MIN_NOTES_EDITOR_WIDTH),
          )
        : MAX_NOTES_LIST_WIDTH;

    return Math.min(
      Math.max(nextWidth, MIN_NOTES_LIST_WIDTH),
      maxWidthFromShell,
    );
  }, []);
  const updateListWidthFromPointer = useCallback(
    (clientX: number) => {
      const shellRect = shellRef.current?.getBoundingClientRect();

      if (!shellRect) {
        return;
      }

      setListWidth(clampListWidth(clientX - shellRect.left));
    },
    [clampListWidth],
  );
  const startListResize = (event: PointerEvent<HTMLDivElement>) => {
    if (isListCollapsed) {
      return;
    }

    if ((event.target as Element).closest(".notes-pane-divider-button")) {
      return;
    }

    event.preventDefault();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId) === false) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setIsResizingList(true);
    updateListWidthFromPointer(event.clientX);
  };
  const resizeList = (event: PointerEvent<HTMLDivElement>) => {
    if (!isResizingList) {
      return;
    }

    updateListWidthFromPointer(event.clientX);
  };
  const stopListResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!isResizingList) {
      return;
    }

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setRestoreListWidth(clampListWidth(listWidth));
    setIsResizingList(false);
  };
  const toggleListCollapsed = () => {
    setIsListCollapsed((current) => {
      if (current) {
        setListWidth(clampListWidth(restoreListWidth));
        return false;
      }

      setRestoreListWidth(clampListWidth(listWidth));
      return true;
    });
  };
  const productShellStyle = {
    "--notes-list-width": `${clampListWidth(listWidth)}px`,
  } as CSSProperties;

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
        <div
          className={
            isListCollapsed
              ? "notes-product-shell notes-product-shell-list-collapsed"
              : isResizingList
                ? "notes-product-shell notes-product-shell-resizing"
                : "notes-product-shell"
          }
          ref={shellRef}
          style={productShellStyle}
        >
          {isListCollapsed ? null : (
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
          )}

          <div
            aria-label="Resize notes list"
            aria-orientation="vertical"
            aria-valuemax={MAX_NOTES_LIST_WIDTH}
            aria-valuemin={MIN_NOTES_LIST_WIDTH}
            aria-valuenow={Math.round(clampListWidth(listWidth))}
            className="notes-pane-divider"
            onPointerCancel={stopListResize}
            onPointerDown={startListResize}
            onPointerMove={resizeList}
            onPointerUp={stopListResize}
            role="separator"
            title="Drag to resize notes list"
          >
            <button
              aria-label={
                isListCollapsed ? "Expand notes list" : "Collapse notes list"
              }
              className="notes-pane-divider-button"
              onClick={toggleListCollapsed}
              title={
                isListCollapsed ? "Expand notes list" : "Collapse notes list"
              }
              type="button"
            >
              <span aria-hidden="true">{isListCollapsed ? ">" : "<"}</span>
            </button>
          </div>

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
