import { useState } from "react";

import type { KnowledgeSourceRef } from "../../../workspace/types/knowledgeDocuments";
import type {
  KnowledgeV2ContextActionNotice,
  KnowledgeV2ContextAffordanceSource,
  KnowledgeV2ContextAffordanceState,
  KnowledgeV2ContextTarget,
} from "./knowledgeV2ContextAffordances";
import {
  formatKnowledgeV2ContextUnavailableReason,
  knowledgeV2ReferenceText,
} from "./knowledgeV2ContextAffordances";
import type { KnowledgeV2CatalogItem } from "./knowledgeV2CatalogTypes";
import {
  KnowledgeV2StatusBadge,
  KnowledgeV2StatusReasonList,
  knowledgeV2ItemStatuses,
} from "./knowledgeV2ItemStatus";
import {
  KnowledgeV2ContextPicker,
  type KnowledgeV2PickerItem,
} from "./KnowledgeV2ContextPicker";

type KnowledgeV2PreviewPanelProps = {
  readonly actionNotice?: KnowledgeV2ContextActionNotice | null;
  readonly affordanceSource?: KnowledgeV2ContextAffordanceSource | null;
  readonly affordanceState?: KnowledgeV2ContextAffordanceState;
  readonly canAttachToQueueTask?: boolean;
  readonly canAttachToWorkspaceAgent?: boolean;
  readonly canCopyReference?: boolean;
  readonly contextItems?: readonly KnowledgeV2PickerItem[];
  readonly hasItems: boolean;
  readonly item: KnowledgeV2CatalogItem | null;
  readonly isContextPickerOpen?: boolean;
  readonly onAttachContextPicker?: (
    target: KnowledgeV2ContextTarget,
    selectedItemIds: readonly string[],
  ) => void;
  readonly onCloseContextPicker?: () => void;
  readonly onOpenContextPicker?: () => void;
  readonly selectedItemId: string | null;
};

type KnowledgeV2PreviewTab = "overview" | "details" | "versions" | "usage";

const previewTabs: ReadonlyArray<{
  readonly id: KnowledgeV2PreviewTab;
  readonly label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Details" },
  { id: "versions", label: "Versions" },
  { id: "usage", label: "Usage" },
];

export function KnowledgeV2PreviewPanel({
  actionNotice = null,
  affordanceSource = null,
  affordanceState,
  canAttachToQueueTask = false,
  canAttachToWorkspaceAgent = false,
  canCopyReference = false,
  contextItems = [],
  hasItems,
  isContextPickerOpen = false,
  item,
  onAttachContextPicker,
  onCloseContextPicker,
  onOpenContextPicker,
  selectedItemId,
}: KnowledgeV2PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<KnowledgeV2PreviewTab>("overview");

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

  return (
    <section aria-label="Knowledge preview" className="knowledge-v2-preview">
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
        {capText(item.summary || item.description, 260)}
      </p>

      <dl className="knowledge-v2-status-grid knowledge-v2-status-grid-compact">
        <StatusTerm label="Scope" value={formatScope(item.source.scope)} />
        <StatusTerm label="Source" value={item.source.label || sourceFallback(item)} />
        <StatusTerm label="Version" value={item.version ? `v${item.version}` : "No version"} />
        <StatusTerm label="Updated" value={formatDate(item.updatedAt)} />
      </dl>

      <section className="knowledge-v2-preview-section">
        <h4>Status</h4>
        <KnowledgeV2StatusReasonList statuses={statuses} />
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
          actionNotice={actionNotice}
          affordanceSource={affordanceSource}
          affordanceState={affordanceState}
          canAttachToQueueTask={canAttachToQueueTask}
          canAttachToWorkspaceAgent={canAttachToWorkspaceAgent}
          canCopyReference={canCopyReference}
          contextItems={contextItems}
          isContextPickerOpen={isContextPickerOpen}
          item={item}
          onAttachContextPicker={onAttachContextPicker}
          onCloseContextPicker={onCloseContextPicker}
          onOpenContextPicker={onOpenContextPicker}
        />
      ) : null}
      {activeTab === "details" ? <KnowledgeV2DetailsTab item={item} /> : null}
      {activeTab === "versions" ? <KnowledgeV2VersionsTab item={item} /> : null}
      {activeTab === "usage" ? <KnowledgeV2UsageTab /> : null}
    </section>
  );
}

