import type { KnowledgeV2CatalogItem } from "./knowledgeV2CatalogTypes";

type KnowledgeV2CatalogListProps = {
  readonly hasItems: boolean;
  readonly items: readonly KnowledgeV2CatalogItem[];
  readonly selectedItemId: string | null;
  readonly onSelectItem: (itemId: string) => void;
};

export function KnowledgeV2CatalogList({
  hasItems,
  items,
  onSelectItem,
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

  return (
    <div aria-label="Knowledge catalog items" className="knowledge-v2-list" role="list">
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
