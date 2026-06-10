import { useState } from "react";

import type { KnowledgeV2CatalogItem } from "./knowledgeV2CatalogTypes";
import {
  KnowledgeV2StatusBadge,
  knowledgeV2ItemStatuses,
} from "./knowledgeV2ItemStatus";

type KnowledgeV2CatalogListProps = {
  readonly hasItems: boolean;
  readonly items: readonly KnowledgeV2CatalogItem[];
  readonly mode?: "cards" | "list";
  readonly selectedItemId: string | null;
  readonly getArchiveDisabledReason?: (
    item: KnowledgeV2CatalogItem,
  ) => string | null;
  readonly getDeleteDisabledReason?: (
    item: KnowledgeV2CatalogItem,
  ) => string | null;
  readonly getUseAsContextDisabledReason?: (
    item: KnowledgeV2CatalogItem,
  ) => string | null;
  readonly onArchive?: (itemId: string) => void;
  readonly onClearFilters?: () => void;
  readonly onDelete?: (itemId: string) => void;
  readonly onImport?: () => void;
  readonly onOpenDetails: (itemId: string) => void;
  readonly onSelectItem: (itemId: string) => void;
  readonly onUseAsContext?: (itemId: string) => void;
};

export function KnowledgeV2CatalogList({
  hasItems,
  items,
  mode = "list",
  getArchiveDisabledReason,
  getDeleteDisabledReason,
  getUseAsContextDisabledReason,
  onArchive,
  onClearFilters,
  onDelete,
  onImport,
  onOpenDetails,
  onSelectItem,
  onUseAsContext,
  selectedItemId,
}: KnowledgeV2CatalogListProps) {
  if (!hasItems) {
    return (
      <section aria-label="Knowledge catalog empty state" className="knowledge-v2-empty">
        <h3>No catalog items yet.</h3>
        <p>
          Import or create Knowledge in the existing Knowledge / Skills flow,
          then return here to review it in the experimental catalog.
        </p>
        {onImport ? (
          <button className="knowledge-v2-empty-action" onClick={onImport} type="button">
            Import item
          </button>
        ) : null}
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section
        aria-label="Knowledge catalog no results"
        className="knowledge-v2-empty"
      >
        <h3>No search results.</h3>
        <p>Adjust search, type, lifecycle, or availability filters.</p>
        {onClearFilters ? (
          <button className="knowledge-v2-empty-action" onClick={onClearFilters} type="button">
            Clear filters
          </button>
        ) : null}
      </section>
    );
  }

  if (mode === "cards") {
    return (
      <div
        aria-label="Knowledge catalog items"
        className="knowledge-v2-list knowledge-v2-card-list"
        role="list"
      >
        {items.map((item) => (
          <KnowledgeV2CatalogCard
            item={item}
            key={item.id}
            onSelectItem={onSelectItem}
            selected={item.id === selectedItemId}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      aria-label="Knowledge catalog items"
      className="knowledge-v2-list knowledge-v2-dense-list"
      role="table"
    >
      <div className="knowledge-v2-row knowledge-v2-row-header" role="row">
        <span role="columnheader">Title</span>
        <span role="columnheader">Type</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Scope</span>
        <span role="columnheader">Tags</span>
        <span role="columnheader">Updated</span>
        <span role="columnheader">More</span>
      </div>
      {items.map((item) => (
        <KnowledgeV2CatalogRow
          item={item}
          key={item.id}
          archiveDisabledReason={getArchiveDisabledReason?.(item) ?? null}
          deleteDisabledReason={getDeleteDisabledReason?.(item) ?? null}
          useAsContextDisabledReason={getUseAsContextDisabledReason?.(item) ?? null}
          onArchive={onArchive}
          onDelete={onDelete}
          onOpenDetails={onOpenDetails}
          onUseAsContext={onUseAsContext}
          selected={item.id === selectedItemId}
        />
      ))}
      {items.length <= 5 ? (
        <div
          aria-label="Knowledge catalog small list helper"
          className="knowledge-v2-small-list-helper"
          role="row"
        >
          <span role="cell">
            {items.length} {items.length === 1 ? "item" : "items"} shown.
          </span>
        </div>
      ) : null}
    </div>
  );
}

type KnowledgeV2CatalogRowProps = {
  readonly archiveDisabledReason?: string | null;
  readonly deleteDisabledReason?: string | null;
  readonly item: KnowledgeV2CatalogItem;
  readonly selected: boolean;
  readonly useAsContextDisabledReason?: string | null;
  readonly onArchive?: (itemId: string) => void;
  readonly onDelete?: (itemId: string) => void;
  readonly onOpenDetails: (itemId: string) => void;
  readonly onUseAsContext?: (itemId: string) => void;
};

export function KnowledgeV2CatalogRow({
  archiveDisabledReason = null,
  deleteDisabledReason = null,
  item,
  onArchive,
  onDelete,
  onOpenDetails,
  onUseAsContext,
  selected,
  useAsContextDisabledReason = null,
}: KnowledgeV2CatalogRowProps) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const statuses = knowledgeV2ItemStatuses(item);
  const visibleTags = item.tags.slice(0, 2);
  const hiddenTagCount = item.tags.length - visibleTags.length;
  const updatedDate = formatDate(item.updatedAt);

  return (
    <div
      aria-selected={selected}
      className="knowledge-v2-row"
      data-selected={selected ? "true" : "false"}
      onClick={() => onOpenDetails(item.id)}
      role="row"
    >
      <button
        aria-label={`${item.title}. ${item.summary}`}
        className="knowledge-v2-row-title"
        onClick={(event) => {
          event.stopPropagation();
          onOpenDetails(item.id);
        }}
        role="cell"
        title={`${item.title}\n${item.summary}`}
        type="button"
      >
        <span title={item.title}>{item.title}</span>
        <small title={item.summary}>{item.summary}</small>
      </button>
      <span role="cell" title={formatTypeLabel(item.type)}>
        <span className="knowledge-v2-type-badge">
          {formatTypeBadge(item.type)}
        </span>
      </span>
      <span role="cell">
        <span className="knowledge-v2-status-stack">
          {statuses.map((status) => (
            <KnowledgeV2StatusBadge key={status.key} status={status} />
          ))}
        </span>
      </span>
      <span role="cell">{formatScope(item.source.scope)}</span>
      <span role="cell">
        {item.tags.length > 0 ? (
          <span
            aria-label={`${item.tags.length.toString()} tags: ${item.tags.join(", ")}`}
            className="knowledge-v2-row-tags"
          >
            {visibleTags.map((tag) => (
              <span className="knowledge-v2-tag" key={tag} title={tag}>
                {tag}
              </span>
            ))}
            {hiddenTagCount > 0 ? (
              <span
                className="knowledge-v2-tag"
                title={item.tags.slice(2).join(", ")}
              >
                +{hiddenTagCount}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="knowledge-v2-muted">No tags</span>
        )}
      </span>
      <span role="cell">
        <span
          className={updatedDate.muted ? "knowledge-v2-muted" : undefined}
          data-muted={updatedDate.muted ? "true" : "false"}
        >
          {updatedDate.label}
        </span>
      </span>
      <span className="knowledge-v2-row-actions" role="cell">
        <button
          className="knowledge-v2-row-icon-button"
          aria-expanded={isActionMenuOpen}
          aria-label={`More actions for ${item.title}`}
          onClick={(event) => {
            event.stopPropagation();
            setIsActionMenuOpen((current) => !current);
          }}
          title={`More actions for ${item.title}`}
          type="button"
        >
          More
        </button>
        {isActionMenuOpen ? (
          <KnowledgeV2RowActionMenu
            archiveDisabledReason={archiveDisabledReason}
            deleteDisabledReason={deleteDisabledReason}
            item={item}
            onArchive={onArchive}
            onDelete={onDelete}
            onOpenDetails={onOpenDetails}
            onRequestClose={() => setIsActionMenuOpen(false)}
            onUseAsContext={onUseAsContext}
            useAsContextDisabledReason={useAsContextDisabledReason}
          />
        ) : null}
      </span>
    </div>
  );
}

function KnowledgeV2RowActionMenu({
  archiveDisabledReason,
  deleteDisabledReason,
  item,
  onArchive,
  onDelete,
  onOpenDetails,
  onRequestClose,
  onUseAsContext,
  useAsContextDisabledReason,
}: {
  readonly archiveDisabledReason: string | null;
  readonly deleteDisabledReason: string | null;
  readonly item: KnowledgeV2CatalogItem;
  readonly onArchive?: (itemId: string) => void;
  readonly onDelete?: (itemId: string) => void;
  readonly onOpenDetails: (itemId: string) => void;
  readonly onRequestClose: () => void;
  readonly onUseAsContext?: (itemId: string) => void;
  readonly useAsContextDisabledReason: string | null;
}) {
  function run(action: () => void) {
    action();
    onRequestClose();
  }

  return (
    <span
      aria-label={`Action menu for ${item.title}`}
      className="knowledge-v2-row-action-menu"
      onClick={(event) => event.stopPropagation()}
      role="menu"
    >
      <button
        onClick={() => run(() => onOpenDetails(item.id))}
        role="menuitem"
        type="button"
      >
        Open details
      </button>
      <KnowledgeV2RowActionMenuItem
        disabledReason={
          onUseAsContext
            ? useAsContextDisabledReason
            : "Use as Context is unavailable because no context action bridge is connected."
        }
        label="Use as context"
        onClick={() => run(() => onUseAsContext?.(item.id))}
      />
      <KnowledgeV2RowActionMenuItem
        disabledReason={
          onArchive
            ? archiveDisabledReason
            : "Archive is unavailable because no safe archive bridge is connected."
        }
        label="Archive"
        onClick={() => run(() => onArchive?.(item.id))}
      />
      <KnowledgeV2RowActionMenuItem
        danger={true}
        disabledReason={
          onDelete
            ? deleteDisabledReason
            : "Delete is unavailable because no safe delete bridge is connected."
        }
        label="Delete"
        onClick={() => run(() => onDelete?.(item.id))}
      />
    </span>
  );
}

function KnowledgeV2RowActionMenuItem({
  danger = false,
  disabledReason,
  label,
  onClick,
}: {
  readonly danger?: boolean;
  readonly disabledReason: string | null;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <span className="knowledge-v2-row-action-menu-item">
      <button
        className={danger ? "knowledge-v2-danger-action" : undefined}
        disabled={Boolean(disabledReason)}
        onClick={onClick}
        role="menuitem"
        title={disabledReason ?? undefined}
        type="button"
      >
        {label}
      </button>
      {disabledReason ? (
        <small className="knowledge-v2-row-action-reason">{disabledReason}</small>
      ) : null}
    </span>
  );
}

type KnowledgeV2CatalogCardProps = {
  readonly item: KnowledgeV2CatalogItem;
  readonly selected: boolean;
  readonly onSelectItem: (itemId: string) => void;
};

export function KnowledgeV2CatalogCard({
  item,
  onSelectItem,
  selected,
}: KnowledgeV2CatalogCardProps) {
  const warningCount = item.warnings.length;
  const statuses = knowledgeV2ItemStatuses(item);

  return (
    <button
      aria-pressed={selected}
      className="knowledge-v2-card"
      data-selected={selected ? "true" : "false"}
      onClick={() => onSelectItem(item.id)}
      role="listitem"
      type="button"
    >
      <span className="knowledge-v2-card-topline">
        <span className="knowledge-v2-card-title">{item.title}</span>
        <span className="knowledge-v2-status-inline">
          {statuses.map((status) => (
            <KnowledgeV2StatusBadge key={status.key} status={status} />
          ))}
        </span>
      </span>
      <span className="knowledge-v2-card-meta">
        <span>{formatTypeLabel(item.type)}</span>
        <span>{formatScope(item.source.scope)}</span>
        {item.enabled === false ? <span>Disabled</span> : null}
        {item.searchable === false ? <span>Not searchable</span> : null}
        {warningCount > 0 ? <span>{warningCount} warning{warningCount === 1 ? "" : "s"}</span> : null}
      </span>
      <span className="knowledge-v2-card-summary">{item.summary}</span>
      {item.tags.length > 0 ? (
        <span className="knowledge-v2-tags">
          {item.tags.slice(0, 4).map((tag) => (
            <span className="knowledge-v2-tag" key={tag}>
              {tag}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
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

function formatTypeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTypeBadge(type: KnowledgeV2CatalogItem["type"]) {
  switch (type) {
    case "document":
      return "DOC";
    case "skill":
      return "SKILL";
    case "runbook":
      return "RUNBOOK";
    case "draft":
      return "DRAFT";
    default:
      return "ITEM";
  }
}

function formatDate(value?: string | null) {
  if (!value) {
    return { label: "Unknown", muted: true };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { label: "Unknown", muted: true };
  }

  return { label: parsed.toISOString().slice(0, 10), muted: false };
}