function KnowledgeV2OverviewTab({
  actionNotice,
  affordanceSource,
  affordanceState,
  canAttachToQueueTask,
  canAttachToWorkspaceAgent,
  canCopyReference,
  contextItems,
  isContextPickerOpen,
  item,
  onAttachContextPicker,
  onCloseContextPicker,
  onOpenContextPicker,
}: {
  readonly actionNotice: KnowledgeV2ContextActionNotice | null;
  readonly affordanceSource: KnowledgeV2ContextAffordanceSource | null;
  readonly affordanceState?: KnowledgeV2ContextAffordanceState;
  readonly canAttachToQueueTask: boolean;
  readonly canAttachToWorkspaceAgent: boolean;
  readonly canCopyReference: boolean;
  readonly contextItems: readonly KnowledgeV2PickerItem[];
  readonly isContextPickerOpen: boolean;
  readonly item: KnowledgeV2CatalogItem;
  readonly onAttachContextPicker?: (
    target: KnowledgeV2ContextTarget,
    selectedItemIds: readonly string[],
  ) => void;
  readonly onCloseContextPicker?: () => void;
  readonly onOpenContextPicker?: () => void;
}) {
  return (
    <div className="knowledge-v2-tab-panel" role="tabpanel">
      <section className="knowledge-v2-preview-section">
        <h4>Summary</h4>
        <p>{capText(item.summary, 420)}</p>
      </section>
      <section className="knowledge-v2-preview-section">
        <h4>What it does</h4>
        <p>{capText(item.description || item.summary, 620)}</p>
      </section>
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
      <KnowledgeV2ContextActions
        actionNotice={actionNotice}
        affordanceSource={affordanceSource}
        affordanceState={affordanceState}
        canAttachToQueueTask={canAttachToQueueTask}
        canAttachToWorkspaceAgent={canAttachToWorkspaceAgent}
        canCopyReference={canCopyReference}
        contextItems={contextItems}
        isContextPickerOpen={isContextPickerOpen}
        item={item}
        onAttachContextPicker={onAttachContextPicker}
        onCloseContextPicker={onCloseContextPicker}
        onOpenContextPicker={onOpenContextPicker}
      />
    </div>
  );
}

