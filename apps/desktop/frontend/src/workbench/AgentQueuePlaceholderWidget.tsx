import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  agentQueuePreview,
  type AgentQueueGroup,
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
      subtitle="Static queue and review inbox preview"
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
          <Badge variant="neutral">
            {agentQueuePreview.summary.badgeLabel}
          </Badge>
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
          <div className="agent-queue-overview-metrics">
            {agentQueuePreview.overview.metrics.map((metric) => (
              <QueueMetric
                key={metric.label}
                label={metric.label}
                value={metric.value}
              />
            ))}
          </div>
        </section>

        <div
          aria-label="Static Agent Queue groups"
          className="agent-queue-groups"
        >
          {agentQueuePreview.groups.map((group) => (
            <QueueGroup group={group} key={group.title} />
          ))}
        </div>

        <section
          aria-label="Future Agent Queue widget synergy"
          className="agent-queue-synergy"
        >
          <div className="agent-queue-section-header">
            <h3 className="agent-queue-section-title">Linked work surfaces</h3>
            <Badge variant="neutral">Planned</Badge>
          </div>
          <dl className="agent-queue-synergy-list">
            {agentQueuePreview.linkedSurfaces.map((item) => (
              <div className="agent-queue-synergy-item" key={item.label}>
                <dt className="agent-queue-card-label">{item.label}</dt>
                <dd className="agent-queue-card-value">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div
          aria-label="Planned Agent Queue actions"
          className="agent-queue-action-row"
        >
          {agentQueuePreview.plannedActions.map((action) => (
            <Button disabled key={action.label} variant="secondary">
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </WidgetFrame>
  );
}

function QueueMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="agent-queue-metric">
      <span className="agent-queue-card-label">{label}</span>
      <span className="agent-queue-card-value">{value}</span>
    </div>
  );
}

function QueueGroup({ group }: { group: AgentQueueGroup }) {
  return (
    <section className="agent-queue-group">
      <div className="agent-queue-section-header">
        <div className="agent-queue-group-copy">
          <h3 className="agent-queue-section-title">{group.title}</h3>
          <p className="agent-queue-section-text">{group.description}</p>
        </div>
        <Badge variant={group.badgeVariant}>{group.badgeLabel}</Badge>
      </div>

      <div className="agent-queue-card-list">
        {group.items.map((item) => (
          <QueueItemCard item={item} key={`${item.block}-${item.title}`} />
        ))}
      </div>
    </section>
  );
}

function QueueItemCard({ item }: { item: AgentQueuePreviewItem }) {
  return (
    <article className="agent-queue-item-card">
      <div className="agent-queue-item-header">
        <div className="agent-queue-item-title-copy">
          <p className="agent-queue-item-block">{item.block}</p>
          <h4 className="agent-queue-item-title">{item.title}</h4>
        </div>
        <Badge variant={item.status.variant}>{item.status.label}</Badge>
      </div>

      <dl className="agent-queue-item-grid">
        <QueueCardField label="Request" value={item.requestTemplate} />
        <QueueCardField label="Response" value={item.responseTemplate} />
        <QueueCardField label="Run" value={item.run} />
        <QueueCardField label="Validation" value={item.validation} />
        <QueueCardField label="Git" value={item.git} />
        <QueueCardField label="Decision" value={item.decision.label} />
      </dl>
    </article>
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
