import type { KnowledgeSourceRef } from "../../../workspace/types/knowledgeDocuments";
import type {
  KnowledgeV2ContextActionNotice,
  KnowledgeV2ContextAffordanceSource,
  KnowledgeV2ContextAffordanceState,
} from "./knowledgeV2ContextAffordances";
import {
  formatKnowledgeV2ContextUnavailableReason,
  knowledgeV2ReferenceText,
} from "./knowledgeV2ContextAffordances";
import type { KnowledgeV2CatalogItem } from "./knowledgeV2CatalogTypes";

type KnowledgeV2PreviewPanelProps = {
  readonly actionNotice?: KnowledgeV2ContextActionNotice | null;
  readonly affordanceSource?: KnowledgeV2ContextAffordanceSource | null;
  readonly affordanceState?: KnowledgeV2ContextAffordanceState;
  readonly canAttachToQueueTask?: boolean;
  readonly canAttachToWorkspaceAgent?: boolean;
  readonly canCopyReference?: boolean;
  readonly hasItems: boolean;
  readonly item: KnowledgeV2CatalogItem | null;
  readonly onAttachToQueueTask?: () => void;
  readonly onAttachToWorkspaceAgent?: () => void;
  readonly onCopyReference?: () => void;
  readonly selectedItemId: string | null;
};

