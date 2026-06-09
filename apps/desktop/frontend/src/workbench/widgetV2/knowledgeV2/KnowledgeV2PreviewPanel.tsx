import type { KnowledgeSourceRef } from "../../../workspace/types/knowledgeDocuments";
import type { KnowledgeV2CatalogItem } from "./knowledgeV2CatalogTypes";

type KnowledgeV2PreviewPanelProps = {
  readonly hasItems: boolean;
  readonly item: KnowledgeV2CatalogItem | null;
  readonly selectedItemId: string | null;
};

export function KnowledgeV2PreviewPanel({
  hasItems,
  item,
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
        <p>Choose a catalog card to inspect lifecycle, source, and warnings.</p>
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
    </section>
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
