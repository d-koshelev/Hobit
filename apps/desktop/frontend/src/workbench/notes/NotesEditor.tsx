import { Button } from "../../design-system/Button";
import type { KnowledgeDocument, WorkspaceNote } from "../../workspace/types";
import {
  KNOWLEDGE_DOCUMENT_TYPE_OPTIONS,
  KNOWLEDGE_LIFECYCLE_STATUS_OPTIONS,
} from "../skillLibraryModel";
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
  isPromotingToKnowledge,
  isPromotionOpen,
  isSaving,
  knowledgePromotionAvailable,
  loadError,
  onCancelKnowledgePromotion,
  onOpenKnowledgePromotion,
  onPromoteSelectedNoteToKnowledge,
  onSaveNote,
  onSetPromotionCatalogItemType,
  onSetPromotionLifecycleStatus,
  onSetPromotionScope,
  onSetPromotionTags,
  onUpdateDraftBody,
  onUpdateDraftTitle,
  promotionCatalogItemType,
  promotionError,
  promotionLifecycleStatus,
  promotionMessage,
  promotionScope,
  promotionTags,
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
  isPromotingToKnowledge: boolean;
  isPromotionOpen: boolean;
  isSaving: boolean;
  knowledgePromotionAvailable: boolean;
  loadError: string | null;
  onCancelKnowledgePromotion: () => void;
  onOpenKnowledgePromotion: () => void;
  onPromoteSelectedNoteToKnowledge: () => void | Promise<void>;
  onSaveNote: () => void | Promise<void>;
  onSetPromotionCatalogItemType: (
    value: KnowledgeDocument["catalogItemType"],
  ) => void;
  onSetPromotionLifecycleStatus: (
    value: KnowledgeDocument["lifecycleStatus"],
  ) => void;
  onSetPromotionScope: (value: KnowledgeDocument["scope"]) => void;
  onSetPromotionTags: (value: string) => void;
  onUpdateDraftBody: (value: string) => void;
  onUpdateDraftTitle: (value: string) => void;
  promotionCatalogItemType: KnowledgeDocument["catalogItemType"];
  promotionError: string | null;
  promotionLifecycleStatus: KnowledgeDocument["lifecycleStatus"];
  promotionMessage: string | null;
  promotionScope: KnowledgeDocument["scope"];
  promotionTags: string;
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
              disabled={
                !selectedNote ||
                !knowledgePromotionAvailable ||
                isDirty ||
                isSaving ||
                isPromotingToKnowledge
              }
              onClick={onOpenKnowledgePromotion}
              title={
                isDirty
                  ? "Save current note before promoting it to Knowledge."
                  : "Promote this saved note to a separate Knowledge Document."
              }
              variant="secondary"
            >
              Promote to Knowledge
            </Button>
            <Button
              disabled={!selectedNote || !isDirty || isSaving}
              onClick={onSaveNote}
              variant="primary"
            >
              {isSaving ? "Saving" : "Save"}
            </Button>
          </div>
          {isPromotionOpen ? (
            <section
              aria-label="Promote selected note to Knowledge"
              className="notes-knowledge-promotion"
            >
              <label className="notes-promotion-field">
                <span>Type</span>
                <select
                  className="input"
                  onChange={(event) =>
                    onSetPromotionCatalogItemType(
                      event.currentTarget
                        .value as KnowledgeDocument["catalogItemType"],
                    )
                  }
                  value={promotionCatalogItemType}
                >
                  {KNOWLEDGE_DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value === "documentation_knowledge"
                        ? "Docs / technical note"
                        : option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="notes-promotion-field">
                <span>Scope</span>
                <select
                  className="input"
                  onChange={(event) =>
                    onSetPromotionScope(
                      event.currentTarget.value === "global"
                        ? "global"
                        : "workspace",
                    )
                  }
                  value={promotionScope}
                >
                  <option value="workspace">Workspace</option>
                  <option value="global">Global</option>
                </select>
              </label>
              <label className="notes-promotion-field">
                <span>Status</span>
                <select
                  className="input"
                  onChange={(event) =>
                    onSetPromotionLifecycleStatus(
                      event.currentTarget
                        .value as KnowledgeDocument["lifecycleStatus"],
                    )
                  }
                  value={promotionLifecycleStatus}
                >
                  {KNOWLEDGE_LIFECYCLE_STATUS_OPTIONS.filter(
                    (option) =>
                      option.value === "active" || option.value === "draft",
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="notes-promotion-field notes-promotion-tags">
                <span>Tags</span>
                <input
                  className="input"
                  onChange={(event) =>
                    onSetPromotionTags(event.currentTarget.value)
                  }
                  placeholder="tag, tag"
                  value={promotionTags}
                />
              </label>
              <div className="notes-editor-controls">
                <Button
                  disabled={isPromotingToKnowledge}
                  onClick={onCancelKnowledgePromotion}
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  disabled={isPromotingToKnowledge}
                  onClick={onPromoteSelectedNoteToKnowledge}
                  variant="primary"
                >
                  {isPromotingToKnowledge ? "Creating" : "Create document"}
                </Button>
              </div>
            </section>
          ) : null}
          {validationMessage ? (
            <NotesStatusMessage variant="warning">
              {validationMessage}
            </NotesStatusMessage>
          ) : null}
          {editorError ? (
            <NotesStatusMessage variant="error">{editorError}</NotesStatusMessage>
          ) : null}
          {promotionMessage ? (
            <NotesStatusMessage variant="success">
              {promotionMessage}
            </NotesStatusMessage>
          ) : null}
          {promotionError ? (
            <NotesStatusMessage variant="error">{promotionError}</NotesStatusMessage>
          ) : null}
          <p className="notes-privacy-note">
            Workspace-local notes. Not sent to agents, Git, or Knowledge
            automatically.
          </p>
        </div>
      ) : (
        <NotesEmptyState text="Select a note from the list." title="No note selected." />
      )}
    </section>
  );
}
