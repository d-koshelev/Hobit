import { Button } from "../../../design-system/Button";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../../../renderMemoryGuards";
import type { KnowledgeDocument, Skill } from "../../../workspace/types";
import {
  DEFAULT_DOCUMENT_TITLE,
  KNOWLEDGE_DOCUMENT_TYPE_OPTIONS,
  KNOWLEDGE_LIFECYCLE_STATUS_OPTIONS,
  knowledgeDocumentRelations,
  knowledgeDocumentDraftFromDocument,
  knowledgeDocumentVersionLabel,
  skillRelations,
  skillCatalogFullContent,
  type KnowledgeCatalogAttachmentState,
  type KnowledgeCatalogListItem,
  type KnowledgeDocumentDraft,
  type KnowledgeRelation,
} from "./skillLibraryModel";
import { knowledgeDocumentQuickSummaryWarning } from "../../knowledgeDocumentQuickSummaryWarning";

type CatalogSkillPreviewProps = {
  attachmentState?: KnowledgeCatalogAttachmentState;
  canAttachToWorkspaceAgent: boolean;
  canAttachToQueueTask: boolean;
  documents: KnowledgeDocument[];
  error: string | null;
  item: KnowledgeCatalogListItem | null;
  onAttachToQueueTask: () => void;
  message: string | null;
  onAttachToWorkspaceAgent: () => void;
  onEditSkill: () => void;
  skill: Skill;
  skills: Skill[];
};

type CatalogDocumentEditorProps = {
  attachmentState?: KnowledgeCatalogAttachmentState;
  canCreateRefreshTask: boolean;
  documentApiAvailable: boolean;
  documents: KnowledgeDocument[];
  draft: KnowledgeDocumentDraft;
  error: string | null;
  canAttachToQueueTask: boolean;
  isCreatingRefreshTask: boolean;
  isDeletingDocument: boolean;
  isDirty: boolean;
  isSavingDocument: boolean;
  item: KnowledgeCatalogListItem | null;
  message: string | null;
  onDeleteDocument: () => void;
  onAttachToQueueTask: () => void;
  onArchiveDocument: () => void;
  onCreateRefreshTask: () => void;
  onDiscardDraft: () => void;
  onMarkStale: () => void;
  onRestoreDocument: () => void;
  onSaveDocument: () => void;
  onSetDraftField: <Key extends keyof KnowledgeDocumentDraft>(
    key: Key,
    value: KnowledgeDocumentDraft[Key],
  ) => void;
  skills: Skill[];
};

type CatalogDocumentPreviewProps = {
  attachmentState?: KnowledgeCatalogAttachmentState;
  canAttachToWorkspaceAgent: boolean;
  canAttachToQueueTask: boolean;
  document: KnowledgeDocument;
  documents: KnowledgeDocument[];
  error: string | null;
  item: KnowledgeCatalogListItem | null;
  message: string | null;
  onAttachToQueueTask: () => void;
  onAttachToWorkspaceAgent: () => void;
  onEditDocument: () => void;
  skills: Skill[];
};

export function CatalogSkillPreview({
  attachmentState,
  canAttachToWorkspaceAgent,
  canAttachToQueueTask,
  documents,
  error,
  item,
  message,
  onAttachToQueueTask,
  onAttachToWorkspaceAgent,
  onEditSkill,
  skill,
  skills,
}: CatalogSkillPreviewProps) {
  const relations = skillRelations({
    attachmentState,
    documents,
    skill,
    skills,
  });

  return (
    <div className="skill-editor">
      <CatalogPreviewHeader item={item} />
      <PreviewField label="Quick summary" value={item?.quickSummary ?? ""} />
      <PreviewField
        label="Full content"
        value={skillCatalogFullContent(skill)}
      />
      <PreviewField label="Source" value="Workspace Skill record" />
      <PreviewField
        label="Relations"
        value={knowledgeRelationsText(relations)}
      />
      <div className="skill-editor-actions">
        {canAttachToWorkspaceAgent ? (
          <Button
            onClick={onAttachToWorkspaceAgent}
            title="Shares this saved Skill with Workspace Agent. Does not send automatically."
            variant="secondary"
          >
            Attach to Workspace Agent
          </Button>
        ) : null}
        <Button
          disabled={!canAttachToQueueTask}
          onClick={onAttachToQueueTask}
          title="Attaches this saved Skill to the selected Queue task as a safe ref and summary. Does not run automatically."
          variant="secondary"
        >
          Attach to Queue task
        </Button>
        <Button onClick={onEditSkill} variant="secondary">
          Edit skill
        </Button>
      </div>
      <p className="skill-attach-note">
        {canAttachToWorkspaceAgent
          ? "Attach uses the last saved Skill. Save edits before attaching. Does not send automatically."
          : "Add Workspace Agent to attach saved Skills as visible context."}
        {" "}Edit skill opens the selected Skill record editor. Queue attachments store
        refs and summaries only.
      </p>
      <CatalogMessages error={error} message={message} />
    </div>
  );
}

