import type { ReactNode } from "react";

export type WorkspaceAgentV2ContextItemType =
  | "file"
  | "future-git-review"
  | "knowledge"
  | "manual"
  | "note"
  | "queue-task-context"
  | "skill";

export type WorkspaceAgentV2ContextWarning =
  | "disabled"
  | "large"
  | "rejected"
  | "secret"
  | "stale";

export type WorkspaceAgentV2ContextItem = {
  readonly id: string;
  readonly label: string;
  readonly source?: string;
  readonly scope?: string;
  readonly type: WorkspaceAgentV2ContextItemType;
  readonly version?: string;
  readonly warningDetails?: readonly string[];
  readonly warnings?: readonly WorkspaceAgentV2ContextWarning[];
};

type WorkspaceAgentV2ContextStripProps = {
  readonly items?: readonly WorkspaceAgentV2ContextItem[];
  readonly onAddPlaceholder?: () => void;
  readonly onRemoveItem?: (itemId: string) => void;
};

type WorkspaceAgentV2ContextCardProps = {
  readonly item: WorkspaceAgentV2ContextItem;
  readonly onRemove?: (itemId: string) => void;
};

type WorkspaceAgentV2ContextChipProps = {
  readonly children: ReactNode;
  readonly tone?: "blocked" | "default" | "warning";
};

const warningLabels: Record<WorkspaceAgentV2ContextWarning, string> = {
  disabled: "Disabled",
  large: "Large",
  rejected: "Rejected",
  secret: "Secret",
  stale: "Stale",
};

const typeLabels: Record<WorkspaceAgentV2ContextItemType, string> = {
  file: "File",
  "future-git-review": "Future Git review",
  knowledge: "Knowledge",
  manual: "Manual attachment",
  note: "Note",
  "queue-task-context": "Queue task context",
  skill: "Skill",
};

export function WorkspaceAgentV2ContextStrip({
  items = [],
  onAddPlaceholder,
  onRemoveItem,
}: WorkspaceAgentV2ContextStripProps) {
  return (
    <section
      aria-label="Workspace Agent v2 visible context strip"
      className="workspace-agent-v2-context-strip"
    >
      <div className="workspace-agent-v2-context-strip-header">
        <div>
          <h3>Visible context</h3>
          <p>Review-only scaffold for Direct Run and Queue Run context.</p>
        </div>
        <button
          className="button button-ghost workspace-agent-v2-context-add"
          onClick={onAddPlaceholder}
          type="button"
        >
          Add placeholder
        </button>
      </div>
      {items.length > 0 ? (
        <div className="workspace-agent-v2-context-items">
          {items.map((item) => (
            <WorkspaceAgentV2ContextCard
              item={item}
              key={item.id}
              onRemove={onRemoveItem}
            />
          ))}
        </div>
      ) : (
        <p className="workspace-agent-v2-context-empty">
          No visible context selected. Nothing is attached automatically.
        </p>
      )}
    </section>
  );
}

export function WorkspaceAgentV2ContextCard({
  item,
  onRemove,
}: WorkspaceAgentV2ContextCardProps) {
  const warnings = item.warnings ?? [];
  const isBlocked =
    warnings.includes("disabled") || warnings.includes("rejected");

  return (
    <article
      aria-label={`${typeLabels[item.type]} context: ${item.label}`}
      className="workspace-agent-v2-context-card"
      data-blocked={isBlocked ? "true" : "false"}
    >
      <div className="workspace-agent-v2-context-card-main">
        <div className="workspace-agent-v2-context-card-title-row">
          <h4>{item.label}</h4>
          <WorkspaceAgentV2ContextChip tone={isBlocked ? "blocked" : "default"}>
            {typeLabels[item.type]}
          </WorkspaceAgentV2ContextChip>
        </div>
        <div className="workspace-agent-v2-context-meta">
          {item.scope ? (
            <WorkspaceAgentV2ContextChip>Scope: {item.scope}</WorkspaceAgentV2ContextChip>
          ) : null}
          {item.source ? (
            <WorkspaceAgentV2ContextChip>Source: {item.source}</WorkspaceAgentV2ContextChip>
          ) : null}
          {item.version ? (
            <WorkspaceAgentV2ContextChip>
              Version: {item.version}
            </WorkspaceAgentV2ContextChip>
          ) : null}
        </div>
        {warnings.length > 0 ? (
          <div
            aria-label={`Warnings for ${item.label}`}
            className="workspace-agent-v2-context-warnings"
          >
            {warnings.map((warning) => (
              <WorkspaceAgentV2ContextChip
                key={warning}
                tone={warning === "disabled" || warning === "rejected" ? "blocked" : "warning"}
              >
                {warningLabels[warning]}
              </WorkspaceAgentV2ContextChip>
            ))}
            {item.warningDetails?.map((detail) => (
              <span className="workspace-agent-v2-context-warning-detail" key={detail}>
                {detail}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <button
        className="button button-ghost workspace-agent-v2-context-remove"
        onClick={() => onRemove?.(item.id)}
        type="button"
      >
        Remove
      </button>
    </article>
  );
}

export function WorkspaceAgentV2ContextChip({
  children,
  tone = "default",
}: WorkspaceAgentV2ContextChipProps) {
  return (
    <span className="workspace-agent-v2-context-chip" data-tone={tone}>
      {children}
    </span>
  );
}
