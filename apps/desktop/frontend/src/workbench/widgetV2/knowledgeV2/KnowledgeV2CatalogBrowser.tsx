import { useMemo, useState } from "react";

import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";
import { WidgetV2RightInspector, WidgetV2Toolbar } from "../WidgetV2Shell";
import { KnowledgeV2CatalogList } from "./KnowledgeV2CatalogList";
import { KnowledgeV2Filters, type KnowledgeV2FilterValues } from "./KnowledgeV2Filters";
import { KnowledgeV2PreviewPanel } from "./KnowledgeV2PreviewPanel";
import {
  buildKnowledgeV2CatalogViewModel,
  defaultKnowledgeV2CatalogSelection,
} from "./knowledgeV2CatalogModel";
import type { KnowledgeV2CatalogFilters } from "./knowledgeV2CatalogTypes";

export type KnowledgeV2CatalogBrowserProps = {
  readonly documents: readonly KnowledgeDocument[];
  readonly skills: readonly Skill[];
};

const defaultFilters: KnowledgeV2FilterValues = {
  availability: "all",
  lifecycle: "all",
  text: "",
  type: "all",
};

export function KnowledgeV2CatalogBrowser({
  documents,
  skills,
}: KnowledgeV2CatalogBrowserProps) {
  const [filters, setFilters] = useState<KnowledgeV2FilterValues>(defaultFilters);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const catalogFilters = useMemo(
    () => knowledgeV2CatalogFiltersFromValues(filters),
    [filters],
  );
  const viewModel = useMemo(
    () =>
      buildKnowledgeV2CatalogViewModel({
        documents,
        filters: catalogFilters,
        selection: {
          ...defaultKnowledgeV2CatalogSelection(),
          selectedItemId,
        },
        skills,
      }),
    [catalogFilters, documents, selectedItemId, skills],
  );

  const selectedItem =
    viewModel.filteredItems.find((item) => item.id === selectedItemId) ?? null;

  return (
    <>
      <WidgetV2Toolbar label="Knowledge v2 search and filter row">
        <KnowledgeV2Filters
          onChange={setFilters}
          resultCount={viewModel.filteredItems.length}
          totalCount={viewModel.items.length}
          value={filters}
        />
      </WidgetV2Toolbar>
      <div className="knowledge-v2-browser">
        <KnowledgeV2CatalogList
          hasItems={viewModel.items.length > 0}
          items={viewModel.filteredItems}
          onSelectItem={setSelectedItemId}
          selectedItemId={selectedItemId}
        />
        <WidgetV2RightInspector label="Knowledge v2 preview details">
          <KnowledgeV2PreviewPanel
            hasItems={viewModel.items.length > 0}
            item={selectedItem}
            selectedItemId={selectedItemId}
          />
        </WidgetV2RightInspector>
      </div>
    </>
  );
}

function knowledgeV2CatalogFiltersFromValues(
  values: KnowledgeV2FilterValues,
): KnowledgeV2CatalogFilters {
  return {
    enabled:
      values.availability === "enabled" || values.availability === "disabled"
        ? values.availability
        : "all",
    lifecycleStates: values.lifecycle === "all" ? [] : [values.lifecycle],
    searchable:
      values.availability === "not_searchable" ? "not_searchable" : "all",
    text: values.text,
    types: values.type === "all" ? [] : [values.type],
  };
}
