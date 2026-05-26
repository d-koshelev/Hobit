import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Button } from "../design-system/Button";
import { EmptyState } from "../design-system/EmptyState";
import type { KnowledgeDocument } from "../workspace/types";
import {
  DEFAULT_DOCUMENT_TITLE,
  EMPTY_DOCUMENT_DRAFT,
  isKnowledgeDocumentDraftDirty,
  knowledgeDocumentDraftFromDocument,
  type KnowledgeDocumentDraft,
} from "./skillLibraryModel";
import type { WidgetRenderProps } from "./types";

export type SkillLibraryDocumentsPanelHandle = {
  startNewDocument: () => void;
};

type KnowledgeDocumentScopeFilter = "workspace" | "global" | "all";

export type SkillLibraryDocumentsToolbarState = {
  isNewDisabled: boolean;
};

type SkillLibraryDocumentsPanelProps = {
  isActive: boolean;
  onCreateKnowledgeDocument: WidgetRenderProps["onCreateKnowledgeDocument"];
  onDeleteKnowledgeDocument: WidgetRenderProps["onDeleteKnowledgeDocument"];
  onGetKnowledgeDocument: WidgetRenderProps["onGetKnowledgeDocument"];
  onListKnowledgeDocuments: WidgetRenderProps["onListKnowledgeDocuments"];
  onReadKnowledgeDocumentImportFile: WidgetRenderProps["onReadKnowledgeDocumentImportFile"];
  onToolbarStateChange: (state: SkillLibraryDocumentsToolbarState) => void;
  onUpdateKnowledgeDocument: WidgetRenderProps["onUpdateKnowledgeDocument"];
};

export const SkillLibraryDocumentsPanel = forwardRef<
  SkillLibraryDocumentsPanelHandle,
  SkillLibraryDocumentsPanelProps
