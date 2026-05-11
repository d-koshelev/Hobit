import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  agentQueuePreview,
  type AgentQueueDetailField,
  type AgentQueueGroup,
  type AgentQueueOverviewMetric,
  type AgentQueueItemDetailPreview,
  type AgentQueuePlannedAction,
  type AgentQueuePreviewItem,
} from "./agentQueuePreview";
import type { WidgetRenderProps } from "./types";

export function AgentQueuePlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="neutral">Placeholder</Badge>}
      title={title}
    >
      <div className="agent-queue-placeholder">
        <section className="agent-queue-summary">
          <div className="agent-queue-summary-copy">
            <p className="agent-queue-summary-title">
              {agentQueuePreview.summary.title}
            </p>
            <p className="agent-queue-summary-text">
              {agentQueuePreview.summary.text}
            </p>
          </div>
          <div className="agent-queue-summary-badges">
            <Badge variant="neutral">
              {agentQueuePreview.summary.badgeLabel}
            </Badge>
            <Badge variant="neutral">No execution</Badge>
          </div>
        </section>

        <section
          className="agent-queue-overview"
          aria-label={agentQueuePreview.overview.ariaLabel}
        >
          <div className="agent-queue-overview-copy">
            <h3 className="agent-queue-section-title">
              {agentQueuePreview.overview.title}
            </h3>
            <p className="agent-queue-section-text">
              {agentQueuePreview.overview.text}
            </p>
          </div>
          <dl className="agent-queue-overview-metrics">
            {agentQueuePreview.overview.metrics.map((metric) => (
              <QueueMetric
                key={metric.label}
                metric={metric}
              />
            ))}
          </dl>
        </section>

        <div
          aria-label="Static Agent Queue groups"
          className="agent-queue-groups"
        >
          {agentQueuePreview.groups.map((group) => (
            <QueueGroup group={group} key={group.title} />
          ))}
        </div>

        <QueueItemDetailPreview preview={agentQueuePreview.detailPreview} />

        <section
          aria-label="Future Agent Queue widget synergy"
          className="agent-queue-linked-surfaces"
        >
          <div className="agent-queue-section-header">
            <h3 className="agent-queue-section-title">Linked work surfaces</h3>
            <Badge variant="neutral">Planned</Badge>
          </div>
          <dl className="agent-queue-linked-surface-list">
            {agentQueuePreview.linkedSurfaces.map((item) => (
              <div className="agent-queue-linked-surface" key={item.label}>
                <dt className="agent-queue-card-label">{item.label}</dt>
                <dd className="agent-queue-card-value">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </WidgetFrame>
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

function QueueGroup({ group }: { group: AgentQueueGroup }) {
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
            item={item}
            key={`${item.block}-${item.title}`}
          />
        ))}
      </div>
    </section>
  );
}

function QueueItemCard({
  groupVariant,
  item,
}: {
  groupVariant: AgentQueueGroup["badgeVariant"];
  item: AgentQueuePreviewItem;
}) {
  return (
    <article
      className={`agent-queue-item-card agent-queue-item-card-${groupVariant}`}
    >
      <div className="agent-queue-item-header">
        <div className="agent-queue-item-title-copy">
          <p className="agent-queue-item-block">{item.block}</p>
          <h4 className="agent-queue-item-title">{item.title}</h4>
        </div>
        <Badge variant={item.status.variant}>{item.status.label}</Badge>
      </div>

      <dl className="agent-queue-card-signals">
        <QueueCardSignal label="Validation" value={item.validation} />
        <QueueCardSignal label="Git" value={item.git} />
        <QueueCardSignal label="Next" value={item.decision.label} />
      </dl>
    </article>
  );
}

function QueueItemDetailPreview({
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
      <dl className="agent-queue-item-grid">
        {fields.map((field) => (
          <QueueCardField
            key={field.label}
            label={field.label}
            value={field.value}
          />
        ))}
      </dl>
      {actions ? (
        <div className="agent-queue-action-row">
          {actions.map((action) => (
            <Button disabled key={action.label} variant="secondary">
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function QueueCardSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="agent-queue-card-signal">
      <dt className="agent-queue-card-label">{label}</dt>
      <dd className="agent-queue-card-value">{value}</dd>
    </div>
  );
}

function QueueCardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="agent-queue-card-field">
      <dt className="agent-queue-card-label">{label}</dt>
      <dd className="agent-queue-card-value">{value}</dd>
    </div>
  );
}
