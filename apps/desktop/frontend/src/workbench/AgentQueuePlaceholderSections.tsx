import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Badge } from "../design-system/Badge";
import {
  StaticPreviewFieldList,
  StaticPreviewPlannedActions,
} from "./StaticPreviewPrimitives";
import type {
  AgentQueueDetailField,
  AgentQueueGroup,
  AgentQueueItemDetailPreview,
  AgentQueueLinkedSurface,
  AgentQueueOverview,
  AgentQueueOverviewMetric,
  AgentQueuePlannedAction,
  AgentQueuePreviewItem,
  AgentQueuePreviewItemId,
  AgentQueueSummary,
} from "./agentQueuePreview";

export function AgentQueueSummarySection({
  summary,
}: {
  summary: AgentQueueSummary;
}) {
  return (
    <section className="agent-queue-summary">
      <div className="agent-queue-summary-copy">
        <p className="agent-queue-summary-title">{summary.title}</p>
        <p className="agent-queue-summary-text">{summary.text}</p>
      </div>
      <div className="agent-queue-summary-badges">
        <Badge variant="neutral">{summary.badgeLabel}</Badge>
        <Badge variant="neutral">No execution</Badge>
      </div>
    </section>
  );
}

export function AgentQueueOverviewSection({
  overview,
}: {
  overview: AgentQueueOverview;
}) {
  return (
    <section className="agent-queue-overview" aria-label={overview.ariaLabel}>
      <div className="agent-queue-overview-copy">
        <h3 className="agent-queue-section-title">{overview.title}</h3>
        <p className="agent-queue-section-text">{overview.text}</p>
      </div>
      <dl className="agent-queue-overview-metrics">
        {overview.metrics.map((metric) => (
          <QueueMetric key={metric.label} metric={metric} />
        ))}
      </dl>
    </section>
  );
}

export function AgentQueueGroupList({
  groups,
  onSelectItem,
  selectedItemId,
}: {
  groups: AgentQueueGroup[];
  onSelectItem: (itemId: AgentQueuePreviewItemId) => void;
  selectedItemId: AgentQueuePreviewItemId;
}) {
  return (
    <div aria-label="Static Agent Queue groups" className="agent-queue-groups">
      {groups.map((group) => (
        <QueueGroup
          group={group}
          key={group.title}
          onSelectItem={onSelectItem}
          selectedItemId={selectedItemId}
        />
      ))}
    </div>
  );
}

export function AgentQueueItemDetail({
  preview,
}: {
  preview: AgentQueueItemDetailPreview;
}) {
  const primarySections: Array<{
    actions?: AgentQueuePlannedAction[];
    fields: AgentQueueDetailField[];
    title: string;
  }> = [
    preview.request,
    preview.result,
    preview.gitReview,
    { ...preview.decision, actions: preview.decision.actions },
  ];
  const secondarySections = [preview.execution, preview.artifacts];

  return (
    <section aria-label={preview.ariaLabel} className="agent-queue-detail">
      <div className="agent-queue-detail-header">
        <div className="agent-queue-group-copy">
          <p className="agent-queue-item-block">{preview.block}</p>
          <h3 className="agent-queue-section-title">{preview.title}</h3>
          <p className="agent-queue-section-text">{preview.description}</p>
        </div>
        <div className="agent-queue-action-row">
          {preview.badges.map((badge) => (
            <Badge key={badge} variant="neutral">
              {badge}
            </Badge>
          ))}
        </div>
      </div>

      <div className="agent-queue-detail-grid agent-queue-detail-grid-primary">
        {primarySections.map((section) => (
          <QueueDetailSection
            actions={section.actions}
            emphasis="primary"
            fields={section.fields}
            key={section.title}
            title={section.title}
          />
        ))}
      </div>

      <div
        aria-label="Secondary static queue detail"
        className="agent-queue-detail-grid agent-queue-detail-grid-secondary"
      >
        {secondarySections.map((section) => (
          <QueueDetailSection
            emphasis="secondary"
            fields={section.fields}
            key={section.title}
            title={section.title}
          />
        ))}
      </div>
    </section>
  );
}