>(function SkillLibraryDocumentsPanel(
  {
    isActive,
    onCreateKnowledgeDocument,
    onDeleteKnowledgeDocument,
    onGetKnowledgeDocument,
    onListKnowledgeDocuments,
    onReadKnowledgeDocumentImportFile,
    onToolbarStateChange,
    onUpdateKnowledgeDocument,
  },
  ref,
) {
  const documentApiAvailable = Boolean(
    onCreateKnowledgeDocument &&
      onDeleteKnowledgeDocument &&
      onGetKnowledgeDocument &&
      onListKnowledgeDocuments &&
      onUpdateKnowledgeDocument,
  );
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedDocument, setSelectedDocument] =
    useState<KnowledgeDocument | null>(null);
  const [documentDraft, setDocumentDraft] =
    useState<KnowledgeDocumentDraft>({ ...EMPTY_DOCUMENT_DRAFT });
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [isImportingDocument, setIsImportingDocument] = useState(false);
  const [isSelectingDocument, setIsSelectingDocument] = useState(false);
  const [documentImportPath, setDocumentImportPath] = useState("");
  const [documentImportScope, setDocumentImportScope] =
    useState<KnowledgeDocumentDraft["scope"]>("workspace");
  const [scopeFilter, setScopeFilter] =
    useState<KnowledgeDocumentScopeFilter>("all");
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const isDocumentDirty = useMemo(
    () => isKnowledgeDocumentDraftDirty(documentDraft, selectedDocument),
    [documentDraft, selectedDocument],
  );
  const visibleDocuments = useMemo(
    () =>
      documents.filter(
        (document) =>
          scopeFilter === "all" || document.scope === scopeFilter,
      ),
    [documents, scopeFilter],
  );

  useEffect(() => {
    void loadDocuments(null);
  }, [documentApiAvailable]);

  useEffect(() => {
    onToolbarStateChange({
      isNewDisabled: !documentApiAvailable || isLoadingDocuments,
    });
  }, [documentApiAvailable, isLoadingDocuments, onToolbarStateChange]);

  useImperativeHandle(ref, () => ({
    startNewDocument,
  }));

  async function loadDocuments(preferredDocumentId: string | null) {
    if (
      !documentApiAvailable ||
      !onListKnowledgeDocuments ||
      !onGetKnowledgeDocument
    ) {
      setDocuments([]);
      clearDocumentDraft();
      setDocumentError("Knowledge Document API is not available in this runtime.");
      setIsLoadingDocuments(false);
      return;
    }

    setIsLoadingDocuments(true);
    setDocumentError(null);
    setDocumentMessage(null);

    try {
      const loadedDocuments = await onListKnowledgeDocuments();
      setDocuments(loadedDocuments);
      const preferredExists = loadedDocuments.some(
        (document) => document.knowledgeDocumentId === preferredDocumentId,
      );
      const documentIdToSelect = preferredExists
        ? preferredDocumentId
        : loadedDocuments[0]?.knowledgeDocumentId;

      if (!documentIdToSelect) {
        clearDocumentDraft();
        return;
      }

      const detail = await onGetKnowledgeDocument(documentIdToSelect);
      if (!detail) {
        clearDocumentDraft();
        setDocumentError("The selected document could not be found.");
        return;
      }

      setSelectedDocumentDraft(detail);
    } catch (loadError) {
      setDocuments([]);
      clearDocumentDraft();
      setDocumentError(errorToMessage(loadError, "Unable to load documents."));
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  function startNewDocument() {
    if (isDocumentDirty) {
      setDocumentMessage(
        "Save or discard the current document before creating another.",
      );
      return;
    }

    setSelectedDocument(null);
    setDocumentDraft({ ...EMPTY_DOCUMENT_DRAFT });
    setDocumentMessage(null);
    setDocumentError(null);
  }

  async function selectDocument(knowledgeDocumentId: string) {
    if (
      !onGetKnowledgeDocument ||
      selectedDocument?.knowledgeDocumentId === knowledgeDocumentId ||
      isSelectingDocument
    ) {
      return;
    }

    if (isDocumentDirty) {
      setDocumentMessage(
        "Save or discard the current document before selecting another.",
      );
      return;
    }

    setIsSelectingDocument(true);
    setDocumentMessage(null);
    setDocumentError(null);

    try {
      const detail = await onGetKnowledgeDocument(knowledgeDocumentId);
      if (!detail) {
        setDocumentError("The selected document could not be found.");
        return;
      }

      setSelectedDocumentDraft(detail);
      setDocuments((currentDocuments) =>
        currentDocuments.map((document) =>
          document.knowledgeDocumentId === detail.knowledgeDocumentId
            ? detail
            : document,
        ),
      );
    } catch (selectError) {
      setDocumentError(errorToMessage(selectError, "Unable to open document."));
    } finally {
      setIsSelectingDocument(false);
    }
  }

  async function saveDocument() {
    if (!onCreateKnowledgeDocument || !onUpdateKnowledgeDocument || isSavingDocument) {
      return;
    }

    const documentTitle = documentDraft.title.trim();
    if (!documentTitle) {
      setDocumentMessage("Title is required before saving.");
      return;
    }

    setIsSavingDocument(true);
    setDocumentMessage(null);
    setDocumentError(null);

    try {
      const request = {
        scope: documentDraft.scope,
        title: documentTitle,
        sourceLabel: documentDraft.sourceLabel,
        content: documentDraft.content,
        tags: documentDraft.tags,
        enabled: documentDraft.enabled,
      };
      const savedDocument = documentDraft.knowledgeDocumentId
        ? await onUpdateKnowledgeDocument({
            knowledgeDocumentId: documentDraft.knowledgeDocumentId,
            ...request,
          })
        : await onCreateKnowledgeDocument(request);

      if (!savedDocument) {
        setDocumentError("The selected document could not be found.");
        return;
      }

      setSelectedDocumentDraft(savedDocument);
      await loadDocuments(savedDocument.knowledgeDocumentId);
      setDocumentMessage("Document saved.");
    } catch (saveError) {
      setDocumentError(errorToMessage(saveError, "Unable to save document."));
    } finally {
      setIsSavingDocument(false);
    }
  }

  async function deleteSelectedDocument() {
    if (
      !documentDraft.knowledgeDocumentId ||
      !onDeleteKnowledgeDocument ||
      isDeletingDocument
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${documentDraft.title.trim() || DEFAULT_DOCUMENT_TITLE}" from this workspace?`,
    );
    if (!confirmed) {
      return;
    }

    setIsDeletingDocument(true);
    setDocumentMessage(null);
    setDocumentError(null);

    try {
      const deleted = await onDeleteKnowledgeDocument({
        knowledgeDocumentId: documentDraft.knowledgeDocumentId,
      });
      if (!deleted) {
        setDocumentError("The selected document could not be found.");
        return;
      }

      await loadDocuments(null);
      setDocumentMessage("Document deleted.");
    } catch (deleteError) {
      setDocumentError(errorToMessage(deleteError, "Unable to delete document."));
    } finally {
      setIsDeletingDocument(false);
    }
  }

  async function importDocumentFromPath() {
    if (
      !onReadKnowledgeDocumentImportFile ||
      !onCreateKnowledgeDocument ||
      isImportingDocument
    ) {
      return;
    }

    if (isDocumentDirty) {
      setDocumentMessage(
        "Save or discard the current document before importing another.",
      );
      return;
    }

    const path = documentImportPath.trim();
    if (!path) {
      setDocumentMessage("Path is required before importing.");
      return;
    }

    setIsImportingDocument(true);
    setDocumentMessage(null);
    setDocumentError(null);

    try {
      const importedFile = await onReadKnowledgeDocumentImportFile({ path });
      const importedDocument = await onCreateKnowledgeDocument({
        title: importedFile.title,
        scope: documentImportScope,
        sourceLabel: importedFile.fileName,
        content: importedFile.content,
        tags: "",
        enabled: true,
      });

      setSelectedDocumentDraft(importedDocument);
      await loadDocuments(importedDocument.knowledgeDocumentId);
      setDocumentImportPath("");
      setDocumentImportScope("workspace");
      setDocumentMessage("Imported document");
    } catch (importError) {
      setDocumentError(
        errorToMessage(importError, "Unable to import document."),
      );
    } finally {
      setIsImportingDocument(false);
    }
  }

  function discardDocumentDraft() {
    if (selectedDocument) {
      setSelectedDocumentDraft(selectedDocument);
    } else {
      setDocumentDraft({ ...EMPTY_DOCUMENT_DRAFT });
    }
    setDocumentMessage(null);
    setDocumentError(null);
  }

  function setSelectedDocumentDraft(document: KnowledgeDocument) {
    setSelectedDocument(document);
    setDocumentDraft(knowledgeDocumentDraftFromDocument(document));
  }

  function clearDocumentDraft() {
    setSelectedDocument(null);
    setDocumentDraft({ ...EMPTY_DOCUMENT_DRAFT });
  }

  function setDocumentDraftField<Key extends keyof KnowledgeDocumentDraft>(
    key: Key,
    value: KnowledgeDocumentDraft[Key],
  ) {
    setDocumentDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
    setDocumentMessage(null);
    setDocumentError(null);
  }

  return (
    <div className="skill-library-tab-panel" hidden={!isActive} role="tabpanel">
      <div className="skill-library-summary skill-library-summary-secondary">
        <span>Plain-text or Markdown reference documents.</span>
        <span>
          Workspace Agent can search enabled workspace and global documents.
          Used documents show scope in the answer context.
        </span>
      </div>
      <div className="skill-scope-filter" aria-label="Document scope filter">
        {(["workspace", "global", "all"] as const).map((filter) => (
          <button
            aria-pressed={scopeFilter === filter}
            className={[
              "skill-scope-filter-button",
              scopeFilter === filter ? "skill-scope-filter-button-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={filter}
            onClick={() => setScopeFilter(filter)}
            type="button"
          >
            {scopeFilterLabel(filter)}
          </button>
        ))}
      </div>
      <div className="skill-document-import">
        <label className="skill-field skill-document-import-path">
          <span>Import path</span>
          <input
            className="input"
            onChange={(event) => {
              setDocumentImportPath(event.currentTarget.value);
              setDocumentMessage(null);
              setDocumentError(null);
            }}
            placeholder="Path to .txt, .md, or .markdown file"
            value={documentImportPath}
          />
        </label>
        <label className="skill-field skill-document-import-scope">
          <span>Import as</span>
          <select
            className="input"
            onChange={(event) =>
              setDocumentImportScope(
                event.currentTarget.value === "global"
                  ? "global"
                  : "workspace",
              )
            }
            value={documentImportScope}
          >
            <option value="workspace">Workspace document</option>
            <option value="global">Global document</option>
          </select>
        </label>
        <Button
          disabled={
            !documentApiAvailable ||
            !onReadKnowledgeDocumentImportFile ||
            isImportingDocument ||
            isSavingDocument ||
            isDeletingDocument
          }
          onClick={() => void importDocumentFromPath()}
          title={
            onReadKnowledgeDocumentImportFile
              ? "Imports one explicit .txt, .md, or .markdown file into this workspace."
              : "Import from path is only available in the Tauri desktop shell."
          }
          variant="secondary"
        >
          {isImportingDocument ? "Importing" : "Import .txt/.md"}
        </Button>
      </div>
      {isLoadingDocuments ? (
        <EmptyState
          text="Workspace-local documents are loading from desktop storage."
          title="Loading documents."
        />
      ) : documentError && documents.length === 0 ? (
        <EmptyState text={documentError} title="Documents unavailable." />
      ) : (
        <div className="skill-library-layout">
          <aside className="skill-list-pane" aria-label="Documents">
            {visibleDocuments.length === 0 ? (
              <EmptyState
                text={emptyDocumentText(scopeFilter)}
                title="No documents yet."
              />
            ) : (
              <div className="skill-list">
                {visibleDocuments.map((document) => (
                  <button
                    className={[
                      "skill-list-row",
                      selectedDocument?.knowledgeDocumentId ===
                      document.knowledgeDocumentId
                        ? "skill-list-row-selected"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={isSelectingDocument}
                    key={document.knowledgeDocumentId}
                    onClick={() =>
                      void selectDocument(document.knowledgeDocumentId)
                    }
                    type="button"
                  >
                    <span className="skill-list-title-row">
                      <span className="skill-list-title">{document.title}</span>
                      <span className="skill-scope-badge">
                        {knowledgeDocumentScopeLabel(document.scope)}
                      </span>
                    </span>
                    <span className="skill-list-meta">
                      {document.enabled ? "Enabled" : "Disabled"}
                      {document.tags ? ` - ${document.tags}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="skill-editor-pane" aria-label="Selected document">
            <div className="skill-editor">
              <label className="skill-field skill-field-wide">
                <span>Title</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setDocumentDraftField("title", event.currentTarget.value)
                  }
                  placeholder={DEFAULT_DOCUMENT_TITLE}
                  value={documentDraft.title}
                />
              </label>

              <label className="skill-field">
                <span>Scope</span>
                <select
                  className="input"
                  onChange={(event) =>
                    setDocumentDraftField(
                      "scope",
                      event.currentTarget.value === "global"
                        ? "global"
                        : "workspace",
                    )
                  }
                  value={documentDraft.scope}
                >
                  <option value="workspace">Workspace</option>
                  <option value="global">Global</option>
                </select>
              </label>

              <label className="skill-field">
                <span>Source label</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setDocumentDraftField(
                      "sourceLabel",
                      event.currentTarget.value,
                    )
                  }
                  placeholder="README.md or pasted docs"
                  value={documentDraft.sourceLabel}
                />
              </label>

              <label className="skill-field">
                <span>Tags</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setDocumentDraftField("tags", event.currentTarget.value)
                  }
                  placeholder="api, onboarding"
                  value={documentDraft.tags}
                />
              </label>

              <label className="skill-field skill-checkbox-field">
                <input
                  checked={documentDraft.enabled}
                  onChange={(event) =>
                    setDocumentDraftField("enabled", event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span>Searchable by Workspace Agent</span>
              </label>

              <label className="skill-field skill-field-wide">
                <span>Content</span>
                <textarea
                  className="input skill-document-textarea"
                  onChange={(event) =>
                    setDocumentDraftField("content", event.currentTarget.value)
                  }
                  value={documentDraft.content}
                />
              </label>

              <div className="skill-editor-actions">
                <Button
                  disabled={
                    !documentApiAvailable ||
                    !isDocumentDirty ||
                    isSavingDocument ||
                    isDeletingDocument
                  }
                  onClick={() => void saveDocument()}
                  variant="primary"
                >
                  {isSavingDocument ? "Saving" : "Save document"}
                </Button>
                <Button
                  disabled={
                    !isDocumentDirty || isSavingDocument || isDeletingDocument
                  }
                  onClick={discardDocumentDraft}
                  variant="secondary"
                >
                  Discard
                </Button>
                <Button
                  disabled={
                    !documentDraft.knowledgeDocumentId ||
                    isSavingDocument ||
                    isDeletingDocument
                  }
                  onClick={() => void deleteSelectedDocument()}
                  variant="ghost"
                >
                  {isDeletingDocument ? "Deleting" : "Delete"}
                </Button>
              </div>
              <p className="skill-attach-note">
                Enabled saved workspace and global documents may be searched
                before Run with Codex. Disabled documents are ignored.
              </p>
              {documentMessage ? (
                <p className="skill-message">{documentMessage}</p>
              ) : null}
              {documentError ? (
                <p className="skill-message skill-message-error" role="alert">
                  {documentError}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
});

function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function scopeFilterLabel(filter: KnowledgeDocumentScopeFilter) {
  switch (filter) {
    case "workspace":
      return "Workspace";
    case "global":
      return "Global";
    case "all":
    default:
      return "All";
  }
}

function knowledgeDocumentScopeLabel(scope: KnowledgeDocument["scope"]) {
  return scope === "global" ? "Global" : "Workspace";
}

function emptyDocumentText(filter: KnowledgeDocumentScopeFilter) {
  if (filter === "global") {
    return "Add the first local-global reference document for this desktop database.";
  }

  if (filter === "workspace") {
    return "Add the first workspace-local reference document for this workspace.";
  }

  return "Add the first workspace-local or local-global reference document.";
}
