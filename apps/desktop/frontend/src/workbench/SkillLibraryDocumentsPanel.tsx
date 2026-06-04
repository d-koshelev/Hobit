import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Button } from "../design-system/Button";
import { EmptyState } from "../design-system/EmptyState";
import type { KnowledgeDocument, Skill } from "../workspace/types";
import {
  knowledgeDraftAcceptedSourceLabel,
  knowledgeDraftAcceptedSourceRef,
  parseKnowledgeDraftPackFromText,
  type KnowledgeDraftReviewItem,
  type KnowledgeDraftReviewPack,
} from "./knowledgeDraftPacks";
import {
  CatalogDocumentEditor,
  CatalogSkillPreview,
} from "./SkillLibraryCatalogPreview";
import {
  KNOWLEDGE_CATALOG_VIEW_OPTIONS,
  DEFAULT_DOCUMENT_TITLE,
  EMPTY_DOCUMENT_DRAFT,
  filterKnowledgeCatalogItems,
  formatKnowledgeCatalogDate,
  isKnowledgeDocumentDraftDirty,
  knowledgeCatalogItemsFromRecords,
  knowledgeDocumentDraftFromDocument,
  skillCoordinatorContextText,
  type KnowledgeDocumentDraft,
  type KnowledgeCatalogListItem,
  type KnowledgeCatalogView,
} from "./skillLibraryModel";
import type { WidgetRenderProps } from "./types";

export type SkillLibraryDocumentsPanelHandle = {
  startNewDocument: () => void;
};

export type SkillLibraryDocumentsToolbarState = {
  isNewDisabled: boolean;
};

type SkillLibraryDocumentsPanelProps = {
  isActive: boolean;
  onAttachContextToCoordinator: WidgetRenderProps["onAttachContextToCoordinator"];
  onAttachKnowledgeContextToQueueTask: WidgetRenderProps["onAttachKnowledgeContextToQueueTask"];
  onCreateAgentQueueTask: WidgetRenderProps["onCreateAgentQueueTask"];
  onCreateKnowledgeDocument: WidgetRenderProps["onCreateKnowledgeDocument"];
  onCreateSkill: WidgetRenderProps["onCreateSkill"];
  onDeleteKnowledgeDocument: WidgetRenderProps["onDeleteKnowledgeDocument"];
  onGetKnowledgeDocument: WidgetRenderProps["onGetKnowledgeDocument"];
  onGetSkill: WidgetRenderProps["onGetSkill"];
  onListKnowledgeDocuments: WidgetRenderProps["onListKnowledgeDocuments"];
  onListSkills: WidgetRenderProps["onListSkills"];
  onReadKnowledgeDocumentImportFile: WidgetRenderProps["onReadKnowledgeDocumentImportFile"];
  onShowSkills: () => void;
  onToolbarStateChange: (state: SkillLibraryDocumentsToolbarState) => void;
  onUpdateKnowledgeDocument: WidgetRenderProps["onUpdateKnowledgeDocument"];
};

export const SkillLibraryDocumentsPanel = forwardRef<
  SkillLibraryDocumentsPanelHandle,
  SkillLibraryDocumentsPanelProps