export function KnowledgeV2PreviewPanel({
  actionNotice = null,
  affordanceSource = null,
  affordanceState,
  canAttachToQueueTask = false,
  canAttachToWorkspaceAgent = false,
  canCopyReference = false,
  hasItems,
  item,
  onAttachToQueueTask,
  onAttachToWorkspaceAgent,
  onCopyReference,
  selectedItemId,
}: KnowledgeV2PreviewPanelProps) {
  if (selectedItemId && !item) {
    return (
      <section
        aria-label="Knowledge preview unavailable"
        className="knowledge-v2-preview knowledge-v2-empty"
      >
        <h3>Selected item unavailable.</h3>
        <p>The selected catalog item is not visible with the current filters.</p>
      </section>
    );
  }

  if (!hasItems) {
    return (
      <section
        aria-label="Knowledge preview empty"
        className="knowledge-v2-preview knowledge-v2-empty"
      >
        <h3>No item selected.</h3>
        <p>Add or pass Knowledge Documents and Skills to preview details here.</p>
      </section>
    );
  }

  if (!item) {
    return (
      <section
        aria-label="Knowledge preview waiting"
        className="knowledge-v2-preview knowledge-v2-empty"
      >
        <h3>Select an item.</h3>
        <p>Choose a catalog row to inspect lifecycle, source, and warnings.</p>
      </section>
    );
  }

  return (
    <section aria-label="Knowledge preview" className="knowledge-v2-preview">
      <div className="knowledge-v2-preview-heading">
        <div>
          <p className="knowledge-v2-eyebrow">{formatToken(item.type)}</p>
          <h3>{item.title}</h3>
        </div>
        <span className="knowledge-v2-chip" data-tone={toneForLifecycle(item.lifecycleState)}>
          {formatToken(item.lifecycleState)}
        </span>
      </div>

      <dl className="knowledge-v2-status-grid">
        <StatusTerm label="Review" value={item.reviewState ?? "Not set"} />
        <StatusTerm label="Enabled" value={item.enabled === false ? "No" : "Yes"} />
        <StatusTerm
          label="Searchable"
          value={item.searchable === false ? "No" : "Yes"}
        />
        <StatusTerm label="Scope" value={formatScope(item.source.scope)} />
      </dl>

      <section className="knowledge-v2-preview-section">
        <h4>Preview</h4>
        <p>{capText(item.description || item.summary, 520)}</p>
      </section>

      <section className="knowledge-v2-preview-section">
        <h4>Source</h4>
        <dl className="knowledge-v2-source-list">
          <StatusTerm label="Label" value={item.source.label || "Not supplied"} />
          <StatusTerm label="Kind" value={item.source.kind || "Not supplied"} />
          <StatusTerm label="Ref" value={item.source.ref || "Not supplied"} />
          <StatusTerm label="Source refs" value={String(item.sourceRefCount)} />
        </dl>
        {item.sourceRefs.refs.length > 0 ? (
          <ul className="knowledge-v2-source-refs">
            {item.sourceRefs.refs.slice(0, 4).map((sourceRef, index) => (
              <li key={`${sourceRef.kind}-${index}`}>
                <span>{sourceRef.label}</span>
                <code>{sourceRefValue(sourceRef)}</code>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {item.warnings.length > 0 ? (
        <section className="knowledge-v2-preview-section">
          <h4>Warnings</h4>
          <ul className="knowledge-v2-warnings">
            {item.warnings.map((warning) => (
              <li data-severity={warning.severity} key={`${warning.code}-${warning.message}`}>
                {warning.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <KnowledgeV2ContextActions
        actionNotice={actionNotice}
        affordanceSource={affordanceSource}
        affordanceState={affordanceState}
        canAttachToQueueTask={canAttachToQueueTask}
        canAttachToWorkspaceAgent={canAttachToWorkspaceAgent}
        canCopyReference={canCopyReference}
        item={item}
        onAttachToQueueTask={onAttachToQueueTask}
        onAttachToWorkspaceAgent={onAttachToWorkspaceAgent}
        onCopyReference={onCopyReference}
      />
    </section>
  );
}

function KnowledgeV2ContextActions({
  actionNotice,
  affordanceSource,
  affordanceState,
  canAttachToQueueTask,
  canAttachToWorkspaceAgent,
  canCopyReference,
  item,
  onAttachToQueueTask,
  onAttachToWorkspaceAgent,
  onCopyReference,
}: {
  readonly actionNotice: KnowledgeV2ContextActionNotice | null;
  readonly affordanceSource: KnowledgeV2ContextAffordanceSource | null;
  readonly affordanceState?: KnowledgeV2ContextAffordanceState;
  readonly canAttachToQueueTask: boolean;
  readonly canAttachToWorkspaceAgent: boolean;
  readonly canCopyReference: boolean;
  readonly item: KnowledgeV2CatalogItem;
  readonly onAttachToQueueTask?: () => void;
  readonly onAttachToWorkspaceAgent?: () => void;
  readonly onCopyReference?: () => void;
}) {
  const attachState =
    affordanceState ??
    ({
      canAttach: false,
      reason: "Context eligibility could not be evaluated.",
      warning: "Context eligibility could not be evaluated.",
    } satisfies KnowledgeV2ContextAffordanceState);
  const workspaceReason = formatKnowledgeV2ContextUnavailableReason(
    attachState.canAttach,
    canAttachToWorkspaceAgent,
    attachState.reason,
    "Workspace Agent",
  );
  const queueReason = formatKnowledgeV2ContextUnavailableReason(
    attachState.canAttach,
    canAttachToQueueTask,
    attachState.reason,
    "Queue task",
  );
  const copyReason = canCopyReference
    ? null
    : "Clipboard bridge is unavailable in this runtime.";

  return (
    <section
      aria-label="KnowledgeV2 use as context"
      className="knowledge-v2-preview-section knowledge-v2-context-actions"
    >
      <h4>Use as context</h4>
      <p>
        These controls only use explicit visible callbacks. They do not inject
        hidden context, create Queue tasks, or start runs.
      </p>
      {attachState.warning ? (
        <p className="knowledge-v2-context-warning">{attachState.warning}</p>
      ) : null}
      <div className="knowledge-v2-context-action-row">
        <ContextButton
          disabledReason={workspaceReason}
          label="Attach to Workspace Agent"
          onClick={onAttachToWorkspaceAgent}
        />
        <ContextButton
          disabledReason={queueReason}
          label="Attach to selected Queue task"
          onClick={onAttachToQueueTask}
        />
        <ContextButton
          disabledReason={copyReason}
          label="Copy reference"
          onClick={onCopyReference}
        />
      </div>
      {workspaceReason || queueReason || copyReason ? (
        <ul className="knowledge-v2-context-unavailable">
          {workspaceReason ? <li>{workspaceReason}</li> : null}
          {queueReason ? <li>{queueReason}</li> : null}
          {copyReason ? <li>{copyReason}</li> : null}
          {!affordanceSource ? <li>Open source details are read-only in this preview.</li> : null}
        </ul>
      ) : null}
      <details className="knowledge-v2-reference-details">
        <summary>Open source details</summary>
        <pre>{knowledgeV2ReferenceText(item)}</pre>
      </details>
      {actionNotice ? (
        <p
          className="knowledge-v2-context-action-notice"
          data-status={actionNotice.status}
          role={actionNotice.status === "attached" || actionNotice.status === "copied" ? "status" : "alert"}
        >
          {actionNotice.message}
        </p>
      ) : null}
    </section>
  );
}

function ContextButton({
  disabledReason,
  label,
  onClick,
}: {
  readonly disabledReason: string | null;
  readonly label: string;
  readonly onClick?: () => void;
}) {
  return (
    <button
      className="knowledge-v2-context-button"
      disabled={Boolean(disabledReason) || !onClick}
      onClick={onClick}
      title={disabledReason ?? undefined}
      type="button"
    >
      {label}
    </button>
  );
}

function StatusTerm({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{formatToken(value)}</dd>
    </div>
  );
}

function sourceRefValue(sourceRef: KnowledgeSourceRef) {
  switch (sourceRef.kind) {
    case "codebase_path":
    case "docs_path":
    case "finder_selection":
    case "import_file":
      return sourceRef.path;
    case "manual":
      return sourceRef.refText;
    case "note":
      return sourceRef.noteId;
    case "queue_run":
      return sourceRef.runId;
    case "queue_task":
      return sourceRef.queueTaskId;
  }
}

function capText(value: string, maxLength: number) {
  const text = value.trim();
  if (text.length <= maxLength) {
    return text || "No preview text supplied.";
  }
  return `${text.slice(0, maxLength).trim()}...`;
}

function formatScope(scope: KnowledgeV2CatalogItem["source"]["scope"]) {
  if (scope === "global") {
    return "Global";
  }
  if (scope === "workspace") {
    return "Workspace";
  }
  return "No scope";
}

function formatToken(value: string) {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function toneForLifecycle(value: KnowledgeV2CatalogItem["lifecycleState"]) {
  switch (value) {
    case "active":
    case "reviewed":
      return "ok";
    case "rejected":
    case "deprecated":
      return "blocked";
    case "stale":
    case "needs_review":
      return "warning";
    default:
      return "neutral";
  }
}