export function CatalogDocumentPreview({
  attachmentState,
  canAttachToWorkspaceAgent,
  canAttachToQueueTask,
  document,
  documents,
  error,
  item,
  message,
  onAttachToQueueTask,
  onAttachToWorkspaceAgent,
  onEditDocument,
  skills,
}: CatalogDocumentPreviewProps) {
  const relations = knowledgeDocumentRelations({
    attachmentState,
    documents,
    draft: knowledgeDocumentDraftFromDocument(document),
    skills,
  });

  return (
    <div className="skill-editor skill-catalog-readonly-preview">
      <CatalogPreviewHeader item={item} />
      <PreviewField label="Quick summary" value={document.quickSummary} />
      <PreviewField label="Full content" value={document.content} />
      <PreviewField
        label="Catalog metadata"
        value={[
          `Type: ${item?.typeLabel ?? document.catalogItemType}`,
          `Scope: ${item?.scopeLabel ?? document.scope}`,
          `Lifecycle: ${item?.statusLabel ?? document.lifecycleStatus}`,
          `Enabled: ${document.enabled ? "yes" : "no"}`,
          `Searchable: ${document.searchable === false ? "no" : "yes"}`,
          `Version: ${knowledgeDocumentVersionLabel(document)}`,
          `Created: ${document.createdAt}`,
          `Updated: ${document.updatedAt}`,
          document.reviewedAt ? `Reviewed: ${document.reviewedAt}` : "",
        ]
          .filter(Boolean)
          .join("\n")}
      />
      <PreviewField
        label="Source"
        value={[
          document.sourceLabel,
          document.sourceRef ? `Source ref: ${document.sourceRef}` : "",
          document.sourceKind ? `Source kind: ${document.sourceKind}` : "",
          document.createdByTaskId
            ? `Source task: ${document.createdByTaskId}`
            : "",
          document.createdFromRunId
            ? `Source run: ${document.createdFromRunId}`
            : "",
          ...sourceRefPreviewLines(document),
        ]
          .filter(Boolean)
          .join("\n")}
      />
      <PreviewField
        label="Relations"
        value={knowledgeRelationsText(relations)}
      />
      <div className="skill-editor-actions">
        {canAttachToWorkspaceAgent ? (
          <Button
            disabled={
              !document.enabled ||
              document.searchable === false ||
              document.lifecycleStatus === "archived" ||
              document.lifecycleStatus === "draft" ||
              document.lifecycleStatus === "rejected"
            }
            onClick={onAttachToWorkspaceAgent}
            title="Attaches a bounded visible Knowledge Document snapshot to Workspace Agent. Does not send automatically."
            variant="secondary"
          >
            Attach to Workspace Agent
          </Button>
        ) : null}
        <Button
          disabled={!canAttachToQueueTask}
          onClick={onAttachToQueueTask}
          title="Attaches this saved Knowledge Document to the selected Queue task as a safe ref and summary. Does not run automatically."
          variant="secondary"
        >
          Attach to Queue task
        </Button>
        <Button onClick={onEditDocument} variant="secondary">
          Edit item
        </Button>
      </div>
      <p className="skill-attach-note">
        This is a saved Knowledge Document preview. Edit item opens the
        catalog item editor; attachments use safe refs, summaries, and bounded
        excerpts only.
      </p>
      <CatalogMessages error={error} message={message} />
    </div>
  );
}

