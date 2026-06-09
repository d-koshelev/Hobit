import { useMemo, useState } from "react";

import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";
import { Button } from "../../../design-system/Button";
import { WidgetPopupShell } from "../../../design-system/WidgetPopupShell";
import type { WidgetRenderProps } from "../../types";
import { WidgetV2Toolbar } from "../WidgetV2Shell";
import { KnowledgeV2CatalogList } from "./KnowledgeV2CatalogList";
import { KnowledgeV2ContextPicker } from "./KnowledgeV2ContextPicker";
import { KnowledgeV2Filters, type KnowledgeV2FilterValues } from "./KnowledgeV2Filters";
import { KnowledgeV2PreviewPanel } from "./KnowledgeV2PreviewPanel";
import {
  attachKnowledgeV2SourceToQueueTask,
  knowledgeV2ContextAffordanceSource,
  knowledgeV2ContextAffordanceState,
  type KnowledgeV2ContextAffordanceSource,
  type KnowledgeV2ContextTarget,
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
  KnowledgeV2CatalogItem,
  KnowledgeV2CatalogSort,
} from "./knowledgeV2CatalogTypes";

export type KnowledgeV2CatalogBrowserProps = {
  readonly documents: readonly KnowledgeDocument[];
  readonly loadError?: string | null;
  readonly missingBridges?: readonly string[];
  readonly onAttachContextToCoordinator?: WidgetRenderProps["onAttachContextToCoordinator"];
  readonly onAttachKnowledgeContextToQueueTask?: WidgetRenderProps["onAttachKnowledgeContextToQueueTask"];
  readonly onDeleteKnowledgeDocument?: WidgetRenderProps["onDeleteKnowledgeDocument"];
  readonly onDeleteSkill?: WidgetRenderProps["onDeleteSkill"];
  readonly onImport?: () => void;
  readonly onRetry?: () => void;
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
  onDeleteKnowledgeDocument,
  onDeleteSkill,
  onImport,
  onRetry,
  skills,
  status = "ready",
  viewMode = "list",
}: KnowledgeV2CatalogBrowserProps) {
  const [filters, setFilters] = useState<KnowledgeV2FilterValues>(defaultFilters);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] =
    useState<KnowledgeV2ContextActionNotice | null>(null);
  const [isContextPickerOpen, setIsContextPickerOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
  const pickerItems = useMemo(
    () =>
      viewModel.filteredItems.map((item) => {
        const source = knowledgeV2ContextAffordanceSource(item, documents, skills);
        return {
          affordanceSource: source,
          affordanceState: knowledgeV2ContextAffordanceState(source),
          item,
        };
      }),
    [documents, skills, viewModel.filteredItems],
  );
  const canCopyReference = Boolean(
    typeof navigator !== "undefined" && navigator.clipboard?.writeText,
  );
  const selectedContextDisabledReason = selectedItem
    ? useAsContextDisabledReason({
        canAttachToQueueTask: Boolean(onAttachKnowledgeContextToQueueTask),
        canAttachToWorkspaceAgent: Boolean(onAttachContextToCoordinator),
        canCopyReference,
        entry: {
          affordanceSource,
          affordanceState,
          item: selectedItem,
        },
      })
    : null;

  function selectItem(itemId: string) {
    setSelectedItemId(itemId);
    setActionNotice(null);
    setIsContextPickerOpen(false);
    setIsDetailsOpen(true);
  }

  function clearFilters() {
    setFilters(defaultFilters);
  }

  function closeDetailsPopup() {
    setIsDetailsOpen(false);
    setIsContextPickerOpen(false);
  }

  function openContextPicker(itemId?: string) {
    const requestedItem =
      itemId !== undefined
        ? pickerItems.find((entry) => entry.item.id === itemId) ?? null
        : selectedItem
          ? {
              affordanceSource,
              affordanceState,
              item: selectedItem,
            }
          : null;
    const disabledReason = requestedItem
      ? useAsContextDisabledReason({
          canAttachToQueueTask: Boolean(onAttachKnowledgeContextToQueueTask),
          canAttachToWorkspaceAgent: Boolean(onAttachContextToCoordinator),
          canCopyReference,
          entry: requestedItem,
        })
      : "Select a usable Knowledge item before using it as context.";

    if (itemId) {
      setSelectedItemId(itemId);
    }
    setActionNotice(null);
    setIsDetailsOpen(false);
    if (disabledReason) {
      setActionNotice({
        message: disabledReason,
        status: "blocked",
      });
      setIsContextPickerOpen(false);
      return;
    }
    setIsContextPickerOpen(true);
  }

  async function attachContextPickerSelection(
    target: KnowledgeV2ContextTarget,
    selectedItemIds: readonly string[],
  ) {
    const selectedEntries = selectedItemIds
      .map((itemId) => pickerItems.find((entry) => entry.item.id === itemId) ?? null)
      .filter((entry): entry is (typeof pickerItems)[number] => Boolean(entry));
    const selectedSources = selectedEntries
      .map((entry) => entry.affordanceSource)
      .filter(
        (source): source is KnowledgeV2ContextAffordanceSource => Boolean(source),
      );

    if (selectedEntries.length === 0 || selectedSources.length === 0) {
      setActionNotice({
        message: "Select at least one attachable KnowledgeV2 item before attaching.",
        status: "blocked",
      });
      return;
    }

    const blockedEntry = selectedEntries.find(
      (entry) => !entry.affordanceState.canAttach,
    );
    if (blockedEntry) {
      setActionNotice({
        message:
          blockedEntry.affordanceState.reason ??
          `${blockedEntry.item.title} cannot be attached as context.`,
        status: "blocked",
      });
      return;
    }

    if (target === "workspace_agent_current") {
      if (!onAttachContextToCoordinator) {
        setActionNotice({
          message:
            "Workspace Agent attach is unavailable because no explicit context bridge is connected.",
          status: "unavailable",
        });
        return;
      }
      onAttachContextToCoordinator(
        knowledgeV2WorkspaceAgentContextInput(selectedSources),
      );
      setActionNotice({
        message:
          selectedSources.length === 1
            ? `${selectedSources[0].item.title} attached to Workspace Agent as visible current-session context.`
            : `${selectedSources.length.toString()} KnowledgeV2 items attached to Workspace Agent as visible current-session context.`,
        status: "attached",
      });
      setIsContextPickerOpen(false);
      setIsDetailsOpen(true);
      return;
    }

    if (target === "workspace_agent_next") {
      setActionNotice({
        message:
          "Workspace Agent next-run context bridge is not wired in KnowledgeV2; nothing was attached.",
        status: "unavailable",
      });
      return;
    }

    if (target === "queue_selected_task") {
      if (!onAttachKnowledgeContextToQueueTask) {
        setActionNotice({
          message:
            "Queue attach is unavailable because no selected Queue task bridge is connected.",
          status: "unavailable",
        });
        return;
      }

      let latestNotice: KnowledgeV2ContextActionNotice | null = null;
      for (const source of selectedSources) {
        latestNotice = await attachKnowledgeV2SourceToQueueTask(
          source,
          onAttachKnowledgeContextToQueueTask,
        );
        if (latestNotice.status !== "attached") {
          setActionNotice(latestNotice);
          return;
        }
      }
      setActionNotice(
        selectedSources.length === 1
          ? latestNotice
          : {
              message: `${selectedSources.length.toString()} KnowledgeV2 items attached to the selected Queue task.`,
              status: "attached",
            },
      );
      setIsContextPickerOpen(false);
      setIsDetailsOpen(true);
      return;
    }

    if (!canCopyReference) {
      setActionNotice({
        message: "Clipboard bridge is unavailable in this runtime.",
        status: "unavailable",
      });
      return;
    }

    await navigator.clipboard.writeText(
      selectedEntries.map((entry) => knowledgeV2ReferenceText(entry.item)).join("\n\n---\n\n"),
    );
    setActionNotice({
      message:
        selectedEntries.length === 1
          ? `${selectedEntries[0].item.title} reference copied.`
          : `${selectedEntries.length.toString()} KnowledgeV2 references copied.`,
      status: "copied",
    });
    setIsContextPickerOpen(false);
    setIsDetailsOpen(true);
  }

  async function deleteSelectedItem() {
    if (!selectedItem) {
      return;
    }

    if (
      !window.confirm(
        `Delete "${selectedItem.title}"? This uses the existing Knowledge / Skills delete action.`,
      )
    ) {
      return;
    }

    if (selectedItem.recordKind === "document" && onDeleteKnowledgeDocument) {
      await onDeleteKnowledgeDocument({
        knowledgeDocumentId: selectedItem.recordId,
      });
      setActionNotice({
        message: `${selectedItem.title} delete action completed.`,
        status: "detached",
      });
      setIsDetailsOpen(false);
      return;
    }

    if (selectedItem.recordKind === "skill" && onDeleteSkill) {
      await onDeleteSkill({ skillId: selectedItem.recordId });
      setActionNotice({
        message: `${selectedItem.title} delete action completed.`,
        status: "detached",
      });
      setIsDetailsOpen(false);
    }
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
        onImport={onImport}
        onRetry={onRetry}
        status={status}
      />
      <div className="knowledge-v2-browser">
        <KnowledgeV2CatalogList
          hasItems={viewModel.items.length > 0}
          items={viewModel.filteredItems}
          mode={viewMode}
          getUseAsContextDisabledReason={(item) => {
            const entry =
              pickerItems.find((candidate) => candidate.item.id === item.id) ??
              null;
            return entry
              ? useAsContextDisabledReason({
                  canAttachToQueueTask: Boolean(onAttachKnowledgeContextToQueueTask),
                  canAttachToWorkspaceAgent: Boolean(onAttachContextToCoordinator),
                  canCopyReference,
                  entry,
                })
              : "Source record is unavailable; this item cannot be attached.";
          }}
          onClearFilters={clearFilters}
          onImport={onImport}
          onSelectItem={selectItem}
          onUseAsContext={openContextPicker}
          selectedItemId={selectedItemId}
        />
        <WidgetPopupShell
          bodyClassName="knowledge-v2-details-popup-body"
          className="knowledge-v2-details-popup-shell"
          footer={
            <KnowledgeV2DetailsPopupFooter
              deleteDisabledReason={deleteDisabledReason({
                item: selectedItem,
                onDeleteKnowledgeDocument,
                onDeleteSkill,
              })}
              onClose={closeDetailsPopup}
              onDelete={deleteSelectedItem}
              onUseAsContext={() => openContextPicker()}
              useAsContextDisabledReason={selectedContextDisabledReason}
            />
          }
          footerClassName="knowledge-v2-details-popup-footer"
          id="knowledge-v2-item-details-popup"
          isOpen={isDetailsOpen && Boolean(selectedItem)}
          onRequestClose={closeDetailsPopup}
          title={selectedItem ? selectedItem.title : "Knowledge item details"}
          titleId="knowledge-v2-item-details-popup-title"
          variant="floating"
        >
          <KnowledgeV2PreviewPanel
            actionNotice={actionNotice}
            affordanceState={affordanceState}
            hasItems={viewModel.items.length > 0}
            item={selectedItem}
            selectedItemId={selectedItemId}
          />
        </WidgetPopupShell>
        <KnowledgeV2ContextPicker
          canAttachToQueueTask={Boolean(onAttachKnowledgeContextToQueueTask)}
          canAttachToWorkspaceAgent={Boolean(onAttachContextToCoordinator)}
          canCopyReference={canCopyReference}
          initialSelectedItemId={selectedItemId}
          isOpen={isContextPickerOpen}
          items={pickerItems}
          onAttach={attachContextPickerSelection}
          onClose={() => setIsContextPickerOpen(false)}
        />
      </div>
    </>
  );
}

