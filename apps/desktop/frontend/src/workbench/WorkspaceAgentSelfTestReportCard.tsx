import { Badge } from "../design-system/Badge";
import type {
  HobitAgentSelfTestReportRowStatus,
  HobitAgentSelfTestReportViewModel,
} from "./agents/selfTest";

export function WorkspaceAgentSelfTestReportCard({
  report,
}: {
  report: HobitAgentSelfTestReportViewModel;
}) {
  return (
    <section
      aria-label="Agent Self-Test Report"
      className={`workspace-agent-self-test-card workspace-agent-self-test-card-${report.overallStatus}`}
    >
      <div className="workspace-agent-self-test-header">
        <div className="workspace-agent-self-test-title-copy">
          <p className="workspace-agent-self-test-kicker">
            Agent Self-Test Report
          </p>
          <h3 className="workspace-agent-self-test-title">
            Agent-executed Smoke Report
          </h3>
        </div>
        <Badge variant={badgeVariantForStatus(report.overallStatus)}>
          {report.overallStatusLabel}
        </Badge>
      </div>

      <p className="workspace-agent-self-test-summary-text">
        {report.productSummary}
      </p>

      <dl
        aria-label="Agent self-test summary counts"
        className="workspace-agent-self-test-summary"
      >
        <SummaryCount label="Passed" value={report.summary.passed} />
        <SummaryCount label="Failed" value={report.summary.failed} />
        <SummaryCount label="Skipped" value={report.summary.skipped} />
        <SummaryCount label="Blocked" value={report.summary.blocked} />
      </dl>

      <div
        aria-label="Hidden side-effect assertions"
        className="workspace-agent-self-test-hidden-effects"
      >
        <Badge variant="success">{report.hiddenSideEffectSummary}</Badge>
        {report.hiddenSideEffectAssertions.map((assertion) => (
          <span
            className="workspace-agent-self-test-hidden-effect"
            key={assertion.assertionId}
          >
            {assertion.label}
          </span>
        ))}
      </div>

      <div className="workspace-agent-self-test-rows" role="list">
        {report.rows.map((row) => (
          <article
            className={`workspace-agent-self-test-row workspace-agent-self-test-row-${row.status}`}
            key={row.checkId}
            role="listitem"
          >
            <div className="workspace-agent-self-test-row-header">
              <Badge variant={badgeVariantForStatus(row.status)}>
                {row.statusLabel}
              </Badge>
              <strong className="workspace-agent-self-test-row-title">
                {row.title}
              </strong>
            </div>
            <dl className="workspace-agent-self-test-row-meta">
              {row.capabilityId ? (
                <div>
                  <dt>Capability</dt>
                  <dd>{row.capabilityId}</dd>
                </div>
              ) : null}
              {row.widgetId ? (
                <div>
                  <dt>Widget</dt>
                  <dd>{row.widgetId}</dd>
                </div>
              ) : null}
              {row.component ? (
                <div>
                  <dt>Component</dt>
                  <dd>{row.component}</dd>
                </div>
              ) : null}
              <div>
                <dt>Source</dt>
                <dd>{row.source}</dd>
              </div>
            </dl>
            <p className="workspace-agent-self-test-row-message">
              {row.message}
            </p>
            {row.reason ? (
              <p className="workspace-agent-self-test-row-reason">
                {row.reason}
              </p>
            ) : null}
            {row.hiddenSideEffectAssertions.length > 0 ? (
              <p className="workspace-agent-self-test-row-assertions">
                Hidden side-effect assertions:{" "}
                {row.hiddenSideEffectAssertions.join(", ")}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value.toString()}</dd>
    </div>
  );
}

function badgeVariantForStatus(status: HobitAgentSelfTestReportRowStatus) {
  if (status === "passed") {
    return "success";
  }

  if (status === "failed") {
    return "error";
  }

  if (status === "blocked") {
    return "warning";
  }

  return "neutral";
}