export function CatalogDocumentEditor({
  attachmentState,
  canCreateRefreshTask,
  documentApiAvailable,
  documents,
  draft,
  error,
  canAttachToQueueTask,
  isCreatingRefreshTask,
  isDeletingDocument,
  isDirty,
  isSavingDocument,
  item,
  message,
  onAttachToQueueTask,
  onArchiveDocument,
  onCreateRefreshTask,
  onDeleteDocument,
  onDiscardDraft,
  onMarkStale,
  onRestoreDocument,
  onSaveDocument,
  onSetDraftField,
  skills,
}: CatalogDocumentEditorProps) {
  const isStale = draft.lifecycleStatus === "stale";
  const quickSummaryWarning = knowledgeDocumentQuickSummaryWarning(draft);
  const relations = knowledgeDocumentRelations({
    attachmentState,
    documents,
    draft,
    skills,
  });

  return (
    <div className="skill-editor">
      <CatalogPreviewHeader item={item} />
      <label className="skill-field skill-field-wide">
        <span>Title</span>
        <input
          className="input"
          onChange={(event) =>
            onSetDraftField("title", event.currentTarget.value)
          }
          placeholder={DEFAULT_DOCUMENT_TITLE}
          value={draft.title}
        />
      </label>

      <label className="skill-field">
        <span>Type</span>
        <select
          className="input"
          onChange={(event) =>
            onSetDraftField(
              "catalogItemType",
              event.currentTarget.value as KnowledgeDocument["catalogItemType"],
            )
          }
          value={draft.catalogItemType}
        >
          {KNOWLEDGE_DOCUMENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="skill-field">
        <span>Scope</span>
        <select
          className="input"
          onChange={(event) =>
            onSetDraftField(
              "scope",
              event.currentTarget.value === "global" ? "global" : "workspace",
            )
          }
          value={draft.scope}
        >
          <option value="workspace">Workspace</option>
          <option value="global">Global</option>
        </select>
      </label>

      <label className="skill-field">
        <span>Status</span>
        <select
          className="input"
          onChange={(event) =>
            onSetDraftField(
              "lifecycleStatus",
              event.currentTarget.value as KnowledgeDocument["lifecycleStatus"],
            )
          }
          value={draft.lifecycleStatus}
        >
          {KNOWLEDGE_LIFECYCLE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="skill-field skill-field-wide">
        <span>Quick summary</span>
        <textarea
          className="input skill-summary-textarea"
          onChange={(event) =>
            onSetDraftField("quickSummary", event.currentTarget.value)
          }
          placeholder="One to three lines for fast review."
          value={draft.quickSummary}
        />
      </label>
      {quickSummaryWarning ? (
        <p className="skill-lifecycle-warning">{quickSummaryWarning}</p>
      ) : null}

      <label className="skill-field">
        <span>Source label</span>
        <input
          className="input"
          onChange={(event) =>
            onSetDraftField("sourceLabel", event.currentTarget.value)
          }
          placeholder="README.md or pasted docs"
          value={draft.sourceLabel}
        />
      </label>

      <label className="skill-field">
        <span>Source ref</span>
        <input
          className="input"
          onChange={(event) =>
            onSetDraftField("sourceRef", event.currentTarget.value)
          }
          placeholder="Optional path, URL, task, or run ref"
          value={draft.sourceRef}
        />
      </label>

      <label className="skill-field">
        <span>Tags</span>
        <input
          className="input"
          onChange={(event) =>
            onSetDraftField("tags", event.currentTarget.value)
          }
          placeholder="api, onboarding"
          value={draft.tags}
        />
      </label>

      <label className="skill-field skill-checkbox-field">
        <input
          checked={draft.enabled}
          onChange={(event) =>
            onSetDraftField("enabled", event.currentTarget.checked)
          }
          type="checkbox"
        />
        <span>Searchable by Workspace Agent</span>
      </label>
      {isStale ? (
        <p className="skill-lifecycle-warning">
          This document is stale. Attaching it to a Queue task will keep a
          visible warning on that task until the context is reviewed or the
          document is restored.
        </p>
      ) : null}

      <label className="skill-field skill-field-wide">
        <span>Full content</span>
        <textarea
          className="input skill-document-textarea"
          onChange={(event) =>
            onSetDraftField("content", event.currentTarget.value)
          }
          value={draft.content}
        />
      </label>

      <PreviewField
        label="Relations"
        value={knowledgeRelationsText(relations)}
      />

      <div className="skill-editor-actions">
        <Button
          disabled={!canAttachToQueueTask || isSavingDocument || isDeletingDocument}
          onClick={onAttachToQueueTask}
          title={
            isDirty
              ? "Save this Knowledge Document before attaching it to a Queue task."
              : "Attaches this saved Knowledge Document to the selected Queue task as a safe ref and summary. Does not run automatically."
          }
          variant="secondary"
        >
          Attach to Queue task
        </Button>
        <Button
          disabled={
            !canCreateRefreshTask ||
            isCreatingRefreshTask ||
            isSavingDocument ||
            isDeletingDocument
          }
          onClick={onCreateRefreshTask}
          title="Creates a manual Queue task to draft a refreshed Knowledge item from the explicit source ref. Does not change this item."
          variant="secondary"
        >
          {isCreatingRefreshTask ? "Creating task" : "Create refresh task"}
        </Button>
        <Button
          disabled={
            !draft.knowledgeDocumentId ||
            isStale ||
            isDirty ||
            isSavingDocument ||
            isDeletingDocument
          }
          onClick={onMarkStale}
          title="Marks this saved item stale. Stale items are not searched as active Knowledge."
          variant="secondary"
        >
          Mark stale
        </Button>
        <Button
          disabled={
            !draft.knowledgeDocumentId ||
            draft.lifecycleStatus === "active" ||
            isDirty ||
            isSavingDocument ||
            isDeletingDocument
          }
          onClick={onRestoreDocument}
          title="Restores this saved item to active Knowledge. Active enabled documents may be searched before Workspace Agent Codex runs."
          variant="secondary"
        >
          Restore active
        </Button>
        <Button
          disabled={
            !draft.knowledgeDocumentId ||
            draft.lifecycleStatus === "archived" ||
            isDirty ||
            isSavingDocument ||
            isDeletingDocument
          }
          onClick={onArchiveDocument}
          title="Archives this saved item while retaining it for review."
          variant="ghost"
        >
          Archive
        </Button>
        <Button
          disabled={
            !documentApiAvailable ||
            !isDirty ||
            isSavingDocument ||
            isDeletingDocument
          }
          onClick={onSaveDocument}
          variant="primary"
        >
          {isSavingDocument ? "Saving" : "Save document"}
        </Button>
        <Button
          disabled={!isDirty || isSavingDocument || isDeletingDocument}
          onClick={onDiscardDraft}
          variant="secondary"
        >
          Discard
        </Button>
        <Button
          disabled={
            !draft.knowledgeDocumentId || isSavingDocument || isDeletingDocument
          }
          onClick={onDeleteDocument}
          variant="ghost"
        >
          {isDeletingDocument ? "Deleting" : "Delete"}
        </Button>
      </div>
      <p className="skill-attach-note">
        Enabled saved workspace and global documents may be searched before Run
        with Codex. Disabled documents are ignored. Queue attachments store safe
        refs and summaries only.
      </p>
      <CatalogMessages error={error} message={message} />
    </div>
  );
}

function knowledgeRelationsText(relations: KnowledgeRelation[]) {
  if (relations.length === 0) {
    return "No relations found in saved metadata.";
  }

  return relations
    .map((relation) => `${relation.label}: ${relation.value}`)
    .join("\n");
}

function sourceRefPreviewLines(document: KnowledgeDocument) {
  return (document.sourceRefs ?? []).slice(0, 5).map((sourceRef, index) => {
    const prefix = `Source ref ${index + 1}`;

    switch (sourceRef.kind) {
      case "codebase_path":
      case "docs_path":
      case "finder_selection":
      case "import_file":
        return `${prefix}: ${sourceRef.kind} ${sourceRef.path}`;
      case "queue_task":
        return `${prefix}: queue task ${sourceRef.queueTaskId}`;
      case "queue_run":
        return `${prefix}: run ${sourceRef.runId}`;
      case "note":
        return `${prefix}: note ${sourceRef.noteId}`;
      case "manual":
        return `${prefix}: manual ${sourceRef.refText}`;
    }
  });
}

function CatalogPreviewHeader({
  item,
}: {
  item: KnowledgeCatalogListItem | null;
}) {
  return (
    <div className="skill-catalog-preview-header">
      <div>
        <span className="skill-list-meta">Selected preview</span>
        <h3>{item?.title ?? "New catalog item"}</h3>
      </div>
      {item ? (
        <div className="skill-catalog-preview-badges">
          <span className="skill-scope-badge">{item.typeLabel}</span>
          <span className="skill-scope-badge">{item.scopeLabel}</span>
          <span className="skill-scope-badge">{item.statusLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="skill-preview-field">
      <span>{label}</span>
      <p>
        {value.trim()
          ? cappedPreviewText(value.trim(), RENDER_MEMORY_CAPS.knowledgePreviewChars)
          : "(empty)"}
      </p>
    </div>
  );
}

function CatalogMessages({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  return (
    <>
      {message ? <p className="skill-message">{message}</p> : null}
      {error ? (
        <p className="skill-message skill-message-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
