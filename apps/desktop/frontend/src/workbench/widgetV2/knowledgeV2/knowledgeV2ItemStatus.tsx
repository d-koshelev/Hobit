import type { KnowledgeV2CatalogItem } from "./knowledgeV2CatalogTypes";

export type KnowledgeV2StatusTone =
  | "blocked"
  | "neutral"
  | "ok"
  | "unavailable"
  | "warning";

export type KnowledgeV2ItemStatus = {
  readonly key: string;
  readonly label:
    | "Archived"
    | "Draft"
    | "Large"
    | "Published"
    | "Rejected"
    | "Stale"
    | "Unavailable";
  readonly reason: string;
  readonly tone: KnowledgeV2StatusTone;
};

export function knowledgeV2ItemStatuses(
  item: KnowledgeV2CatalogItem,
): readonly KnowledgeV2ItemStatus[] {
  const statuses: KnowledgeV2ItemStatus[] = [primaryKnowledgeV2ItemStatus(item)];

  if (item.enabled === false) {
    statuses.push({
      key: "unavailable-disabled",
      label: "Unavailable",
      reason: "Disabled item cannot be used as normal Knowledge context.",
      tone: "unavailable",
    });
  }

  if (item.searchable === false) {
    statuses.push({
      key: "unavailable-not-searchable",
      label: "Unavailable",
      reason: "Not searchable; context attach is blocked.",
      tone: "unavailable",
    });
  }

  if (
    item.warnings.some(
      (warning) =>
        warning.code === "large_content" || warning.code === "large_skill",
    )
  ) {
    statuses.push({
      key: "large",
      label: "Large",
      reason: "Review recommended; visible preview and context are bounded.",
      tone: "warning",
    });
  }

  return uniqueKnowledgeV2Statuses(statuses);
}

export function primaryKnowledgeV2ItemStatus(
  item: KnowledgeV2CatalogItem,
): KnowledgeV2ItemStatus {
  switch (item.lifecycleState) {
    case "active":
    case "reviewed":
      return {
        key: "published",
        label: "Published",
        reason: "Ready and usable as Knowledge context when attach bridges allow it.",
        tone: "ok",
      };
    case "draft":
    case "needs_review":
      return {
        key: "draft",
        label: "Draft",
        reason: "In progress; review is needed before normal context use.",
        tone: "neutral",
      };
    case "archived":
    case "deprecated":
      return {
        key: "archived",
        label: "Archived",
        reason: "No longer active; context attach is blocked in Knowledge.",
        tone: "neutral",
      };
    case "rejected":
      return {
        key: "rejected",
        label: "Rejected",
        reason: "Not approved and cannot be attached.",
        tone: "blocked",
      };
    case "stale":
      return {
        key: "stale",
        label: "Stale",
        reason: "Update recommended; use with caution after review.",
        tone: "warning",
      };
    default:
      return {
        key: "unavailable",
        label: "Unavailable",
        reason: "Cannot be used in this Knowledge state.",
        tone: "unavailable",
      };
  }
}

export function KnowledgeV2StatusBadge({
  status,
}: {
  readonly status: KnowledgeV2ItemStatus;
}) {
  return (
    <span
      className="knowledge-v2-chip"
      data-status-key={status.key}
      data-tone={status.tone}
      title={status.reason}
    >
      {status.label}
    </span>
  );
}

export function KnowledgeV2StatusReasonList({
  statuses,
}: {
  readonly statuses: readonly KnowledgeV2ItemStatus[];
}) {
  return (
    <ul className="knowledge-v2-status-reasons">
      {statuses.map((status) => (
        <li data-tone={status.tone} key={status.key}>
          <strong>{status.label}</strong>
          <span>{status.reason}</span>
        </li>
      ))}
    </ul>
  );
}

function uniqueKnowledgeV2Statuses(
  statuses: readonly KnowledgeV2ItemStatus[],
) {
  const seen = new Set<string>();
  return statuses.filter((status) => {
    const key = `${status.key}:${status.label}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
