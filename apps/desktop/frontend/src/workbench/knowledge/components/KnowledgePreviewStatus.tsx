import type { Dispatch, SetStateAction } from "react";

import type { KnowledgeV2CatalogItem } from "../model/knowledgeCatalogTypes";
import type { KnowledgeV2ContextAffordanceState } from "../context/knowledgeContextAffordances";
import type { KnowledgeV2ItemStatus } from "./KnowledgeItemStatus";

export function KnowledgeV2CompactStatus({
  affordanceState,
  item,
  statuses,
}: {
  readonly affordanceState?: KnowledgeV2ContextAffordanceState;
  readonly item: KnowledgeV2CatalogItem;
  readonly statuses: readonly KnowledgeV2ItemStatus[];
}) {
  const contextUsability = knowledgeV2ContextUsability(
    item,
    statuses,
    affordanceState,
  );

  return (
    <div
      aria-label="Knowledge preview compact status"
      className="knowledge-v2-compact-status"
    >
      <span>{compactStatusText(item, statuses)}</span>
      <span data-usability={contextUsability.state}>
        Context: {contextUsability.state}
      </span>
      <span>{contextUsability.reason}</span>
    </div>
  );
}

export function KnowledgeV2CompactStatusReason({
  item,
  statuses,
}: {
  readonly item: KnowledgeV2CatalogItem;
  readonly statuses: readonly KnowledgeV2ItemStatus[];
}) {
  return (
    <p>
      {`${statuses.map((status) => status.label).join(" - ")} status with ${
        item.enabled === false ? "inactive" : "active"
      } and ${item.searchable === false ? "not searchable" : "searchable"} flags.`}
    </p>
  );
}

export function KnowledgeV2ContextUsabilitySummary({
  affordanceState,
  item,
  statuses,
}: {
  readonly affordanceState?: KnowledgeV2ContextAffordanceState;
  readonly item: KnowledgeV2CatalogItem;
  readonly statuses: readonly KnowledgeV2ItemStatus[];
}) {
  const contextUsability = knowledgeV2ContextUsability(
    item,
    statuses,
    affordanceState,
  );

  return (
    <p>
      Context: {contextUsability.state}. {contextUsability.reason}
    </p>
  );
}

export function KnowledgeV2WarningsSummary({
  isOpen,
  item,
  setIsOpen,
}: {
  readonly isOpen: boolean;
  readonly item: KnowledgeV2CatalogItem;
  readonly setIsOpen: Dispatch<SetStateAction<boolean>>;
}) {
  if (item.warnings.length === 0) {
    return null;
  }

  const warningCountText = `${item.warnings.length.toString()} warning${
    item.warnings.length === 1 ? "" : "s"
  }`;
  const summary = item.warnings.map(warningSummaryLabel).join(", ");

  return (
    <section
      aria-label="Knowledge preview warnings"
      className="knowledge-v2-preview-section knowledge-v2-warning-summary"
    >
      <div className="knowledge-v2-warning-summary-row">
        <div>
          <h4>Warnings</h4>
          <p>
            {warningCountText}: {summary}
          </p>
        </div>
        <button
          aria-expanded={isOpen}
          className="knowledge-v2-link-button"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {isOpen ? "Hide details" : "Show details"}
        </button>
      </div>
      {isOpen ? (
        <ul className="knowledge-v2-warnings">
          {item.warnings.map((warning) => (
            <li data-severity={warning.severity} key={`${warning.code}-${warning.message}`}>
              {warning.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function compactStatusText(
  item: KnowledgeV2CatalogItem,
  statuses: readonly KnowledgeV2ItemStatus[],
) {
  return [
    statuses.map((status) => status.label).join(" - "),
    item.enabled === false ? "Inactive" : "Active",
    item.searchable === false ? "Not searchable" : "Searchable",
  ].join(" - ");
}

function knowledgeV2ContextUsability(
  item: KnowledgeV2CatalogItem,
  statuses: readonly KnowledgeV2ItemStatus[],
  affordanceState?: KnowledgeV2ContextAffordanceState,
): { readonly reason: string; readonly state: "Large" | "Stale" | "Unavailable" | "Usable" } {
  if (affordanceState && !affordanceState.canAttach) {
    return {
      reason: affordanceState.reason ?? "Context attach is blocked.",
      state: "Unavailable",
    };
  }

  if (
    statuses.some(
      (status) => status.label === "Unavailable" || status.label === "Rejected",
    ) ||
    item.enabled === false ||
    item.searchable === false
  ) {
    return {
      reason: "Attach is blocked until the item is approved, enabled, and searchable.",
      state: "Unavailable",
    };
  }

  if (statuses.some((status) => status.label === "Stale")) {
    return {
      reason: "Usable with visible stale warning and bounded context.",
      state: "Stale",
    };
  }

  if (statuses.some((status) => status.label === "Large")) {
    return {
      reason: "Usable with bounded context; review the large-item warning.",
      state: "Large",
    };
  }

  return {
    reason: "Usable when an explicit attach target bridge is available.",
    state: "Usable",
  };
}

function warningSummaryLabel(warning: KnowledgeV2CatalogItem["warnings"][number]) {
  switch (warning.code) {
    case "large_content":
    case "large_skill":
      return "Large";
    case "missing_quick_summary":
    case "missing_skill_summary":
      return "Missing summary";
    case "rejected":
      return "Rejected";
    case "stale":
      return "Stale";
    case "unavailable":
      return warning.message.includes("not searchable")
        ? "Not searchable"
        : "Unavailable";
    default:
      return formatToken(warning.code);
  }
}

function formatToken(value: string) {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