function KnowledgeV2DetailsPopupFooter({
  deleteDisabledReason,
  onClose,
  onDelete,
  onUseAsContext,
  useAsContextDisabledReason,
}: {
  readonly deleteDisabledReason: string | null;
  readonly onClose: () => void;
  readonly onDelete: () => void;
  readonly onUseAsContext: () => void;
  readonly useAsContextDisabledReason: string | null;
}) {
  return (
    <div
      aria-label="KnowledgeV2 use as context"
      className="knowledge-v2-details-footer-actions"
    >
      <Button
        disabled={Boolean(useAsContextDisabledReason)}
        onClick={onUseAsContext}
        title={useAsContextDisabledReason ?? undefined}
        variant="secondary"
      >
        Use as context
      </Button>
      <Button
        disabled={true}
        title="Archive is disabled because KnowledgeV2 has no existing safe archive action."
        variant="secondary"
      >
        Archive
      </Button>
      <Button
        disabled={Boolean(deleteDisabledReason)}
        onClick={onDelete}
        title={deleteDisabledReason ?? undefined}
        variant="secondary"
      >
        Delete
      </Button>
      <Button onClick={onClose} variant="ghost">
        Close
      </Button>
      <p className="knowledge-v2-details-footer-reasons">
        {useAsContextDisabledReason
          ? `Use as context disabled: ${useAsContextDisabledReason}`
          : "Use as context opens explicit visible context targets only. These controls only use explicit visible callbacks."}
        {" "}
        Archive disabled: KnowledgeV2 has no existing safe archive action.
        {" "}
        {deleteDisabledReason
          ? `Delete disabled: ${deleteDisabledReason}`
          : "Delete uses an existing Knowledge / Skills delete action and asks for confirmation."}
      </p>
    </div>
  );
}

