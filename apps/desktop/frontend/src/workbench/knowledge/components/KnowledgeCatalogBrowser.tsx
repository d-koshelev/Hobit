import { useMemo, useState } from "react";

import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";
import { WidgetPopupShell } from "../../../design-system/WidgetPopupShell";
import type { WidgetRenderProps } from "../../types";
import { WidgetV2Toolbar } from "../../widgetV2/WidgetV2Shell";
import { KnowledgeV2CatalogList } from "./KnowledgeCatalogList";
import { KnowledgeV2ContextPicker } from "../context/KnowledgeContextPicker";
import { KnowledgeV2Filters, type KnowledgeV2FilterValues } from "./KnowledgeFilters";
import { KnowledgeV2PreviewPanel } from "./KnowledgePreviewPanel";
import {
  KnowledgeV2DeleteConfirmationPopup,
  KnowledgeV2DetailsPopupHeaderActions,
  KnowledgeV2DetailsPopupFooter,
  knowledgeV2ArchiveDisabledReason,
  knowledgeV2ArchiveUpdateRequest,
  knowledgeV2DeleteDisabledReason,
} from "./KnowledgeItemActions";
import {
  attachKnowledgeV2SourceToQueueTask,
  knowledgeV2ContextAffordanceSource,
  knowledgeV2ContextAffordanceState,
  type KnowledgeV2ContextAffordanceSource,
  type KnowledgeV2ContextTarget,
  knowledgeV2ReferenceText,
  knowledgeV2WorkspaceAgentContextInput,
  type KnowledgeV2ContextActionNotice,
} from "../context/knowledgeContextAffordances";
import {
  buildKnowledgeV2CatalogViewModel,
  defaultKnowledgeV2CatalogSelection,
} from "../model/knowledgeCatalogModel";
import type {
  KnowledgeV2CatalogFilters,
  KnowledgeV2CatalogItem,
  KnowledgeV2CatalogSort,
} from "../model/knowledgeCatalogTypes";

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
  readonly onUpdateKnowledgeDocument?: WidgetRenderProps["onUpdateKnowledgeDocument"];
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
  onUpdateKnowledgeDocument,
  skills,
  status = "ready",
  viewMode = "list",
}: KnowledgeV2CatalogBrowserProps) {
  const [filters, setFilters] = useState<KnowledgeV2FilterValues>(defaultFilters);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<KnowledgeV2ContextActionNotice | null>(null);
  const [isContextPickerOpen, setIsContextPickerOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
  const deleteCandidate =
    viewModel.items.find((item) => item.id === deleteCandidateId) ?? null;
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

  function requestDeleteItem(itemId?: string) {
    const item =
      itemId !== undefined
        ? viewModel.items.find((candidate) => candidate.id === itemId) ?? null
        : selectedItem;
    const disabledReason = knowledgeV2DeleteDisabledReason({
      item,
      onDeleteKnowledgeDocument,
      onDeleteSkill,
    });

    if (!item) {
      setActionNotice({
        message: disabledReason ?? "Select a Knowledge item before deleting.",
        status: "blocked",
      });
      return;
    }
    if (disabledReason) {
      setActionNotice({ message: disabledReason, status: "blocked" });
      return;
    }

    setSelectedItemId(item.id);
    setDeleteCandidateId(item.id);
  }

  async function archiveItem(itemId?: string) {
    const item =
      itemId !== undefined
        ? viewModel.items.find((candidate) => candidate.id === itemId) ?? null
        : selectedItem;
    const disabledReason = knowledgeV2ArchiveDisabledReason({
      item,
      onUpdateKnowledgeDocument,
    });

    if (!item || disabledReason) {
      setActionNotice({ message: disabledReason ?? "Select a Knowledge Document before archiving.", status: "blocked" });
      return;
    }

    const source = knowledgeV2ContextAffordanceSource(item, documents, skills);
    if (!source || source.kind !== "knowledge_document") {
      setActionNotice({
        message: "Archive is unavailable because the source Knowledge Document is not loaded.",
        status: "blocked",
      });
      return;
    }

    try {
      await onUpdateKnowledgeDocument?.(
        knowledgeV2ArchiveUpdateRequest(source.document),
      );
      setActionNotice({
        message: `${item.title} archived through the existing Knowledge Document lifecycle update action.`,
        status: "detached",
      });
      setIsDetailsOpen(false);
      onRetry?.();
    } catch (error) {
      setActionNotice({
        message:
          error instanceof Error
            ? error.message
            : "Unable to archive this Knowledge Document.",
        status: "unavailable",
      });
    }
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
        message: "Select at least one attachable Knowledge item before attaching.",
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
            : `${selectedSources.length.toString()} Knowledge items attached to Workspace Agent as visible current-session context.`,
        status: "attached",
      });
      setIsContextPickerOpen(false);
      setIsDetailsOpen(true);
      return;
    }

    if (target === "workspace_agent_next") {
      setActionNotice({
        message:
          "Workspace Agent next-run context bridge is not wired in Knowledge; nothing was attached.",
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
              message: `${selectedSources.length.toString()} Knowledge items attached to the selected Queue task.`,
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
          : `${selectedEntries.length.toString()} Knowledge references copied.`,
      status: "copied",
    });
    setIsContextPickerOpen(false);
    setIsDetailsOpen(true);
  }

  async function confirmDeleteItem() {
    if (!deleteCandidate || isDeleting) {
      return;
    }

    const disabledReason = knowledgeV2DeleteDisabledReason({
      item: deleteCandidate,
      onDeleteKnowledgeDocument,
      onDeleteSkill,
    });
    if (disabledReason) {
      setActionNotice({ message: disabledReason, status: "blocked" });
      return;
    }

    setIsDeleting(true);
    try {
      if (deleteCandidate.recordKind === "document" && onDeleteKnowledgeDocument) {
        await onDeleteKnowledgeDocument({
          knowledgeDocumentId: deleteCandidate.recordId,
        });
        setActionNotice({
          message: `${deleteCandidate.title} delete action completed.`,
          status: "detached",
        });
        setIsDetailsOpen(false);
        setDeleteCandidateId(null);
        onRetry?.();
        return;
      }

      if (deleteCandidate.recordKind === "skill" && onDeleteSkill) {
        await onDeleteSkill({ skillId: deleteCandidate.recordId });
        setActionNotice({
          message: `${deleteCandidate.title} delete action completed.`,
          status: "detached",
        });
        setIsDetailsOpen(false);
        setDeleteCandidateId(null);
        onRetry?.();
      }
    } catch (error) {
      setActionNotice({
        message:
          error instanceof Error
            ? error.message
            : "Unable to delete this Knowledge item.",
        status: "unavailable",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <WidgetV2Toolbar label="Knowledge search and filter row">
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
          getArchiveDisabledReason={(item) =>
            knowledgeV2ArchiveDisabledReason({ item, onUpdateKnowledgeDocument })
          }
          getDeleteDisabledReason={(item) =>
            knowledgeV2DeleteDisabledReason({
              item,
              onDeleteKnowledgeDocument,
              onDeleteSkill,
            })
          }
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
          onArchive={archiveItem}
          onClearFilters={clearFilters}
          onDelete={requestDeleteItem}
          onImport={onImport}
          onOpenDetails={selectItem}
          onSelectItem={selectItem}
          onUseAsContext={openContextPicker}
          selectedItemId={selectedItemId}
        />
        <WidgetPopupShell
          actions={
            selectedItem ? (
              <KnowledgeV2DetailsPopupHeaderActions
                item={selectedItem}
              />
            ) : null
          }
          bodyClassName="knowledge-v2-details-popup-body"
          className="knowledge-v2-details-popup-shell knowledge-v2-product-detail-size"
          footer={
            <KnowledgeV2DetailsPopupFooter
              deleteDisabledReason={knowledgeV2DeleteDisabledReason({
                item: selectedItem,
                onDeleteKnowledgeDocument,
                onDeleteSkill,
              })}
              archiveDisabledReason={knowledgeV2ArchiveDisabledReason({
                item: selectedItem,
                onUpdateKnowledgeDocument,
              })}
              onClose={closeDetailsPopup}
              onArchive={() => archiveItem()}
              onDelete={() => requestDeleteItem()}
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
            presentation="detailWindow"
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
        <KnowledgeV2DeleteConfirmationPopup
          candidate={deleteCandidate}
          isDeleting={isDeleting}
          onCancel={() => {
            if (!isDeleting) {
              setDeleteCandidateId(null);
            }
          }}
          onConfirm={confirmDeleteItem}
        />
      </div>
    </>
  );
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
      aria-label="Knowledge data bridge status"
      className="knowledge-v2-bridge-notice"
      data-status={status}
    >
      <h3>{titleForBridgeStatus(status)}</h3>
      {status === "loading" ? (
        <p>Loading Knowledge Documents and Skills.</p>
      ) : null}
      {status === "unavailable" ? (
        <p>
          Knowledge / Skills did not receive document or Skill data sources.
          No production data is being faked.
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
