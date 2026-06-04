import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { EmptyState } from "../design-system/EmptyState";
import type { KnowledgeDocument, Skill } from "../workspace/types";
import {
  DEFAULT_DOCUMENT_TITLE,
  EMPTY_DOCUMENT_DRAFT,
  filterKnowledgeCatalogItems,
  isKnowledgeDocumentDraftDirty,
  knowledgeCatalogItemsFromRecords,
  knowledgeDocumentDraftFromDocument,
  type KnowledgeDocumentDraft,
  type KnowledgeCatalogListItem,
  type KnowledgeCatalogView,
} from "./skillLibraryModel";
import {
  SkillLibraryCatalogListView,
  SkillLibraryCatalogSummary,
  SkillLibraryCatalogViewControls,
} from "./SkillLibraryCatalogListView";
import { SkillLibraryCatalogDetailPane } from "./SkillLibraryCatalogDetailPane";
import { SkillLibraryDocumentImportControls } from "./SkillLibraryDocumentImportControls";
import {
  documentLifecycleUpdateMessage,
  errorToMessage,
  isSourceBackedDocument,
  refreshQueueTaskRequestFromDocument,
} from "./SkillLibraryDocumentsPanel.helpers";
import { SkillLibraryDraftReviewPanel } from "./SkillLibraryDraftReviewPanel";
import type { WidgetRenderProps } from "./types";
import { useSkillLibraryCatalogAttachments } from "./useSkillLibraryCatalogAttachments";
import { useSkillLibraryDocumentImport } from "./useSkillLibraryDocumentImport";
import { useSkillLibraryDraftReview } from "./useSkillLibraryDraftReview";

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
  const [isSelectingDocument, setIsSelectingDocument] = useState(false);
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
  const {
    documentImportPath,
    documentImportScope,
    importDocumentFromPath,
    isImportingDocument,
    setDocumentImportScope,
    updateDocumentImportPath,
  } = useSkillLibraryDocumentImport({
    isDocumentDirty,
    loadDocuments,
    onCreateKnowledgeDocument,
    onReadKnowledgeDocumentImportFile,
    setDocumentError,
    setDocumentMessage,
    setSelectedDocumentDraft,
  });
  const {
    acceptDraftItem,
    clearDraftReviewPayload,
    draftPayload,
    draftReviewDecisions,
    draftReviewPack,
    isAcceptingDraftItem,
    loadDraftReviewPayload,
    rejectDraftItem,
    updateDraftPayload,
  } = useSkillLibraryDraftReview({
    loadDocuments,
    onCreateKnowledgeDocument,
    onCreateSkill,
    setDocumentError,
    setDocumentMessage,
    setSelectedDocumentDraft,
  });
  const {
    attachSelectedDocumentToQueueTask,
    attachSelectedSkillToCoordinator,
    attachSelectedSkillToQueueTask,
    attachmentStateByCatalogItemId,
  } = useSkillLibraryCatalogAttachments({
    isDocumentDirty,
    onAttachContextToCoordinator,
    onAttachKnowledgeContextToQueueTask,
    selectedDocument,
    selectedSkill,
    setDocumentError,
    setDocumentMessage,
  });
  const selectedAttachmentState = selectedCatalogItemId
    ? attachmentStateByCatalogItemId[selectedCatalogItemId]
    : undefined;

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
        documentLifecycleUpdateMessage(lifecycleStatus),
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

  return (
    <div className="skill-library-tab-panel" hidden={!isActive} role="tabpanel">
      <SkillLibraryCatalogSummary />
      <SkillLibraryCatalogViewControls
        catalogView={catalogView}
        onCatalogViewChange={setCatalogView}
      />
      <SkillLibraryDocumentImportControls
        documentApiAvailable={documentApiAvailable}
        documentImportPath={documentImportPath}
        documentImportScope={documentImportScope}
        hasImportFileApi={Boolean(onReadKnowledgeDocumentImportFile)}
        isDeletingDocument={isDeletingDocument}
        isImportingDocument={isImportingDocument}
        isSavingDocument={isSavingDocument}
        onDocumentImportPathChange={updateDocumentImportPath}
        onDocumentImportScopeChange={setDocumentImportScope}
        onImportDocument={() => void importDocumentFromPath()}
      />
      <SkillLibraryDraftReviewPanel
        documentApiAvailable={documentApiAvailable}
        draftPayload={draftPayload}
        draftReviewDecisions={draftReviewDecisions}
        draftReviewPack={draftReviewPack}
        isAcceptingDraftItem={isAcceptingDraftItem}
        onAcceptDraftItem={(item) => void acceptDraftItem(item)}
        onClearDraftReviewPayload={clearDraftReviewPayload}
        onDraftPayloadChange={updateDraftPayload}
        onLoadDraftReviewPayload={loadDraftReviewPayload}
        onRejectDraftItem={rejectDraftItem}
        skillCreateAvailable={skillCreateAvailable}
      />
      {isLoadingDocuments ? (
        <EmptyState
          text="Knowledge catalog items are loading from workspace APIs."
          title="Loading catalog."
        />
      ) : documentError && documents.length === 0 && skills.length === 0 ? (
        <EmptyState text={documentError} title="Catalog unavailable." />
      ) : (
        <div className="skill-catalog-layout">
          <SkillLibraryCatalogListView
            catalogView={catalogView}
            isSelectingDocument={isSelectingDocument}
            onSelectCatalogItem={(item) => void selectCatalogItem(item)}
            selectedCatalogItemId={selectedCatalogItemId}
            visibleCatalogItems={visibleCatalogItems}
          />
          <SkillLibraryCatalogDetailPane
            attachmentState={selectedAttachmentState}
            canAttachContextToCoordinator={Boolean(onAttachContextToCoordinator)}
            canAttachKnowledgeContextToQueueTask={Boolean(
              onAttachKnowledgeContextToQueueTask,
            )}
            canCreateAgentQueueTask={Boolean(onCreateAgentQueueTask)}
            documentApiAvailable={documentApiAvailable}
            documentDraft={documentDraft}
            documents={documents}
            error={documentError}
            isCreatingRefreshTask={isCreatingRefreshTask}
            isDeletingDocument={isDeletingDocument}
            isDocumentDirty={isDocumentDirty}
            isSavingDocument={isSavingDocument}
            item={selectedCatalogItem}
            message={documentMessage}
            onArchiveDocument={() =>
              void updateSelectedDocumentLifecycle("archived")
            }
            onAttachDocumentToQueueTask={attachSelectedDocumentToQueueTask}
            onAttachSkillToQueueTask={attachSelectedSkillToQueueTask}
            onAttachSkillToWorkspaceAgent={attachSelectedSkillToCoordinator}
            onCreateRefreshTask={() => void createRefreshQueueTask()}
            onDeleteDocument={() => void deleteSelectedDocument()}
            onDiscardDraft={discardDocumentDraft}
            onMarkStale={() => void updateSelectedDocumentLifecycle("stale")}
            onRestoreDocument={() =>
              void updateSelectedDocumentLifecycle("active")
            }
            onSaveDocument={() => void saveDocument()}
            onSetDocumentDraftField={setDocumentDraftField}
            onShowSkills={onShowSkills}
            selectedDocument={selectedDocument}
            selectedSkill={selectedSkill}
            skills={skills}
          />
        </div>
      )}
    </div>
  );
});