function KnowledgeV2DetailsTab({ item }: { readonly item: KnowledgeV2CatalogItem }) {
  return (
    <div className="knowledge-v2-tab-panel" role="tabpanel">
      <section className="knowledge-v2-preview-section">
        <h4>Source</h4>
        <dl className="knowledge-v2-source-list">
          <StatusTerm label="Label" value={item.source.label || "Unavailable"} />
          <StatusTerm label="Kind" value={item.source.kind || "Unavailable"} />
          <StatusTerm label="Ref" value={item.source.ref || "Unavailable"} />
          <StatusTerm label="Scope" value={formatScope(item.source.scope)} />
        </dl>
      </section>
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
          <StatusTerm label="Owner" value={item.createdBy || "Unavailable"} />
          <StatusTerm label="Created by task" value={item.createdByTaskId || "Unavailable"} />
          <StatusTerm label="Created from run" value={item.createdFromRunId || "Unavailable"} />
          <StatusTerm label="Created" value={formatDate(item.createdAt)} />
        </dl>
      </section>
      <section className="knowledge-v2-preview-section">
        <h4>Catalog flags</h4>
        <dl className="knowledge-v2-source-list">
          <StatusTerm label="Enabled" value={item.enabled === false ? "No" : "Yes"} />
          <StatusTerm label="Searchable" value={item.searchable === false ? "No" : "Yes"} />
          <StatusTerm label="Lifecycle" value={formatToken(item.lifecycleState)} />
          <StatusTerm label="Review" value={item.reviewState ?? "Unavailable"} />
          <StatusTerm label="Reviewed" value={formatDate(item.reviewedAt)} />
        </dl>
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
          <StatusTerm label="Version" value={item.version ? `v${item.version}` : "No version"} />
          <StatusTerm label="Updated" value={formatDate(item.updatedAt)} />
          <StatusTerm label="Lifecycle" value={formatToken(item.lifecycleState)} />
          <StatusTerm label="Summary" value={item.versionSummary || "Unavailable"} />
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

function KnowledgeV2ContextActions({
  actionNotice,
  affordanceSource,
  affordanceState,
  canAttachToQueueTask,
  canAttachToWorkspaceAgent,
  canCopyReference,
  contextItems,
  isContextPickerOpen,
  item,
  onAttachContextPicker,
  onCloseContextPicker,
  onOpenContextPicker,
}: {
  readonly actionNotice: KnowledgeV2ContextActionNotice | null;
  readonly affordanceSource: KnowledgeV2ContextAffordanceSource | null;
  readonly affordanceState?: KnowledgeV2ContextAffordanceState;
  readonly canAttachToQueueTask: boolean;
  readonly canAttachToWorkspaceAgent: boolean;
  readonly canCopyReference: boolean;
  readonly contextItems: readonly KnowledgeV2PickerItem[];
  readonly isContextPickerOpen: boolean;
  readonly item: KnowledgeV2CatalogItem;
  readonly onAttachContextPicker?: (
    target: KnowledgeV2ContextTarget,
    selectedItemIds: readonly string[],
  ) => void;
  readonly onCloseContextPicker?: () => void;
  readonly onOpenContextPicker?: () => void;
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
  const attachableTargetCount = [
    canAttachToWorkspaceAgent,
    canAttachToQueueTask,
    canCopyReference,
  ].filter(Boolean).length;

  return (
    <section
      aria-label="KnowledgeV2 use as context"
      className="knowledge-v2-preview-section knowledge-v2-context-actions"
    >
      <h4>Use as context</h4>
      <p>
        Context usability:{" "}
        {attachState.canAttach
          ? "Available for explicit visible attach when a target bridge is connected."
          : attachState.reason ?? "Unavailable."}
      </p>
      <p>
        These controls only use explicit visible callbacks. They do not inject
        hidden context, create Queue tasks, or start runs.
      </p>
      {attachState.warning ? (
        <p className="knowledge-v2-context-warning">{attachState.warning}</p>
      ) : null}
      <div className="knowledge-v2-context-action-row">
        <ContextButton
          disabledReason={null}
          label="Use as context"
          onClick={onOpenContextPicker}
        />
      </div>
      {attachableTargetCount === 0 ? (
        <p className="knowledge-v2-context-warning">
          No attach target bridge is available. Open the picker to inspect
          disabled targets and copy availability.
        </p>
      ) : null}
      {workspaceReason || queueReason || !canCopyReference ? (
        <ul className="knowledge-v2-context-unavailable">
          {workspaceReason ? <li>{workspaceReason}</li> : null}
          {queueReason ? <li>{queueReason}</li> : null}
          {!canCopyReference ? <li>Clipboard bridge is unavailable in this runtime.</li> : null}
          {!affordanceSource ? <li>Open source details are read-only in this preview.</li> : null}
        </ul>
      ) : null}
      {isContextPickerOpen && onAttachContextPicker && onCloseContextPicker ? (
        <KnowledgeV2ContextPicker
          canAttachToQueueTask={canAttachToQueueTask}
          canAttachToWorkspaceAgent={canAttachToWorkspaceAgent}
          canCopyReference={canCopyReference}
          initialSelectedItemId={item.id}
          items={contextItems}
          onAttach={onAttachContextPicker}
          onClose={onCloseContextPicker}
        />
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
    return `${formatToken(item.documentSubtype)} reference for ${formatScope(item.source.scope)} Knowledge review.`;
  }
  return "Use case metadata is unavailable for this item.";
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

function formatDate(value?: string | null) {
  if (!value) {
    return "Unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toISOString().slice(0, 10);
}

function sourceFallback(item: KnowledgeV2CatalogItem) {
  return item.type === "skill" ? "Operator-authored Skill" : "No source label";
}

function formatToken(value: string) {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
