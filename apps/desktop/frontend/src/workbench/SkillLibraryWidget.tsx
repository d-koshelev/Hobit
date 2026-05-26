import { useEffect, useId, useMemo, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { EmptyState } from "../design-system/EmptyState";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type {
  KnowledgeDocument,
  Skill,
  SkillReviewStatus,
} from "../workspace/types";
import type { WidgetRenderProps } from "./types";

const DEFAULT_SKILL_TITLE = "Untitled skill";
const DEFAULT_DOCUMENT_TITLE = "Untitled document";
const REVIEW_STATUS_OPTIONS: Array<{
  label: string;
  value: SkillReviewStatus;
}> = [
  { label: "Draft", value: "draft" },
  { label: "Needs review", value: "needs_review" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Deprecated", value: "deprecated" },
];

type SkillDraft = {
  skillId: string | null;
  title: string;
  whenToUse: string;
  prerequisites: string;
  steps: string;
  validation: string;
  risks: string;
  tags: string;
  reviewStatus: SkillReviewStatus;
};

type KnowledgeSurfaceTab = "skills" | "documents";

type KnowledgeDocumentDraft = {
  knowledgeDocumentId: string | null;
  title: string;
  sourceLabel: string;
  content: string;
  tags: string;
  enabled: boolean;
};

const EMPTY_DRAFT: SkillDraft = {
  skillId: null,
  title: DEFAULT_SKILL_TITLE,
  whenToUse: "",
  prerequisites: "",
  steps: "",
  validation: "",
  risks: "",
  tags: "",
  reviewStatus: "draft",
};

const EMPTY_DOCUMENT_DRAFT: KnowledgeDocumentDraft = {
  knowledgeDocumentId: null,
  title: DEFAULT_DOCUMENT_TITLE,
  sourceLabel: "Workspace document",
  content: "",
  tags: "",
  enabled: true,
};

export function SkillLibraryWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onCreateSkill,
  onCreateKnowledgeDocument,
  onDeleteKnowledgeDocument,
  onDeleteSkill,
  onGetKnowledgeDocument,
  onGetSkill,
  onListKnowledgeDocuments,
  onListSkills,
  onLoadLogs,
  onReadKnowledgeDocumentImportFile,
  onAttachContextToCoordinator,
  onStartFrameMove,
  onUpdateKnowledgeDocument,
  onUpdateSkill,
  title,
}: WidgetRenderProps) {
  const titleInputId = useId();
  const whenToUseInputId = useId();
  const prerequisitesInputId = useId();
  const stepsInputId = useId();
  const validationInputId = useId();
  const risksInputId = useId();
  const tagsInputId = useId();
  const statusInputId = useId();
  const documentTitleInputId = useId();
  const documentSourceInputId = useId();
  const documentTagsInputId = useId();
  const documentEnabledInputId = useId();
  const documentContentInputId = useId();
  const documentImportPathInputId = useId();
  const apiAvailable = Boolean(
    onCreateSkill && onDeleteSkill && onGetSkill && onListSkills && onUpdateSkill,
  );
  const documentApiAvailable = Boolean(
    onCreateKnowledgeDocument &&
      onDeleteKnowledgeDocument &&
      onGetKnowledgeDocument &&
      onListKnowledgeDocuments &&
      onUpdateKnowledgeDocument,
  );
  const [activeTab, setActiveTab] = useState<KnowledgeSurfaceTab>("skills");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [draft, setDraft] = useState<SkillDraft>(EMPTY_DRAFT);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedDocument, setSelectedDocument] =
    useState<KnowledgeDocument | null>(null);
  const [documentDraft, setDocumentDraft] =
    useState<KnowledgeDocumentDraft>(EMPTY_DOCUMENT_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [isImportingDocument, setIsImportingDocument] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isSelectingDocument, setIsSelectingDocument] = useState(false);
  const [documentImportPath, setDocumentImportPath] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const isNewDraft = !draft.skillId;
  const isNewDocumentDraft = !documentDraft.knowledgeDocumentId;
  const isDirty = useMemo(
    () =>
      isNewDraft
        ? hasDraftContent(draft)
        : Boolean(
            selectedSkill &&
              (draft.title !== selectedSkill.title ||
                draft.whenToUse !== selectedSkill.whenToUse ||
                draft.prerequisites !== selectedSkill.prerequisites ||
                draft.steps !== selectedSkill.steps ||
                draft.validation !== selectedSkill.validation ||
                draft.risks !== selectedSkill.risks ||
                draft.tags !== selectedSkill.tags ||
                draft.reviewStatus !== selectedSkill.reviewStatus),
          ),
    [draft, isNewDraft, selectedSkill],
  );
  const isDocumentDirty = useMemo(
    () =>
      isNewDocumentDraft
        ? hasDocumentDraftContent(documentDraft)
        : Boolean(
            selectedDocument &&
              (documentDraft.title !== selectedDocument.title ||
                documentDraft.sourceLabel !== selectedDocument.sourceLabel ||
                documentDraft.content !== selectedDocument.content ||
                documentDraft.tags !== selectedDocument.tags ||
                documentDraft.enabled !== selectedDocument.enabled),
          ),
    [documentDraft, isNewDocumentDraft, selectedDocument],
  );
  const canAttachToCoordinator = Boolean(
    selectedSkill && !isDirty && onAttachContextToCoordinator,
  );

  useEffect(() => {
    void loadSkills(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiAvailable]);

  useEffect(() => {
    void loadDocuments(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentApiAvailable]);

  async function loadSkills(preferredSkillId: string | null) {
    if (!apiAvailable || !onListSkills || !onGetSkill) {
      setSkills([]);
      clearDraft();
      setError("Skill Library API is not available in this runtime.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const loadedSkills = await onListSkills();
      setSkills(loadedSkills);
      const preferredExists = loadedSkills.some(
        (skill) => skill.skillId === preferredSkillId,
      );
      const skillIdToSelect = preferredExists
        ? preferredSkillId
        : loadedSkills[0]?.skillId;

      if (!skillIdToSelect) {
        clearDraft();
        return;
      }

      const detail = await onGetSkill(skillIdToSelect);
      if (!detail) {
        clearDraft();
        setError("The selected skill could not be found.");
        return;
      }

      setSelectedDraft(detail);
    } catch (loadError) {
      setSkills([]);
      clearDraft();
      setError(errorToMessage(loadError, "Unable to load skills."));
    } finally {
      setIsLoading(false);
    }
  }

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

  function startNewSkill() {
    if (isDirty) {
      setMessage("Save or discard the current skill before creating another.");
      return;
    }

    setSelectedSkill(null);
    setDraft({ ...EMPTY_DRAFT });
    setMessage(null);
    setError(null);
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

  async function selectSkill(skillId: string) {
    if (!onGetSkill || selectedSkill?.skillId === skillId || isSelecting) {
      return;
    }

    if (isDirty) {
      setMessage("Save or discard the current skill before selecting another.");
      return;
    }

    setIsSelecting(true);
    setMessage(null);
    setError(null);

    try {
      const detail = await onGetSkill(skillId);
      if (!detail) {
        setError("The selected skill could not be found.");
        return;
      }

      setSelectedDraft(detail);
      setSkills((currentSkills) =>
        currentSkills.map((skill) =>
          skill.skillId === detail.skillId ? detail : skill,
        ),
      );
    } catch (selectError) {
      setError(errorToMessage(selectError, "Unable to open skill."));
    } finally {
      setIsSelecting(false);
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

  async function saveSkill() {
    if (!onCreateSkill || !onUpdateSkill || isSaving) {
      return;
    }

    const title = draft.title.trim();
    if (!title) {
      setMessage("Title is required before saving.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const request = {
        title,
        whenToUse: draft.whenToUse,
        prerequisites: draft.prerequisites,
        steps: draft.steps,
        validation: draft.validation,
        risks: draft.risks,
        tags: draft.tags,
        reviewStatus: draft.reviewStatus,
      };
      const savedSkill = draft.skillId
        ? await onUpdateSkill({ skillId: draft.skillId, ...request })
        : await onCreateSkill(request);

      if (!savedSkill) {
        setError("The selected skill could not be found.");
        return;
      }

      setSelectedDraft(savedSkill);
      await loadSkills(savedSkill.skillId);
      setMessage("Skill saved.");
    } catch (saveError) {
      setError(errorToMessage(saveError, "Unable to save skill."));
    } finally {
      setIsSaving(false);
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

  async function deleteSelectedSkill() {
    if (!draft.skillId || !onDeleteSkill || isDeleting) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${draft.title.trim() || DEFAULT_SKILL_TITLE}" from this workspace?`,
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setMessage(null);
    setError(null);

    try {
      const deleted = await onDeleteSkill({ skillId: draft.skillId });
      if (!deleted) {
        setError("The selected skill could not be found.");
        return;
      }

      await loadSkills(null);
      setMessage("Skill deleted.");
    } catch (deleteError) {
      setError(errorToMessage(deleteError, "Unable to delete skill."));
    } finally {
      setIsDeleting(false);
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
        sourceLabel: importedFile.fileName,
        content: importedFile.content,
        tags: "",
        enabled: true,
      });

      setSelectedDocumentDraft(importedDocument);
      await loadDocuments(importedDocument.knowledgeDocumentId);
      setDocumentImportPath("");
      setDocumentMessage("Imported document");
    } catch (importError) {
      setDocumentError(
        errorToMessage(importError, "Unable to import document."),
      );
    } finally {
      setIsImportingDocument(false);
    }
  }

  function discardDraft() {
    if (selectedSkill) {
      setSelectedDraft(selectedSkill);
    } else {
      setDraft({ ...EMPTY_DRAFT });
    }
    setMessage(null);
    setError(null);
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

  function attachSelectedSkillToCoordinator() {
    if (!selectedSkill || isDirty || !onAttachContextToCoordinator) {
      return;
    }

    onAttachContextToCoordinator({
      contextText: skillCoordinatorContextText(selectedSkill),
      sourceLabel: "Skill Library / Skill",
    });
    setMessage("Skill attached to Workspace Agent as visible context.");
    setError(null);
  }

  function setSelectedDraft(skill: Skill) {
    setSelectedSkill(skill);
    setDraft({
      skillId: skill.skillId,
      title: skill.title,
      whenToUse: skill.whenToUse,
      prerequisites: skill.prerequisites,
      steps: skill.steps,
      validation: skill.validation,
      risks: skill.risks,
      tags: skill.tags,
      reviewStatus: skill.reviewStatus,
    });
  }

  function setSelectedDocumentDraft(document: KnowledgeDocument) {
    setSelectedDocument(document);
    setDocumentDraft({
      knowledgeDocumentId: document.knowledgeDocumentId,
      title: document.title,
      sourceLabel: document.sourceLabel,
      content: document.content,
      tags: document.tags,
      enabled: document.enabled,
    });
  }

  function clearDraft() {
    setSelectedSkill(null);
    setDraft({ ...EMPTY_DRAFT });
  }

  function clearDocumentDraft() {
    setSelectedDocument(null);
    setDocumentDraft({ ...EMPTY_DOCUMENT_DRAFT });
  }

  const statusBadge = (
    <Badge variant={statusVariant(draft.reviewStatus)}>
      {statusLabel(draft.reviewStatus)}
    </Badge>
  );

  return (
    <WidgetFrame
      actions={
        <>
          <Button
            disabled={
              activeTab === "skills"
                ? !apiAvailable || isLoading
                : !documentApiAvailable || isLoadingDocuments
            }
            onClick={
              activeTab === "skills" ? startNewSkill : startNewDocument
            }
            variant="secondary"
          >
            {activeTab === "skills" ? "New skill" : "New document"}
          </Button>
          {frameActions}
        </>
      }
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      status={statusBadge}
      style={frameStyle}
      title={title}
    >
      <div className="skill-library-shell">
        <div className="skill-library-summary">
          <span>Workspace-local.</span>
          <span>Skills attach explicitly.</span>
          <span>Enabled documents are searched for Workspace Agent runs.</span>
        </div>

        <div className="skill-library-tabs" role="tablist" aria-label="Knowledge surface tabs">
          <button
            aria-selected={activeTab === "skills"}
            className={[
              "skill-library-tab",
              activeTab === "skills" ? "skill-library-tab-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setActiveTab("skills")}
            role="tab"
            type="button"
          >
            Skills
          </button>
          <button
            aria-selected={activeTab === "documents"}
            className={[
              "skill-library-tab",
              activeTab === "documents" ? "skill-library-tab-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setActiveTab("documents")}
            role="tab"
            type="button"
          >
            Documents
          </button>
        </div>

        {activeTab === "skills" ? (
          <div className="skill-library-tab-panel" role="tabpanel">
            <div className="skill-library-summary skill-library-summary-secondary">
              <span>Operator-authored procedures.</span>
          <span>Skills are not sent to Workspace Agent unless explicitly attached.</span>
            </div>

        {isLoading ? (
          <EmptyState
            text="Workspace-local skills are loading from desktop storage."
            title="Loading skills."
          />
        ) : error && skills.length === 0 ? (
          <EmptyState text={error} title="Skills unavailable." />
        ) : (
          <div className="skill-library-layout">
            <aside className="skill-list-pane" aria-label="Skills">
              {skills.length === 0 ? (
                <EmptyState
                  text="Create the first reusable operator-authored skill for this workspace."
                  title="No skills yet."
                />
              ) : (
                <div className="skill-list">
                  {skills.map((skill) => (
                    <button
                      className={[
                        "skill-list-row",
                        selectedSkill?.skillId === skill.skillId
                          ? "skill-list-row-selected"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={isSelecting}
                      key={skill.skillId}
                      onClick={() => void selectSkill(skill.skillId)}
                      type="button"
                    >
                      <span className="skill-list-title">{skill.title}</span>
                      <span className="skill-list-meta">
                        {statusLabel(skill.reviewStatus)}
                        {skill.tags ? ` - ${skill.tags}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <section className="skill-editor-pane" aria-label="Selected skill">
              <div className="skill-editor">
                <label className="skill-field skill-field-wide">
                  <span>Title</span>
                  <input
                    className="input"
                    id={titleInputId}
                    onChange={(event) =>
                      setDraftField("title", event.currentTarget.value)
                    }
                    placeholder={DEFAULT_SKILL_TITLE}
                    value={draft.title}
                  />
                </label>

                <label className="skill-field">
                  <span>Review status</span>
                  <select
                    className="input"
                    id={statusInputId}
                    onChange={(event) =>
                      setDraftField(
                        "reviewStatus",
                        event.currentTarget.value as SkillReviewStatus,
                      )
                    }
                    value={draft.reviewStatus}
                  >
                    {REVIEW_STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="skill-field">
                  <span>Tags</span>
                  <input
                    className="input"
                    id={tagsInputId}
                    onChange={(event) =>
                      setDraftField("tags", event.currentTarget.value)
                    }
                    placeholder="review, deploy"
                    value={draft.tags}
                  />
                </label>

                <SkillTextArea
                  id={whenToUseInputId}
                  label="When to use"
                  onChange={(value) => setDraftField("whenToUse", value)}
                  value={draft.whenToUse}
                />
                <SkillTextArea
                  id={prerequisitesInputId}
                  label="Prerequisites"
                  onChange={(value) => setDraftField("prerequisites", value)}
                  value={draft.prerequisites}
                />
                <SkillTextArea
                  id={stepsInputId}
                  label="Steps"
                  onChange={(value) => setDraftField("steps", value)}
                  value={draft.steps}
                />
                <SkillTextArea
                  id={validationInputId}
                  label="Validation"
                  onChange={(value) => setDraftField("validation", value)}
                  value={draft.validation}
                />
                <SkillTextArea
                  id={risksInputId}
                  label="Risks"
                  onChange={(value) => setDraftField("risks", value)}
                  value={draft.risks}
                />

                <div className="skill-editor-actions">
                  {onAttachContextToCoordinator ? (
                    <Button
                      disabled={
                        !canAttachToCoordinator ||
                        isSaving ||
                        isDeleting
                      }
                      onClick={attachSelectedSkillToCoordinator}
                      title={
                        isDirty
                          ? "Save this Skill before attaching it to Workspace Agent."
                          : "Shares this saved Skill with Workspace Agent. Does not send automatically."
                      }
                      variant="secondary"
                    >
                      Attach to Workspace Agent
                    </Button>
                  ) : null}
                  <Button
                    disabled={!apiAvailable || !isDirty || isSaving || isDeleting}
                    onClick={() => void saveSkill()}
                    variant="primary"
                  >
                    {isSaving ? "Saving" : "Save skill"}
                  </Button>
                  <Button
                    disabled={!isDirty || isSaving || isDeleting}
                    onClick={discardDraft}
                    variant="secondary"
                  >
                    Discard
                  </Button>
                  <Button
                    disabled={!draft.skillId || isSaving || isDeleting}
                    onClick={() => void deleteSelectedSkill()}
                    variant="ghost"
                  >
                    {isDeleting ? "Deleting" : "Delete"}
                  </Button>
                </div>
                <p className="skill-attach-note">
                  {onAttachContextToCoordinator
                    ? "Attach uses the last saved Skill. Save edits before attaching. Does not send automatically."
                    : "Add Workspace Agent to attach saved Skills as visible context."}
                </p>

                {message ? <p className="skill-message">{message}</p> : null}
                {error ? (
                  <p className="skill-message skill-message-error" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        )}
          </div>
        ) : (
          <div className="skill-library-tab-panel" role="tabpanel">
            <div className="skill-library-summary skill-library-summary-secondary">
              <span>Plain-text or Markdown reference documents.</span>
              <span>
                Workspace Agent can search enabled workspace documents. Used documents are shown in the answer context.
              </span>
            </div>
            <div className="skill-document-import">
              <label className="skill-field skill-document-import-path">
                <span>Import path</span>
                <input
                  className="input"
                  id={documentImportPathInputId}
                  onChange={(event) => {
                    setDocumentImportPath(event.currentTarget.value);
                    setDocumentMessage(null);
                    setDocumentError(null);
                  }}
                  placeholder="Path to .txt, .md, or .markdown file"
                  value={documentImportPath}
                />
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
                  {documents.length === 0 ? (
                    <EmptyState
                      text="Add the first workspace-local reference document for this workspace."
                      title="No documents yet."
                    />
                  ) : (
                    <div className="skill-list">
                      {documents.map((document) => (
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
                          <span className="skill-list-title">
                            {document.title}
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

                <section
                  className="skill-editor-pane"
                  aria-label="Selected document"
                >
                  <div className="skill-editor">
                    <label className="skill-field skill-field-wide">
                      <span>Title</span>
                      <input
                        className="input"
                        id={documentTitleInputId}
                        onChange={(event) =>
                          setDocumentDraftField(
                            "title",
                            event.currentTarget.value,
                          )
                        }
                        placeholder={DEFAULT_DOCUMENT_TITLE}
                        value={documentDraft.title}
                      />
                    </label>

                    <label className="skill-field">
                      <span>Source label</span>
                      <input
                        className="input"
                        id={documentSourceInputId}
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
                        id={documentTagsInputId}
                        onChange={(event) =>
                          setDocumentDraftField(
                            "tags",
                            event.currentTarget.value,
                          )
                        }
                        placeholder="api, onboarding"
                        value={documentDraft.tags}
                      />
                    </label>

                    <label className="skill-field skill-checkbox-field">
                      <input
                        checked={documentDraft.enabled}
                        id={documentEnabledInputId}
                        onChange={(event) =>
                          setDocumentDraftField(
                            "enabled",
                            event.currentTarget.checked,
                          )
                        }
                        type="checkbox"
                      />
                      <span>Searchable by Workspace Agent</span>
                    </label>

                    <label className="skill-field skill-field-wide">
                      <span>Content</span>
                      <textarea
                        className="input skill-document-textarea"
                        id={documentContentInputId}
                        onChange={(event) =>
                          setDocumentDraftField(
                            "content",
                            event.currentTarget.value,
                          )
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
                          !isDocumentDirty ||
                          isSavingDocument ||
                          isDeletingDocument
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
                      Enabled saved documents may be searched before Run with Codex. Disabled documents are ignored.
                    </p>
                    {documentMessage ? (
                      <p className="skill-message">{documentMessage}</p>
                    ) : null}
                    {documentError ? (
                      <p
                        className="skill-message skill-message-error"
                        role="alert"
                      >
                        {documentError}
                      </p>
                    ) : null}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </WidgetFrame>
  );

  function setDraftField<Key extends keyof SkillDraft>(
    key: Key,
    value: SkillDraft[Key],
  ) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
    setMessage(null);
    setError(null);
  }

  function setDocumentDraftField<Key extends keyof KnowledgeDocumentDraft>(
    key: Key,
    value: KnowledgeDocumentDraft[Key],
  ) {
    setDocumentDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
    setDocumentMessage(null);
    setDocumentError(null);
  }
}

function skillCoordinatorContextText(
  skill: Pick<
    Skill,
    | "prerequisites"
    | "reviewStatus"
    | "risks"
    | "steps"
    | "tags"
    | "title"
    | "validation"
    | "whenToUse"
  >,
) {
  return [
    "Skill Library Skill",
    `Title: ${visibleSkillValue(skill.title)}`,
    "When to use:",
    visibleSkillValue(skill.whenToUse),
    "Prerequisites:",
    visibleSkillValue(skill.prerequisites),
    "Steps:",
    visibleSkillValue(skill.steps),
    "Validation:",
    visibleSkillValue(skill.validation),
    "Risks:",
    visibleSkillValue(skill.risks),
    `Tags: ${visibleSkillValue(skill.tags)}`,
    `Review status: ${statusLabel(skill.reviewStatus)}`,
  ].join("\n");
}

function visibleSkillValue(value: string) {
  const trimmed = value.trim();
  return trimmed || "(empty)";
}

function SkillTextArea({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="skill-field skill-field-wide">
      <span>{label}</span>
      <textarea
        className="input skill-textarea"
        id={id}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      />
    </label>
  );
}

function hasDraftContent(draft: SkillDraft) {
  return Boolean(
    draft.title.trim() !== DEFAULT_SKILL_TITLE ||
      draft.whenToUse.trim() ||
      draft.prerequisites.trim() ||
      draft.steps.trim() ||
      draft.validation.trim() ||
      draft.risks.trim() ||
      draft.tags.trim(),
  );
}

function hasDocumentDraftContent(draft: KnowledgeDocumentDraft) {
  return Boolean(
    draft.title.trim() !== DEFAULT_DOCUMENT_TITLE ||
      draft.sourceLabel.trim() !== "Workspace document" ||
      draft.content.trim() ||
      draft.tags.trim() ||
      !draft.enabled,
  );
}

function statusLabel(status: SkillReviewStatus) {
  return REVIEW_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function statusVariant(status: SkillReviewStatus) {
  switch (status) {
    case "reviewed":
      return "success";
    case "needs_review":
      return "warning";
    case "deprecated":
      return "neutral";
    case "draft":
    default:
      return "info";
  }
}

function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
