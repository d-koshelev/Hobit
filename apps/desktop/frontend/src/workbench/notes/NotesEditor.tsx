import { Button, InfoTip } from "../../design-system";
import { useEffect, useState, type KeyboardEvent } from "react";
import type { KnowledgeDocument, WorkspaceNote } from "../../workspace/types";
import {
  KNOWLEDGE_DOCUMENT_TYPE_OPTIONS,
  KNOWLEDGE_LIFECYCLE_STATUS_OPTIONS,
} from "../skillLibraryModel";
import { NotesEmptyState } from "./NotesEmptyState";
import { NotesStatusMessage } from "./NotesStatusMessage";
import {
  formatNoteBody,
  type NotesFormatAction,
} from "./notesFormatters";
import { NotesMarkdownPreview } from "./NotesMarkdownPreview";
import { DEFAULT_NOTE_TITLE } from "./useWorkspaceNotesController";

type NotesEditorMode = "edit" | "preview";

const NOTE_FORMAT_ACTIONS: Array<{
  action: NotesFormatAction;
  label: string;
  title: string;
}> = [
  {
    action: "pretty-json",
    label: "Pretty JSON",
    title: "Parse and indent the note body as JSON.",
  },
  {
    action: "minify-json",
    label: "Minify JSON",
    title: "Parse and compact the note body as JSON.",
  },
  {
    action: "normalize-csv",
    label: "Format CSV",
    title: "Normalize comma-separated values and line endings.",
  },
  {
    action: "normalize-text",
    label: "Normalize text",
    title: "Normalize plain text line endings and excess blank lines.",
  },
];

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
  const [formatError, setFormatError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<NotesEditorMode>("edit");
  const [selectedFormatAction, setSelectedFormatAction] =
    useState<NotesFormatAction>("pretty-json");

  useEffect(() => {
    setFormatError(null);
    setEditorMode("edit");
  }, [selectedNote?.noteId]);

  function saveFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") {
      return;
    }

    if (!isNoteEditorInput(event.target)) {
      return;
    }

    event.preventDefault();

    if (!selectedNote || !isDirty || isSaving) {
      return;
    }

    void onSaveNote();
  }

  function updateDraftBody(value: string) {
    if (formatError) {
      setFormatError(null);
    }

    onUpdateDraftBody(value);
  }

  function applyBodyFormat() {
    const result = formatNoteBody(selectedFormatAction, draftBody);

    if (!result.ok) {
      setFormatError(result.error);
      return;
    }

    setFormatError(null);

    if (result.value !== draftBody) {
      onUpdateDraftBody(result.value);
    }
  }

  return (
    <section
      className="notes-editor-pane"
      aria-label="Selected note"
      onKeyDown={saveFromKeyboard}
    >
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
          <div className="notes-editor-mode-row">
            <span
              aria-label="Note editor mode"
              className="notes-editor-mode-toggle"
              role="group"
            >
              <Button
                aria-pressed={editorMode === "edit"}
                className="notes-editor-mode-button"
                onClick={() => setEditorMode("edit")}
                variant={editorMode === "edit" ? "secondary" : "ghost"}
              >
                Edit
              </Button>
              <Button
                aria-pressed={editorMode === "preview"}
                className="notes-editor-mode-button"
                onClick={() => setEditorMode("preview")}
                variant={editorMode === "preview" ? "secondary" : "ghost"}
              >
                Preview
              </Button>
            </span>
            <InfoTip label="Notes Markdown help" title="Markdown preview">
              Preview renders basic Markdown, fenced code, and JSON blocks.
              Source text stays unchanged unless Format is clicked.
            </InfoTip>
          </div>
          {editorMode === "preview" ? (
            <NotesMarkdownPreview body={draftBody} />
          ) : (
            <textarea
              aria-label="Note body"
              className="input notes-body-input"
              id={bodyInputId}
              onChange={(event) => updateDraftBody(event.currentTarget.value)}
              placeholder="Write note..."
              spellCheck={false}
              value={draftBody}
            />
          )}
          <div
            aria-label="Note body formatting actions"
            className="notes-format-toolbar"
          >
            <label className="notes-format-field">
              <span className="notes-format-label">Format</span>
              <select
                aria-label="Format note body"
                className="input notes-format-select"
                disabled={!selectedNote || isSaving}
                onChange={(event) =>
                  setSelectedFormatAction(
                    event.currentTarget.value as NotesFormatAction,
                  )
                }
                value={selectedFormatAction}
              >
                {NOTE_FORMAT_ACTIONS.map((action) => (
                  <option key={action.action} value={action.action}>
                    {action.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              className="notes-format-action"
              disabled={!selectedNote || isSaving}
              onClick={applyBodyFormat}
              title={
                NOTE_FORMAT_ACTIONS.find(
                  (action) => action.action === selectedFormatAction,
                )?.title
              }
              variant="ghost"
            >
              Format
            </Button>
          </div>
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
          {formatError ? (
            <NotesStatusMessage variant="error">{formatError}</NotesStatusMessage>
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

function isNoteEditorInput(target: EventTarget) {
  return (
    target instanceof Element &&
    (target.classList.contains("notes-title-input") ||
      target.classList.contains("notes-body-input"))
  );
}
