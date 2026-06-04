import { Button } from "../design-system/Button";
import type { KnowledgeDocument, Skill } from "../workspace/types";
import {
  DEFAULT_DOCUMENT_TITLE,
  KNOWLEDGE_DOCUMENT_TYPE_OPTIONS,
  KNOWLEDGE_LIFECYCLE_STATUS_OPTIONS,
  skillCatalogFullContent,
  type KnowledgeCatalogListItem,
  type KnowledgeDocumentDraft,
} from "./skillLibraryModel";

type CatalogSkillPreviewProps = {
  canAttachToWorkspaceAgent: boolean;
  canAttachToQueueTask: boolean;
  error: string | null;
  item: KnowledgeCatalogListItem | null;
  onAttachToQueueTask: () => void;
  message: string | null;
  onAttachToWorkspaceAgent: () => void;
  onShowSkills: () => void;
  skill: Skill;
};

type CatalogDocumentEditorProps = {
  canCreateRefreshTask: boolean;
  documentApiAvailable: boolean;
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
};

export function CatalogSkillPreview({
  canAttachToWorkspaceAgent,
  canAttachToQueueTask,
  error,
  item,
  message,
  onAttachToQueueTask,
  onAttachToWorkspaceAgent,
  onShowSkills,
  skill,
}: CatalogSkillPreviewProps) {
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
        value="Related files, tasks, commits, and catalog relations are not implemented in this MVP."
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
        <Button onClick={onShowSkills} variant="secondary">
          Open Skills tab
        </Button>
      </div>
      <p className="skill-attach-note">
        Skills are shown in the catalog for discovery. Edit and delete them from
        the Skills tab. Queue attachments store refs and summaries only.
      </p>
      <CatalogMessages error={error} message={message} />
    </div>
  );
}

export function CatalogDocumentEditor({
  canCreateRefreshTask,
  documentApiAvailable,
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
}: CatalogDocumentEditorProps) {
  const isStale = draft.lifecycleStatus === "stale";

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
        value="Related files, tasks, commits, and catalog relations are not implemented in this MVP."
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
      <p>{value.trim() || "(empty)"}</p>
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
