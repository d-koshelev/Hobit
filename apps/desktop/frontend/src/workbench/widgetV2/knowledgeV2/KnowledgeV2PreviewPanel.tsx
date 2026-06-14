import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

import type { KnowledgeSourceRef } from "../../../workspace/types/knowledgeDocuments";
import type {
  KnowledgeV2ContextActionNotice,
  KnowledgeV2ContextAffordanceState,
} from "./knowledgeV2ContextAffordances";
import { knowledgeV2ReferenceText } from "./knowledgeV2ContextAffordances";
import type { KnowledgeV2CatalogItem } from "./knowledgeV2CatalogTypes";
import { KnowledgeV2StatusBadge, knowledgeV2ItemStatuses } from "./knowledgeV2ItemStatus";
import {
  KnowledgeV2CompactStatus,
  KnowledgeV2CompactStatusReason,
  KnowledgeV2ContextUsabilitySummary,
  KnowledgeV2WarningsSummary,
} from "./KnowledgeV2PreviewStatus";

type KnowledgeV2PreviewPanelProps = {
  readonly actionNotice?: KnowledgeV2ContextActionNotice | null;
  readonly affordanceState?: KnowledgeV2ContextAffordanceState;
  readonly hasItems: boolean;
  readonly item: KnowledgeV2CatalogItem | null;
  readonly presentation?: "preview" | "detailWindow";
  readonly selectedItemId: string | null;
};

type KnowledgeV2PreviewTab = "overview" | "details" | "source" | "versions" | "usage";

const previewTabs: ReadonlyArray<{
  readonly id: KnowledgeV2PreviewTab;
  readonly label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Details" },
  { id: "source", label: "Source" },
  { id: "versions", label: "Versions" },
  { id: "usage", label: "Usage" },
];

