import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../design-system/Button";
import { WidgetPopupShell } from "../../../design-system/WidgetPopupShell";
import type {
  KnowledgeV2ContextAffordanceSource,
  KnowledgeV2ContextAffordanceState,
  KnowledgeV2ContextTarget,
} from "./knowledgeV2ContextAffordances";
import { knowledgeV2ContextText, knowledgeV2ReferenceText } from "./knowledgeV2ContextAffordances";
import type { KnowledgeV2CatalogItem } from "./knowledgeV2CatalogTypes";
import {
  KnowledgeV2StatusBadge,
  knowledgeV2ItemStatuses,
} from "./knowledgeV2ItemStatus";

export type KnowledgeV2PickerItem = {
  readonly affordanceSource: KnowledgeV2ContextAffordanceSource | null;
  readonly affordanceState: KnowledgeV2ContextAffordanceState;
  readonly item: KnowledgeV2CatalogItem;
};

type KnowledgeV2ContextPickerProps = {
  readonly canAttachToQueueTask: boolean;
  readonly canAttachToWorkspaceAgent: boolean;
  readonly canCopyReference: boolean;
  readonly initialSelectedItemId: string | null;
  readonly isOpen: boolean;
  readonly items: readonly KnowledgeV2PickerItem[];
  readonly onAttach: (
    target: KnowledgeV2ContextTarget,
    selectedItemIds: readonly string[],
  ) => void;
  readonly onClose: () => void;
};

const targetOptions: ReadonlyArray<{
  readonly id: KnowledgeV2ContextTarget;
  readonly label: string;
}> = [
  { id: "workspace_agent_current", label: "Workspace Agent current context" },
  { id: "workspace_agent_next", label: "Workspace Agent next run context" },
  { id: "queue_selected_task", label: "Selected Queue task" },
  { id: "copy_reference", label: "Copy reference" },
];

