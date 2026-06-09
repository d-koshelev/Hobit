import { Button } from "../../../design-system/Button";
import { WidgetPopupShell } from "../../../design-system/WidgetPopupShell";
import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { WidgetRenderProps } from "../../types";
import type { KnowledgeV2CatalogItem } from "./knowledgeV2CatalogTypes";

type KnowledgeDocumentUpdateInput = Parameters<
  NonNullable<WidgetRenderProps["onUpdateKnowledgeDocument"]>
>[0];

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
      <p className="knowledge-v2-details-footer-reasons">
        {useAsContextDisabledReason
          ? `Use as context disabled: ${useAsContextDisabledReason}`
          : "Use as context opens explicit visible context targets only. These controls only use explicit visible callbacks."}
        {" "}
        {archiveDisabledReason
          ? `Archive disabled: ${archiveDisabledReason}`
          : "Archive uses the existing Knowledge Document lifecycle update action."}
        {" "}
        {deleteDisabledReason
          ? `Delete disabled: ${deleteDisabledReason}`
          : "Delete uses an existing Knowledge / Skills delete action and asks for confirmation."}
      </p>
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
    <WidgetPopupShell
      bodyClassName="knowledge-v2-delete-popup-body"
      className="knowledge-v2-delete-popup-shell"
      footer={
        <div className="knowledge-v2-delete-popup-footer">
          <Button disabled={isDeleting} onClick={onCancel} variant="ghost">
            Cancel
          </Button>
          <Button
            className="knowledge-v2-danger-button"
            disabled={isDeleting}
            onClick={onConfirm}
            variant="secondary"
          >
            {isDeleting ? "Deleting" : "Delete"}
          </Button>
        </div>
      }
      footerClassName="knowledge-v2-delete-popup-footer-shell"
      id="knowledge-v2-delete-confirmation-popup"
      isOpen={Boolean(candidate)}
      onRequestClose={onCancel}
      title="Delete catalog item"
      titleId="knowledge-v2-delete-confirmation-popup-title"
      variant="floating"
    >
      <section
        aria-label="KnowledgeV2 delete confirmation"
        className="knowledge-v2-delete-confirmation"
      >
        <p className="knowledge-v2-delete-title">
          Delete {candidate ? `"${candidate.title}"` : "this item"}?
        </p>
        <p>
          This is permanent and uses only the existing Knowledge / Skills delete
          bridge for this item type. No delete action runs until you confirm
          here.
        </p>
      </section>
    </WidgetPopupShell>
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