export function AgentQueueLinkedSurfaces({
  linkedSurfaces,
}: {
  linkedSurfaces: AgentQueueLinkedSurface[];
}) {
  return (
    <section
      aria-label="Future Agent Queue widget synergy"
      className="agent-queue-linked-surfaces"
    >
      <div className="agent-queue-section-header">
        <h3 className="agent-queue-section-title">Linked work surfaces</h3>
        <Badge variant="neutral">Planned</Badge>
      </div>
      <StaticPreviewFieldList
        className="agent-queue-linked-surface-list"
        fieldClassName="agent-queue-linked-surface"
        fields={linkedSurfaces}
        labelClassName="agent-queue-card-label"
        valueClassName="agent-queue-card-value"
      />
    </section>
  );
}

function QueueMetric({ metric }: { metric: AgentQueueOverviewMetric }) {
  return (
    <div className={`agent-queue-metric agent-queue-metric-${metric.variant}`}>
      <dt className="agent-queue-metric-label">{metric.label}</dt>
      <dd className="agent-queue-metric-value">{metric.value}</dd>
    </div>
  );
}

function QueueGroup({
  group,
  onSelectItem,
  selectedItemId,
}: {
  group: AgentQueueGroup;
  onSelectItem: (itemId: AgentQueuePreviewItemId) => void;
  selectedItemId: AgentQueuePreviewItemId;
}) {
  return (
    <section
      className={`agent-queue-group agent-queue-group-${group.badgeVariant}`}
    >
      <div className="agent-queue-section-header">
        <div className="agent-queue-group-copy">
          <h3 className="agent-queue-section-title">{group.title}</h3>
          <p className="agent-queue-section-text">{group.description}</p>
        </div>
        <Badge variant={group.badgeVariant}>{group.badgeLabel}</Badge>
      </div>

      <div className="agent-queue-card-list">
        {group.items.map((item) => (
          <QueueItemCard
            groupVariant={group.badgeVariant}
            isSelected={item.id === selectedItemId}
            item={item}
            key={item.id}
            onSelectItem={onSelectItem}
          />
        ))}
      </div>
    </section>
  );
}

function QueueItemCard({
  groupVariant,
  isSelected,
  item,
  onSelectItem,
}: {
  groupVariant: AgentQueueGroup["badgeVariant"];
  isSelected: boolean;
  item: AgentQueuePreviewItem;
  onSelectItem: (itemId: AgentQueuePreviewItemId) => void;
}) {
  const cardClassName = `agent-queue-item-card agent-queue-item-card-${groupVariant}${
    isSelected ? " agent-queue-item-card-selected" : ""
  }`;

  function selectItem() {
    onSelectItem(item.id);
  }

  function selectItemWithKeyboard(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    selectItem();
  }

  return (
    <article
      aria-label={`Show static detail for ${item.block}: ${item.title}`}
      aria-pressed={isSelected}
      className={cardClassName}
      onClick={selectItem}
      onKeyDown={selectItemWithKeyboard}
      role="button"
      tabIndex={0}
    >
      <div className="agent-queue-item-header">
        <div className="agent-queue-item-title-copy">
          <p className="agent-queue-item-block">{item.block}</p>
          <h4 className="agent-queue-item-title">{item.title}</h4>
        </div>
        <Badge variant={item.status.variant}>{item.status.label}</Badge>
      </div>

      <StaticPreviewFieldList
        className="agent-queue-card-signals"
        fieldClassName="agent-queue-card-signal"
        fields={[
          { label: "Validation", value: item.validation },
          { label: "Git", value: item.git },
          { label: "Next", value: item.decision.label },
        ]}
        labelClassName="agent-queue-card-label"
        valueClassName="agent-queue-card-value"
      />
    </article>
  );
}

function QueueDetailSection({
  actions,
  emphasis,
  fields,
  title,
}: {
  actions?: AgentQueuePlannedAction[];
  emphasis: "primary" | "secondary";
  fields: AgentQueueDetailField[];
  title: string;
}) {
  return (
    <section
      className={`agent-queue-detail-section agent-queue-detail-section-${emphasis}`}
    >
      <h4 className="agent-queue-item-title">{title}</h4>
      <StaticPreviewFieldList
        className="agent-queue-item-grid"
        fieldClassName="agent-queue-card-field"
        fields={fields}
        labelClassName="agent-queue-card-label"
        valueClassName="agent-queue-card-value"
      />
      {actions ? (
        <StaticPreviewPlannedActions
          actions={actions}
          className="agent-queue-action-row"
        />
      ) : null}
    </section>
  );
}