export function KnowledgeV2ContextPicker({
  canAttachToQueueTask,
  canAttachToWorkspaceAgent,
  canCopyReference,
  initialSelectedItemId,
  isOpen,
  items,
  onAttach,
  onClose,
}: KnowledgeV2ContextPickerProps) {
  const selectableIds = useMemo(
    () =>
      new Set(
        items
          .filter((entry) => entry.affordanceSource && entry.affordanceState.canAttach)
          .map((entry) => entry.item.id),
      ),
    [items],
  );
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(() =>
    initialSelectedItemId && selectableIds.has(initialSelectedItemId)
      ? [initialSelectedItemId]
      : [],
  );
  const [target, setTarget] = useState<KnowledgeV2ContextTarget>(() =>
    initialTarget({
      canAttachToQueueTask,
      canAttachToWorkspaceAgent,
      canCopyReference,
    }),
  );

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((itemId) => selectableIds.has(itemId)),
    );
  }, [selectableIds]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedIds(
      initialSelectedItemId && selectableIds.has(initialSelectedItemId)
        ? [initialSelectedItemId]
        : [],
    );
    setTarget(
      initialTarget({
        canAttachToQueueTask,
        canAttachToWorkspaceAgent,
        canCopyReference,
      }),
    );
  }, [
    canAttachToQueueTask,
    canAttachToWorkspaceAgent,
    canCopyReference,
    initialSelectedItemId,
    isOpen,
    selectableIds,
  ]);

  const selectedItems = selectedIds
    .map((itemId) => items.find((entry) => entry.item.id === itemId) ?? null)
    .filter((entry): entry is KnowledgeV2PickerItem => Boolean(entry));
  const estimate = estimateSelectedItems(selectedItems);
  const selectedWarnings = selectedItems
    .map((entry) => entry.affordanceState.warning)
    .filter((warning): warning is string => Boolean(warning));
  const targetReason = targetDisabledReason({
    canAttachToQueueTask,
    canAttachToWorkspaceAgent,
    canCopyReference,
    target,
  });
  const attachDisabledReason =
    targetReason ??
    (selectedItems.length === 0
      ? "Select at least one attachable Knowledge item."
      : null);

  function toggleItem(itemId: string) {
    if (!selectableIds.has(itemId)) {
      return;
    }
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((selectedId) => selectedId !== itemId)
        : [...current, itemId],
    );
  }

  return (
    <WidgetPopupShell
      actions={
        <Button onClick={onClose} variant="ghost">
          Close
        </Button>
      }
      bodyClassName="knowledge-v2-context-picker-popup-body"
      className="knowledge-v2-context-picker-popup-shell"
      footer={
        <>
          {attachDisabledReason ? (
            <p className="knowledge-v2-context-picker-footer-reason">
              {attachDisabledReason}
            </p>
          ) : null}
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={Boolean(attachDisabledReason)}
            onClick={() => onAttach(target, selectedIds)}
            variant="primary"
          >
            Attach
          </Button>
        </>
      }
      footerClassName="knowledge-v2-context-picker-popup-footer"
      id="knowledge-v2-use-as-context-popup"
      isOpen={isOpen}
      onRequestClose={onClose}
      title="Use as context"
      titleId="knowledge-v2-use-as-context-popup-title"
      variant="floating"
    >
      <section
        aria-label="KnowledgeV2 Use as Context picker"
        className="knowledge-v2-context-picker"
      >
      <p className="knowledge-v2-context-picker-intro">Explicit attach only.</p>
      <div className="knowledge-v2-context-picker-grid">
        <section aria-label="Selectable Knowledge items" className="knowledge-v2-picker-panel">
          <h5>Selectable items</h5>
          <ul className="knowledge-v2-picker-items">
            {items.map((entry) => {
              const disabledReason = itemDisabledReason(entry);
              const selected = selectedIds.includes(entry.item.id);
              const statuses = knowledgeV2ItemStatuses(entry.item);
              return (
                <li data-disabled={disabledReason ? "true" : "false"} key={entry.item.id}>
                  <label>
                    <input
                      checked={selected}
                      disabled={Boolean(disabledReason)}
                      onChange={() => toggleItem(entry.item.id)}
                      type="checkbox"
                    />
                    <span>
                      <strong>{entry.item.title}</strong>
                      <span>{formatToken(entry.item.type)} / {statuses[0]?.label ?? "Unavailable"}</span>
                    </span>
                  </label>
                  <div className="knowledge-v2-picker-badges">
                    <span className="knowledge-v2-chip">{formatToken(entry.item.recordKind)}</span>
                    {statuses.map((status) => (
                      <KnowledgeV2StatusBadge key={status.key} status={status} />
                    ))}
                    {entry.item.reviewState ? (
                      <span className="knowledge-v2-chip">{formatToken(entry.item.reviewState)}</span>
                    ) : null}
                  </div>
                  <p>{entry.item.summary}</p>
                  {entry.affordanceState.warning ? (
                    <p className="knowledge-v2-context-warning">
                      {compactContextWarning(entry.affordanceState.warning)}
                    </p>
                  ) : null}
                  {disabledReason ? (
                    <p className="knowledge-v2-picker-disabled-reason">
                      {disabledReason}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Selected Knowledge context" className="knowledge-v2-picker-panel">
          <h5>Selected items</h5>
          <p>{selectedItems.length.toString()} selected</p>
          <dl className="knowledge-v2-picker-estimate">
            <div>
              <dt>Estimated tokens</dt>
              <dd>{estimate.available ? estimate.tokens.toString() : "Unavailable"}</dd>
            </div>
            <div>
              <dt>Estimated bytes</dt>
              <dd>{estimate.available ? estimate.bytes.toString() : "Unavailable"}</dd>
            </div>
          </dl>
          {estimate.available ? (
            <p>Bounded context estimate.</p>
          ) : (
            <p>Estimate unavailable.</p>
          )}
          <ul className="knowledge-v2-picker-selected-list">
            {selectedItems.length > 0 ? (
              selectedItems.map((entry) => (
                <li key={entry.item.id}>{entry.item.title}</li>
              ))
            ) : (
              <li>No items selected.</li>
            )}
          </ul>
        </section>
      </div>

      <section aria-label="Knowledge context target" className="knowledge-v2-picker-panel">
        <h5>Target</h5>
        <div className="knowledge-v2-target-list">
          {targetOptions.map((option) => {
            const reason = targetDisabledReason({
              canAttachToQueueTask,
              canAttachToWorkspaceAgent,
              canCopyReference,
              target: option.id,
            });
            return (
              <label data-disabled={reason ? "true" : "false"} key={option.id}>
                <input
                  checked={target === option.id}
                  disabled={Boolean(reason)}
                  name="knowledge-v2-context-target"
                  onChange={() => setTarget(option.id)}
                  type="radio"
                />
                <span>{option.label}</span>
                {reason ? <small>{reason}</small> : null}
              </label>
            );
          })}
        </div>
      </section>

      {selectedWarnings.length > 0 ? (
        <section className="knowledge-v2-picker-warning-summary">
          <h5>Warnings</h5>
          <p>
            {selectedWarnings.length.toString()} warning
            {selectedWarnings.length === 1 ? "" : "s"}:{" "}
            {selectedWarnings.map(compactContextWarning).join(", ")}
          </p>
          <details>
            <summary>Warning details</summary>
            <ul>
              {selectedWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}
    </section>
    </WidgetPopupShell>
  );
}

function initialTarget({
  canAttachToQueueTask,
  canAttachToWorkspaceAgent,
  canCopyReference,
}: {
  readonly canAttachToQueueTask: boolean;
  readonly canAttachToWorkspaceAgent: boolean;
  readonly canCopyReference: boolean;
}): KnowledgeV2ContextTarget {
  if (canAttachToWorkspaceAgent) {
    return "workspace_agent_current";
  }
  if (canAttachToQueueTask) {
    return "queue_selected_task";
  }
  if (canCopyReference) {
    return "copy_reference";
  }
  return "workspace_agent_current";
}

function itemDisabledReason(entry: KnowledgeV2PickerItem) {
  if (!entry.affordanceSource) {
    return "Source record is unavailable; this item cannot be attached.";
  }
  if (!entry.affordanceState.canAttach) {
    return entry.affordanceState.reason ?? "This item is unavailable for context use.";
  }
  return null;
}

function compactContextWarning(warning: string) {
  if (warning.includes("Large item")) {
    return "Large item: bounded context only";
  }
  if (warning.includes("stale") || warning.includes("Stale")) {
    return "Stale item";
  }
  if (warning.includes("disabled")) {
    return "Disabled";
  }
  if (warning.includes("rejected")) {
    return "Rejected";
  }
  if (warning.includes("not searchable")) {
    return "Not searchable";
  }
  if (warning.includes("review status")) {
    return "Review required";
  }
  return warning;
}

function targetDisabledReason({
  canAttachToQueueTask,
  canAttachToWorkspaceAgent,
  canCopyReference,
  target,
}: {
  readonly canAttachToQueueTask: boolean;
  readonly canAttachToWorkspaceAgent: boolean;
  readonly canCopyReference: boolean;
  readonly target: KnowledgeV2ContextTarget;
}) {
  switch (target) {
    case "workspace_agent_current":
      return canAttachToWorkspaceAgent
        ? null
        : "Workspace Agent current-context bridge is unavailable.";
    case "workspace_agent_next":
      return "Workspace Agent next-run context bridge is not wired in KnowledgeV2.";
    case "queue_selected_task":
      return canAttachToQueueTask
        ? null
        : "Selected Queue task attach bridge is unavailable.";
    case "copy_reference":
      return canCopyReference ? null : "Clipboard bridge is unavailable.";
  }
}

function estimateSelectedItems(items: readonly KnowledgeV2PickerItem[]) {
  if (items.some((entry) => !entry.affordanceSource)) {
    return { available: false, bytes: 0, tokens: 0 };
  }

  const text = items
    .map((entry) =>
      entry.affordanceSource
        ? knowledgeV2ContextText(entry.affordanceSource)
        : knowledgeV2ReferenceText(entry.item),
    )
    .join("\n\n");
  const bytes = new Blob([text]).size;
  return {
    available: true,
    bytes,
    tokens: Math.ceil(text.length / 4),
  };
}

function formatToken(value: string) {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