function deleteDisabledReason({
  item,
  onDeleteKnowledgeDocument,
  onDeleteSkill,
}: {
  readonly item: KnowledgeV2CatalogItem | null;
  readonly onDeleteKnowledgeDocument?: WidgetRenderProps["onDeleteKnowledgeDocument"];
  readonly onDeleteSkill?: WidgetRenderProps["onDeleteSkill"];
}) {
  if (!item) {
    return "Select a KnowledgeV2 item before deleting.";
  }
  if (item.recordKind === "document") {
    return onDeleteKnowledgeDocument
      ? null
      : "KnowledgeV2 did not receive the existing Knowledge Document delete action.";
  }
  if (item.recordKind === "skill") {
    return onDeleteSkill
      ? null
      : "KnowledgeV2 did not receive the existing Skill delete action.";
  }
  return "This item type has no existing safe delete action.";
}

function useAsContextDisabledReason({
  canAttachToQueueTask,
  canAttachToWorkspaceAgent,
  canCopyReference,
  entry,
}: {
  readonly canAttachToQueueTask: boolean;
  readonly canAttachToWorkspaceAgent: boolean;
  readonly canCopyReference: boolean;
  readonly entry: {
    readonly affordanceSource: KnowledgeV2ContextAffordanceSource | null;
    readonly affordanceState: ReturnType<typeof knowledgeV2ContextAffordanceState>;
    readonly item: { readonly title: string };
  };
}) {
  if (!entry.affordanceSource) {
    return "Source record is unavailable; this item cannot be attached.";
  }
  if (!entry.affordanceState.canAttach) {
    return (
      entry.affordanceState.reason ??
      `${entry.item.title} is unavailable for context use.`
    );
  }
  if (!canAttachToWorkspaceAgent && !canAttachToQueueTask && !canCopyReference) {
    return "Use as Context is unavailable because no Workspace Agent, Queue, or clipboard context bridge is connected.";
  }
  return null;
}

function KnowledgeV2BridgeNotice({
  loadError,
  missingBridges,
  onImport,
  onRetry,
  status,
}: {
  readonly loadError: string | null;
  readonly missingBridges: readonly string[];
  readonly onImport?: () => void;
  readonly onRetry?: () => void;
  readonly status: "loading" | "partial" | "ready" | "unavailable";
}) {
  if (status === "ready" || status === "partial") {
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
      {loadError ? <p>Load failed: {loadError}</p> : null}
      {missingBridges.length > 0 ? (
        <ul>
          {missingBridges.map((bridge) => (
            <li key={bridge}>{bridge}</li>
          ))}
        </ul>
      ) : null}
      {status === "unavailable" || loadError ? (
        <div className="knowledge-v2-empty-actions">
          {onRetry ? (
            <button className="knowledge-v2-empty-action" onClick={onRetry} type="button">
              Retry
            </button>
          ) : null}
          {onImport ? (
            <button className="knowledge-v2-empty-action" onClick={onImport} type="button">
              Import item
            </button>
          ) : null}
        </div>
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
    includeDrafts: values.lifecycle === "draft",
  };
}
