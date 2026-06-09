import type {
  KnowledgeV2CatalogItemType,
  KnowledgeV2CatalogLifecycleState,
  KnowledgeV2CatalogSort,
} from "./knowledgeV2CatalogTypes";

export type KnowledgeV2FilterValues = {
  readonly text: string;
  readonly type: "all" | KnowledgeV2CatalogItemType;
  readonly lifecycle: "all" | KnowledgeV2CatalogLifecycleState;
  readonly availability: "all" | "enabled" | "disabled" | "not_searchable";
  readonly scope: "all" | "global" | "workspace";
  readonly tag: string;
  readonly sort: KnowledgeV2CatalogSort;
};

type KnowledgeV2FiltersProps = {
  readonly resultCount: number;
  readonly totalCount: number;
  readonly value: KnowledgeV2FilterValues;
  readonly onChange: (value: KnowledgeV2FilterValues) => void;
};

const typeOptions: ReadonlyArray<{
  readonly label: string;
  readonly value: KnowledgeV2FilterValues["type"];
}> = [
  { label: "All items", value: "all" },
  { label: "Documents", value: "document" },
  { label: "Skills", value: "skill" },
  { label: "Runbooks", value: "runbook" },
];

const lifecycleOptions: ReadonlyArray<{
  readonly label: string;
  readonly value: KnowledgeV2FilterValues["lifecycle"];
}> = [
  { label: "Any lifecycle", value: "all" },
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Needs review", value: "needs_review" },
  { label: "Stale", value: "stale" },
  { label: "Archived", value: "archived" },
  { label: "Rejected", value: "rejected" },
];

const availabilityOptions: ReadonlyArray<{
  readonly label: string;
  readonly value: KnowledgeV2FilterValues["availability"];
}> = [
  { label: "Any status", value: "all" },
  { label: "Enabled", value: "enabled" },
  { label: "Disabled", value: "disabled" },
  { label: "Not searchable", value: "not_searchable" },
];

const scopeOptions: ReadonlyArray<{
  readonly label: string;
  readonly value: KnowledgeV2FilterValues["scope"];
}> = [
  { label: "Any scope", value: "all" },
  { label: "Workspace", value: "workspace" },
  { label: "Global", value: "global" },
];

const sortOptions: ReadonlyArray<{
  readonly label: string;
  readonly value: KnowledgeV2CatalogSort;
}> = [
  { label: "Updated desc", value: "updated-desc" },
  { label: "Updated asc", value: "updated-asc" },
  { label: "Title A-Z", value: "title-asc" },
  { label: "Title Z-A", value: "title-desc" },
  { label: "Type", value: "type-asc" },
];

export function KnowledgeV2Filters({
  onChange,
  resultCount,
  totalCount,
  value,
}: KnowledgeV2FiltersProps) {
  return (
    <div className="knowledge-v2-toolbar">
      <label className="knowledge-v2-search-field">
        <span>Search</span>
        <input
          aria-label="Search Knowledge catalog"
          onChange={(event) =>
            onChange({
              ...value,
              text: event.currentTarget.value,
            })
          }
          placeholder="Title, summary, source, tag"
          type="search"
          value={value.text}
        />
      </label>
      <label className="knowledge-v2-select-field">
        <span>Type</span>
        <select
          aria-label="Filter Knowledge catalog by type"
          onChange={(event) =>
            onChange({
              ...value,
              type: event.currentTarget.value as KnowledgeV2FilterValues["type"],
            })
          }
          value={value.type}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="knowledge-v2-select-field">
        <span>Status</span>
        <select
          aria-label="Filter Knowledge catalog by status"
          onChange={(event) =>
            onChange({
              ...value,
              lifecycle: event.currentTarget
                .value as KnowledgeV2FilterValues["lifecycle"],
            })
          }
          value={value.lifecycle}
        >
          {lifecycleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="knowledge-v2-select-field">
        <span>Scope</span>
        <select
          aria-label="Filter Knowledge catalog by scope"
          onChange={(event) =>
            onChange({
              ...value,
              scope: event.currentTarget.value as KnowledgeV2FilterValues["scope"],
            })
          }
          value={value.scope}
        >
          {scopeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="knowledge-v2-search-field knowledge-v2-tag-field">
        <span>Tags</span>
        <input
          aria-label="Filter Knowledge catalog by tag"
          onChange={(event) =>
            onChange({
              ...value,
              tag: event.currentTarget.value,
            })
          }
          placeholder="tag"
          type="search"
          value={value.tag}
        />
      </label>
      <details className="knowledge-v2-more-filters">
        <summary>More filters</summary>
        <label className="knowledge-v2-select-field">
          <span>Availability</span>
          <select
            aria-label="Filter Knowledge catalog by availability"
            onChange={(event) =>
              onChange({
                ...value,
                availability: event.currentTarget
                  .value as KnowledgeV2FilterValues["availability"],
              })
            }
            value={value.availability}
          >
            {availabilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </details>
      <label className="knowledge-v2-select-field">
        <span>Sort</span>
        <select
          aria-label="Sort Knowledge catalog"
          onChange={(event) =>
            onChange({
              ...value,
              sort: event.currentTarget.value as KnowledgeV2CatalogSort,
            })
          }
          value={value.sort}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div aria-live="polite" className="knowledge-v2-result-count">
        {resultCount} / {totalCount}
      </div>
    </div>
  );
}
