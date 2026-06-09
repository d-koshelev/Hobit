import { useMemo, useState } from "react";

import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";
import type { WidgetRenderProps } from "../../types";
import { WidgetV2RightInspector, WidgetV2Toolbar } from "../WidgetV2Shell";
import { KnowledgeV2CatalogList } from "./KnowledgeV2CatalogList";
import { KnowledgeV2Filters, type KnowledgeV2FilterValues } from "./KnowledgeV2Filters";
import { KnowledgeV2PreviewPanel } from "./KnowledgeV2PreviewPanel";
import {
  attachKnowledgeV2SourceToQueueTask,
  knowledgeV2ContextAffordanceSource,
  knowledgeV2ContextAffordanceState,
  knowledgeV2ReferenceText,
  knowledgeV2WorkspaceAgentContextInput,
  type KnowledgeV2ContextActionNotice,
} from "./knowledgeV2ContextAffordances";
import {
  buildKnowledgeV2CatalogViewModel,
  defaultKnowledgeV2CatalogSelection,
} from "./knowledgeV2CatalogModel";
import type {
  KnowledgeV2CatalogFilters,
  KnowledgeV2CatalogSort,
} from "./knowledgeV2CatalogTypes";

export type KnowledgeV2CatalogBrowserProps = {
  readonly documents: readonly KnowledgeDocument[];
  readonly loadError?: string | null;
  readonly missingBridges?: readonly string[];
  readonly onAttachContextToCoordinator?: WidgetRenderProps["onAttachContextToCoordinator"];
  readonly onAttachKnowledgeContextToQueueTask?: WidgetRenderProps["onAttachKnowledgeContextToQueueTask"];
  readonly skills: readonly Skill[];
  readonly status?: "loading" | "partial" | "ready" | "unavailable";
  readonly viewMode?: "cards" | "list";
};

const defaultFilters: KnowledgeV2FilterValues = {
  availability: "all",
  lifecycle: "all",
  scope: "all",
  sort: "updated-desc",
  tag: "",
  text: "",
  type: "all",
};

