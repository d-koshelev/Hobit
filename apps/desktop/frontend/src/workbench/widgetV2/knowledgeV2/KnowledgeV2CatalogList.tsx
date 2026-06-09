import type { KnowledgeV2CatalogItem } from "./knowledgeV2CatalogTypes";

type KnowledgeV2CatalogListProps = {
  readonly hasItems: boolean;
  readonly items: readonly KnowledgeV2CatalogItem[];
  readonly mode?: "cards" | "list";
  readonly selectedItemId: string | null;
  readonly onSelectItem: (itemId: string) => void;
  readonly onUseAsContext?: (itemId: string) => void;
};

export function KnowledgeV2CatalogList({
  hasItems,
  items,
  mode = "list",
  onSelectItem,
  onUseAsContext,
  selectedItemId,
}: KnowledgeV2CatalogListProps) {
  if (!hasItems) {
    return (
      <section aria-label="Knowledge catalog empty state" className="knowledge-v2-empty">
        <h3>No catalog items yet.</h3>
        <p>
          Knowledge Documents and Skills will appear here after they are passed
          into this preview surface.
        </p>
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
        <span role="columnheader">Actions</span>
      </div>
      {items.map((item) => (
        <KnowledgeV2CatalogRow
          item={item}
          key={item.id}
          onSelectItem={onSelectItem}
          onUseAsContext={onUseAsContext}
          selected={item.id === selectedItemId}
        />
      ))}
    </div>
  );
}

type KnowledgeV2CatalogRowProps = {
  readonly item: KnowledgeV2CatalogItem;
  readonly selected: boolean;
  readonly onSelectItem: (itemId: string) => void;
  readonly onUseAsContext?: (itemId: string) => void;
};

export function KnowledgeV2CatalogRow({
  item,
  onSelectItem,
  onUseAsContext,
  selected,
}: KnowledgeV2CatalogRowProps) {
  const warningCount = item.warnings.length;

  return (
    <div
      aria-selected={selected}
      className="knowledge-v2-row"
      data-selected={selected ? "true" : "false"}
      role="row"
    >
      <button
        className="knowledge-v2-row-title"
        onClick={() => onSelectItem(item.id)}
        role="cell"
        type="button"
      >
        <span>{item.title}</span>
        <small>{item.summary}</small>
      </button>
      <span role="cell">{formatToken(item.type)}</span>
      <span role="cell">
        <span className="knowledge-v2-chip" data-tone={toneForLifecycle(item.lifecycleState)}>
          {formatToken(item.lifecycleState)}
        </span>
      </span>
      <span role="cell">{formatScope(item.source.scope)}</span>
      <span role="cell">
        {item.tags.length > 0 ? (
          <span className="knowledge-v2-row-tags">
            {item.tags.slice(0, 2).map((tag) => (
              <span className="knowledge-v2-tag" key={tag}>
                {tag}
              </span>
            ))}
            {item.tags.length > 2 ? (
              <span className="knowledge-v2-tag">+{item.tags.length - 2}</span>
            ) : null}
          </span>
        ) : (
          <span className="knowledge-v2-muted">None</span>
        )}
      </span>
      <span role="cell">{formatDate(item.updatedAt)}</span>
      <span className="knowledge-v2-row-actions" role="cell">
        <button onClick={() => onSelectItem(item.id)} type="button">
          Preview
        </button>
        {onUseAsContext ? (
          <button onClick={() => onUseAsContext(item.id)} type="button">
            Use as context
          </button>
        ) : null}
        {warningCount > 0 ? <span>{warningCount} warn</span> : null}
      </span>
    </div>
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
        <span className="knowledge-v2-chip" data-tone={toneForLifecycle(item.lifecycleState)}>
          {formatToken(item.lifecycleState)}
        </span>
      </span>
      <span className="knowledge-v2-card-meta">
        <span>{formatToken(item.type)}</span>
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

function formatToken(value: string) {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Invalid";
  }

  return parsed.toISOString().slice(0, 10);
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
