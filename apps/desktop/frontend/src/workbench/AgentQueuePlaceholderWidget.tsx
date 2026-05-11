import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";

type QueueItemPreview = {
  block: string;
  decision: string;
  git: string;
  responseTemplate: string;
  run: string;
  status: string;
  statusVariant: BadgeVariant;
  title: string;
  validation: string;
  requestTemplate: string;
};

type QueueGroupPreview = {
  badgeLabel: string;
  badgeVariant: BadgeVariant;
  description: string;
  items: QueueItemPreview[];
  title: string;
};

const queueGroups: QueueGroupPreview[] = [
  {
    badgeLabel: "1",
    badgeVariant: "warning",
    description:
      "Completed block previews that require explicit operator review before acceptance.",
    title: "Needs review",
    items: [
      {
        block: "Block 72",
        decision: "Review Git / Accept planned",
        git: "3 changed files",
        requestTemplate: "Codex implementation block",
        responseTemplate: "Implementation result",
        run: "Result Report planned",
        status: "Needs review",
        statusVariant: "warning",
        title: "Git read-only polish",
        validation: "Passed",
      },
    ],
  },
  {
    badgeLabel: "1",
    badgeVariant: "info",
    description:
      "Queued or running block previews. No executor is connected in this placeholder.",
    title: "Running / queued",
    items: [
      {
        block: "Block 73",
        decision: "Open run planned",
        git: "Not linked",
        requestTemplate: "Planning block",
        responseTemplate: "Plan result",
        run: "Overview log planned",
        status: "Running planned",
        statusVariant: "info",
        title: "Notebook tabs plan",
        validation: "Not run",
      },
    ],
  },
  {
    badgeLabel: "1",
    badgeVariant: "error",
    description:
      "Blocked previews keep failed validation and missing context visible.",
    title: "Failed / blocked",
    items: [
      {
        block: "Block 74",
        decision: "Needs fix planned",
        git: "Dirty state visible planned",
        requestTemplate: "Parser implementation block",
        responseTemplate: "Implementation result",
        run: "Raw Log planned",
        status: "Blocked planned",
        statusVariant: "error",
        title: "Template response parser",
        validation: "Failed placeholder",
      },
    ],
  },
  {
    badgeLabel: "1",
    badgeVariant: "success",
    description:
      "Accepted previews show completed review state without implying auto-acceptance.",
    title: "Accepted / completed",
    items: [
      {
        block: "Block 70",
        decision: "Accepted by operator planned",
        git: "Clean after commit",
        requestTemplate: "Docs-only block",
        responseTemplate: "Implementation result",
        run: "Result Report archived planned",
        status: "Accepted planned",
        statusVariant: "success",
        title: "Agent Queue contract",
        validation: "Passed",
      },
    ],
  },
];

const synergyItems = [
  {
    label: "Template Library",
    value: "Provides Request and Response Template references.",
  },
  {
    label: "Agent Run",
    value: "Provides Overview Log, Result Report, and Raw Log views.",
  },
  {
    label: "Git Widget",
    value: "Provides repository state, changed files, and push reminders.",
  },
  {
    label: "Notes / Notebook",
    value: "Captures review notes, assumptions, and follow-up rationale.",
  },
  {
    label: "Workspace Activity",
    value: "Records queue lifecycle events when future storage exists.",
  },
];

const plannedActions = [
  "Open request planned",
  "Open run planned",
  "Review Git planned",
  "Accept planned",
  "Needs fix planned",
  "Rerun planned",
  "Create follow-up planned",
];

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
            <p className="agent-queue-summary-title">Agent Queue</p>
            <p className="agent-queue-summary-text">
              Static preview of a future operator-controlled queue and review
              inbox for agent blocks. Queue storage, automatic execution,
              response capture, validation, Git association, and automatic
              acceptance are not implemented.
            </p>
          </div>
          <Badge variant="neutral">Static preview</Badge>
        </section>

        <section className="agent-queue-overview" aria-label="Queue overview">
          <div className="agent-queue-overview-copy">
            <h3 className="agent-queue-section-title">Queue overview</h3>
            <p className="agent-queue-section-text">
              Future queue cards are review units, not simple TODO items. Each
              item keeps the request, response expectation, run observability,
              validation state, Git review, notes, artifacts, and operator
              decision visible.
            </p>
          </div>
          <div className="agent-queue-overview-metrics">
            <QueueMetric label="Needs review" value="1 static" />
            <QueueMetric label="Running / queued" value="1 static" />
            <QueueMetric label="Failed / blocked" value="1 static" />
            <QueueMetric label="Accepted" value="1 static" />
          </div>
        </section>

        <div
          aria-label="Static Agent Queue groups"
          className="agent-queue-groups"
        >
          {queueGroups.map((group) => (
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
            {synergyItems.map((item) => (
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
          {plannedActions.map((action) => (
            <Button disabled key={action} variant="secondary">
              {action}
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

function QueueGroup({ group }: { group: QueueGroupPreview }) {
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

function QueueItemCard({ item }: { item: QueueItemPreview }) {
  return (
    <article className="agent-queue-item-card">
      <div className="agent-queue-item-header">
        <div className="agent-queue-item-title-copy">
          <p className="agent-queue-item-block">{item.block}</p>
          <h4 className="agent-queue-item-title">{item.title}</h4>
        </div>
        <Badge variant={item.statusVariant}>{item.status}</Badge>
      </div>

      <dl className="agent-queue-item-grid">
        <QueueCardField label="Request" value={item.requestTemplate} />
        <QueueCardField label="Response" value={item.responseTemplate} />
        <QueueCardField label="Run" value={item.run} />
        <QueueCardField label="Validation" value={item.validation} />
        <QueueCardField label="Git" value={item.git} />
        <QueueCardField label="Decision" value={item.decision} />
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
