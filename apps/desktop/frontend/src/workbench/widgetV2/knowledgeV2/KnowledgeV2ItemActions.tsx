import { DestructiveConfirmationPopup } from "../../../design-system/ActionPrimitives";
import { Button } from "../../../design-system/Button";
import { WidgetPopupShell } from "../../../design-system/WidgetPopupShell";
import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { WidgetRenderProps } from "../../types";
import type { KnowledgeV2CatalogItem } from "./knowledgeV2CatalogTypes";
import { KnowledgeV2StatusBadge, knowledgeV2ItemStatuses } from "./knowledgeV2ItemStatus";

type KnowledgeDocumentUpdateInput = Parameters<
  NonNullable<WidgetRenderProps["onUpdateKnowledgeDocument"]>
>[0];

export function KnowledgeV2DetailsPopupHeaderActions({
  item,
}: {
  readonly item: KnowledgeV2CatalogItem;
}) {
  const statuses = knowledgeV2ItemStatuses(item);

  return (
    <>
      <span className="knowledge-v2-type-badge">{formatKnowledgeV2Token(item.type)}</span>
      <div className="knowledge-v2-details-header-badges" aria-label="Knowledge item states">
        {statuses.map((status) => (
          <KnowledgeV2StatusBadge key={status.key} status={status} />
        ))}
        {item.reviewState ? (
          <span className="knowledge-v2-chip">
            {formatKnowledgeV2Token(item.reviewState)}
          </span>
        ) : null}
      </div>
    </>
  );
}

export function KnowledgeV2DetailsPopupFooter({
  archiveDisabledReason,
  deleteDisabledReason,
  onArchive,
  onClose,
  onDelete,
  onUseAsContext,
  useAsContextDisabledReason,
}: {
  readonly archiveDisabledReason: string | null;
  readonly deleteDisabledReason: string | null;
  readonly onArchive: () => void;
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
        disabled={Boolean(archiveDisabledReason)}
        onClick={onArchive}
        title={archiveDisabledReason ?? undefined}
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
    </div>
  );
}

export function KnowledgeV2DeleteConfirmationPopup({
  candidate,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  readonly candidate: KnowledgeV2CatalogItem | null;
  readonly isDeleting: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <DestructiveConfirmationPopup
      ariaLabel="KnowledgeV2 delete confirmation"
      body={
        <>
          <p>
            <strong>
              Delete {candidate ? `"${candidate.title}"` : "this item"}?
            </strong>
          </p>
          <p>
            This is permanent and uses only the existing Knowledge / Skills
            delete bridge for this item type. No delete action runs until you
            confirm here.
          </p>
        </>
      }
      className="knowledge-v2-delete-popup-shell"
      confirmLabel="Delete"
      id="knowledge-v2-delete-confirmation-popup"
      isConfirming={isDeleting}
      isOpen={Boolean(candidate)}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title="Delete catalog item"
      titleId="knowledge-v2-delete-confirmation-popup-title"
    />
  );
}

export function knowledgeV2ArchiveDisabledReason({
  item,
  onUpdateKnowledgeDocument,
}: {
  readonly item: KnowledgeV2CatalogItem | null;
  readonly onUpdateKnowledgeDocument?: WidgetRenderProps["onUpdateKnowledgeDocument"];
}) {
  if (!item) {
    return "Select a Knowledge Document before archiving.";
  }
  if (item.recordKind !== "document") {
    return "Archive is unavailable because this item type has no existing lifecycle archive bridge.";
  }
  if (!onUpdateKnowledgeDocument) {
    return "Archive is unavailable because KnowledgeV2 did not receive the existing Knowledge Document update action.";
  }
  if (item.lifecycleState === "archived") {
    return "This Knowledge Document is already archived.";
  }
  return null;
}

export function knowledgeV2DeleteDisabledReason({
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

export function knowledgeV2ArchiveUpdateRequest(
  document: KnowledgeDocument,
): KnowledgeDocumentUpdateInput {
  return {
    catalogItemType: document.catalogItemType,
    content: document.content,
    createdByTaskId: document.createdByTaskId,
    createdFromRunId: document.createdFromRunId,
    enabled: document.enabled,
    knowledgeDocumentId: document.knowledgeDocumentId,
    lifecycleStatus: "archived",
    quickSummary: document.quickSummary,
    relations: document.relations,
    reviewedAt: document.reviewedAt,
    scope: document.scope,
    searchable: document.searchable,
    sourceKind: document.sourceKind,
    sourceLabel: document.sourceLabel,
    sourceRef: document.sourceRef,
    sourceRefs: document.sourceRefs,
    tags: document.tags,
    title: document.title,
    versionSummary: document.versionSummary,
  };
}

function formatKnowledgeV2Token(value: string) {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