>(function SkillLibraryDocumentsPanel(
  {
    isActive,
    onAttachContextToCoordinator,
    onAttachKnowledgeContextToQueueTask,
    onCreateAgentQueueTask,
    onCreateKnowledgeDocument,
    onCreateSkill,
    onDeleteKnowledgeDocument,
    onGetKnowledgeDocument,
    onGetSkill,
    onListKnowledgeDocuments,
    onListSkills,
    onReadKnowledgeDocumentImportFile,
    onShowSkills,
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
  const skillApiAvailable = Boolean(onGetSkill && onListSkills);
  const skillCreateAvailable = Boolean(onCreateSkill);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedDocument, setSelectedDocument] =
    useState<KnowledgeDocument | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [documentDraft, setDocumentDraft] = useState<KnowledgeDocumentDraft>({
    ...EMPTY_DOCUMENT_DRAFT,
  });
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [isCreatingRefreshTask, setIsCreatingRefreshTask] = useState(false);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [isImportingDocument, setIsImportingDocument] = useState(false);
  const [isSelectingDocument, setIsSelectingDocument] = useState(false);
  const [documentImportPath, setDocumentImportPath] = useState("");
  const [documentImportScope, setDocumentImportScope] =
    useState<KnowledgeDocumentDraft["scope"]>("workspace");
  const [draftPayload, setDraftPayload] = useState("");
  const [draftReviewPack, setDraftReviewPack] =
    useState<KnowledgeDraftReviewPack | null>(null);
  const [draftReviewDecisions, setDraftReviewDecisions] = useState<
    Record<string, "accepted" | "pending" | "rejected">
  >({});
  const [isAcceptingDraftItem, setIsAcceptingDraftItem] = useState(false);
  const [catalogView, setCatalogView] = useState<KnowledgeCatalogView>("all");
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const isDocumentDirty = useMemo(
    () => isKnowledgeDocumentDraftDirty(documentDraft, selectedDocument),
    [documentDraft, selectedDocument],
  );
  const catalogItems = useMemo(
    () => knowledgeCatalogItemsFromRecords(documents, skills),
    [documents, skills],
  );
  const visibleCatalogItems = useMemo(
    () => filterKnowledgeCatalogItems(catalogItems, catalogView),
    [catalogItems, catalogView],
  );
  const selectedCatalogItemId = selectedDocument
    ? `document:${selectedDocument.knowledgeDocumentId}`
    : selectedSkill
      ? `skill:${selectedSkill.skillId}`
      : null;
  const selectedCatalogItem = selectedCatalogItemId
    ? (catalogItems.find((item) => item.id === selectedCatalogItemId) ?? null)
    : null;

  useEffect(() => {
    void loadDocuments(null);
  }, [documentApiAvailable, skillApiAvailable]);

  useEffect(() => {
    onToolbarStateChange({
      isNewDisabled: !documentApiAvailable || isLoadingDocuments,
    });
  }, [documentApiAvailable, isLoadingDocuments, onToolbarStateChange]);

  useImperativeHandle(ref, () => ({
    startNewDocument,
  }));

  async function loadDocuments(preferredDocumentId: string | null) {
    if (!documentApiAvailable && !skillApiAvailable) {
      setDocuments([]);
      setSkills([]);
      clearDocumentDraft();
      setDocumentError(
        "Knowledge Catalog APIs are not available in this runtime.",
      );
      setIsLoadingDocuments(false);
      return;
    }

    setIsLoadingDocuments(true);
    setDocumentError(null);
    setDocumentMessage(null);

    try {
      const loadedDocuments =
        documentApiAvailable && onListKnowledgeDocuments
          ? await onListKnowledgeDocuments()
          : [];
      const loadedSkills =
        skillApiAvailable && onListSkills ? await onListSkills() : [];
      setDocuments(loadedDocuments);
      setSkills(loadedSkills);
      const preferredExists = loadedDocuments.some(
        (document) => document.knowledgeDocumentId === preferredDocumentId,
      );
      const documentIdToSelect = preferredExists
        ? preferredDocumentId
        : loadedDocuments[0]?.knowledgeDocumentId;

      if (!documentIdToSelect) {
        if (!selectedSkill) {
          clearDocumentDraft();
        }
        return;
      }

      if (!onGetKnowledgeDocument) {
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
      setSkills([]);
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
    setSelectedSkill(null);
    setDocumentDraft({ ...EMPTY_DOCUMENT_DRAFT });
    setDocumentMessage(null);
    setDocumentError(null);
  }

  async function selectCatalogItem(item: KnowledgeCatalogListItem) {
    if (item.recordKind === "skill") {
      await selectSkill(item.recordId);
      return;
    }

    await selectDocument(item.recordId);
  }

  async function selectSkill(skillId: string) {
    if (
      !onGetSkill ||
      selectedSkill?.skillId === skillId ||
      isSelectingDocument
    ) {
      return;
    }

    if (isDocumentDirty) {
      setDocumentMessage(
        "Save or discard the current document before selecting another catalog item.",
      );
      return;
    }

    setIsSelectingDocument(true);
    setDocumentMessage(null);
    setDocumentError(null);

    try {
      const detail = await onGetSkill(skillId);
      if (!detail) {
        setDocumentError("The selected skill could not be found.");
        return;
      }

      setSelectedSkill(detail);
      setSelectedDocument(null);
      setDocumentDraft({ ...EMPTY_DOCUMENT_DRAFT });
      setSkills((currentSkills) =>
        currentSkills.map((skill) =>
          skill.skillId === detail.skillId ? detail : skill,
        ),
      );
    } catch (selectError) {
      setDocumentError(errorToMessage(selectError, "Unable to open skill."));
    } finally {
      setIsSelectingDocument(false);
    }
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
      setSelectedSkill(null);
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
    if (
      !onCreateKnowledgeDocument ||
      !onUpdateKnowledgeDocument ||
      isSavingDocument
    ) {
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
        catalogItemType: documentDraft.catalogItemType,
        quickSummary: documentDraft.quickSummary,
        lifecycleStatus: documentDraft.lifecycleStatus,
        title: documentTitle,
        sourceLabel: documentDraft.sourceLabel,
        sourceKind: documentDraft.sourceKind,
        sourceRef: documentDraft.sourceRef,
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

  async function updateSelectedDocumentLifecycle(
    lifecycleStatus: KnowledgeDocument["lifecycleStatus"],
  ) {
    if (
      !selectedDocument ||
      !onUpdateKnowledgeDocument ||
      isSavingDocument ||
      isDeletingDocument
    ) {
      return;
    }

    if (isDocumentDirty) {
      setDocumentMessage(
        "Save or discard edits before changing this item's status.",
      );
      return;
    }

    setIsSavingDocument(true);
    setDocumentMessage(null);
    setDocumentError(null);

    try {
      const updatedDocument = await onUpdateKnowledgeDocument({
        knowledgeDocumentId: selectedDocument.knowledgeDocumentId,
        scope: selectedDocument.scope,
        catalogItemType: selectedDocument.catalogItemType,
        quickSummary: selectedDocument.quickSummary,
        lifecycleStatus,
        title: selectedDocument.title,
        sourceLabel: selectedDocument.sourceLabel,
        sourceKind: selectedDocument.sourceKind,
        sourceRef: selectedDocument.sourceRef,
        content: selectedDocument.content,
        tags: selectedDocument.tags,
        enabled: selectedDocument.enabled,
      });

      if (!updatedDocument) {
        setDocumentError("The selected document could not be found.");
        return;
      }

      setSelectedDocumentDraft(updatedDocument);
      await loadDocuments(updatedDocument.knowledgeDocumentId);
      setDocumentMessage(
        lifecycleStatus === "stale"
          ? "Document marked stale."
          : "Document archived.",
      );
    } catch (statusError) {
      setDocumentError(
        errorToMessage(statusError, "Unable to update document status."),
      );
    } finally {
      setIsSavingDocument(false);
    }
  }

  async function createRefreshQueueTask() {
    if (
      !selectedDocument ||
      !onCreateAgentQueueTask ||
      isCreatingRefreshTask ||
      isSavingDocument ||
      isDeletingDocument
    ) {
      return;
    }

    if (isDocumentDirty) {
      setDocumentMessage(
        "Save or discard edits before creating a refresh task.",
      );
      return;
    }

    if (!isSourceBackedDocument(selectedDocument)) {
      setDocumentMessage(
        "Add a source ref before creating a refresh task for this item.",
      );
      return;
    }

    setIsCreatingRefreshTask(true);
    setDocumentMessage(null);
    setDocumentError(null);

    try {
      const task = await onCreateAgentQueueTask(
        refreshQueueTaskRequestFromDocument(selectedDocument),
      );
      setDocumentMessage(
        `Refresh task ${task.queueItemId} created. The current Knowledge item was not changed.`,
      );
    } catch (taskError) {
      setDocumentError(
        errorToMessage(taskError, "Unable to create refresh Queue task."),
      );
    } finally {
      setIsCreatingRefreshTask(false);
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
      setDocumentError(
        errorToMessage(deleteError, "Unable to delete document."),
      );
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
        catalogItemType: "documentation_knowledge",
        quickSummary: "",
        lifecycleStatus: "active",
        sourceLabel: importedFile.fileName,
        sourceKind: "file_import",
        sourceRef: path,
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

  function loadDraftReviewPayload() {
    const parsedPack = parseKnowledgeDraftPackFromText(draftPayload);

    if (!parsedPack) {
      setDocumentMessage(null);
      setDocumentError(
        "No draft Knowledge pack was found in the imported payload.",
      );
      return;
    }

    setDraftReviewPack(parsedPack);
    setDraftReviewDecisions(
      Object.fromEntries(
        parsedPack.proposedItems.map((item) => [item.draftItemId, "pending"]),
      ),
    );
    setDocumentMessage(
      `Loaded ${parsedPack.proposedItems.length.toString()} draft item${
        parsedPack.proposedItems.length === 1 ? "" : "s"
      } for review.`,
    );
    setDocumentError(null);
  }

  function clearDraftReviewPayload() {
    setDraftPayload("");
    setDraftReviewPack(null);
    setDraftReviewDecisions({});
    setDocumentMessage(null);
    setDocumentError(null);
  }

  function rejectDraftItem(item: KnowledgeDraftReviewItem) {
    setDraftReviewDecisions((current) => ({
      ...current,
      [item.draftItemId]: "rejected",
    }));
    setDocumentMessage("Draft item rejected and archived for this review.");
    setDocumentError(null);
  }

  async function acceptDraftItem(item: KnowledgeDraftReviewItem) {
    if (!draftReviewPack || isAcceptingDraftItem) {
      return;
    }

    if (item.targetKind === "skill" && !onCreateSkill) {
      setDocumentError("Skill API is not available for accepting this draft.");
      return;
    }

    if (item.targetKind === "document" && !onCreateKnowledgeDocument) {
      setDocumentError(
        "Knowledge Document API is not available for accepting this draft.",
      );
      return;
    }

    setIsAcceptingDraftItem(true);
    setDocumentMessage(null);
    setDocumentError(null);

    try {
      if (item.targetKind === "skill" && onCreateSkill) {
        await onCreateSkill({
          title: item.title,
          whenToUse: item.quickSummary,
          prerequisites: sourceNotesForDraft(draftReviewPack, item),
          steps: item.fullContent,
          validation: "",
          risks: draftRiskNotes(item),
          tags: item.suggestedTags,
          reviewStatus: "reviewed",
        });
        await loadDocuments(null);
      } else if (onCreateKnowledgeDocument) {
        const acceptedDocument = await onCreateKnowledgeDocument({
          scope: item.suggestedScope,
          catalogItemType: item.suggestedType,
          quickSummary: item.quickSummary,
          lifecycleStatus: "active",
          title: item.title,
          sourceLabel: knowledgeDraftAcceptedSourceLabel(draftReviewPack, item),
          sourceKind: "queue_draft",
          sourceRef: knowledgeDraftAcceptedSourceRef(draftReviewPack, item),
          content: item.fullContent,
          tags: item.suggestedTags,
          enabled: true,
        });
        setSelectedDocumentDraft(acceptedDocument);
        await loadDocuments(acceptedDocument.knowledgeDocumentId);
      }

      setDraftReviewDecisions((current) => ({
        ...current,
        [item.draftItemId]: "accepted",
      }));
      setDocumentMessage("Draft item accepted into Knowledge / Skills.");
    } catch (acceptError) {
      setDocumentError(
        errorToMessage(acceptError, "Unable to accept draft item."),
      );
    } finally {
      setIsAcceptingDraftItem(false);
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
    setSelectedSkill(null);
    setDocumentDraft(knowledgeDocumentDraftFromDocument(document));
  }

  function clearDocumentDraft() {
    setSelectedDocument(null);
    setSelectedSkill(null);
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

  function attachSelectedSkillToCoordinator() {
    if (!selectedSkill || !onAttachContextToCoordinator) {
      return;
    }

    onAttachContextToCoordinator({
      contextText: skillCoordinatorContextText(selectedSkill),
      sourceLabel: "Skill Library / Skill",
    });
    setDocumentMessage("Skill attached to Workspace Agent as visible context.");
    setDocumentError(null);
  }

  function attachSelectedSkillToQueueTask() {
    if (!selectedSkill || !onAttachKnowledgeContextToQueueTask) {
      return;
    }

    const result = onAttachKnowledgeContextToQueueTask({
      kind: "skill",
      skill: selectedSkill,
    });
    setDocumentMessage(result.message);
    setDocumentError(result.status === "blocked" ? result.message : null);
  }

  function attachSelectedDocumentToQueueTask() {
    if (
      !selectedDocument ||
      isDocumentDirty ||
      !onAttachKnowledgeContextToQueueTask
    ) {
      return;
    }

    const result = onAttachKnowledgeContextToQueueTask({
      document: selectedDocument,
      kind: "knowledge_document",
    });
    setDocumentMessage(result.message);
    setDocumentError(result.status === "blocked" ? result.message : null);
  }

  return (
    <div className="skill-library-tab-panel" hidden={!isActive} role="tabpanel">
      <div className="skill-library-summary skill-library-summary-secondary">
        <span>Catalog views combine scoped documents and saved skills.</span>
        <span>
          Only enabled active documents are searched for Workspace Agent Codex
          runs.
        </span>
      </div>
      <div className="skill-scope-filter" aria-label="Knowledge catalog views">
        {KNOWLEDGE_CATALOG_VIEW_OPTIONS.map((filter) => (
          <button
            aria-pressed={catalogView === filter.value}
            className={[
              "skill-scope-filter-button",
              catalogView === filter.value
                ? "skill-scope-filter-button-active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={filter.value}
            onClick={() => setCatalogView(filter.value)}
            type="button"
          >
            {filter.label}
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
                event.currentTarget.value === "global" ? "global" : "workspace",
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
      <section
        className="skill-draft-review"
        aria-label="Draft Knowledge review"
      >
        <div className="skill-draft-review-header">
          <div>
            <p className="skill-list-meta">Draft review</p>
            <h3>Queue Knowledge drafts</h3>
          </div>
          {draftReviewPack ? (
            <span className="skill-scope-badge">
              {draftReviewPack.proposedItems.length.toString()} item
              {draftReviewPack.proposedItems.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <label className="skill-field skill-field-wide">
          <span>Draft payload</span>
          <textarea
            className="input skill-draft-payload-textarea"
            onChange={(event) => {
              setDraftPayload(event.currentTarget.value);
              setDocumentMessage(null);
              setDocumentError(null);
            }}
            placeholder="Paste a Queue result, worker report, or draft pack JSON."
            value={draftPayload}
          />
        </label>
        <div className="skill-editor-actions">
          <Button
            disabled={!documentApiAvailable && !skillCreateAvailable}
            onClick={loadDraftReviewPayload}
            variant="secondary"
          >
            Load drafts
          </Button>
          <Button
            disabled={!draftReviewPack}
            onClick={clearDraftReviewPayload}
            variant="ghost"
          >
            Clear drafts
          </Button>
        </div>
        {draftReviewPack ? (
          <div className="skill-draft-review-list">
            <p className="skill-draft-review-pack-title">
              {draftReviewPack.packTitle}
              {draftReviewPack.queueItemId
                ? ` - Queue task ${draftReviewPack.queueItemId}`
                : ""}
            </p>
            {draftReviewPack.proposedItems.map((item) => {
              const decision =
                draftReviewDecisions[item.draftItemId] ?? "pending";
              const isActionDisabled =
                decision !== "pending" || isAcceptingDraftItem;

              return (
                <article
                  className="skill-draft-review-item"
                  key={item.draftItemId}
                >
                  <div className="skill-draft-review-item-header">
                    <div>
                      <h4>{item.title}</h4>
                      <p>{item.quickSummary || item.fullContent}</p>
                    </div>
                    <span className="skill-scope-badge">
                      {draftDecisionLabel(decision)}
                    </span>
                  </div>
                  <dl className="skill-draft-review-facts">
                    <div>
                      <dt>Target</dt>
                      <dd>
                        {item.targetKind === "skill" ? "Skill" : "Document"}
                      </dd>
                    </div>
                    <div>
                      <dt>Type</dt>
                      <dd>{item.suggestedType}</dd>
                    </div>
                    <div>
                      <dt>Scope</dt>
                      <dd>{item.suggestedScope}</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{knowledgeDraftAcceptedSourceRef(draftReviewPack, item)}</dd>
                    </div>
                  </dl>
                  <div className="skill-editor-actions">
                    <Button
                      disabled={isActionDisabled}
                      onClick={() => void acceptDraftItem(item)}
                      variant="primary"
                    >
                      Accept
                    </Button>
                    <Button
                      disabled={isActionDisabled}
                      onClick={() => rejectDraftItem(item)}
                      variant="secondary"
                    >
                      Reject / archive
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
      {isLoadingDocuments ? (
        <EmptyState
          text="Knowledge catalog items are loading from workspace APIs."
          title="Loading catalog."
        />
      ) : documentError && documents.length === 0 && skills.length === 0 ? (
        <EmptyState text={documentError} title="Catalog unavailable." />
      ) : (
        <div className="skill-catalog-layout">
          <section className="skill-list-pane" aria-label="Catalog items">
            {visibleCatalogItems.length === 0 ? (
              <EmptyState
                text={emptyCatalogText(catalogView)}
                title="No catalog items yet."
              />
            ) : (
              <div className="skill-list">
                {visibleCatalogItems.map((item) => (
                  <button
                    className={[
                      "skill-list-row",
                      selectedCatalogItemId === item.id
                        ? "skill-list-row-selected"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={isSelectingDocument}
                    key={item.id}
                    onClick={() => void selectCatalogItem(item)}
                    type="button"
                  >
                    <span className="skill-list-title-row">
                      <span className="skill-list-title">{item.title}</span>
                      <span className="skill-scope-badge">
                        {item.scopeLabel}
                      </span>
                    </span>
                    <span className="skill-catalog-card-summary">
                      {item.quickSummary}
                    </span>
                    <span className="skill-list-meta">
                      {item.typeLabel} - {item.statusLabel}
                      {item.tags ? ` - ${item.tags}` : ""}
                    </span>
                    <span className="skill-list-meta">
                      Updated {formatKnowledgeCatalogDate(item.updatedAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section
            className="skill-editor-pane"
            aria-label="Selected catalog item"
          >
            {selectedSkill ? (
              <CatalogSkillPreview
                canAttachToWorkspaceAgent={Boolean(
                  onAttachContextToCoordinator,
                )}
                canAttachToQueueTask={Boolean(
                  selectedSkill && onAttachKnowledgeContextToQueueTask,
                )}
                error={documentError}
                item={selectedCatalogItem}
                message={documentMessage}
                onAttachToQueueTask={attachSelectedSkillToQueueTask}
                onAttachToWorkspaceAgent={attachSelectedSkillToCoordinator}
                onShowSkills={onShowSkills}
                skill={selectedSkill}
              />
            ) : (
              <CatalogDocumentEditor
                canAttachToQueueTask={Boolean(
                  selectedDocument &&
                    !isDocumentDirty &&
                    onAttachKnowledgeContextToQueueTask,
                )}
                canCreateRefreshTask={Boolean(
                  selectedDocument &&
                    !isDocumentDirty &&
                    onCreateAgentQueueTask &&
                    isSourceBackedDocument(selectedDocument),
                )}
                documentApiAvailable={documentApiAvailable}
                draft={documentDraft}
                error={documentError}
                isCreatingRefreshTask={isCreatingRefreshTask}
                isDeletingDocument={isDeletingDocument}
                isDirty={isDocumentDirty}
                isSavingDocument={isSavingDocument}
                item={selectedCatalogItem}
                message={documentMessage}
                onAttachToQueueTask={attachSelectedDocumentToQueueTask}
                onArchiveDocument={() =>
                  void updateSelectedDocumentLifecycle("archived")
                }
                onCreateRefreshTask={() => void createRefreshQueueTask()}
                onDeleteDocument={() => void deleteSelectedDocument()}
                onDiscardDraft={discardDocumentDraft}
                onMarkStale={() => void updateSelectedDocumentLifecycle("stale")}
                onSaveDocument={() => void saveDocument()}
                onSetDraftField={setDocumentDraftField}
              />
            )}
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

function emptyCatalogText(view: KnowledgeCatalogView) {
  if (view === "global") {
    return "Add the first local-global catalog item for this desktop database.";
  }

  if (view === "workspace") {
    return "Add the first workspace-local catalog item for this workspace.";
  }

  if (view === "skills") {
    return "Create the first saved Skill from the Skills tab.";
  }

  return "Add the first workspace-local or local-global catalog item.";
}

function draftDecisionLabel(decision: "accepted" | "pending" | "rejected") {
  switch (decision) {
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Archived";
    case "pending":
    default:
      return "Pending";
  }
}

function sourceNotesForDraft(
  pack: KnowledgeDraftReviewPack,
  item: KnowledgeDraftReviewItem,
) {
  return [
    knowledgeDraftAcceptedSourceLabel(pack, item),
    knowledgeDraftAcceptedSourceRef(pack, item)
      ? `Source ref: ${knowledgeDraftAcceptedSourceRef(pack, item)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function draftRiskNotes(item: KnowledgeDraftReviewItem) {
  return [
    item.blockers ? `Blockers: ${item.blockers}` : "",
    item.reviewNotes ? `Review notes: ${item.reviewNotes}` : "",
    item.confidence ? `Confidence: ${item.confidence}` : "",
    item.activationRecommendation
      ? `Activation recommendation: ${item.activationRecommendation}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function isSourceBackedDocument(document: KnowledgeDocument) {
  return Boolean(document.sourceRef.trim());
}

function refreshQueueTaskRequestFromDocument(document: KnowledgeDocument) {
  const sourceLabel = document.sourceLabel.trim() || "Knowledge source";
  const sourceRef = document.sourceRef.trim();
  const title = `Refresh Knowledge: ${document.title.trim() || DEFAULT_DOCUMENT_TITLE}`;

  return {
    title,
    description: [
      "Refresh an existing source-backed Knowledge item and return a draft update for operator review.",
      `Knowledge document id: ${document.knowledgeDocumentId}`,
      `Current status: ${document.lifecycleStatus}`,
      `Scope: ${document.scope}`,
      `Type: ${document.catalogItemType}`,
      `Source label: ${sourceLabel}`,
      `Source kind: ${document.sourceKind.trim() || "source_ref"}`,
      `Source ref: ${sourceRef}`,
      "The current item must remain unchanged until the operator manually accepts an update.",
    ].join("\n"),
    executionPolicy: "manual" as const,
    priority: 2,
    prompt: [
      "Create a draft Knowledge update for the existing Knowledge item below.",
      "",
      "Use only the explicitly listed source ref. Do not scan folders, use hidden workspace context, mutate files, mutate Git, create Knowledge, enable Knowledge, or run background refresh.",
      "",
      `Knowledge document id: ${document.knowledgeDocumentId}`,
      `Title: ${document.title}`,
      `Current quick summary: ${document.quickSummary || "(empty)"}`,
      `Current tags: ${document.tags || "(empty)"}`,
      `Current scope: ${document.scope}`,
      `Current type: ${document.catalogItemType}`,
      `Source label: ${sourceLabel}`,
      `Source kind: ${document.sourceKind.trim() || "source_ref"}`,
      `Source ref: ${sourceRef}`,
      "",
      "Return a bounded draft Knowledge pack for review. The draft should propose updated title, quickSummary, fullContent, tags, type, scope, confidence, blockers, and source refs. Do not activate the update.",
    ].join("\n"),
    status: "queued" as const,
  };
}