export function KnowledgeV2PreviewPanel({
  actionNotice = null,
  affordanceState,
  hasItems,
  item,
  presentation = "preview",
  selectedItemId,
}: KnowledgeV2PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<KnowledgeV2PreviewTab>("overview");
  const [isWarningDetailsOpen, setIsWarningDetailsOpen] = useState(false);

  useEffect(() => {
    setActiveTab("overview");
    setIsWarningDetailsOpen(false);
  }, [item?.id]);

  if (selectedItemId && !item) {
    return (
      <section
        aria-label="Knowledge preview unavailable"
        className="knowledge-v2-preview knowledge-v2-empty"
      >
        <h3>Selected item unavailable.</h3>
        <p>
          The selected catalog item is no longer visible with the current
          filters. Clear filters or select another item from the catalog.
        </p>
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
        <h3>No selected item.</h3>
        <p>Choose a catalog row to inspect lifecycle, source, and warnings.</p>
      </section>
    );
  }

  const statuses = knowledgeV2ItemStatuses(item);
  const isDetailWindow = presentation === "detailWindow";

  return (
    <section
      aria-label="Knowledge preview"
      className={[
        "knowledge-v2-preview",
        isDetailWindow ? "knowledge-v2-detail-window-body" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!isDetailWindow ? (
        <>
          <div className="knowledge-v2-preview-heading">
            <div className="knowledge-v2-preview-title-block">
              <span className="knowledge-v2-type-icon" aria-hidden="true">
                {typeIcon(item.type)}
              </span>
              <div>
                <p className="knowledge-v2-eyebrow">{formatToken(item.type)}</p>
                <h3>{item.title}</h3>
              </div>
            </div>
            <div className="knowledge-v2-preview-badges" aria-label="Knowledge item states">
              {statuses.map((status) => (
                <KnowledgeV2StatusBadge key={status.key} status={status} />
              ))}
              {item.reviewState ? (
                <span className="knowledge-v2-chip">{formatToken(item.reviewState)}</span>
              ) : null}
            </div>
          </div>

          <p className="knowledge-v2-preview-summary">
            {overviewSummaryText(item)}
          </p>
        </>
      ) : null}

      {!isDetailWindow ? (
        <>
          <KnowledgeV2CompactStatus affordanceState={affordanceState} item={item} statuses={statuses} />

          <dl className="knowledge-v2-status-grid knowledge-v2-status-grid-compact">
            <StatusTerm label="Scope" value={formatScope(item.source.scope)} />
            <StatusTerm label="Source" value={item.source.label || sourceFallback(item)} />
            <StatusTerm label="Version" value={formatVersion(item.version)} />
            <StatusTerm label="Updated" value={formatDate(item.updatedAt)} />
          </dl>

          <section className="knowledge-v2-preview-section knowledge-v2-preview-status-section">
            <h4>Status</h4>
            <KnowledgeV2CompactStatusReason item={item} statuses={statuses} />
          </section>

          <KnowledgeV2WarningsSummary isOpen={isWarningDetailsOpen} item={item} setIsOpen={setIsWarningDetailsOpen} />
        </>
      ) : null}

      <div className="knowledge-v2-preview-tabs" role="tablist" aria-label="Knowledge preview tabs">
        {previewTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className="knowledge-v2-preview-tab"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <KnowledgeV2OverviewTab
          affordanceState={affordanceState}
          item={item}
          statuses={statuses}
        />
      ) : null}
      {activeTab === "details" ? (
        <KnowledgeV2DetailsTab
          affordanceState={affordanceState}
          isWarningDetailsOpen={isWarningDetailsOpen}
          item={item}
          setIsWarningDetailsOpen={setIsWarningDetailsOpen}
          statuses={statuses}
        />
      ) : null}
      {activeTab === "source" ? <KnowledgeV2SourceTab item={item} /> : null}
      {activeTab === "versions" ? <KnowledgeV2VersionsTab item={item} /> : null}
      {activeTab === "usage" ? <KnowledgeV2UsageTab /> : null}
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

function KnowledgeV2OverviewTab({
  affordanceState,
  item,
  statuses,
}: {
  readonly affordanceState?: KnowledgeV2ContextAffordanceState;
  readonly item: KnowledgeV2CatalogItem;
  readonly statuses: ReturnType<typeof knowledgeV2ItemStatuses>;
}) {
  return (
    <div className="knowledge-v2-tab-panel" role="tabpanel">
      <section className="knowledge-v2-preview-section">
        <h4>Summary</h4>
        <p>{overviewSummaryText(item)}</p>
      </section>
      <section className="knowledge-v2-preview-section">
        <h4>What it does</h4>
        <p>{overviewDescriptionText(item)}</p>
      </section>
      <section className="knowledge-v2-preview-section">
        <h4>Context use</h4>
        <KnowledgeV2ContextUsabilitySummary
          affordanceState={affordanceState}
          item={item}
          statuses={statuses}
        />
      </section>
      {item.warnings.length > 0 ? (
        <section
          aria-label="Knowledge preview warnings"
          className="knowledge-v2-preview-section knowledge-v2-warning-summary"
        >
          <h4>Warnings</h4>
          <p>{warningSummaryText(item)}</p>
        </section>
      ) : null}
      <section className="knowledge-v2-preview-section">
        <h4>Use cases</h4>
        <p>{useCaseText(item)}</p>
      </section>
      <section className="knowledge-v2-preview-section">
        <h4>Tags</h4>
        {item.tags.length > 0 ? (
          <div className="knowledge-v2-tags">
            {item.tags.map((tag) => (
              <span className="knowledge-v2-tag" key={tag}>{tag}</span>
            ))}
          </div>
        ) : (
          <p>No tags supplied.</p>
        )}
      </section>
    </div>
  );
}

function KnowledgeV2DetailsTab({
  affordanceState,
  isWarningDetailsOpen,
  item,
  setIsWarningDetailsOpen,
  statuses,
}: {
  readonly affordanceState?: KnowledgeV2ContextAffordanceState;
  readonly isWarningDetailsOpen: boolean;
  readonly item: KnowledgeV2CatalogItem;
  readonly setIsWarningDetailsOpen: Dispatch<SetStateAction<boolean>>;
  readonly statuses: ReturnType<typeof knowledgeV2ItemStatuses>;
}) {
  return (
    <div className="knowledge-v2-tab-panel" role="tabpanel">
      <section className="knowledge-v2-preview-section">
        <h4>Metadata</h4>
        <dl className="knowledge-v2-source-list">
          <StatusTerm label="Source" value={item.source.label || sourceFallback(item)} />
          <StatusTerm label="Scope" value={formatScope(item.source.scope)} />
          <StatusTerm label="Version" value={formatVersion(item.version)} />
          <StatusTerm label="Created" value={formatDate(item.createdAt)} />
          <StatusTerm label="Updated" value={formatDate(item.updatedAt)} />
          <StatusTerm label="Lifecycle" value={formatToken(item.lifecycleState)} />
          <StatusTerm label="Status" value={statuses.map((status) => status.label).join(" - ")} />
          <StatusTerm label="Enabled" value={item.enabled === false ? "No" : "Yes"} />
          <StatusTerm label="Searchable" value={item.searchable === false ? "No" : "Yes"} />
        </dl>
      </section>
      <section className="knowledge-v2-preview-section">
        <h4>Source details</h4>
        <dl className="knowledge-v2-source-list">
          <StatusTerm label="Kind" value={item.source.kind || "Not available"} />
          <StatusTerm label="Ref" value={item.source.ref || "Not available"} />
          <StatusTerm label="Source size" value={formatSourceSize(item.sourcePreviewLength)} />
          <StatusTerm label="Source text" value={item.sourcePreviewCapped ? "Capped" : "Bounded"} />
        </dl>
      </section>
      <section className="knowledge-v2-preview-section knowledge-v2-preview-status-section">
        <h4>Context usability</h4>
        <KnowledgeV2ContextUsabilitySummary
          affordanceState={affordanceState}
          item={item}
          statuses={statuses}
        />
        <KnowledgeV2CompactStatusReason item={item} statuses={statuses} />
      </section>
      <KnowledgeV2WarningsSummary
        isOpen={isWarningDetailsOpen}
        item={item}
        setIsOpen={setIsWarningDetailsOpen}
      />
      <section className="knowledge-v2-preview-section">
        <h4>Attachments and source refs</h4>
        <p>
          {item.sourceRefCount > 0
            ? `${item.sourceRefCount} source ref${item.sourceRefCount === 1 ? "" : "s"} supplied.`
            : "No structured source refs are available for this item."}
        </p>
        {item.sourceRefs.refs.length > 0 ? (
          <ul className="knowledge-v2-source-refs">
            {item.sourceRefs.refs.slice(0, 6).map((sourceRef, index) => (
              <li key={`${sourceRef.kind}-${index}`}>
                <span>{sourceRef.label}</span>
                <code>{sourceRefValue(sourceRef)}</code>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="knowledge-v2-preview-section">
        <h4>Ownership</h4>
        <dl className="knowledge-v2-source-list">
          <StatusTerm label="Owner" value={item.createdBy || "Not available"} />
          <StatusTerm
            label="Created by task"
            value={item.createdByTaskId || "Not available"}
          />
          <StatusTerm
            label="Created from run"
            value={item.createdFromRunId || "Not available"}
          />
          <StatusTerm label="Created" value={formatDate(item.createdAt)} />
        </dl>
      </section>
    </div>
  );
}

function KnowledgeV2SourceTab({ item }: { readonly item: KnowledgeV2CatalogItem }) {
  return (
    <div className="knowledge-v2-tab-panel" role="tabpanel">
      <section className="knowledge-v2-preview-section">
        <h4>Source content</h4>
        <p>
          {item.sourcePreview
            ? item.sourcePreviewCapped
              ? "Large source content is capped in this bounded popup."
              : "Bounded source content from the selected Knowledge record."
            : "No source content is available for this item."}
        </p>
        {item.sourcePreview ? (
          <p className="knowledge-v2-muted">
            Preview: {item.sourcePreviewCapped ? "Capped" : "Bounded"}
          </p>
        ) : null}
        {item.sourcePreview ? (
          <pre
            aria-label="KnowledgeV2 source content"
            className="knowledge-v2-source-content"
          >
            {item.sourcePreview}
          </pre>
        ) : null}
      </section>
      <section className="knowledge-v2-preview-section">
        <h4>Reference text</h4>
        <details className="knowledge-v2-reference-details">
          <summary>Open source details</summary>
          <pre>{knowledgeV2ReferenceText(item)}</pre>
        </details>
      </section>
    </div>
  );
}

function KnowledgeV2VersionsTab({ item }: { readonly item: KnowledgeV2CatalogItem }) {
  return (
    <div className="knowledge-v2-tab-panel" role="tabpanel">
      <section className="knowledge-v2-preview-section">
        <h4>Current version</h4>
        <dl className="knowledge-v2-source-list">
          <StatusTerm label="Version" value={formatVersion(item.version)} />
          <StatusTerm label="Updated" value={formatDate(item.updatedAt)} />
          <StatusTerm label="Lifecycle" value={formatToken(item.lifecycleState)} />
          <StatusTerm label="Summary" value={item.versionSummary || "Not available"} />
        </dl>
      </section>
      <section className="knowledge-v2-preview-section knowledge-v2-unavailable-panel">
        <h4>Version history unavailable</h4>
        <p>
          Full version history is not wired in KnowledgeV2. This panel shows
          only current item metadata already present on the selected record.
        </p>
      </section>
    </div>
  );
}

function KnowledgeV2UsageTab() {
  return (
    <div className="knowledge-v2-tab-panel" role="tabpanel">
      <section className="knowledge-v2-preview-section knowledge-v2-unavailable-panel">
        <h4>Usage tracking unavailable</h4>
        <p>
          Where-used tracking is not wired in KnowledgeV2. No Workspace Agent,
          Queue, run, prompt, or widget usage data is being invented here.
        </p>
      </section>
    </div>
  );
}

function StatusTerm({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{formatMetadataValue(value)}</dd>
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

function typeIcon(type: KnowledgeV2CatalogItem["type"]) {
  switch (type) {
    case "skill":
      return "S";
    case "runbook":
      return "R";
    case "draft":
      return "D";
    case "document":
    default:
      return "K";
  }
}

function useCaseText(item: KnowledgeV2CatalogItem) {
  if (item.type === "skill") {
    return item.description || "Use case unavailable for this Skill.";
  }
  if (item.documentSubtype) {
    return `${formatToken(item.documentSubtype)} reference for Knowledge review.`;
  }
  return "Use case metadata is unavailable for this item.";
}

function overviewSummaryText(item: KnowledgeV2CatalogItem) {
  const summary = item.summary.trim();
  if (summary) {
    return capText(summary, 420);
  }
  return item.source.kind === "import_file"
    ? "Imported reference document. Source content is available in Source."
    : "No summary available yet.";
}

function warningSummaryText(item: KnowledgeV2CatalogItem) {
  return `${item.warnings.length.toString()} warning${
    item.warnings.length === 1 ? "" : "s"
  }: ${item.warnings.map(warningSummaryLabel).join(", ")}`;
}

function warningSummaryLabel(warning: KnowledgeV2CatalogItem["warnings"][number]) {
  switch (warning.code) {
    case "large_content":
    case "large_skill":
      return "Large";
    case "missing_quick_summary":
    case "missing_skill_summary":
      return "Missing summary";
    case "rejected":
      return "Rejected";
    case "stale":
      return "Stale";
    case "unavailable":
      return warning.message.includes("not searchable")
        ? "Not searchable"
        : "Unavailable";
    default:
      return formatToken(warning.code);
  }
}

function overviewDescriptionText(item: KnowledgeV2CatalogItem) {
  if (item.type === "document") {
    return "Reference document. Source content is available in Source.";
  }

  const description = item.description.trim();
  if (description) {
    return capText(description, 620);
  }
  return "No description available yet.";
}

function capText(value: string, maxLength: number) {
  const text = value.trim();
  if (text.length <= maxLength) {
    return text || "No preview text supplied.";
  }
  return `${text.slice(0, maxLength).trim()}...`;
}

function formatSourceSize(value: number) {
  if (value <= 0) {
    return "Not available";
  }
  if (value < 1_000) {
    return `${value} chars`;
  }
  return `${Math.round(value / 1_000)}k chars`;
}

function formatScope(scope: KnowledgeV2CatalogItem["source"]["scope"]) {
  if (scope === "global") {
    return "Global";
  }
  if (scope === "workspace") {
    return "Workspace";
  }
  return "Not available";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toISOString().slice(0, 10);
}

function formatVersion(value?: string | null) {
  const text = value?.trim();
  return text ? `v${text.replace(/^v/i, "")}` : "Not available";
}

function sourceFallback(item: KnowledgeV2CatalogItem) {
  return item.type === "skill" ? "Operator-authored Skill" : "Not available";
}

function formatToken(value: string) {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMetadataValue(value: string) {
  if (value === "Not available" || value === "Unknown") {
    return value;
  }
  if (/^v\d+/i.test(value)) {
    return value.toLowerCase();
  }
  return formatToken(value);
}