export function KnowledgeV2CatalogBrowser({
  documents,
  loadError = null,
  missingBridges = [],
  onAttachContextToCoordinator,
  onAttachKnowledgeContextToQueueTask,
  skills,
  status = "ready",
  viewMode = "list",
}: KnowledgeV2CatalogBrowserProps) {
  const [filters, setFilters] = useState<KnowledgeV2FilterValues>(defaultFilters);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] =
    useState<KnowledgeV2ContextActionNotice | null>(null);

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
        sort: filters.sort,
      }),
    [catalogFilters, documents, filters.sort, selectedItemId, skills],
  );

  const selectedItem =
    viewModel.filteredItems.find((item) => item.id === selectedItemId) ?? null;
  const affordanceSource = selectedItem
    ? knowledgeV2ContextAffordanceSource(selectedItem, documents, skills)
    : null;
  const affordanceState = knowledgeV2ContextAffordanceState(affordanceSource);
  const canCopyReference = Boolean(
    typeof navigator !== "undefined" && navigator.clipboard?.writeText,
  );

  function selectItem(itemId: string) {
    setSelectedItemId(itemId);
    setActionNotice(null);
  }

  function attachToWorkspaceAgent() {
    if (!affordanceSource || !affordanceState.canAttach) {
      setActionNotice({
        message:
          affordanceState.reason ??
          "This KnowledgeV2 item cannot be attached as context.",
        status: "blocked",
      });
      return;
    }

    if (!onAttachContextToCoordinator) {
      setActionNotice({
        message:
          "Workspace Agent attach is unavailable because no explicit context bridge is connected.",
        status: "unavailable",
      });
      return;
    }

    onAttachContextToCoordinator(
      knowledgeV2WorkspaceAgentContextInput(affordanceSource),
    );
    setActionNotice({
      message: `${affordanceSource.item.title} attached to Workspace Agent as visible current-session context.`,
      status: "attached",
    });
  }

  async function attachToQueueTask() {
    if (!affordanceSource || !affordanceState.canAttach) {
      setActionNotice({
        message:
          affordanceState.reason ??
          "This KnowledgeV2 item cannot be attached as Queue context.",
        status: "blocked",
      });
      return;
    }

    const result = await attachKnowledgeV2SourceToQueueTask(
      affordanceSource,
      onAttachKnowledgeContextToQueueTask,
    );
    setActionNotice(result);
  }

  async function copyReference() {
    if (!selectedItem || !canCopyReference) {
      setActionNotice({
        message: "Clipboard bridge is unavailable in this runtime.",
        status: "unavailable",
      });
      return;
    }

    await navigator.clipboard.writeText(knowledgeV2ReferenceText(selectedItem));
    setActionNotice({
      message: `${selectedItem.title} reference copied.`,
      status: "copied",
    });
  }

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
      <KnowledgeV2BridgeNotice
        loadError={loadError}
        missingBridges={missingBridges}
        status={status}
      />
      <div className="knowledge-v2-browser">
        <KnowledgeV2CatalogList
          hasItems={viewModel.items.length > 0}
          items={viewModel.filteredItems}
          mode={viewMode}
          onSelectItem={selectItem}
          selectedItemId={selectedItemId}
        />
        <WidgetV2RightInspector label="Knowledge v2 preview details">
          <KnowledgeV2PreviewPanel
            actionNotice={actionNotice}
            affordanceSource={affordanceSource}
            affordanceState={affordanceState}
            canAttachToQueueTask={Boolean(onAttachKnowledgeContextToQueueTask)}
            canAttachToWorkspaceAgent={Boolean(onAttachContextToCoordinator)}
            canCopyReference={canCopyReference}
            hasItems={viewModel.items.length > 0}
            item={selectedItem}
            onAttachToQueueTask={attachToQueueTask}
            onAttachToWorkspaceAgent={attachToWorkspaceAgent}
            onCopyReference={copyReference}
            selectedItemId={selectedItemId}
          />
        </WidgetV2RightInspector>
      </div>
    </>
  );
}

function KnowledgeV2BridgeNotice({
  loadError,
  missingBridges,
  status,
}: {
  readonly loadError: string | null;
  readonly missingBridges: readonly string[];
  readonly status: "loading" | "partial" | "ready" | "unavailable";
}) {
  if (status === "ready") {
    return null;
  }

  return (
    <section
      aria-label="KnowledgeV2 data bridge status"
      className="knowledge-v2-bridge-notice"
      data-status={status}
    >
      <h3>{titleForBridgeStatus(status)}</h3>
      {status === "loading" ? (
        <p>Loading Knowledge Documents and Skills through existing frontend list actions.</p>
      ) : null}
      {status === "unavailable" ? (
        <p>
          This experimental WidgetV2 path did not receive Knowledge / Skills
          list props or list actions. No production data is being faked.
        </p>
      ) : null}
      {status === "partial" ? (
        <p>
          KnowledgeV2 is showing only data from available frontend bridges.
          Missing bridges remain unavailable in this experimental path.
        </p>
      ) : null}
      {loadError ? <p>Load failed: {loadError}</p> : null}
      {missingBridges.length > 0 ? (
        <ul>
          {missingBridges.map((bridge) => (
            <li key={bridge}>{bridge}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function titleForBridgeStatus(
  status: "loading" | "partial" | "ready" | "unavailable",
) {
  switch (status) {
    case "loading":
      return "Loading catalog data.";
    case "partial":
      return "Some catalog bridges are unavailable.";
    case "unavailable":
      return "Catalog data unavailable.";
    case "ready":
      return "";
  }
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
    scopes: values.scope === "all" ? [] : [values.scope],
    tags: values.tag.trim() ? [values.tag] : [],
    text: values.text,
    types: values.type === "all" ? [] : [values.type],
  };
}
