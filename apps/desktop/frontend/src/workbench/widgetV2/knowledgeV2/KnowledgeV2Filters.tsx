import type {
  KnowledgeV2CatalogItemType,
  KnowledgeV2CatalogLifecycleState,
} from "./knowledgeV2CatalogTypes";

export type KnowledgeV2FilterValues = {
  readonly text: string;
  readonly type: "all" | KnowledgeV2CatalogItemType;
  readonly lifecycle: "all" | KnowledgeV2CatalogLifecycleState;
  readonly availability: "all" | "enabled" | "disabled" | "not_searchable";
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
        <span>Lifecycle</span>
        <select
          aria-label="Filter Knowledge catalog by lifecycle"
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
        <span>Status</span>
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
      <div aria-live="polite" className="knowledge-v2-result-count">
        {resultCount} / {totalCount}
      </div>
    </div>
  );
}
