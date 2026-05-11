import { Badge } from "../design-system/Badge";
import {
  StaticPreviewFieldList,
  StaticPreviewPlannedActions,
} from "./StaticPreviewPrimitives";

type AgentRunResultField = {
  label: string;
  value: string;
};

type AgentRunPlannedAction = {
  label: string;
};

export function AgentRunSummarySection({
  badgeLabel,
  text,
  title,
}: {
  badgeLabel: string;
  text: string;
  title: string;
}) {
  return (
    <section className="agent-run-summary">
      <div className="agent-run-summary-copy">
        <p className="agent-run-summary-title">{title}</p>
        <p className="agent-run-summary-text">{text}</p>
      </div>
      <Badge variant="neutral">{badgeLabel}</Badge>
    </section>
  );
}

export function AgentRunOverviewPreview({ steps }: { steps: readonly string[] }) {
  return (
    <section className="agent-run-view agent-run-overview">
      <AgentRunPreviewHeader
        badgeLabel="Planned"
        text="Operator-friendly logical steps. Static preview only."
        title="Overview Log"
      />
      <ol className="agent-run-overview-list">
        {steps.map((step) => (
          <li className="agent-run-overview-step" key={step}>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AgentRunResultReportPreview({
  fields,
}: {
  fields: readonly AgentRunResultField[];
}) {
  return (
    <section className="agent-run-view agent-run-result">
      <AgentRunPreviewHeader
        badgeLabel="Planned"
        text="Final acceptance artifact shaped by the future Response Template."
        title="Result Report"
      />
      <StaticPreviewFieldList
        className="agent-run-result-grid"
        fieldClassName="agent-run-result-field"
        fields={fields}
        labelClassName="agent-run-result-label"
        valueClassName="agent-run-result-value"
      />
    </section>
  );
}

export function AgentRunRawLogPreview({
  placeholder,
  sample,
}: {
  placeholder: string;
  sample: string;
}) {
  return (
    <section className="agent-run-view agent-run-raw">
      <AgentRunPreviewHeader
        badgeLabel="Planned"
        text="Debug and audit trace. No live output is attached."
        title="Raw Log"
      />
      <div className="agent-run-raw-log" aria-label="Static Raw Log preview">
        <p className="agent-run-raw-placeholder">{placeholder}</p>
        <code className="agent-run-raw-sample">{sample}</code>
      </div>
    </section>
  );
}

export function AgentRunPlannedActions({
  actions,
}: {
  actions: readonly AgentRunPlannedAction[];
}) {
  return (
    <StaticPreviewPlannedActions
      actions={actions}
      aria-label="Planned Agent Monitoring actions"
      className="agent-run-actions"
    />
  );
}

function AgentRunPreviewHeader({
  badgeLabel,
  text,
  title,
}: {
  badgeLabel: string;
  text: string;
  title: string;
}) {
  return (
    <div className="agent-run-view-header">
      <div className="agent-run-view-copy">
        <h3 className="agent-run-view-title">{title}</h3>
        <p className="agent-run-view-text">{text}</p>
      </div>
      <Badge variant="neutral">{badgeLabel}</Badge>
    </div>
  );
}
