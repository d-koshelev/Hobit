import { EmptyState } from "../design-system/EmptyState";
import {
  KNOWLEDGE_CATALOG_VIEW_OPTIONS,
  formatKnowledgeCatalogDate,
  type KnowledgeCatalogListItem,
  type KnowledgeCatalogView,
} from "./skillLibraryModel";
import { emptyCatalogText } from "./SkillLibraryDocumentsPanel.helpers";

type SkillLibraryCatalogViewControlsProps = {
  catalogView: KnowledgeCatalogView;
  onCatalogViewChange: (catalogView: KnowledgeCatalogView) => void;
};

type SkillLibraryCatalogListViewProps = {
  catalogView: KnowledgeCatalogView;
  isSelectingDocument: boolean;
  selectedCatalogItemId: string | null;
  visibleCatalogItems: KnowledgeCatalogListItem[];
  onSelectCatalogItem: (item: KnowledgeCatalogListItem) => void;
};

export function SkillLibraryCatalogSummary() {
  return (
    <div className="skill-library-summary skill-library-summary-secondary">
      <span>Catalog views combine scoped documents and saved skills.</span>
      <span>
        Only enabled active documents are searched for Workspace Agent Codex
        runs.
      </span>
    </div>
  );
}

export function SkillLibraryCatalogViewControls({
  catalogView,
  onCatalogViewChange,
}: SkillLibraryCatalogViewControlsProps) {
  return (
    <div className="skill-scope-filter" aria-label="Knowledge catalog views">
      {KNOWLEDGE_CATALOG_VIEW_OPTIONS.map((filter) => (
        <button
          aria-pressed={catalogView === filter.value}
          className={[
            "skill-scope-filter-button",
            catalogView === filter.value
              ? "skill-scope-filter-button-active"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          key={filter.value}
          onClick={() => onCatalogViewChange(filter.value)}
          type="button"
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

export function SkillLibraryCatalogListView({
  catalogView,
  isSelectingDocument,
  selectedCatalogItemId,
  visibleCatalogItems,
  onSelectCatalogItem,
}: SkillLibraryCatalogListViewProps) {
  return (
    <section className="skill-list-pane" aria-label="Catalog items">
      {visibleCatalogItems.length === 0 ? (
        <EmptyState
          text={emptyCatalogText(catalogView)}
          title="No catalog items yet."
        />
      ) : (
        <div className="skill-list">
          {visibleCatalogItems.map((item) => (
            <button
              className={[
                "skill-list-row",
                selectedCatalogItemId === item.id
                  ? "skill-list-row-selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={isSelectingDocument}
              key={item.id}
              onClick={() => onSelectCatalogItem(item)}
              type="button"
            >
              <span className="skill-list-title-row">
                <span className="skill-list-title">{item.title}</span>
                <span className="skill-scope-badge">{item.scopeLabel}</span>
              </span>
              <span className="skill-catalog-card-summary">
                {item.quickSummary}
              </span>
              <span className="skill-list-meta">
                {item.typeLabel} - {item.statusLabel}
                {item.tags ? ` - ${item.tags}` : ""}
              </span>
              <span className="skill-list-meta">
                Updated {formatKnowledgeCatalogDate(item.updatedAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
